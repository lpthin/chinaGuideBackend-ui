import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { probeUser, provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J08 可分析：人工浏览 PV / UV / 停留 / 热门页，且爬虫抓取不混进 PV（判据 G-10）
 *
 * spec §5 J-08：埋点 → page_view_log → /api/analytics/{overview,pages,trend,bot} 三段全走，
 * 断言「真人 5 次浏览 = 报表 5，且 AI 爬虫抓 /llms.txt 的计数不混进这 5」。出处按 file:line 摘：
 *   采集口 `POST /api/portal/public/track`（PortalPublicController.java:210-216）——
 *     回体永远 ok，不管这一条收没收（`trackFromVisitor` 返回 false 也不告诉探测者哪条被拒）；
 *     入参白名单只有 path/eventType/durationMs/sessionId 四个键（TrackRequest.java）
 *   落库前四道过滤（PortalTrackingService.trackFromVisitor:105-124）：
 *     ①path 必须命中 ALLOWED_PATHS（:73-79，带 scheme/查询串/后台路径一律不收）
 *     ②单机限流 5 事件/秒（:86-87、:268-274，键 = clientAddress|UA）
 *     ③站点解析 + evaluatePublicSurface（候选站不收）
 *     ④带有效预览令牌整条不收（:158-164）
 *   隐私：IP 只进 visitor_hash 单向散列，ip_address 列不再写入（:38 那段理由 + :276-280）；
 *     visitor_hash 带当天日期盐 ⇒ 同一个人跨天不可反推
 *   写库是异步的：PageViewLogWriter.write 带 @Async("portalTrackTaskExecutor") ⇒ 断言前必须轮询数据库
 *   读取层四条硬规则（AnalyticsQueryService.java:50-190）：必须带租户（少一个 eq(tenant_id) 就是串数据）、
 *     默认 is_demo=0、人工浏览与抓取两套谓词不相加、区间最长 366 天
 *   UA 分档（UserAgentClassifier.classify:37-58）：词表在 resources/config/bot-ua.yml；
 *     空 UA = unknown，有 UA 但不认识 = human，isBot 只认真正的爬虫（:61-66）
 *   权限：/api/analytics/* 四个口都是 @RequirePermission("analytics:view")（AnalyticsController.java:33-70）
 *
 * 两处形状要在这里现场判掉（判红就照实记红）：
 *   A. 「热门」这一维：报表只到 page_url 粒度（pages 的 group by），没有任何按栏目/分类聚合的出口。
 *      Q-P4a 拍板 (a) = 栏目这一维不做，判据措辞换成页面粒度 ⇒ 第 12 节量的是「出不出得到热门页」，
 *      栏目维的现状（三个候选口的回话 + JSON 里有没有 category/section 键）仍照实记进证据。
 *   B. 后台文章详情那个 viewCount（Q-P4b 拍板 (a)：只修读取侧，采集侧不动）。修之前它按
 *      page_view_log.article_id 数（旧实现在 ArticleController.humanViewCounts），而采集侧只在路径
 *      第三段是纯数字时才落这一列（PortalTrackingService.articleIdOf:256），且那份 wrapper 没有
 *      eq(tenant_id)（page_view_log 不在租户自动过滤清单里，见 AnalyticsQueryService.java:27-29
 *      那段自述）⇒ 三处坏在同一行读取上。现在改认 page_url + 带这一行自己的租户，
 *      地址取自 PortalUrls.articleUrlVariants ⇒ 与 sitemap / llms.txt 同一真相源。
 *      库里的地址有两种真实写法：跟 sitemap 点进来的浏览器报百分号编码那一串（现网 2026-09-24
 *      租户 15 那批行就是编码形状），直接把中文当路径报上来的客户端报原文档。两种都是这一篇被
 *      打开过一次 ⇒ 读侧两档一起认。第 13 节两种各发一发对账：编码 3 + 未编码 1 ⇒ 卡片 4。
 *
 * 真花钱：1 次生成（不带 targetLocales）。
 */

interface GenStatus {
  status?: string;
  progress?: number;
  stage?: string;
  articleId?: number | null;
  errorMessage?: string | null;
}

const TERMINAL = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'CONTENT_REJECTED'];

async function waitTask(api: Api, j: Journal, taskId: number, budgetMs: number): Promise<GenStatus> {
  const started = Date.now();
  let last: GenStatus = {};
  while (Date.now() - started < budgetMs) {
    await new Promise(r => setTimeout(r, 5_000));
    const res = await api.get(`/api/workspace/articles/generate/${taskId}/status`);
    last = (res.data ?? {}) as GenStatus;
    j.note(`任务 ${taskId} 轮询 +${Math.round((Date.now() - started) / 1000)}s`,
      { status: last.status, stage: last.stage, progress: last.progress, articleId: last.articleId });
    if (last.status && TERMINAL.includes(last.status)) return last;
  }
  throw new Error(`任务 ${taskId} 在 ${budgetMs / 1000}s 内没到终态，最后状态=${JSON.stringify(last)}`);
}

/** 埋点上报回的是 ApiResponse<Void>，不是 envelope 里带 data 那种，直接原样发并留证 */
interface TrackResult { status: number; code: string }

async function track(j: Journal, site: string, body: Record<string, unknown>,
  userAgent: string, forwardedFor?: string): Promise<TrackResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': userAgent };
  if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor;
  const started = Date.now();
  const resp = await fetch(`${env.apiBase}/api/portal/public/track?site=${site}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const text = await resp.text();
  let code = '';
  try {
    code = String((JSON.parse(text) as Record<string, unknown>).code ?? '');
  } catch {
    code = `<非 JSON：${text.slice(0, 60)}>`;
  }
  j.record('track', 'POST /api/portal/public/track', {
    site, body, userAgent, forwardedFor: forwardedFor ?? null,
    status: resp.status, code, ms: Date.now() - started,
  });
  return { status: resp.status, code };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** 浏览器 UA（分档结果是 human），以及两档爬虫 UA */
const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_GPTBOT = 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)';
const UA_GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

interface PvRow {
  page_url: string; event_type: string; bot_category: string; duration_ms: number | null;
  article_id: number | null; page_type: string; device_type: string; visitor_hash: string | null;
  ip_address: string | null;
}

/** 轮询等异步写库：page_view_log 落行是 @Async 的，等不到就照实报等不到 */
async function waitRows(db: Db, tenantId: number, atLeast: number, budgetMs = 30_000): Promise<number> {
  const started = Date.now();
  let n = -1;
  while (Date.now() - started < budgetMs) {
    n = await db.count('SELECT COUNT(*) AS n FROM page_view_log WHERE tenant_id = ? AND del_flag = \'0\'', [tenantId]);
    if (n >= atLeast) return n;
    await sleep(1_000);
  }
  return n;
}

/**
 * 等「行数不再变」而不是等固定秒数。
 * 采集是 @Async 的，上一批的最后几行可能还在路上；拿一个还没稳的基数去比「一行不多」，
 * 测出来的会是「非法输入收了 5 条」这种假红（第一轮就是这么红的）。
 */
async function settleCount(db: Db, tenantId: number, budgetMs = 20_000): Promise<number> {
  const started = Date.now();
  let prev = -1;
  while (Date.now() - started < budgetMs) {
    await sleep(1_500);
    const now = await db.count('SELECT COUNT(*) AS n FROM page_view_log WHERE tenant_id = ?', [tenantId]);
    if (now === prev) return now;
    prev = now;
  }
  return prev;
}

test('SYS-J08 可分析：真人浏览进报表、爬虫抓取不混进 PV、热门页与后台那格浏览量同源对账', async () => {
  test.info().setTimeout(900_000);
  const j = new Journal('SYS-J08');
  const db = new Db(j);
  const tag = process.env.E2E_J08_TAG ?? `J08${Date.now()}`;

  let A: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let B: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let articleId = 0;
  let slug = '';

  try {
    j.card({
      用例号: 'SYS-J08-01',
      判据: 'G-10（PV/热门/停留，且爬虫不混进 PV）',
      层级: 'API',
      前置: `后端 ${env.apiBase}（dev：allow-site-param=true ⇒ 埋点用 ?site= 认站）；`
        + '探针租户 A 有一篇已发布中文文章（真实 slug 地址），B 只用来做跨租户那一条；'
        + '限流 5 事件/秒：本用例每一批之间都 sleep >1.1s，同一批不超 4 发，只有「限流」那一节故意发 8 连',
      步骤: [
        '1 开 A/B 两家；A 生成一篇 → 提审 → 通过 → 发布，拿到真人打得开的那条对外地址（中文 slug 百分号编码后的 /news/{slug}）',
        '2 埋点：4 发 pageview（两个访客：XFF 不同）+ 1 发 duration(4200ms) + 1 发 duration(800ms)，UA 都是浏览器档',
        '3 轮询 page_view_log 等到行落下来，逐行核 bot_category=human / duration_ms / visitor_hash 非空 / ip_address 全空',
        '4 GET /api/analytics/overview：pageviews=4、uniqueVisitors=2、durationEvents=2、avgDurationMs=2500',
        '5 GET /api/analytics/pages：热门页第一名就是那条编码后的文章地址，count 与 visitors 与第 2 步一致',
        '6 GET /api/analytics/trend：今天那一点 pageviews/durationEvents 分列，botHits 先为 0',
        '7 爬虫抓取：GPTBot 抓 /llms.txt + /robots.txt、Googlebot 抓 /api/portal/public/articles ⇒ /bot 口出 ai-crawler 与 search-engine 两片，且 overview.pageviews 一个都没涨',
        '8 限流：同一访客 8 连发 ⇒ 落库只多 5 行（回话仍然 8 个 ok）',
        '9 反例·静默丢弃：非法 path（带 scheme、带查询串、后台路径 /api/admin/users）、未知 eventType、假站码 各一发 —— 回话都是 ok，库里一行不多',
        '10 反例·权限：CONTENT_EDITOR 档四个口逐个（没有 analytics:view 就是 403）；不带 token = 401；超管平台档不带 tenantId = TENANT_REQUIRED',
        '11 反例·隔离：B 家管理员看自己的 overview = 0（A 家的流量一条都不过去）',
        '12 ★G-10 的「热门」按 Q-P4a(a) 的口径量：报表出不出得到页面粒度的热门行（page_url + 计数 + 独立访客）；栏目聚合按拍板不做，只把现状记进证据',
        '13 ★后台那篇文章的 viewCount 与真实浏览对账（Q-P4b(a) 修读取侧之后）：编码那发要让它等于报表的 3；再补发一发未编码地址，收了但不许进卡片',
        '14 ★案例地址与别家租户都不许改这个数字：track /cases/{A 家文章 id} 之后 viewCount 仍是 3；同一行借 B 家站点再发一发，A 家那篇的数字仍然不动',
      ],
      期望: [
        '步骤 4：报表数字与埋点动作逐一对得上，且 avgDurationMs 是两条 duration 事件的算术平均（4200+800)/2=2500',
        '步骤 7：AI 抓取量与人工浏览量是两个互不加总的数（G-10 后半句「爬虫不混进 PV」）',
        '步骤 9：埋点是免鉴权端点 ⇒ 非法输入必须静默丢弃而不是「收下来再说」',
        '步骤 3：隐私那一列 ip_address 恒空，只有单向散列 visitor_hash',
        '步骤 13：后台那格浏览量与门户报表同一口径（真人 pageview、非演示、带这一行的租户），报表 3 ⇒ 卡片 3；这一篇的两种地址写法都算数',
        '步骤 14：案例页的访问与别家租户的访问都不许把这篇的浏览量改大（读取侧既不认 article_id 那一列，也带着这一行自己的租户）',
      ],
      反例: [
        '越权读别家报表（CONTENT_EDITOR / 无 token / 平台档不带租户号）',
        '把爬虫抓取算进人工浏览 PV',
        '非法 path 被当成任意 URL 存储点（带 scheme/查询串/后台路径）',
        '候选站或预览令牌的浏览被计入租户真实流量（§2.6）',
        'A 家流量出现在 B 家报表里',
        '案例页的访问按同号给文章刷浏览量（采集侧把 case id 写进 article_id 那一列）',
        '别家租户在同一条地址上的浏览算进这篇文章的后台卡片（page_view_log 无自动租户过滤）',
      ],
      收尾: 'A/B 走 DELETE /api/admin/tenants/{id} 软删；page_view_log 是追加型的日志表，'
        + '没有随租户删除的链路 ⇒ 本轮给它写的行会留在库里，按租户号单独清点并报数（不藏着）',
    });

    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    A = await provisionTenant(sa.api, db, j, tag);
    B = await provisionTenant(sa.api, db, j, `${tag}B`);
    const admin = A.admin;
    j.note('两家探针租户', {
      A: { tenantId: A.tenantId, siteId: A.siteId, siteCode: A.siteCode },
      B: { tenantId: B.tenantId, siteCode: B.siteCode },
    });

    // ── 1 一篇真的能被读者打开的文章 ──────────────────────────────────────
    const gen = await admin.post('/api/workspace/articles/generate-async', {
      keyword: '儿童近视防控有哪些方法，家长应该怎么配合',
    });
    j.expect('提交生成回 OK', gen.code, 'OK');
    const taskId = Number((gen.data as Record<string, unknown>)?.taskId ?? 0);
    j.check('拿到 taskId', taskId, taskId > 0);
    const done = await waitTask(admin, j, taskId, 420_000);
    j.expect('任务终态 = COMPLETED', done.status, 'COMPLETED');
    articleId = Number(done.articleId ?? 0);
    j.check('COMPLETED 带出 articleId', articleId, articleId > 0);
    const submitted = await admin.post(`/api/workspace/articles/${articleId}/submit-review`);
    j.expect('提审回 OK', submitted.code, 'OK');
    const approved = await admin.post(`/api/workspace/reviews/${articleId}/approve`, { comment: 'SYS-J08 可分析探针，可以发' });
    j.expect('审核通过回 OK', approved.code, 'OK');
    const published = await admin.post(`/api/workspace/publish/${articleId}`);
    j.expect('发布回 OK', published.code, 'OK');
    const art = await db.rows<{ slug: string; status: string }>(
      `SELECT slug, status FROM article WHERE id = ?`, [articleId]);
    slug = String(art[0]?.slug ?? '');
    j.expect('库里这一篇是 published 且有 slug（读者地址就靠它）', [art[0]?.status, slug !== ''], ['published', true]);
    // 浏览器上报的就是这一份：PortalUrls.article 把中文 slug 百分号编码后才对外发布，现网真人那批行
    // （2026-09-24，租户 15）在库里就是编码形状 ⇒ 埋点照这个形状发才等于真人。未编码的
    // `/news/${slug}` 是手写探测的形状，会在库里落成另一行，第 13 节两种各发一发对账。
    const articleUrl = `/news/${encodeURIComponent(slug)}`;
    // 读者真的点得到这一页：公开详情口回 OK，这一发是「埋点报的那个地址不是我自己编的」的对账
    const detail = await Api.anonymous(env.apiBase, j).get(`/api/portal/public/articles/${articleId}?site=${A.siteCode}`);
    j.expect('公开详情口读得到这一篇（埋点的地址是真实存在的页面）', detail.code, 'OK');

    // ── 2 埋点：4 发 pageview（两个访客）+ 2 发 duration ───────────────────
    const xff1 = '203.0.113.11';
    const xff2 = '203.0.113.22';
    const sess1 = `j08s1${tag.slice(-6)}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    const sess2 = `j08s2${tag.slice(-6)}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    const trackCalls = [
      { path: articleUrl, ua: UA_BROWSER, xff: xff1, session: sess1, eventType: 'pageview', durationMs: undefined, who: '访客 1 打开文章' },
      { path: articleUrl, ua: UA_BROWSER, xff: xff1, session: sess1, eventType: 'pageview', durationMs: undefined, who: '访客 1 再开一次' },
      { path: '/news', ua: UA_BROWSER, xff: xff1, session: sess1, eventType: 'pageview', durationMs: undefined, who: '访客 1 看列表页' },
      { path: articleUrl, ua: UA_IPHONE, xff: xff2, session: sess2, eventType: 'pageview', durationMs: undefined, who: '访客 2（手机）打开文章' },
      { path: articleUrl, ua: UA_BROWSER, xff: xff1, session: sess1, eventType: 'duration', durationMs: 4200, who: '访客 1 停留 4.2s' },
      { path: articleUrl, ua: UA_IPHONE, xff: xff2, session: sess2, eventType: 'duration', durationMs: 800, who: '访客 2 停留 0.8s' },
    ];
    for (const call of trackCalls) {
      const res = await track(j, A.siteCode, {
        path: call.path, eventType: call.eventType, durationMs: call.durationMs, sessionId: call.session,
      }, call.ua, call.xff);
      j.check(`埋点回话一律 ok（${call.who}）`, res.code, res.code === 'OK');
      await sleep(250);
    }
    const landed = await waitRows(db, A.tenantId, 6);
    j.expect('六发全部异步落库（PageViewLogWriter 是 @Async，等到行出现为止）', landed, 6);

    // ── 3 库里逐行核 ─────────────────────────────────────────────────────
    const rows = await db.rows<PvRow>(
      `SELECT page_url, event_type, bot_category, duration_ms, article_id, page_type, device_type,
              visitor_hash, ip_address
       FROM page_view_log WHERE tenant_id = ? ORDER BY id`, [A.tenantId]);
    j.note('page_view_log 这一家的全部行（原样落进证据）', rows);
    j.expect('浏览器 UA 上报的都落成 human，一条 unknown 都没有',
      [...new Set(rows.map(r => r.bot_category))], ['human']);
    j.expect('page_type 按门户地址命名：文章页是 article，列表页是 list',
      [...new Set(rows.map(r => r.page_type).sort())], ['article', 'list']);
    j.expect('手机 UA 那两发（一次浏览 + 一次停留）都被认成 mobile（设备分布不是摆设）',
      rows.filter(r => r.device_type === 'mobile').length, 2);
    j.expect('duration 两行带着各自的毫秒数', rows.filter(r => r.event_type === 'duration')
      .map(r => r.duration_ms).sort((x, y) => Number(x) - Number(y)), [800, 4200]);
    j.expect('visitor_hash 每行都有值（UV 的口径靠它）',
      rows.filter(r => r.visitor_hash === null || r.visitor_hash === '').length, 0);
    j.expect('★隐私：ip_address 一行都没写（IP 只进单向散列）',
      rows.filter(r => r.ip_address !== null && r.ip_address !== '').length, 0);
    j.expect('is_demo=0 且两个访客的散列值不同（UV 数得出来）',
      await db.count(`SELECT COUNT(DISTINCT visitor_hash) AS n FROM page_view_log WHERE tenant_id = ?
                      AND event_type = 'pageview' AND bot_category = 'human'`, [A.tenantId]), 2);

    // ── 4 overview ───────────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const ov = await admin.get(`/api/analytics/overview?tenantId=${A.tenantId}&from=${today}&to=${today}`);
    j.expect('overview 回 OK', ov.code, 'OK');
    const ovData = (ov.data ?? {}) as Record<string, unknown>;
    j.note('overview 回体的全部键（判「热门栏目」那一维要用它）', Object.keys(ovData));
    j.expect('人工浏览 PV = 4（三次文章 + 一次列表，不含 duration 事件）', Number(ovData.pageviews), 4);
    j.expect('UV = 2（两个访客，各自 UA + IP 散列）', Number(ovData.uniqueVisitors), 2);
    j.expect('duration 事件数 = 2', Number(ovData.durationEvents), 2);
    j.expect('平均停留 = (4200+800)/2 = 2500ms', Number(ovData.avgDurationMs), 2500);
    j.expect('这一家有数据 ⇒ empty=false', ovData.empty, false);
    j.expect('报表认的就是这一家租户', Number(ovData.tenantId), A.tenantId);

    // ── 5 pages：热门页 ──────────────────────────────────────────────────
    const pages = await admin.get(`/api/analytics/pages?tenantId=${A.tenantId}&from=${today}&to=${today}&limit=10`);
    j.expect('pages 回 OK', pages.code, 'OK');
    const pageList = (((pages.data as Record<string, unknown>)?.pages ?? []) as Array<Record<string, unknown>>);
    j.note('pages 的每一行与它的全部键', { keys: Object.keys((pages.data ?? {}) as object), rows: pageList });
    j.expect('热门第一名就是读者真实打开的那篇文章页', String(pageList[0]?.pageUrl), articleUrl);
    j.expect('它的浏览数 = 3、访客数 = 2',
      [Number(pageList[0]?.count), Number(pageList[0]?.visitors)], [3, 2]);
    j.expect('列表页排第二（/news ⇒ page_type=list）',
      [String(pageList[1]?.pageUrl), String(pageList[1]?.pageType)], ['/news', 'list']);

    // ── 6 trend ──────────────────────────────────────────────────────────
    const trend = await admin.get(`/api/analytics/trend?tenantId=${A.tenantId}&from=${today}&to=${today}`);
    j.expect('trend 回 OK', trend.code, 'OK');
    const points = (((trend.data as Record<string, unknown>)?.points ?? []) as Array<Record<string, unknown>>);
    j.expect('只有一天有数据（区间就是今天）', points.length, 1);
    j.expect('今天：pageviews=4、visitors=2、抓取=0、AI 抓取=0（还没放爬虫）',
      [Number(points[0]?.pageviews), Number(points[0]?.uniqueVisitors), Number(points[0]?.botHits), Number(points[0]?.aiCrawlerHits)],
      [4, 2, 0, 0]);

    // ── 7 爬虫抓取不混进 PV ──────────────────────────────────────────────
    const anon = Api.anonymous(env.apiBase, j);
    const gpt = await anon.rawText(`/llms.txt?site=${A.siteCode}`, { 'User-Agent': UA_GPTBOT });
    const gptRobots = await anon.rawText(`/robots.txt?site=${A.siteCode}`, { 'User-Agent': UA_GPTBOT });
    const google = await anon.get(`/api/portal/public/articles?site=${A.siteCode}&page=1&size=5`);
    // 这一发带 Googlebot 的 UA：get() 不能改 UA，所以单独用 rawText 打公开接口
    await anon.rawText(`/api/portal/public/articles?site=${A.siteCode}&page=1&size=5`, { 'User-Agent': UA_GOOGLEBOT });
    j.expect('GPTBot 抓 llms.txt 抓到了内容', [gpt.status, gpt.body.length > 50], [200, true]);
    j.expect('GPTBot 抓 robots.txt 成功', gptRobots.status, 200);
    j.expect('Googlebot 那一发接口本身照回内容（统计不改变回话）', google.code, 'OK');
    await waitRows(db, A.tenantId, 10);
    const bot = await admin.get(`/api/analytics/bot?tenantId=${A.tenantId}&from=${today}&to=${today}&top=5`);
    j.expect('bot 口回 OK', bot.code, 'OK');
    const slices = (((bot.data as Record<string, unknown>)?.slices ?? []) as Array<Record<string, unknown>>);
    j.note('bot 口两片明细（类别 / 次数 / Top 页面）', slices);
    const byCat = new Map(slices.map(s => [String(s.botCategory), Number(s.hits)]));
    j.expect('GPTBot 两发落在 ai-crawler = 2', byCat.get('ai-crawler'), 2);
    j.expect('Googlebot 那一发落在 search-engine = 1', byCat.get('search-engine'), 1);
    j.expect('抓取事件的命名是 seo-file / portal-api，不冒充页面浏览量',
      [...new Set((await db.rows<{ event_type: string }>(
        `SELECT DISTINCT event_type FROM page_view_log WHERE tenant_id = ? AND bot_category <> 'human'`,
        [A.tenantId])).map(r => r.event_type))].sort(), ['portal-api', 'seo-file']);
    const ovAfterBot = await admin.get(`/api/analytics/overview?tenantId=${A.tenantId}&from=${today}&to=${today}`);
    j.expect('★爬虫抓了三次，人工 PV 一个都没涨（G-10 后半句）',
      Number((ovAfterBot.data as Record<string, unknown>).pageviews), 4);
    j.expect('★抓取也没进 UV 与停留', [(ovAfterBot.data as Record<string, unknown>).uniqueVisitors,
      (ovAfterBot.data as Record<string, unknown>).durationEvents], [2, 2]);
    const trendAfter = await admin.get(`/api/analytics/trend?tenantId=${A.tenantId}&from=${today}&to=${today}`);
    const pointAfter = (((trendAfter.data as Record<string, unknown>)?.points ?? []) as Array<Record<string, unknown>>)[0] ?? {};
    j.expect('trend 里抓取与人工是分开的两列（不相加）',
      [Number(pointAfter.pageviews), Number(pointAfter.botHits), Number(pointAfter.aiCrawlerHits)], [4, 3, 2]);
    j.expect('报表里没有任何一个字段是「人工 + 抓取」的和',
      Object.keys(pointAfter).sort(), ['aiCrawlerHits', 'botHits', 'date', 'pageviews', 'uniqueVisitors']);

    // ── 8 限流 ───────────────────────────────────────────────────────────
    const beforeRate = await settleCount(db, A.tenantId);
    const rateCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await track(j, A.siteCode, { path: '/about', eventType: 'pageview', sessionId: sess1 }, UA_BROWSER, xff1);
      rateCodes.push(res.code);
    }
    await sleep(3_000);
    const afterRate = await db.count('SELECT COUNT(*) AS n FROM page_view_log WHERE tenant_id = ?', [A.tenantId]);
    j.expect('同一访客 8 连发只收 5 条（应用侧限流，app.tracking.max-events-per-visitor-per-second）',
      afterRate - beforeRate, 5);
    j.expect('被限流的那三发回话仍然是 ok（拒收不声张，回体不区分收了没收）',
      [...new Set(rateCodes)], ['OK']);

    // ── 9 静默丢弃 ───────────────────────────────────────────────────────
    const beforeJunk = await settleCount(db, A.tenantId);
    const junkPaths = [
      { path: 'http://evil.example.com/x', why: '带 scheme 的绝对 URL' },
      { path: '//evil.example.com/x', why: '协议相对地址' },
      { path: '/news?category=x', why: '带查询串' },
      { path: '/api/admin/users', why: '后台路径（想被存进报表）' },
      { path: '/p/../../etc/passwd', why: '目录穿越形状' },
      { path: '/a'.repeat(600).slice(0, 600), why: '超长路径（>512）' },
    ];
    const junkResults = [];
    for (const junk of junkPaths) {
      const res = await track(j, A.siteCode, { path: junk.path, eventType: 'pageview' }, UA_BROWSER, '198.51.100.7');
      junkResults.push({ 形制: junk.why, path: junk.path.slice(0, 40), 回话: res.code });
      await sleep(1_200);
    }
    await track(j, A.siteCode, { path: '/about', eventType: '<script>alert(1)</script>' }, UA_BROWSER, '198.51.100.8');
    await track(j, 'e2e-no-such-site-code', { path: '/about', eventType: 'pageview' }, UA_BROWSER, '198.51.100.9');
    j.note('非法输入的回话（每一条都该是 ok，但一条都不该入库）', junkResults);
    // /about 那一发是合法路径 + 未知 eventType ⇒ 按 :113 的口径折算成 pageview 收下来，所以只允许多这一行
    j.expect('★非法 path（带 scheme/查询串/后台路径/穿越/超长）与未知站码全部静默丢弃：只多「合法路径 + 未知事件类型」那一行',
      await settleCount(db, A.tenantId), beforeJunk + 1);
    j.expect('非法那几发的回话确实全是 ok（拒绝不声张）',
      [...new Set(junkResults.map(r => r.回话))], ['OK']);

    // ── 10 权限与租户号 ──────────────────────────────────────────────────
    const editor = await probeUser(sa.api, db, A, 'CONTENT_EDITOR', `${tag}ED`, j);
    j.note('探针账号的角色与权限里有没有 analytics:view',
      { roles: editor.principal.roles, hasAnalyticsView: editor.principal.permissions.includes('analytics:view') });
    const permPaths = ['/api/analytics/overview', '/api/analytics/pages', '/api/analytics/trend', '/api/analytics/bot'];
    const editorResults = [];
    for (const path of permPaths) {
      const res = await editor.api.get(`${path}?tenantId=${A.tenantId}`);
      editorResults.push({ path, status: res.status, code: res.code, message: res.message.slice(0, 60) });
    }
    j.note('CONTENT_EDITOR 档逐个打四个口', editorResults);
    j.expect('★四个口对没有 analytics:view 的角色全部拒（403 + PERMISSION_DENIED）',
      [...new Set(editorResults.map(r => `${r.status} ${r.code}`))], ['403 PERMISSION_DENIED']);
    const noToken = await anon.get(`/api/analytics/overview?tenantId=${A.tenantId}`);
    j.expect('不带 token = 401（这一条不是 permitAll 白名单里的公开口）', noToken.status, 401);
    const platformView = await sa.api.withTenant(null, null).get('/api/analytics/overview');
    j.expect('超管在平台档不带租户号 = 明确拒（TENANT_REQUIRED，「先看一家」而不是全平台汇总）',
      platformView.code, 'TENANT_REQUIRED');
    const badRange = await admin.get(`/api/analytics/overview?tenantId=${A.tenantId}&from=2025-01-01&to=2026-12-31`);
    j.expect('区间超过 366 天被拒（不是把全表扫一遍）', badRange.code, 'PARAM_ERROR');
    const okRange = await admin.get(`/api/analytics/overview?tenantId=${A.tenantId}&from=2026-01-01&to=2026-12-31`);
    j.expect('365 天那一档是放行的（所以上一条红不是因为日期格式写错）', okRange.code, 'OK');

    // ── 11 跨租户隔离 ────────────────────────────────────────────────────
    const bOv = await B.admin.get(`/api/analytics/overview?tenantId=${B.tenantId}&from=${today}&to=${today}`);
    j.expect('B 家看自己的报表回 OK', bOv.code, 'OK');
    j.expect('★A 家的 7 条浏览一条都没算到 B 家（page_view_log 不在自动过滤清单里，靠的是显式 tenant_id）',
      Number((bOv.data as Record<string, unknown>).pageviews), 0);
    j.expect('B 家这一格是诚实的空态而不是报错', (bOv.data as Record<string, unknown>).empty, true);
    const bPages = await B.admin.get(`/api/analytics/pages?tenantId=${B.tenantId}&from=${today}&to=${today}`);
    j.expect('B 家热门页也是空列表（没有把 A 家的 /news/{slug} 端过去）',
      (((bPages.data as Record<string, unknown>)?.pages ?? []) as unknown[]).length, 0);

    // ── 12 ★G-10 的「热门」是栏目还是页面 ────────────────────────────────
    const dimProbes = [];
    for (const path of ['/api/analytics/sections', '/api/analytics/categories', '/api/analytics/columns']) {
      const res = await admin.get(`${path}?tenantId=${A.tenantId}&from=${today}&to=${today}`);
      dimProbes.push({ path, status: res.status, code: res.code });
    }
    j.note('三个候选「按栏目聚合」口的回话', dimProbes);
    const dimKeys = [...new Set([
      ...Object.keys(ovData), ...Object.keys((pages.data ?? {}) as object),
      ...(pageList[0] ? Object.keys(pageList[0]) : []),
    ])].filter(k => /section|categor|column|topic/i.test(k));
    // Q-P4a 拍板 (a)：栏目这一维不做聚合，判据措辞换成页面粒度（docs/CURRENT_GOAL_BASELINE.md §2 G-10 行）。
    // 所以这一节现在问的是「页面粒度这一层给不给得出热门页」，栏目维仍然按原样把事实记在证据里，
    // 因为它是「选了不做」而不是「有但坏了」——措辞改在这里，不在断言里偷偷放宽。
    j.expect('★按 Q-P4a(a) 的口径：报表出得到热门页（page_url 粒度 + 计数 + 独立访客），栏目聚合按拍板不做',
      { 第一名有页面: pageList[0]?.pageUrl !== undefined, 第一名有计数: typeof pageList[0]?.count === 'number',
        第一名有访客数: typeof pageList[0]?.visitors === 'number', 栏目维: 'not-built(by Q-P4a/a)' },
      { 第一名有页面: true, 第一名有计数: true, 第一名有访客数: true, 栏目维: 'not-built(by Q-P4a/a)' });
    j.note('栏目维现状留痕（不是缺陷，是拍板不做的维度）',
      { 维度键: dimKeys, 候选口: [...new Set(dimProbes.map(p => p.code))].sort() });

    // ── 13 ★后台那篇文章的浏览量与真实浏览对账 ───────────────────────────
    const idRows = await db.rows<{ n: number }>(
      `SELECT COUNT(*) AS n FROM page_view_log WHERE tenant_id = ? AND article_id IS NOT NULL`, [A.tenantId]);
    const backDetail = await admin.get(`/api/articles/${articleId}`);
    const backView = Number((backDetail.data as Record<string, unknown>)?.viewCount ?? -1);
    j.note('后台文章详情的 viewCount 与库里 article_id 非空的行数（旧口径按后者数，所以那时有名无实）',
      { viewCount: backView, rowsWithArticleId: Number(idRows[0]?.n), 这篇真实人工PV: 3 });
    j.expect('★报表说这篇被看了 3 次，后台文章详情也必须是 3（同一口径的两个出口）', backView, 3);
    // 两种形状各发一发：真人跟 sitemap 点进来报的是编码档，直接把中文当路径报上来的是原文档，
    // 两种都是这一篇被打开过一次（PortalUrls.articleUrlVariants），读侧只认一种就是漏计真人。
    await track(j, A.siteCode, { path: `/news/${slug}`, eventType: 'pageview' }, UA_BROWSER, '198.51.100.21');
    await sleep(3_000);
    const plainLanded = await db.count('SELECT COUNT(*) AS n FROM page_view_log WHERE tenant_id = ? AND page_url = ?',
      [A.tenantId, `/news/${slug}`]);
    const decodedView = Number(((await admin.get(`/api/articles/${articleId}`)).data as Record<string, unknown>)?.viewCount ?? -1);
    j.note('未编码那发：库里另一行（报表按 page_url 分组时它是单独一行），卡片把两档一起数',
      { 未编码行: plainLanded, viewCount: decodedView, 报表编码档那一行: 3 });
    j.expect('★两种形状都算这一篇被打开过：编码 3 + 未编码 1 ⇒ 卡片 4（少认一档就是漏计真人）',
      { 未编码行: plainLanded, viewCount: decodedView }, { 未编码行: 1, viewCount: 4 });

    // ── 14 ★案例地址会不会算成文章浏览 ───────────────────────────────────
    // /cases/{数字} 在白名单内，而采集侧只看「第三段是不是纯数字」，不区分 news 还是 cases。
    const beforeCase = await settleCount(db, A.tenantId);
    await track(j, A.siteCode, { path: `/cases/${articleId}`, eventType: 'pageview' }, UA_BROWSER, '198.51.100.31');
    await sleep(3_000);
    const caseRow = await db.rows<PvRow>(
      `SELECT page_url, article_id, page_type, bot_category FROM page_view_log
       WHERE tenant_id = ? AND page_url = ?`, [A.tenantId, `/cases/${articleId}`]);
    j.note('track /cases/{文章 id} 落库那一行', caseRow);
    j.expect('案例地址确实被收了（不是被白名单挡掉）',
      await db.count('SELECT COUNT(*) AS n FROM page_view_log WHERE tenant_id = ? AND page_url = ?',
        [A.tenantId, `/cases/${articleId}`]), 1);
    // 写侧现状按 Q-P4b(a) 不动：采集侧只看第三段是不是纯数字，于是把案例 id 写进 article_id 这一列，
    // 而 page_type 说的是 case。这一行照实记进证据，判据落在「它进不进卡片」上——读取侧已经不认这一列。
    j.note('写侧现状（拍板 (a)：只修读取侧，article_id 这一列仍被案例 id 污染）',
      { article_id: caseRow[0]?.article_id, page_type: caseRow[0]?.page_type });
    const afterCaseRes = await admin.get(`/api/articles/${articleId}`);
    const afterCaseView = Number((afterCaseRes.data as Record<string, unknown>).viewCount ?? -1);
    j.note('案例那一发之前/之后的后台 viewCount（之前=编码 3+未编码 1）', { before: decodedView, after: afterCaseView });
    j.expect('★案例页那一次访问没给这篇文章刷浏览量（卡片不认 article_id 那一列）', afterCaseView, decodedView);
    // 借 B 家的站点把同一行写进 B 家：A 家 viewCount 会不会因此上涨（humanViewCounts 有没有带 tenant_id）
    await track(j, B.siteCode, { path: `/cases/${articleId}`, eventType: 'pageview' }, UA_BROWSER, '198.51.100.32');
    await sleep(3_000);
    const leakedRes = await admin.get(`/api/articles/${articleId}`);
    j.expect('★B 家访客看的是 B 家的案例页，不该算进 A 家那篇文章的浏览量',
      Number((leakedRes.data as Record<string, unknown>).viewCount ?? -1), afterCaseView);
    j.expect('这一发确实写到了 B 家名下（不是没写进去所以「看着没影响」）',
      await db.count('SELECT COUNT(*) AS n FROM page_view_log WHERE tenant_id = ? AND page_url = ?',
        [B.tenantId, `/cases/${articleId}`]), 1);
    j.expect('A 家行数只多这一条', await settleCount(db, A.tenantId), beforeCase + 1);
  } finally {
    if (A) {
      j.note('收尾前：本轮给 page_view_log 写的行数（追加型日志表没有随租户删除的链路，留库里）', {
        A: await db.count('SELECT COUNT(*) AS n FROM page_view_log WHERE tenant_id = ?', [A.tenantId]),
        B: await db.count('SELECT COUNT(*) AS n FROM page_view_log WHERE tenant_id = ?',
          [B?.tenantId ?? 0]),
      });
      const saApi = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
      await retireTenant(saApi, j, A);
      if (B) await retireTenant(saApi, j, B);
    } else if (B) {
      const saApi = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
      await retireTenant(saApi, j, B);
    }
    const left = await residue(db);
    j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
    j.note('残留清点', left);
    await db.close();
    j.assertClean();
  }
});
