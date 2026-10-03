import { test } from '@playwright/test';
import { Api, type Envelope } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J07 读者互动（判据 G-08「前台文章可以评论、点赞」design.md:867）
 *
 * 这一条测的是「有没有」，所以每一发探测都要留下码，红也要红在证据上：
 *   写口 —— 评论/点赞/回复的候选路径逐个 POST/PUT/DELETE（登录身份发，避开「先被鉴权拦掉」那种假阴性；
 *            /api/portal/public/** 在 SecurityConfig 里是 permitAll，匿名那批发用的是同一批路径，两向各留一档）
 *   读口 —— 公开详情与公开列表的 JSON 键里有没有任何 comment/like 字段（PortalContentDTO.ArticleItem
 *            / ArticleDetail 全文只有 id/slug/title/summary/coverImage/publishedAt/categoryName/categorySlug/tags，
 *            一个计数字段都没暴露 ⇒ 读者连「别人说过什么」都看不到）
 *   库里 —— article_comment / article_like 两张表是迁移留下的结构（V1 那批），
 *           全站行数（不限租户、不限删除档）必须是 0 才叫「从来没有一处往里写」
 *   人写的那一半 —— 后台文章读口（ArticleController.java:84-91、413-415）确实把 viewCount/likeCount
 *           拼进 DTO，但那两个数只从 page_view_log 与 article_like「读」，系统里没有任何一处「写」article_like
 *           （VirtualInteractionService 是唯一会往这两张表插行的类，全仓 0 个调用方 —— 这一条由本用例
 *           「发布之后两张表仍然 0 行」现场反证）
 *   最接近的既有能力 —— /api/guestbook（留言板/工单，GuestbookController.java:16-128 有列表/回复/关闭），
 *           它是「访客留一句话、后台回一句」，与「在某篇文章下面评论」不是同一个东西，
 *           这一发把它读出来记进证据，免得报告里出现「什么都没有」这种过头话
 *
 * G-09（英文回复）按拍板 B-3b 并入 G-06，本用例只顺手探一条 `/comments/{id}/translate-reply` 的不存在，不单独判档。
 * 真花钱：1 次生成（不带 targetLocales，J-02 实测 90.6s）。
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
      { status: last.status, stage: last.stage, progress: last.progress, articleId: last.articleId,
        errorMessage: last.errorMessage });
    if (last.status && TERMINAL.includes(last.status)) return last;
  }
  throw new Error(`任务 ${taskId} 在 ${budgetMs / 1000}s 内没到终态，最后状态=${JSON.stringify(last)}`);
}

/** 候选写口：路径全部带 comment/like/reaction/reply 这类互动语义，不带任何「文章本体」路径 */
const WRITE_PROBES: Array<{ method: 'POST' | 'PUT' | 'DELETE'; path: (id: number) => string; why: string }> = [
  { method: 'POST', path: id => `/api/portal/public/articles/${id}/comments`, why: '最直白的「在这篇文章下留言」' },
  { method: 'POST', path: id => `/api/portal/public/articles/${id}/comment`, why: '单数写法' },
  { method: 'POST', path: () => '/api/portal/public/comments', why: '评论独立成资源' },
  { method: 'POST', path: id => `/api/portal/public/articles/${id}/like`, why: '最直白的「点赞」' },
  { method: 'PUT', path: id => `/api/portal/public/articles/${id}/like`, why: '点赞幂等档（取消/再点）' },
  { method: 'DELETE', path: id => `/api/portal/public/articles/${id}/like`, why: '取消点赞' },
  { method: 'POST', path: id => `/api/portal/public/articles/${id}/likes`, why: '复数写法' },
  { method: 'POST', path: () => '/api/portal/public/likes', why: '点赞独立成资源' },
  { method: 'POST', path: id => `/api/portal/public/articles/${id}/reactions`, why: 'reactions 那一派写法' },
  { method: 'POST', path: () => '/api/portal/comments', why: '不带 public 前缀的门户评论' },
  { method: 'POST', path: () => '/api/comments', why: '顶层评论资源' },
  { method: 'POST', path: id => `/api/workspace/articles/${id}/comments`, why: '租户侧补一条评论' },
  { method: 'POST', path: () => '/api/admin/comments', why: '超管侧代客回复' },
  { method: 'POST', path: id => `/api/articles/${id}/comments`, why: '文章资源下挂评论' },
  { method: 'PUT', path: id => `/api/portal/public/comments/${id}/reply`, why: '后台回复某条评论' },
  { method: 'PUT', path: id => `/api/portal/public/comments/${id}/translate-reply`, why: 'G-09 的英文回复（已并入 G-06）' },
];

const READ_PROBES = ['/api/portal/public/comments?articleId=', '/api/admin/comments',
  '/api/workspace/comments', '/api/portal/public/interactions'];

test('SYS-J07 读者互动：评论/点赞在系统里到底存不存在', async () => {
  test.info().setTimeout(900_000);
  const j = new Journal('SYS-J07');
  const db = new Db(j);
  const tag = process.env.E2E_J07_TAG ?? `J07${Date.now()}`;

  let A: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let articleId = 0;

  try {
    j.card({
      用例号: 'SYS-J07-01',
      判据: 'G-08（前台文章可以评论、点赞，design.md:867）',
      层级: 'API',
      前置: `后端 ${env.apiBase}；探针租户 ${tag} 现开并真的走完「生成→提审→通过→发布」（判据要在真的有一篇已发布文章的站上测）；`
        + '真调模型 1 次',
      步骤: [
        '1 开探针租户 A，生成一篇中文草稿 → 提审 → 通过 → 发布（拿到一个真实可评论的对象）',
        '2 匿名逐个发 16 条互动写口候选（POST/PUT/DELETE），逐条留码',
        '3 同一批路径换成 A 家管理员的身份再发一遍（登录身份才分得清「鉴权拦的」与「根本没有这条映射」）',
        '4 后台/门户的评论读口候选逐个 GET，逐条留码',
        '5 库里对账：article_comment、article_like 两张表的全站行数（不限租户、不限删除档）',
        '6 读侧形状：公开详情与公开列表的 JSON 键里有没有任何 comment/like 字段',
        '7 后台文章读口有没有 likeCount/viewCount 这两个键，值是多少',
        '8 最接近的既有能力：GET /api/guestbook（留言板/工单）在不在、回什么',
        '9 收尾清点，两张互动表的行数再读一次',
      ],
      期望: [
        '步骤 2/3 里只要有任何一条是 2xx，G-08 就朝「达成」进一步；405 也算「口在、只是方法不对」',
        '步骤 6 若键里出现 comment/like，说明前台至少在展示层留了位置',
        '步骤 7 后台读得到计数字段（这是现状里唯一「看起来像互动」的东西）',
      ],
      反例: ['本轮实测：写口全部不存在，两张表全站 0 行 ⇒ 判 G-08 未达成（★ 那几条红就是这个判据本体）'],
      收尾: 'A 走 DELETE /api/admin/tenants/{id} 软删；article/article_version/task 残留按前缀清点；'
        + '探测只发在候选路径上，一次都没有落到真实业务行（404 之前没有 handler，不存在写入路径）',
    });

    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    A = await provisionTenant(sa.api, db, j, tag);
    const admin = A.admin;

    // ── 1 先有一个真的能评论的对象 ────────────────────────────────────────
    const gen = await admin.post('/api/workspace/articles/generate-async', { keyword: '儿童近视防控有哪些方法' });
    j.expect('提交生成回 OK', gen.code, 'OK');
    const taskId = Number((gen.data as Record<string, unknown>)?.taskId ?? 0);
    j.check('拿到 taskId', taskId, taskId > 0);
    const done = await waitTask(admin, j, taskId, 420_000);
    j.expect('任务终态 = COMPLETED（这一步要是 FAILED，「评论对象」就不存在，后面的红没有意义）',
      done.status, 'COMPLETED');
    articleId = Number(done.articleId ?? 0);
    j.check('COMPLETED 带出 articleId', articleId, articleId > 0);
    j.expect('提审回 OK', (await admin.post(`/api/workspace/articles/${articleId}/submit-review`)).code, 'OK');
    j.expect('人工通过回 OK',
      (await admin.post(`/api/workspace/reviews/${articleId}/approve`, { comment: '互动探针，可以发' })).code, 'OK');
    const publish = await admin.post(`/api/workspace/publish/${articleId}`);
    j.expect('发布回 OK', publish.code, 'OK');
    j.expect('库里这篇确实是 published（读者点得到的那一档）', await db.count(
      "SELECT COUNT(*) AS n FROM article WHERE id = ? AND status = 'published' AND del_flag = '0'", [articleId]), 1);

    const anon = Api.anonymous(env.apiBase, j);
    const probeWrite = async (api: Api, label: string) => {
      const results: Array<Record<string, unknown>> = [];
      for (const p of WRITE_PROBES) {
        const path = p.path(articleId);
        const res = await api.call(p.method, path, { content: 'E2E 互动探针', comment: 'E2E 互动探针', messageId: articleId });
        results.push({ method: p.method, path, why: p.why, status: res.status, code: res.code, message: res.message.slice(0, 80) });
      }
      j.note(`${label}：${results.length} 条候选写口的实测码`, results);
      return results;
    };

    // ── 2/3 写口：匿名与登录身份各发一轮 ──────────────────────────────────
    const anonResults = await probeWrite(anon, '匿名档');
    const adminResults = await probeWrite(admin, '租户管理员档');
    for (const [label, list] of [['匿名', anonResults], ['登录', adminResults]] as const) {
      const created = list.filter(r => Number(r.status) < 400);
      j.expect(`反例★${label}档 16 条候选写口里没有一条是 2xx（有任何一条就说明口存在）`, created, []);
      const methodNotAllowed = list.filter(r => Number(r.status) === 405);
      j.expect(`反例★${label}档没有一条回 405（405=路径在、只是方法不对，那也叫口在）`, methodNotAllowed, []);
    }
    const statusCodes = [...new Set(adminResults.map(r => Number(r.status)))].sort();
    j.note('登录档实测到的状态码集合（404 就是 Spring 找不到 handler，不是权限）', statusCodes);
    j.expect('★登录档这一轮全部是「没有这条映射」那一档（404/404 包装）',
      adminResults.filter(r => Number(r.status) !== 404), []);

    // ── 4 读口 ────────────────────────────────────────────────────────────
    const readResults: Array<Record<string, unknown>> = [];
    for (const path of READ_PROBES) {
      const full = path.endsWith('=') ? `${path}${articleId}` : path;
      const res = await admin.get(full);
      readResults.push({ path: full, status: res.status, code: res.code, message: res.message.slice(0, 80) });
    }
    j.note('评论/点赞读口候选的实测码（后台没有评论管理页要用的那些口）', readResults);
    j.expect('★后台没有任何一条评论读口是 2xx（管理页无从谈起）',
      readResults.filter(r => Number(r.status) < 400), []);

    // ── 5 库里对账：全站 0 行 ─────────────────────────────────────────────
    const tables = await db.rows<{ tn: string }>(
      `SELECT table_name AS tn FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN ('article_comment','article_like') ORDER BY table_name`);
    j.expect('两张互动表在结构里是存在的（迁移留下的骨架）',
      tables.map(t => t.tn), ['article_comment', 'article_like']);
    const commentRows = await db.count('SELECT COUNT(*) AS n FROM article_comment');
    const likeRows = await db.count('SELECT COUNT(*) AS n FROM article_like');
    j.expect('★article_comment 全站行数 = 0（不限租户、含已删除档）', commentRows, 0);
    j.expect('★article_like 全站行数 = 0（连虚拟点赞都没写过一行）', likeRows, 0);
    const tenantRows = await db.rows<{ n: number }>(
      'SELECT COUNT(*) AS n FROM article_comment WHERE tenant_id = ?', [A.tenantId]);
    j.expect('★这一家自己的评论行数 = 0', Number(tenantRows[0]?.n), 0);

    // ── 6 读侧形状：公开口连计数字段都不暴露 ─────────────────────────────
    const detail = await anon.get(`/api/portal/public/articles/${articleId}?site=${A.siteCode}`);
    j.expect('公开详情口本身回 OK（这一发是为了下面那句「键里没有互动字段」不是误报）', detail.code, 'OK');
    const detailKeys = Object.keys((detail.data ?? {}) as Record<string, unknown>);
    j.note('公开详情的全部键（读者在这一屏能拿到的东西就是这些）', detailKeys);
    j.expect('★公开详情里没有任何 comment/like/reaction/reply 字样的键',
      detailKeys.filter(k => /comment|like|reaction|repl/i.test(k)), []);
    const list = await anon.get(`/api/portal/public/articles?site=${A.siteCode}&page=1&size=20`);
    const firstItem = (((list.data as Record<string, unknown>)?.records ?? []) as Array<Record<string, unknown>>)[0] ?? {};
    j.expect('★公开列表的条目里同样没有互动字段',
      Object.keys(firstItem).filter(k => /comment|like|reaction/i.test(k)), []);

    // ── 7 后台文章读口：字段在，但永远是 0 ───────────────────────────────
    const back = await admin.get(`/api/articles/${articleId}`);
    j.expect('后台文章详情回 OK', back.code, 'OK');
    const backKeys = Object.keys((back.data ?? {}) as Record<string, unknown>);
    j.expect('后台 DTO 里有 likeCount 这个键（读侧半套是有的）',
      backKeys.filter(k => k === 'likeCount' || k === 'viewCount').sort(), ['likeCount', 'viewCount']);
    j.expect('★而它的值恒为 0：没有任何一处代码往 article_like 里写行',
      Number((back.data as Record<string, unknown>)?.likeCount ?? -1), 0);
    j.note('后台详情回体里的互动相关键（viewCount 的来源是 page_view_log，见 J-08）',
      backKeys.filter(k => /like|view|comment/i.test(k)));

    // ── 8 最接近的既有能力：留言板/工单不是文章评论 ────────────────────────
    const guestbook = await sa.api.withTenant(A.tenantId, A.code).get('/api/guestbook?page=1&size=5');
    j.note('最接近的既有能力 /api/guestbook（访客留言 + 后台回复/关闭，GuestbookController.java:16-128）：'
      + '它是「给企业留一句话」的工单，不挂在任何一篇文章下面，没有 article_id 归属 ⇒ 不能算 G-08',
      { code: guestbook.code, status: guestbook.status, message: guestbook.message.slice(0, 80) });
    const guestbookTable = await db.rows<{ n: number }>(
      `SELECT COUNT(*) AS n FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'guestbook_message'`);
    j.note('留言板表有没有 article_id 这一列（有才算「文章下面留言」）', await db.rows<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'guestbook_message' AND column_name LIKE '%article%'`));
    j.expect('留言板表里没有 article_id 列（所以它不是文章评论的另一种写法）',
      (await db.rows<{ c: number }>(
        `SELECT COUNT(*) AS c FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'guestbook_message' AND column_name = 'article_id'`
      ))[0]?.c, 0);
    j.note('guestbook 表的列数（结构确实活着，只是与文章无关）', Number(guestbookTable[0]?.n));
  } finally {
    if (A) {
      await retireTenant((await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api, j, A);
      j.note('收尾后再读一次两张互动表（本轮所有探测都没往里写东西）', {
        article_comment: await db.count('SELECT COUNT(*) AS n FROM article_comment'),
        article_like: await db.count('SELECT COUNT(*) AS n FROM article_like'),
        A_article: await db.count('SELECT COUNT(*) AS n FROM article WHERE tenant_id = ?', [A.tenantId]),
        A_task: await db.count('SELECT COUNT(*) AS n FROM article_generation_task WHERE tenant_id = ?', [A.tenantId]),
      });
    }
    const left = await residue(db);
    j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
    j.note('残留清点', left);
    await db.close();
  }
  j.assertClean();
});
