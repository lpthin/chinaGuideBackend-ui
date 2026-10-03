import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J06 爬虫面那四份文件（判据 G-07 改判后口径：不做静态化，改为在线渲染 + 四口逐租户真取）
 *
 * spec §5 J-06：`/robots.txt`、`/llms.txt`、`/llms-full.txt`、`/sitemap.xml` 四口逐租户真取，
 * 断言内容与已发布页面对得上；同时断言静态发布链路不再存在（改判留痕）。
 * 出处按 `file:line` 摘：
 *   四条端点 `GeoPublicController.java:79/85/91/97`，全部只过 `visibilityGuard.evaluatePublicSurface`
 *     （SiteVisibilityGuard.java:188-190 —— 只答「对公众开着吗」，预览令牌在这一问里一律不作数）
 *   站点身份 `SiteResolver.resolve:89-114`：dev 允许 `?site={code}`，其次 Host；
 *     根地址 `baseUrlOf:204-222`：站点没填 domain 时按 `{code}.{rootDomain}` 约定拼，
 *     dev 的 rootDomain=localhost、base-scheme=http（application-dev.yml:50-53）⇒ 期望基址是
 *     `http://{siteCode}.localhost`，而**绝不能**是本次请求自身的 origin（127.0.0.1:8080）
 *   robots 文本 `RobotsTxtPolicy.resolve:53-58` + `renderStructured:72-85`：通用段恒 Allow，
 *     六个 AI 词条逐个成段（AiCrawlers.java:47-56），没配过域名就不写 `Sitemap:` 那一行
 *   渲染只有一处 `GeoSeoFilesRenderer`（robots :89 / llms :98 / sitemap :158 / llms-full :219），
 *     文章地址一律 `PortalUrls.article(id, slug)` = `/news/{slug}`（PortalUrls.java:30-33），
 *     历史那个 `/article/{id}` 是死链来源；栏目列表页刻意不进 sitemap（:203-206 那段理由）
 *   哪一版算数 = `ArticleVersions.preferred`（认 article.source_locale 那一版），
 *     llms.txt 的标题与 llms-full.txt 的正文都取自它（GeoSeoFilesRenderer.java:230-236）
 *     ⇒ 这一条测的是 G-06 修好之后的**爬虫侧**：引擎抓到的必须是中文那一版，不是英文译稿
 *   下架 `POST /api/articles/{id}/unpublish`（ArticleController.java:272-282 →
 *     PublishExecutor.unpublish:98-125：状态转 offline + publish_job.unpublished_at 落值）
 *
 * 这一条真花钱：1 次生成 + 内含 1 次翻译（targetLocales=['en-US']，J-04 实测同形那一发全程 172s）。
 */

interface GenStatus {
  status?: string;
  progress?: number;
  stage?: string;
  articleId?: number | null;
  errorMessage?: string | null;
  modelName?: string | null;
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

/** PortalUrls.page() 的 TS 侧对照：内置页走短路径，其余走 /p/{slug}，home 走 / */
const BUILTIN_SHORT = new Set(['about', 'services', 'cases', 'news', 'contact', 'jobs']);
function pagePath(slug: string, pageKind: string): string {
  const key = (slug ?? '').trim();
  if (!key || key === 'home' || pageKind === 'home') return '/';
  return BUILTIN_SHORT.has(key) ? `/${key}` : `/p/${encodeURIComponent(key)}`;
}

/** <loc> 拆成相对路径（去掉基址）并还原转义，转义还原不了就保留原文（那样它必然落不进期望集合，红得下来） */
function locPaths(xml: string, base: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => {
    const abs = m[1];
    const rest = abs.startsWith(base) ? abs.slice(base.length) : abs;
    try {
      return decodeURIComponent(rest);
    } catch {
      return rest;
    }
  });
}

function llmsEntries(body: string, section: string): Array<{ title: string; url: string }> {
  const start = body.indexOf(`## ${section}`);
  if (start < 0) return [];
  const rest = body.slice(start + `## ${section}`.length);
  const stop = rest.indexOf('\n## ');
  const block = stop < 0 ? rest : rest.slice(0, stop);
  return [...block.matchAll(/^- \[([^\]]*)\]\(([^)]*)\)/gm)].map(m => ({ title: m[1], url: m[2] }));
}

test('SYS-J06 爬虫面四口：robots/llms/llms-full/sitemap 与库里的已发布内容对得上', async () => {
  test.info().setTimeout(900_000);
  const j = new Journal('SYS-J06');
  const db = new Db(j);
  const tag = process.env.E2E_J06_TAG ?? `J06${Date.now()}`;

  let A: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let B: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let articleId = 0;
  let base = '';

  try {
    j.card({
      用例号: 'SYS-J06-01',
      判据: 'G-07（改判：不做静态化，在线渲染 + 四口逐租户真取）',
      层级: 'API',
      前置: `后端 ${env.apiBase}（dev：app.portal.root-domain=localhost、base-scheme=http、allow-site-param=true）；`
        + '探针租户 A 的站点不填 domain，按 {code}.localhost 约定拼基址；B 只做候选站反例，不跑 AI；'
        + '真调模型 1 次生成 + 1 次翻译（targetLocales=["en-US"]，J-04 同形实测 172s）',
      步骤: [
        '1 开 A/B 两家探针租户，A 生成一篇中英双语草稿 → 人改标题 → 提审 → 通过 → 发布',
        '2 匿名（不带 token）按 ?site=A 站码 取四口原文，逐字留进证据',
        '3 robots：通用段 Allow、六个 AI 词条逐段放行、Sitemap 行指向本站基址；与后台 /api/geoseo/config/preview/robots 逐字相同（同源那条纪律在爬虫侧落一次地）',
        '4 llms.txt：站点抬头 + Articles 条目；条目的标题必须等于库里 zh-CN 那一版的标题（G-06 的爬虫侧），地址必须是 /news/{slug} 形制',
        '5 sitemap：每条 <loc> 都是绝对地址且都落在本站基址下；/news/{slug} 集合与库里已发布文章全等；页面集合与 portal_page 已发布非演示行全等；不出现 /article/{id}、/articles/、/category/ 那三种历史死链形制',
        '6 llms-full.txt：同一篇的 ## 标题、URL、正文都在，且与 llms.txt 同址',
        '7 交叉对账：llms.txt 里每一个链接要么在 sitemap 里，要么是 /news?category= 那条形制；公开列表口的 id 集合与 sitemap 的 /news/ 集合一致',
        '8 反例①：unpublish 之后同四口再取一次 —— 这一篇从 llms/llms-full/sitemap/公开列表里全部消失，页面那 7 条不受影响',
        '9 反例②：把 B 家站点状态改成 candidate 再取四口，且额外带一枚假 reviewToken —— 输出与「域名根本没绑站」逐字节相同',
        '10 改判留痕：information_schema 里没有任何 static 表；发布驱动只剩 dynamic-portal 的启动日志',
        '11 ★覆写档（客户手贴原文）：相对/空的 Sitemap 当场拒且库里不动；合法那份逐字对外；只列一家 ⇒ 其余五家在 structured.warnings 里逐家点名；{sitemap} 占位导成本站绝对地址；提交 crawlers 回到勾选档并清空覆写那列',
      ],
      期望: [
        '步骤 3 后台预览与爬虫口是同一份字节（RobotsTxtPolicy 单源的实测形态）',
        '步骤 4/6 爬虫抓到的是中文那一版：标题取 zh-CN version，英文译稿一个字都不出现在标题位上',
        '步骤 5 四份文件里出现的域名只有 http://{站码}.localhost，绝不出现本次请求自身的 origin',
        '步骤 8/9 下架的内容不再被推给引擎；还没对客户开放的候选站也不会被收录',
        '步骤 11 覆写档「逐字对外」与「保存体检」不冲突：形状错（贴了也收不到）才拦，缺段落只点名——拦人是替客户做决定，点名是把决定权还给客户',
      ],
      反例: ['越权拼基址：正文里出现 127.0.0.1:8080（拿请求 origin 凑 base URL）',
        '历史死链形制：/article/{id}、/articles/、/category/',
        '候选站带预览令牌时爬虫面改口（§6.6 验收③：演给客户看与演给搜索引擎看不能串）',
        '英文译稿顶掉中文标题（G-06 读侧那个 bug 在爬虫口的形状）',
        '超管在平台档直接 ?tenantId= 指别家预览被拦（要站到那一家）',
        '覆写原文里那条相对 Sitemap 被原样存进库（现网 id=1 那一行就是这一形状，缺陷 E）'],
      收尾: 'A/B 走 DELETE /api/admin/tenants/{id} 软删；本轮对 B 家站点状态的那一次写（candidate）随租户一起失去归属，'
        + '不做还原——它本身就是探针行；article/keyword/task 残留按前缀清点并记进日志',
    });

    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    A = await provisionTenant(sa.api, db, j, tag);
    B = await provisionTenant(sa.api, db, j, `${tag}B`);
    const admin = A.admin;
    base = `http://${A.siteCode.toLowerCase()}.localhost`;
    j.note('两家探针租户与期望基址（基址来自 SiteResolver.baseUrlOf 的 {code}.{rootDomain} 约定，不是请求 origin）',
      { A: { tenantId: A.tenantId, siteId: A.siteId, siteCode: A.siteCode }, B: { tenantId: B.tenantId, siteCode: B.siteCode }, base });

    // ── 1 生成一篇有中英两版、且被人改过标题的文章 ─────────────────────────
    const gen = await admin.post('/api/workspace/articles/generate-async', {
      keyword: '企业官网多久更新一次内容对SEO有影响吗', targetLocales: ['en-US'],
    });
    j.expect('提交生成回 OK', gen.code, 'OK');
    const taskId = Number((gen.data as Record<string, unknown>)?.taskId ?? 0);
    j.check('拿到 taskId', taskId, taskId > 0);
    const done = await waitTask(admin, j, taskId, 420_000);
    j.expect('任务终态 = COMPLETED', done.status, 'COMPLETED');
    articleId = Number(done.articleId ?? 0);
    j.check('COMPLETED 带出 articleId', articleId, articleId > 0);

    const versions = await db.rows<{ id: number; locale: string; title: string }>(
      `SELECT id, locale, title FROM article_version
       WHERE article_id = ? AND del_flag = '0' ORDER BY id`, [articleId]);
    j.expect('两版都在（zh-CN 源 + en-US 译）', versions.map(v => v.locale).sort(), ['en-US', 'zh-CN']);
    const zhBefore = versions.find(v => v.locale === 'zh-CN');
    j.check('反例形状成立：译稿行的 id 大于源语言行（否则后面测不出取的是哪一版）',
      { zhId: zhBefore?.id, enId: versions.find(v => v.locale === 'en-US')?.id },
      (versions.find(v => v.locale === 'en-US')?.id ?? 0) > (zhBefore?.id ?? 0));

    const marker = '｜SEO四口探针核过';
    const editedTitle = `${zhBefore?.title ?? ''}${marker}`;
    const put = await admin.put(`/api/workspace/articles/${articleId}`, { title: editedTitle });
    j.expect('人改标题回 OK', put.code, 'OK');
    const after = await db.rows<{ id: number; locale: string; title: string }>(
      `SELECT id, locale, title FROM article_version
       WHERE article_id = ? AND del_flag = '0' ORDER BY id`, [articleId]);
    const zhTitle = after.find(v => v.locale === 'zh-CN')?.title ?? '';
    const enTitle = after.find(v => v.locale === 'en-US')?.title ?? '';
    j.expect('改的就是源语言那一版（写侧不许把译稿顶掉）', zhTitle, editedTitle);
    j.check('英文译稿的标题非空（否则下面「取的是哪一版」那两条测不出东西）', enTitle, enTitle.length > 0);
    j.check('两版标题确实不是一个字符串（否则「爬虫抓到哪一版」测不出东西）',
      { zhTitle, enTitle }, zhTitle !== enTitle);

    const submit = await admin.post(`/api/workspace/articles/${articleId}/submit-review`);
    j.expect('提审回 OK', submit.code, 'OK');
    const approve = await admin.post(`/api/workspace/reviews/${articleId}/approve`, { comment: 'SEO 四口探针，可以发' });
    j.expect('人工通过回 OK', approve.code, 'OK');
    const publish = await admin.post(`/api/workspace/publish/${articleId}`);
    j.expect('发布回 OK', publish.code, 'OK');
    const published = await db.rows<{ status: string; slug: string | null; site_id: number }>(
      'SELECT status, slug, site_id FROM article WHERE id = ?', [articleId]);
    j.expect('终态 = published', published[0]?.status, 'published');
    const slug = String(published[0]?.slug ?? '');
    j.check('有 slug（文章对外地址取的是它）', slug.length, slug.length > 0);
    const job = await db.rows<{ n: number; open: number }>(
      `SELECT COUNT(*) AS n, SUM(unpublished_at IS NULL) AS open FROM publish_job
       WHERE article_id = ? AND status = 'success'`, [articleId]);
    j.expect('有一条生效中的发布记录（unpublished_at 为空）', Number(job[0]?.open ?? 0), 1);

    const anon = Api.anonymous(env.apiBase, j);
    const four = async (site: string, extra = '') => ({
      robots: await anon.rawText(`/robots.txt?site=${site}${extra}`),
      llms: await anon.rawText(`/llms.txt?site=${site}${extra}`),
      llmsFull: await anon.rawText(`/llms-full.txt?site=${site}${extra}`),
      sitemap: await anon.rawText(`/sitemap.xml?site=${site}${extra}`),
    });

    // ── 2/3 robots ────────────────────────────────────────────────────────
    const first = await four(A.siteCode);
    j.expect('四口全部 200', [first.robots, first.llms, first.llmsFull, first.sitemap].map(r => r.status), [200, 200, 200, 200]);
    j.expect('robots 的 Content-Type 是 text/plain（显式指定，通配 Accept 的爬虫不该被判 406）',
      first.robots.contentType.startsWith('text/plain'), true);
    j.expect('robots 开头是通用段且恒 Allow（本期不给勾）',
      first.robots.body.startsWith('User-agent: *\nAllow: /\n'), true);
    const agents = [...first.robots.body.matchAll(/^User-agent: (.+)$/gm)].map(m => m[1]);
    j.expect('六个 AI 词条逐个成段（词表全列出，缺一个就是勾漏了）',
      ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'OAI-SearchBot', 'Claude-SearchBot']
        .filter(name => !agents.includes(name)), []);
    j.expect('探针站没勾过任何一项 ⇒ 默认档全放行，一条 Disallow 都不该有',
      (first.robots.body.match(/Disallow: \//g) ?? []).length, 0);
    j.expect(`Sitemap 行指向本站基址（${base}/sitemap.xml）`,
      first.robots.body.includes(`Sitemap: ${base}/sitemap.xml`), true);
    // 超管在平台档直接 ?tenantId= 指过去，SiteInfoService 那一路按「当前站的归属」比身份，判的是「无权限操作该站点」；
    // 站到这一家里去（界面右上角切租户做的就是这件事）才读得到预览。两向都在这里落一次地。
    const previewPlatform = await sa.api.get(`/api/geoseo/config/preview/robots?tenantId=${A.tenantId}`);
    j.expect('反例③平台档直接指别家的租户号被拦', previewPlatform.code, 'FORBIDDEN');
    const preview = await sa.api.withTenant(A.tenantId, A.code)
      .get(`/api/geoseo/config/preview/robots?tenantId=${A.tenantId}`);
    j.expect('后台预览（站到这一家之后）回 OK', preview.code, 'OK');
    j.expect('后台预览那份与爬虫抓到的逐字相同（RobotsTxtPolicy 单源）', String(preview.data), first.robots.body);

    // ── 4 llms.txt ────────────────────────────────────────────────────────
    j.expect('llms 开头是站点抬头 # <站名>', first.llms.body.startsWith('# '), true);
    const articles = llmsEntries(first.llms.body, 'Articles');
    j.expect('Articles 条目数 = 库里已发布文章数', articles.length, 1);
    // 这一条就是 G-06 在爬虫口的形态：引擎抓到的标题必须是源语言那一版
    j.expect('条目标题 = 库里 zh-CN 那一版（人改过的那个），不是英文译稿', articles[0]?.title, zhTitle);
    j.expect(`人工改稿里那个记号「${marker}」出现在爬虫抓到的标题上`,
      (articles[0]?.title ?? '').includes(marker), true);
    j.expect('英文译稿的标题没有出现在 llms.txt 里', first.llms.body.includes(enTitle), false);
    const articlePath = `/news/${slug}`;
    j.expect('文章条目地址形制 = {基址}/news/{slug}', decodeURIComponent(articles[0]?.url ?? ''), `${base}${articlePath}`);
    // slug 是中文，出站形制是百分号编码那一份（PortalUrls.encodeSegment）。
    // 后面三处比对（llms-full 的 URL 行、下架反例、publish_job.output_path）都拿这份逐字，不再各自编码一次。
    const articleUrlRaw = String(articles[0]?.url ?? '');
    const pageEntries = llmsEntries(first.llms.body, 'Pages');
    j.check('Pages 段非空（导航给出的每一页都在）', pageEntries.length, pageEntries.length >= 1);

    // ── 5 sitemap ─────────────────────────────────────────────────────────
    j.expect('sitemap 的 Content-Type 是 application/xml', first.sitemap.contentType.startsWith('application/xml'), true);
    j.expect('XML 声明与 urlset 头在', first.sitemap.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), true);
    const locs = locPaths(first.sitemap.body, base);
    const rawLocs = [...first.sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    j.expect('每一条 <loc> 都是本站绝对地址（没有相对路径，也没有请求 origin）',
      rawLocs.filter(u => !u.startsWith(base)), []);
    j.expect('四条出口里任何一份都不许出现本次请求自身的 origin',
      [first.robots.body, first.llms.body, first.llmsFull.body, first.sitemap.body].filter(t => t.includes('127.0.0.1')), []);
    j.expect('历史死链形制一条都没有（/article/{id}、/articles/、/category/）',
      locs.filter(p => /^\/article\//.test(p) || p.startsWith('/articles/') || p.startsWith('/category/')), []);
    const lastmods = [...first.sitemap.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
    j.expect('每个 lastmod 都是 yyyy-MM-dd', lastmods.filter(v => !/^\d{4}-\d{2}-\d{2}$/.test(v)), []);

    const dbPages = await db.rows<{ slug: string; page_kind: string; status: string; is_demo: number }>(
      `SELECT slug, page_kind, status, is_demo FROM portal_page
       WHERE tenant_id = ? AND site_id = ? AND status = 'published' AND is_demo = 0 AND del_flag = '0' ORDER BY nav_sort, id`,
      [A.tenantId, A.siteId]);
    j.expect('骨架页有已发布的（开通链自己长出来的那 7 页）', dbPages.length, 7);
    const expectedPages = dbPages.map(p => pagePath(p.slug, p.page_kind)).sort();
    const actualPages = locs.filter(p => !p.startsWith('/news/') && !p.startsWith('/cases/')).sort();
    j.expect('页面集合与 portal_page 已发布非演示行全等（不多不少）', actualPages, expectedPages);
    const newsInSitemap = locs.filter(p => p.startsWith('/news/')).map(p => p.slice('/news/'.length)).sort();
    const dbSlugs = await db.rows<{ slug: string }>(
      `SELECT slug FROM article WHERE tenant_id = ? AND site_id = ? AND status = 'published' AND del_flag = '0'`,
      [A.tenantId, A.siteId]);
    j.expect('文章集合与库里已发布文章全等', newsInSitemap, dbSlugs.map(s => String(s.slug ?? '')).sort());
    j.expect('<url> 条数 = 页面 + 文章 + 案例（探针站没有已发布案例）',
      locs.length, dbPages.length + dbSlugs.length);

    // ── 6 llms-full.txt ───────────────────────────────────────────────────
    j.expect('llms-full 的抬头说明这是长文版', first.llmsFull.body.includes('本文件是 llms.txt 的长文版'), true);
    j.expect('llms-full 里有这一篇的 ## 标题（同样是源语言那一版）',
      first.llmsFull.body.includes(`\n## ${zhTitle}\n`), true);
    j.expect('llms-full 里这篇的 URL 与 llms.txt 同址（逐字，含同一份百分号编码）',
      first.llmsFull.body.includes(`URL: ${articleUrlRaw}`), true);
    // 取正文中段 60 字做逐字比对：头尾各有处理（尾部截断说明、抬头换行），中段才是原样吐出去的那一份
    const bodyProbe = (await db.rows<{ probe: string | null }>(
      `SELECT SUBSTRING(content_md, 200, 60) AS probe FROM article_version
       WHERE article_id = ? AND locale = 'zh-CN' AND del_flag = '0' ORDER BY id DESC LIMIT 1`, [articleId]))[0]?.probe ?? '';
    j.check('中文正文长度 > 200（这一条不成立时下面那句「正文进了长文版」没有意义）', bodyProbe.length, bodyProbe.length > 0);
    j.expect('llms-full.txt 里逐字带着这段正文（AI 写的内容真的出去了，不是只有标题）',
      first.llmsFull.body.includes(bodyProbe), true);
    j.expect('llms.txt 里则只有清单，不带正文', first.llms.body.includes(bodyProbe), false);
    j.note('两份文件的字节数与中文正文长度',
      { llms: first.llms.body.length, llmsFull: first.llmsFull.body.length, zhBodyChars: bodyProbe.length });

    // ── 7 交叉对账：llms 里的每个链接都不能是死链 ───────────────────────────
    const locSet = new Set(locs);
    const phantom = [...articles, ...pageEntries]
      .map(e => decodeURIComponent(e.url))
      .filter(u => u.startsWith(base))
      .map(u => u.slice(base.length))
      // 栏目列表页刻意不进 sitemap（前台没有 /category/{slug} 路由，按栏目过滤走 /news?category=）
      .filter(p => !/^\?/.test(p) && !p.startsWith('/news?category='))
      .filter(p => !locSet.has(p));
    j.expect('llms.txt 列出的每一页都在 sitemap 里（栏目那条 /news?category= 形制除外）', phantom, []);
    const publicList = await anon.get(`/api/portal/public/articles?site=${A.siteCode}&page=1&size=20`);
    const publicIds = (((publicList.data as Record<string, unknown>)?.records ?? []) as Array<Record<string, unknown>>)
      .map(r => Number(r.id)).sort();
    j.expect('公开列表口的 id 集合 = 这一篇（爬虫推的就是读者点得到的那些）', publicIds, [articleId]);

    // ── 8 反例①：下架之后从四份文件里消失 ─────────────────────────────────
    const off = await admin.post(`/api/articles/${articleId}/unpublish`);
    j.expect('反例①下架回 OK', off.code, 'OK');
    j.expect('反例①回体 status=offline', (off.data as Record<string, unknown>)?.status, 'offline');
    j.expect('反例①库里状态 = offline', await db.count(
      "SELECT COUNT(*) AS n FROM article WHERE id = ? AND status = 'offline'", [articleId]), 1);
    j.expect('反例①发布记录上落了撤回时间', await db.count(
      "SELECT COUNT(*) AS n FROM publish_job WHERE article_id = ? AND status = 'success' AND unpublished_at IS NOT NULL",
      [articleId]), 1);
    const after1 = await four(A.siteCode);
    j.expect('反例①llms.txt 的 Articles 空了', llmsEntries(after1.llms.body, 'Articles').length, 0);
    j.expect('反例①llms-full.txt 不再带这一篇正文', after1.llmsFull.body.includes(`URL: ${articleUrlRaw}`), false);
    j.expect('反例①sitemap 里没有 /news/{slug} 了',
      locPaths(after1.sitemap.body, base).filter(p => p.startsWith('/news/')), []);
    j.expect('反例①页面那 7 条不受影响', locPaths(after1.sitemap.body, base).length, dbPages.length);
    j.expect('反例①公开列表也读不到了',
      ((((await anon.get(`/api/portal/public/articles?site=${A.siteCode}&page=1&size=20`))
        .data as Record<string, unknown>)?.records ?? []) as unknown[]).length, 0);

    // ── 9 反例②：候选站的爬虫面 = 「根本没绑站」 ───────────────────────────
    // 参照档先取：?site= 指到一个不存在的站码 ⇒ SiteResolver 落空 ⇒ 按「没有站」渲染
    const none = await four('e2e-no-such-site-code');
    const toCandidate = await sa.api.withTenant(B.tenantId, B.code)
      .put(`/api/admin/sites/${B.siteId}`, { status: 'candidate' });
    j.expect('反例②把 B 家站点改成候选（本轮对探针行的一次写，随租户软删一起收尾）', toCandidate.code, 'OK');
    // SiteService.update 在状态流转时 evictAll()，所以这里不需要等缓存过期
    const bSite = await db.rows<{ status: string }>('SELECT status FROM site WHERE id = ?', [B.siteId]);
    j.expect('反例②库里状态 = candidate', bSite[0]?.status, 'candidate');
    const cand = await four(B.siteCode);
    // 带一枚假令牌再来一次：evaluatePublicSurface 根本不看令牌，输出必须还是同一份
    const candToken = await four(B.siteCode, '&reviewToken=e2e-fake-token');
    j.expect('反例②候选站的 robots 与「没绑站」逐字相同', cand.robots.body, none.robots.body);
    j.expect('反例②候选站的 llms 是空文本', cand.llms.body, '');
    j.expect('反例②候选站的 llms-full 是空文本', cand.llmsFull.body, '');
    j.expect('反例②候选站的 sitemap 是空 urlset', cand.sitemap.body, none.sitemap.body);
    j.expect('反例②候选站带着预览令牌也一样不松口（§6.6 验收③）',
      [candToken.robots.body, candToken.llms.body, candToken.sitemap.body],
      [cand.robots.body, cand.llms.body, cand.sitemap.body]);
    j.expect('反例②没绑站那份 robots 里不写 Sitemap 行（宁缺不编）',
      none.robots.body.includes('Sitemap:'), false);
    // B 家自己有 7 个已发布的骨架页：候选站那一份内容只要漏一条出去，就是「还没选定就先被收录」
    j.expect('反例②候选站的 sitemap 里一条 <loc> 都没有（它那 7 个已发布页面一条都不推）',
      (cand.sitemap.body.match(/<loc>/g) ?? []).length, 0);
    j.expect('反例②候选站的 robots 也没有本站痕迹（没有 Sitemap 行就是没有认站）',
      cand.robots.body.includes(B.siteCode.toLowerCase()), false);

    // ── 10 改判留痕：静态发布链路不存在 ──────────────────────────────────
    const staticTables = await db.rows<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name LIKE '%static%'`);
    j.expect('库里没有任何 static 表（不做静态化的结构证据）', staticTables.map(r => r.table_name), []);
    const staticColumns = await db.rows<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND (column_name LIKE '%static%' OR column_name LIKE '%html_file%')`);
    j.note('static/html_file 字样的列清点（应为空）', staticColumns);
    j.expect('也没有 static 字样的列', staticColumns.map(c => `${c.table_name}.${c.column_name}`), []);
    const drivers = await db.rows<{ drivers_json: string | null; output_path: string | null; git_head_after: string | null }>(
      `SELECT drivers_json, output_path, git_head_after FROM publish_job WHERE article_id = ? ORDER BY id`, [articleId]);
    j.note('publish_job 这一篇的驱动档与产出（application.yml:127 只配 dynamic-portal；'
      + 'DynamicPortalDriver.publish 写的是门户相对地址，不是静态文件路径；'
      + 'git_head_after / affected_files 那几列是静态化那一期的残留，改判之后不再有任何一处往里写）', drivers);
    j.expect('每一次发布落的驱动名只有 dynamic-portal',
      [...new Set(drivers.map(r => String(r.drivers_json ?? '')))], ['dynamic-portal']);
    j.expect('产出记的就是爬虫面那一份门户地址（不是 .html 文件，也不许和 llms.txt 各编各的码）',
      drivers.map(r => r.output_path).filter(p => p !== null && p !== articleUrlRaw.slice(base.length)), []);
    j.expect('产出里没有 .html / static 字样的文件路径',
      drivers.filter(r => /\.html|static/i.test(String(r.output_path ?? ''))).length, 0);
    j.expect('Git 输出那两列全空（静态化/Git 从没启用过）',
      drivers.filter(r => r.git_head_after !== null && r.git_head_after !== ''), []);

    // ── 11 ★覆写档（客户手贴原文那一档）：形状错当场拒、缺哪一段点名，原文仍逐字对外 ──
    // 缺陷 E 的正身：现网 geoseo_config id=1 那份覆写原文写的是 `Sitemap: /sitemap.xml`（相对地址），
    // 而 robots 协议里相对地址不算一条 sitemap 引用 ⇒ 搜索引擎整行忽略，客户在后台却看着「我填了」。
    const robotsState = async (): Promise<Record<string, unknown>> => {
      const view = await admin.get('/api/portal/site-info');
      j.check('后台「网站信息」读得到（探针管理员有 portal:siteinfo:manage）', view.code, 'OK');
      const fields = ((view.data as Record<string, unknown>)?.fields ?? {}) as Record<string, unknown>;
      return (((fields.robots ?? {}) as Record<string, unknown>).structured ?? {}) as Record<string, unknown>;
    };
    const rejected = await admin.put('/api/portal/site-info', {
      fields: { robots: { overrideText: 'User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml\n' } },
    });
    j.note('贴一份相对 Sitemap 的覆写原文，回的是', { code: rejected.code, message: rejected.message });
    j.expect('★形状错当场拒（不是先存进库、让爬虫整行忽略而没人知道）',
      rejected.code, 'ROBOTS_OVERRIDE_REJECTED');
    j.expect('那一句点名的是哪一行、为什么，客户照着就能改',
      [String(rejected.message).includes('Sitemap: /sitemap.xml'), String(rejected.message).includes('http://')],
      [true, true]);
    j.expect('拒了就必须真没落库：爬虫口仍是结构化推导那一份，一个字节没动',
      (await anon.rawText(`/robots.txt?site=${A.siteCode}`)).body, first.robots.body);
    j.expect('「Sitemap:」后面留空同样是形状错（一样整行忽略）',
      (await admin.put('/api/portal/site-info', {
        fields: { robots: { overrideText: 'User-agent: *\nAllow: /\n\nSitemap:\n' } },
      })).code, 'ROBOTS_OVERRIDE_REJECTED');
    j.expect('勾选与原文同时给仍然拒（两档不许并存，这条改造前就有）',
      (await admin.put('/api/portal/site-info', {
        fields: { robots: { crawlers: ['gpt-bot'], overrideText: 'User-agent: *\nAllow: /\n' } },
      })).code, 'ROBOTS_AMBIGUOUS_FORM');

    const onlyGpt = `User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
    j.expect('合法覆写（绝对地址 + 通用段）保存回 OK',
      (await admin.put('/api/portal/site-info', { fields: { robots: { overrideText: onlyGpt } } })).code, 'OK');
    // 保存时 trim() 掉的是首尾空白，段内一个字节不改 —— 「逐字对外」说的是段内逐字
    const onlyGptStored = onlyGpt.trim();
    const overrideOut = (await anon.rawText(`/robots.txt?site=${A.siteCode}`)).body;
    j.expect('★覆写档逐字对外：爬虫拿到的就是客户贴的那一份（只有首尾空白在保存时被 trim 掉）',
      overrideOut, onlyGptStored);
    const stOverride = await robotsState();
    const warns = (stOverride.warnings ?? []) as string[];
    j.note('覆写档的 structured', { mode: stOverride.mode, 点名条数: warns.length, warnings: warns });
    j.expect('判档读的是库里那一列（界面不是猜的）', stOverride.mode, 'raw_override');
    j.expect('★缺哪几家 AI 爬虫逐家点名：只列了 GPTBot ⇒ 其余五家各一条（只提示不拦，屏蔽某一家是客户的权利）',
      warns.length, 5);
    j.expect('后台那份折叠预览与爬虫口仍是同一份字节（覆写档也要单源）',
      String(stOverride.exportedText), overrideOut);
    j.expect('占位 {sitemap} 算合法（界面 placeholder 提示客户写的就是这一种）',
      (await admin.put('/api/portal/site-info', {
        fields: { robots: { overrideText: 'User-agent: *\nAllow: /\n\nSitemap: {sitemap}\n' } },
      })).code, 'OK');
    j.expect('占位在导出那一刻换成本站绝对地址（与结构化档同源，不是两处各拼一次）',
      (await anon.rawText(`/robots.txt?site=${A.siteCode}`)).body.includes(`Sitemap: ${base}/sitemap.xml`), true);
    j.expect('提交 crawlers 就能回到勾选档',
      (await admin.put('/api/portal/site-info', { fields: { robots: { crawlers: ['gpt-bot'] } } })).code, 'OK');
    const stBack = await robotsState();
    j.expect('回到勾选档后覆写那列是空的（不是「藏着但还生效」）',
      [stBack.mode, stBack.overrideText ?? null], ['structured', null]);
    const backOut = (await anon.rawText(`/robots.txt?site=${A.siteCode}`)).body;
    j.expect('爬虫口随之回到推导那份', [backOut.includes('User-agent: GPTBot'), backOut === onlyGpt], [true, false]);
    j.note('落库那两列（两档互斥的结构证据）', await db.rows<{ robots_txt: string | null; robots_crawlers: string | null }>(
      `SELECT robots_txt, robots_crawlers FROM geoseo_config WHERE tenant_id = ?`, [A.tenantId]));
  } finally {
    const saApi = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
    if (A) await retireTenant(saApi, j, A);
    if (B) await retireTenant(saApi, j, B);
    if (A) {
      j.note('A 家（已注销）本轮留下的行数', {
        article: await db.count('SELECT COUNT(*) AS n FROM article WHERE tenant_id = ?', [A.tenantId]),
        article_version: await db.count(
          'SELECT COUNT(*) AS n FROM article_version v JOIN article a ON a.id = v.article_id WHERE a.tenant_id = ?', [A.tenantId]),
        publish_job: await db.count(
          'SELECT COUNT(*) AS n FROM publish_job pj JOIN article a ON a.id = pj.article_id WHERE a.tenant_id = ?', [A.tenantId]),
        portal_page: await db.count('SELECT COUNT(*) AS n FROM portal_page WHERE tenant_id = ?', [A.tenantId]),
      });
    }
    const left = await residue(db);
    j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
    j.note('残留清点', left);
    await db.close();
  }
  j.assertClean();
});
