import { test } from '@playwright/test';
import mysql from 'mysql2/promise';
import { Api, type Envelope } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J07 读者互动（判据 G-08「前台文章可以评论、点赞」design.md:867）
 *
 * 上一轮这一条判的是「有没有」，实测写口全部不存在、两张表全站 0 行 ⇒ G-08 未达成。
 * 本轮 P9-C 把整块做完了，所以判据换成「四条拍板落地成什么形状」：
 *   拍板 1（方案1，一次做全 + 默认关 + 开通落在租户本人账号 + 前台不带 AI 标识）
 *   拍板 2（默认进人工待审，租户可切成「安全闸判过直接显示」）
 *   拍板 3（点赞沿用 article_like.ip_address 明文去重 —— 与 G-10「IP 只进散列」的冲突就地登记）
 *   拍板 4（四道闸全接：XssFilter / 长度与重复 / AntiSpam 限流与敏感词 / 内容安全闸判拒降级进待审）
 * 立项原话里的形状约束也在这里判：「点赞：AI 在发布的时候就把数量写上。评论：AI 在随机时间生成……
 * 文章发布时间的前一个月，而且不要太有规律」—— 后半句读的是 comment_seed_task.fire_at 的分布。
 *
 * 这一处偏离 runner 纪律（lib/db.ts 只读、写一律走业务接口）是刻意且唯一的：
 * 第 10 步用一条直连 UPDATE 把【本轮探针自己那一行】comment_seed_task.fire_at 挪到 NOW()+15s，
 * 目的是让「到点真的补一条 AI 评论」这一支在一次跑里真的跑到，而不是等一到三十天。
 * 它不伪造任何业务行、不改状态、不改别人的行，改完的结论仍然由 cron + 模型 + 读口三段真链路产生。
 * 除此之外本用例一次写库都没有。
 *
 * 真花钱：1 次文章生成（约 90~180s）+ 1 次评论安全闸 + 1 次示例评论生成，共 3 次模型调用。
 * 真等：排产执行走 @Scheduled(cron="30 * * * * *")，一次跑里最多等 420s。
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

/** 后台「读者互动」那一页的口 */
const CFG = '/api/workspace/interaction/config';
const QUEUE = '/api/workspace/interaction/comments';
const STATS = '/api/workspace/interaction/stats';
const SEEDS = '/api/workspace/interaction/seed-tasks';

const num = (v: unknown): number => Number(v ?? -999);
const str = (v: unknown): string => String(v ?? '');
const rec = (v: unknown): Record<string, unknown> => (v ?? {}) as Record<string, unknown>;
const obj = (res: Envelope<unknown>): Record<string, unknown> => rec(res.data);
/** 回体里那一列 items：前台读口与后台队列都用 */
const listOf = (body: Record<string, unknown>): Array<Record<string, unknown>> =>
  recArr(body.items);
const recArr = (v: unknown): Array<Record<string, unknown>> =>
  (Array.isArray(v) ? v : []) as Array<Record<string, unknown>>;
const items = (res: Envelope<unknown>): Array<Record<string, unknown>> => listOf(obj(res));

test('SYS-J07 读者互动：评论、点赞、待审队列与系统补写真的跑不跑得动', async () => {
  test.info().setTimeout(1_500_000);
  const j = new Journal('SYS-J07');
  const db = new Db(j);
  const tag = process.env.E2E_J07_TAG ?? `J07${Date.now()}`;

  let A: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let articleId = 0;
  let probeConn: mysql.Connection | null = null;

  try {
    j.card({
      用例号: 'SYS-J07-01',
      判据: 'G-08（前台文章可以评论、点赞，design.md:867）+ P9-C 四条拍板（2026-10-05）',
      层级: 'API',
      前置: `后端 ${env.apiBase}（P9-C 代码在跑：Flyway 167/168/169 均 success=1）；`
        + `探针租户 ${tag} 现开并真的走完「开开关→生成→提审→通过→发布」；真调模型 3 次；`
        + 'dev 档 app.antispam max-submissions=10 / window-seconds=300、sensitive-words 为空',
      步骤: [
        '1 出厂状态：四个默认值 + 全关那句 disclosure + tenant_interaction_config 零行（读默认不许建行）',
        '2 四条非法配置逐个 PUT，逐条留话术，回读仍是出厂值',
        '3 A 家管理员本人开两个开关（每篇 10 条 / 点赞 20~30）⇒ updatedBy 是他本人、库里建行 1 行',
        '4 生成中文草稿 → 提审 → 人工通过 → 发布，published_at 从库里读',
        '5 发布那一刻：虚拟点赞真的写进了 article_like；comment_seed_task 排出 10 行，时刻落在发布后 1~30 天且不打堆',
        '6 匿名点赞三次（XFF 造两个访客）⇒ recorded 真/假/真、数往上加、库里是明文 IP（登记与 G-10 的冲突）、后台 likeCount 一起数',
        '7 读者写一条 → 前台看不到 → 租户放行 → 前台看得到，且前台条目不带 source 这一列',
        '8 驳回与摘除：驳回后行还在但前台不显示；终态想退回待审一律拒；action 拼错一律拒',
        '9 四道闸逐个实测：太短 / 全空白 / 带标签 / 蜜罐 / 重复同话 / 跨租户文章；敏感词那一道的现状如实记下',
        '10 把探针自己那一行排产的 fire_at 挪到 NOW()+15s ⇒ 等 cron 真跑：模型写出一条示例评论、落库 approved、前台多一条',
        '11 moderationMode=auto：干净评论要么直接 approved，要么 pending 且行上留着那句判词，不许静默丢弃',
        '12 同一个 IP 连发不同话 ⇒ 第 11 条撞限流，回的是那句中文而不是静默丢弃',
        '13 总账：stats 十键与库里逐表数一致；队列回 source/sourceText/文章标题；seed-tasks 十条带时刻',
        '14 摘除（软删）：前台立刻少一条，行仍留在库里，del_flag=1',
        '15 G-09 那条 translate-reply 仍 404（并入 G-06 了）、留言板表没有 article_id、预览档不可达 ⇒ 三条如实记 note',
      ],
      期望: [
        'G-08 的达成判据：公开写口回 OK 且库里真的有行；前台读口出已放行的评论与点赞数',
        '拍板 1：默认全关、读默认不建行、按开的那一下 updatedBy=租户本人账号',
        '拍板 2：默认 review 一切进待审；切成 auto 后判不过也只是降级，不是丢弃',
        '拍板 4：被拦下的每一发都回真错与那句中文（与留资的静默形状刻意不同）',
        '排产分布：fire_at 全部落在 published_at 后 1~30 天，天数去重 ≥5，相邻间隔不重复成等间隔',
      ],
      反例: [
        '若写口回 404 或评论一行都不落 ⇒ G-08 仍未达成（上一轮的红就是这个）',
        '若前台读口返回了 source 列 ⇒ 违反拍板 1「前台不带 AI 标识」',
        '若模型不可用时示例评论拿固定模板顶数 ⇒ 违反「补不上就标失败」',
      ],
      口径: '限流键是 action:IP，评论与点赞各算一份；访客身份用 X-Forwarded-For 第一段造，'
        + '所以限流那一发只烧 203.0.113.77 那个专用访客的额度，不影响前面几条断言。'
        + '跨租户那一档：访客拿别人家的文章 id 写评论必须回「这篇文章不存在或未发布」，不是「这篇不属于你」。',
      收尾: 'A 走 DELETE /api/admin/tenants/{id} 软删；互动四表按租户逐表清点残留；'
        + '本轮唯一一次直连 SQL 只改了探针自己那一行排产的时刻，没有伪造业务行',
    });

    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    A = await provisionTenant(sa.api, db, j, tag);
    const admin = A.admin;
    const anon = Api.anonymous(env.apiBase, j);
    const siteQ = `site=${A.siteCode}`;

    // 每一发内容都要唯一：重复判定窗口 30 分钟，同话第二发会被蜜罐式静默吞掉
    let nonce = 0;
    const fresh = (text: string): string => `${text}（探针编号 ${++nonce}-${Date.now() % 100000}）`;
    const publicComments = () => anon.get(`/api/portal/public/articles/${articleId}/comments?${siteQ}&page=1&size=10`);
    const postComment = (content: string, ip?: string, extra: Record<string, unknown> = {}) =>
      anon.call('POST', `/api/portal/public/articles/${articleId}/comments?${siteQ}`,
        { authorName: 'E2E 读者探针', content, ...extra }, ip ? { 'X-Forwarded-For': ip } : {});
    const postLike = (ip: string) =>
      anon.call('POST', `/api/portal/public/articles/${articleId}/like?${siteQ}`, undefined, { 'X-Forwarded-For': ip });

    // ── 1 出厂状态：默认全关，读默认不建行 ────────────────────────────────
    const factory = obj(await admin.get(CFG));
    j.expect('出厂 aiCommentEnabled = 0（关）', num(factory.aiCommentEnabled), 0);
    j.expect('出厂 virtualLikeEnabled = 0（关）', num(factory.virtualLikeEnabled), 0);
    j.expect('出厂 moderationMode = review（先人工待审）', str(factory.moderationMode), 'review');
    j.expect('出厂每篇示例评论条数 = 3', num(factory.aiCommentMaxPerArticle), 3);
    j.expect('出厂虚拟点赞区间 = 6~28', [num(factory.likeSeedMin), num(factory.likeSeedMax)], [6, 28]);
    j.expect('出厂 updatedBy 为空（还没有人按过）', factory.updatedBy ?? null, null);
    j.expect('全关那句 disclosure 原文', str(factory.disclosure),
      '两个开关都关着：前台显示的评论与点赞数全部来自真人。');
    j.expect('读了默认值也不会为租户插一行', await db.count(
      'SELECT COUNT(*) AS n FROM tenant_interaction_config WHERE tenant_id = ?', [A.tenantId]), 0);

    // ── 2 校验只有一处：四条非法配置 ─────────────────────────────────────
    const illegal: Array<[string, Record<string, unknown>, string]> = [
      ['点赞区间反向', { likeSeedMin: 40, likeSeedMax: 6 }, '虚拟点赞上界不能小于下界：收到下界 40、上界 6'],
      ['条数越上界', { aiCommentMaxPerArticle: 11 }, '每篇示例评论条数只能在 1~10 之间，收到：11'],
      ['审核模式乱填', { moderationMode: 'publish' },
        '评论处理方式只能是 review（先进人工待审）或 auto（安全闸判过直接显示），收到：publish'],
      ['开关不是布尔', { aiCommentEnabled: 'maybe' }, 'AI 示例评论开关只能是开或关，收到：maybe'],
    ];
    for (const [label, body, wantMessage] of illegal) {
      const res = await admin.put(CFG, body);
      j.expect(`${label}：回 ERROR`, res.code, 'ERROR');
      j.expect(`${label}：话术原文`, res.message, wantMessage);
    }
    const stillFactory = obj(await admin.get(CFG));
    j.expect('四条非法配置一条都没落库（回读仍是出厂区间 6~28）',
      [num(stillFactory.likeSeedMin), num(stillFactory.likeSeedMax), num(stillFactory.aiCommentMaxPerArticle),
        str(stillFactory.moderationMode)], [6, 28, 3, 'review']);

    // ── 3 开关由租户本人按下去：updatedBy 记的就是这个人 ─────────────────
    const on = obj(await admin.put(CFG, {
      aiCommentEnabled: 1, virtualLikeEnabled: 1, moderationMode: 'review',
      aiCommentMaxPerArticle: 10, likeSeedMin: 20, likeSeedMax: 30,
    }));
    j.expect('开示例评论', num(on.aiCommentEnabled), 1);
    j.expect('开虚拟点赞', num(on.virtualLikeEnabled), 1);
    j.expect('每篇排产 10 条', num(on.aiCommentMaxPerArticle), 10);
    j.expect('点赞区间配成 20~30', [num(on.likeSeedMin), num(on.likeSeedMax)], [20, 30]);
    j.expect('updatedBy = A 家管理员本人（不是超管代按）', num(on.updatedBy), A.adminPrincipal.userId);
    j.expect('按开关才建行，且只有一行', await db.count(
      'SELECT COUNT(*) AS n FROM tenant_interaction_config WHERE tenant_id = ?', [A.tenantId]), 1);
    const disclosureOn = str(on.disclosure);
    j.check('开以后的 disclosure 写明「前台不带 AI 标识」', disclosureOn, disclosureOn.includes('前台不带 AI 标识'));
    j.check('开以后的 disclosure 写明「旧稿不会被回头补」', disclosureOn, disclosureOn.includes('已发布的旧稿不会被回头补'));
    j.note('开以后的 disclosure 全文', disclosureOn);

    // ── 4 先真的有一篇已发布的文章 ───────────────────────────────────────
    const gen = await admin.post('/api/workspace/articles/generate-async', { keyword: '儿童近视防控有哪些方法' });
    j.expect('提交生成回 OK', gen.code, 'OK');
    const taskId = num(obj(gen).taskId);
    j.check('拿到 taskId', taskId, taskId > 0);
    const done = await waitTask(admin, j, taskId, 600_000);
    j.expect('任务终态 = COMPLETED', done.status, 'COMPLETED');
    articleId = num(done.articleId);
    j.check('COMPLETED 带出 articleId', articleId, articleId > 0);
    j.expect('提审回 OK', (await admin.post(`/api/workspace/articles/${articleId}/submit-review`)).code, 'OK');
    j.expect('人工通过回 OK',
      (await admin.post(`/api/workspace/reviews/${articleId}/approve`, { comment: '互动探针，可以发' })).code, 'OK');
    j.expect('发布回 OK', (await admin.post(`/api/workspace/publish/${articleId}`)).code, 'OK');
    j.expect('库里这篇确实是 published', await db.count(
      "SELECT COUNT(*) AS n FROM article WHERE id = ? AND status = 'published' AND del_flag = '0'", [articleId]), 1);
    const publishedAt = str((await db.rows<{ p: string }>(
      "SELECT DATE_FORMAT(published_at, '%Y-%m-%d %H:%i:%s') AS p FROM article WHERE id = ?", [articleId]))[0]?.p);
    j.check('published_at 有值（排产窗口以它为零点）', publishedAt, publishedAt !== 'undefined' && publishedAt !== '');

    // ── 5 发布那一刻：点赞写了、评论排了 ─────────────────────────────────
    const virtualLikes = await db.count(
      "SELECT COUNT(*) AS n FROM article_like WHERE article_id = ? AND source = 'virtual' AND del_flag = '0'",
      [articleId]);
    j.check(`虚拟点赞落在配置的 20~30 区间内（实测 ${virtualLikes}）`, virtualLikes,
      virtualLikes >= 20 && virtualLikes <= 30);
    j.note('虚拟点赞那几行的 ip_address 形状（拍板：来源标在 source 列，不藏在 IP 里伪装真人）',
      await db.rows<{ ip: string }>(
        "SELECT ip_address AS ip FROM article_like WHERE article_id = ? AND source = 'virtual' LIMIT 3", [articleId]));
    const seedRows = await db.rows<{ id: number; seq: number; fire: string; status: string }>(
      `SELECT id, seq, DATE_FORMAT(fire_at, '%Y-%m-%d %H:%i:%s') AS fire, status
       FROM comment_seed_task WHERE article_id = ? ORDER BY seq`, [articleId]);
    j.expect('按配置排满 10 条示例评论计划', seedRows.length, 10);
    j.expect('排产全部是待执行', [...new Set(seedRows.map(r => r.status))], ['PENDING']);
    const windowCheck = await db.rows<{ seq: number; diff: number }>(
      `SELECT seq, DATEDIFF(fire_at, (SELECT published_at FROM article WHERE id = ?)) AS diff
       FROM comment_seed_task WHERE article_id = ?`, [articleId, articleId]);
    j.expect('★窗口：10 条时刻全部落在发布后 1~30 天内（越界的必须是 0 行）',
      windowCheck.filter(r => !(r.diff >= 1 && r.diff <= 30)), []);
    const distinctDays = await db.count(
      'SELECT COUNT(DISTINCT DATE(fire_at)) AS n FROM comment_seed_task WHERE article_id = ?', [articleId]);
    j.check(`「不要太有规律」①：10 条分散在 ≥5 个不同日期（实测 ${distinctDays} 天）`, distinctDays, distinctDays >= 5);
    const gapCounts = new Map<number, number>();
    const sortedByFire = [...seedRows].sort((l, r) => l.fire.localeCompare(r.fire));
    for (let i = 1; i < sortedByFire.length; i++) {
      const hours = Math.round((Date.parse(sortedByFire[i].fire.replace(' ', 'T')) -
        Date.parse(sortedByFire[i - 1].fire.replace(' ', 'T'))) / 3_600_000);
      gapCounts.set(hours, (gapCounts.get(hours) ?? 0) + 1);
    }
    const maxRepeat = Math.max(0, ...gapCounts.values());
    j.check(`「不要太有规律」②：相邻间隔同一个值最多出现 2 次（实测 ${maxRepeat}，等间隔会到 9）`, maxRepeat, maxRepeat <= 2);
    j.note('相邻间隔分布（小时 → 出现次数）', [...gapCounts.entries()].sort((a, b) => a[0] - b[0]));

    // ── 6 匿名点赞：IP 去重 + 数一起数 + 明文 IP 登记 ─────────────────────
    const like1 = obj(await postLike('198.51.100.11'));
    j.expect('第一个访客点赞被记下', like1.recorded, true);
    j.expect('数 = 虚拟数 + 1', num(like1.likeCount), virtualLikes + 1);
    const like2 = obj(await postLike('198.51.100.11'));
    j.expect('同一个人第二次点不再记', like2.recorded, false);
    j.expect('数不涨（不骗人，也不偷偷减）', num(like2.likeCount), virtualLikes + 1);
    const like3 = obj(await postLike('198.51.100.12'));
    j.expect('换一个人就记上', like3.recorded, true);
    j.expect('数 +1', num(like3.likeCount), virtualLikes + 2);
    const readerIpRows = await db.rows<{ ip: string }>(
      "SELECT ip_address AS ip FROM article_like WHERE article_id = ? AND source = 'reader' ORDER BY ip_address",
      [articleId]);
    j.expect('库里真实点赞两行，ip_address 存的是明文（★登记：与 G-10「IP 只进散列」冲突，拍板 3 沿用现状）',
      readerIpRows.map(r => r.ip), ['198.51.100.11', '198.51.100.12']);
    const backDetail = obj(await admin.get(`/api/articles/${articleId}`));
    j.expect('后台那一篇的 likeCount = 虚拟 + 真实（两个来源一起数）', num(backDetail.likeCount), virtualLikes + 2);

    // ── 7 默认 review：写了要等人放行才对外 ──────────────────────────────
    const c1 = fresh('文章写得挺实用的，想再问一下具体的做法');
    const post1 = await postComment(c1);
    const r1 = obj(post1);
    j.expect('提交回 OK（这一条链真的收下了访客写的话）', post1.code, 'OK');
    j.expect('回执 accepted = true（真的落库了）', r1.accepted, true);
    j.expect('回执 needsReview = true', r1.needsReview, true);
    j.expect('那句待审话术原文', str(r1.message), '已提交，站主审核通过后会显示在页面上');
    let front = obj(await publicComments());
    j.expect('★还没放行时前台一条都不显示', num(front.total), 0);
    const queueRes = await admin.get(`${QUEUE}?status=pending`);
    j.expect('后台待审队列回 OK', queueRes.code, 'OK');
    const queued = items(queueRes).find(c => c.content === c1);
    j.check('队列里看得到这一条', queued ?? null, queued !== undefined);
    const commentId = num(queued?.id);
    j.check('拿到评论 id', commentId, commentId > 0);
    j.expect('后台认得这是「读者写的」（source 只在后台回）', str(queued?.sourceText), '读者写的');
    j.expect('后台队列回体的键（前台不回的那三列只在这里回）',
      Object.keys(queued ?? {}).sort(),
      ['articleId', 'articleTitle', 'authorName', 'content', 'createdAt', 'id', 'moderationNote',
        'reviewedAt', 'source', 'sourceText', 'status'].sort());
    const approvedRes = obj(await admin.post(`/api/workspace/interaction/comments/${commentId}/moderate`, { action: 'approve' }));
    j.expect('放行后状态 = approved', str(approvedRes.status), 'approved');
    front = obj(await publicComments());
    j.expect('放行之后前台立刻显示 1 条', num(front.total), 1);
    const entryKeys = Object.keys((listOf(front)[0] ?? {})).sort();
    j.expect('前台评论条目的键恰好这四个（没有 source、没有 moderationNote）',
      entryKeys, ['authorName', 'content', 'createdAt', 'id']);
    const again = await admin.post(`/api/workspace/interaction/comments/${commentId}/moderate`, { action: 'approve' });
    j.expect('已放行的想再放行一次要被判非法转移', again.code, 'INVALID_COMMENT_STATUS');
    j.note('非法转移那句原文', again.message);

    // ── 8 驳回 / 摘除 / 拼错动作 ─────────────────────────────────────────
    const c2 = fresh('请问这一家的门诊需要提前预约吗，谢谢');
    const id2 = await submitAndFindId(c2);
    j.expect('驳回回 OK', (await admin.post(`/api/workspace/interaction/comments/${id2}/moderate`,
      { action: 'reject' })).code, 'OK');
    j.expect('驳回之后前台仍然看不到', num(obj(await publicComments()).total), 1);
    j.expect('驳回不是删：行留在库里（能查租户处理过什么）', await db.count(
      "SELECT COUNT(*) AS n FROM article_comment WHERE id = ? AND status = 'rejected' AND del_flag = '0'", [id2]), 1);
    const rejectThenApprove = await admin.post(`/api/workspace/interaction/comments/${id2}/moderate`, { action: 'approve' });
    j.expect('驳回是终态，想反悔改放行一律拒', rejectThenApprove.code, 'INVALID_COMMENT_STATUS');
    const badAction = await admin.post(`/api/workspace/interaction/comments/${id2}/moderate`, { action: 'publish' });
    j.expect('action 拼错一律拒（旧代码「不是 approve 就当 reject」那个坑）', badAction.code, 'COMMENT_ACTION_INVALID');
    j.expect('拼错那句原文', badAction.message, '队列上的动作只能是 approve / reject / remove，收到：publish');

    // ── 9 四道闸逐个实测：被拦下要回真错，不许静默吞 ──────────────────────
    const tooShort = await postComment('好');
    j.expect('闸②：一个字被拦', tooShort.code, 'COMMENT_TOO_SHORT');
    j.expect('太短那句原文', tooShort.message, '评论至少写 2 个字');
    j.expect('闸②：只有空白的按「太短」处理', (await postComment('      ')).code, 'COMMENT_TOO_SHORT');
    const withTag = await postComment('这家医院<b>非常好</b>，推荐给大家');
    j.expect('闸①+②：XssFilter 只剥 script/iframe 那一类，残留的尖括号一律不收',
      withTag.code, 'COMMENT_HTML_NOT_ALLOWED');
    j.expect('带标签那句原文', withTag.message, '评论里不许带标签');
    const honeypot = obj(await postComment(fresh('正常长度的一句话，但是机器人发的'), undefined, { website: 'http://spam.invalid' }));
    j.expect('蜜罐：回的是成功形状', str(honeypot.message), '已提交，感谢留言');
    j.expect('蜜罐：accepted = false，一行都没落', honeypot.accepted, false);
    const c3 = fresh('内容很好，我家孩子做完视力复查之后反馈不错');
    const firstOfDup = await postComment(c3);
    j.expect('重复判定之前的那一发正常收下', firstOfDup.code, 'OK');
    const secondOfDup = obj(await postComment(c3));
    j.expect('同一篇同一句话第二发被静默判成灌水（回成功但不落库）', str(secondOfDup.message), '已提交，感谢留言');
    j.expect('第二发确实没落库（此刻这一篇身上读者写的正好 3 行：c1 已放行 / c2 已驳回 / c3 待审）', await db.count(
      "SELECT COUNT(*) AS n FROM article_comment WHERE article_id = ? AND source = 'reader' AND del_flag = '0'",
      [articleId]), 3);
    const foreign = await db.rows<{ id: number }>(
      "SELECT id FROM article WHERE tenant_id <> ? AND status = 'published' AND del_flag = '0' LIMIT 1", [A.tenantId]);
    if (foreign.length === 1) {
      const wrongArticle = await anon.call('POST',
        `/api/portal/public/articles/${foreign[0].id}/comments?${siteQ}`,
        { authorName: 'E2E 跨租户探针', content: fresh('拿别人家的文章 id 来这家写评论') });
      j.expect('跨租户：拿别人家的文章 id 写评论 = 「这篇文章不存在」，不是「这篇不属于你」',
        wrongArticle.code, 'COMMENT_ARTICLE_NOT_FOUND');
      j.expect('跨租户那句原文', wrongArticle.message, '这篇文章不存在或未发布，评论没有收到');
      const wrongRead = obj(await anon.get(`/api/portal/public/articles/${foreign[0].id}/comments?${siteQ}`));
      j.expect('跨租户读别人家的评论 = 空（前台不替别人数条数）',
        [num(wrongRead.total), listOf(wrongRead).length, num(wrongRead.likeCount)], [0, 0, 0]);
    } else {
      j.note('库里没有别家的已发布文章可当跨租户靶子，这一档由单测覆盖', { foreign: foreign.length });
    }
    const sensitive = await postComment(fresh('这一发用来测敏感词那一道会不会拦'));
    j.note('闸③的敏感词部分现状：dev 配置 app.antispam.sensitive-words 为空 ⇒ 这一道今天必然空跑，'
      + '限流那部分在下面第 12 步实测', { code: sensitive.code });

    // ── 10 到点真的补一条 AI 示例评论（本轮唯一一次直连 SQL，只改探针自己那一行）─
    // env.db 里那格叫 schema，mysql2 只认 database（systemtest/lib/db.ts 也是这么映射的）
    probeConn = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.schema,
      charset: 'utf8mb4',
    });
    const [moved] = await probeConn.execute(
      `UPDATE comment_seed_task SET fire_at = NOW() + INTERVAL 15 SECOND
       WHERE tenant_id = ? AND article_id = ? AND status = 'PENDING' ORDER BY fire_at ASC LIMIT 1`,
      [A.tenantId, articleId]);
    j.note('把探针自己那一行排产的时刻挪到 NOW()+15s（改动行数与理由见用例卡）', moved);
    let seeded: { id: number; status: string; commentId: number | null; fire: string; seq: number } | null = null;
    const waitStarted = Date.now();
    while (Date.now() - waitStarted < 420_000) {
      const rows = await db.rows<{ id: number; status: string; commentId: number | null; fire: string; seq: number }>(
        `SELECT id, status, comment_id AS commentId, DATE_FORMAT(fire_at, '%Y-%m-%d %H:%i:%s') AS fire, seq
         FROM comment_seed_task WHERE article_id = ? ORDER BY fire_at ASC LIMIT 1`, [articleId]);
      const first = rows[0] ?? null;
      j.note(`等 cron 真跑那一行排产 +${Math.round((Date.now() - waitStarted) / 1000)}s`, first);
      if (first && (first.status === 'DONE' || first.status === 'FAILED' || first.status === 'SKIPPED')) {
        seeded = first;
        break;
      }
      await new Promise(r => setTimeout(r, 5_000));
    }
    j.check('排产那一行在 420s 内到了终态（cron 每分钟的 :30 跑一次）', seeded?.status ?? '未等到',
      seeded !== null && seeded !== undefined);
    j.expect('★到点执行的结果 = DONE（FAILED=模型没给话，SKIPPED=判据拦下，两种都不能算 G-08 达成）',
      str(seeded?.status), 'DONE');
    j.check('DONE 那行带回了它写出来的评论 id', num(seeded?.commentId ?? 0), num(seeded?.commentId ?? 0) > 0);
    const seedComment = (await db.rows<{ source: string; status: string; author: string; content: string }>(
      'SELECT source, status, author_name AS author, content FROM article_comment WHERE id = ?',
      [num(seeded?.commentId ?? 0)]))[0];
    j.expect('系统补的这条：来源位是 ai_seed（后台认得，前台不认得）', seedComment?.source, 'ai_seed');
    j.expect('系统补的这条一律直接 approved（不然前台空着，判据当场测不了）', seedComment?.status, 'approved');
    j.note('模型真的写出来的那句示例评论与昵称', seedComment);
    j.check('内容里没有出现「AI」「示例」这类自曝字样', seedComment?.content ?? '',
      !/AI|人工智能|示例/.test(seedComment?.content ?? ''));
    front = obj(await publicComments());
    j.expect('补完之后前台从 1 条变 2 条（读者看不出哪条是补的）', num(front.total), 2);
    j.expect('前台条目仍然只有那四个键（补写的内容也一样不带来源）',
      Object.keys(listOf(front)[0] ?? {}).sort(), ['authorName', 'content', 'createdAt', 'id']);
    // ★P9-D 改口：这两支（示例评论 comment_seed、评论安全闸 comment_moderation）走的是
    // AiFailoverService.completeWithFallback，P3/P9-C 那几轮里这一条链只报 Micrometer 指标、
    // 不写 ai_call_log ⇒ 这里当时钉的是实测 0（登记为 N-P9c-1 那条「花钱无账」的缺口）。
    // 拍板「在新路一处补落库」之后，判据翻成「有行，而且四要素齐」。
    // 计数按这一家来：全站按 purpose 数会把别人的轮次算进来，改口后更要认得出是谁花的钱。
    const traceOf = (purpose: string) => db.rows<Record<string, unknown>>(
      `SELECT purpose, status, success, provider, model, token_estimate, call_duration_ms,
              site_id, run_id, cost_estimate, input_hash
         FROM ai_call_log WHERE tenant_id = ? AND purpose = ? ORDER BY id`, [A.tenantId, purpose]);
    const checkTrace = async (purpose: string, 标签: string): Promise<void> => {
      const rows = await traceOf(purpose);
      j.expect(`★${标签}那一发落了 ai_call_log（修前实测 0 行 = N-P9c-1 那条缺口）`, rows.length >= 1, true);
      j.note(`${标签}的留痕原样`, rows);
      const ok = rows.filter(r => str(r.status) === 'success')[0];
      if (!ok) { j.expect(`${标签}：找不到成功的行`, false, true); return; }
      j.expect(`${标签}：① 状态 status=success 且 success 位一致`, [str(ok.status), num(ok.success)], ['success', 1]);
      j.expect(`${标签}：② 来源不是 unknown（是真服务它那台）`,
        str(ok.provider) !== 'unknown' && str(ok.model) !== 'unknown', true);
      j.check(`${标签}：③ 耗时有值且 > 0`, num(ok.call_duration_ms ?? 0), num(ok.call_duration_ms ?? 0) > 0);
      j.expect(`${标签}：④ 输入指纹是 64 位十六进制`,
        /^[0-9a-f]{64}$/.test(str(ok.input_hash)), true);
      j.check(`${标签}：token 估算落了值`, num(ok.token_estimate ?? 0), num(ok.token_estimate ?? 0) > 0);
      j.expect(`${标签}：site_id 落在这一家的站上`, num(ok.site_id ?? -1), A.siteId);
      j.expect(`${标签}：run_id 为空（互动不属于任何一轮 GEO 诊断）`, ok.run_id, null);
    };
    await checkTrace('comment_seed', '示例评论那一发');
    j.note('本轮 ai_call_log 里这一家的全部行（看这一家的钱到底记在了哪些用途上）', await db.rows(
      'SELECT purpose, model, success, cost_estimate AS cost FROM ai_call_log WHERE tenant_id = ? ORDER BY id',
      [A.tenantId]));

    // ── 11 auto 模式：判不过只是降级，不是丢弃 ───────────────────────────
    j.expect('切成 auto 回 OK', (await admin.put(CFG, { moderationMode: 'auto' })).code, 'OK');
    const c4 = fresh('请问文章的视力训练方法一天做几次比较合适，谢谢');
    const id4 = await submitAndFindId(c4);
    const row4 = (await db.rows<{ status: string; note: string | null }>(
      'SELECT status, moderation_note AS note FROM article_comment WHERE id = ?', [id4]))[0];
    j.note('auto 模式下一句正常访客留言的判定结果（模型明确说干净才 approved）', row4);
    j.expect('★不许静默丢弃：要么直接 approved，要么退回待审且行上留着那句判词',
      row4?.status === 'approved' || (row4?.status === 'pending' && !!row4?.note), true);
    // 安全闸那一发只有 auto 模式才跑（ReaderCommentService:130 那个分支），所以这条改口的断言挂在这里，
    // 不像 P9-C 那一轮挂在第 10 步——那时跑到的位置压根还没调过模型，「=0」是条永真断言。
    await checkTrace('comment_moderation', '评论安全闸那一发');
    j.expect('切回 review 回 OK', (await admin.put(CFG, { moderationMode: 'review' })).code, 'OK');

    // ── 12 限流：同一个访客连着灌 ────────────────────────────────────────
    const spamIp = '203.0.113.77';
    let limitedAt = 0;
    let limitedMessage = '';
    for (let i = 1; i <= 14 && limitedAt === 0; i++) {
      const res = await postComment(fresh(`第 ${i} 发限流探针，内容各不相同所以不会被重复判定拦下`), spamIp);
      if (res.code === 'SPAM_RATE_LIMITED') {
        limitedAt = i;
        limitedMessage = res.message;
      }
    }
    j.expect('★dev 档 max-submissions=10 ⇒ 同一个 IP 的第 11 条撞限流', limitedAt, 11);
    j.expect('限流回的是真错与那句中文（与留资的静默形状刻意不同：写的人正对着输入框）',
      limitedMessage, '提交过于频繁，请稍后再试');

    // ── 13 总账：租户按了开关就得能查系统替他补了多少 ────────────────────
    const statsRes = await admin.get(STATS);
    j.expect('总账口回 OK', statsRes.code, 'OK');
    const stats = obj(statsRes);
    j.expect('stats 的十个键', Object.keys(stats).sort(), [
      'approvedReaderComments', 'pendingReaderComments', 'readerComments', 'readerLikes', 'seedDone',
      'seedFailed', 'seedPending', 'seedSkipped', 'seededComments', 'virtualLikes'].sort());
    const dbNum = async (sql: string, params: unknown[] = []): Promise<number> => db.count(sql, params);
    j.expect('readerComments 与库里逐表一致', num(stats.readerComments), await dbNum(
      "SELECT COUNT(*) AS n FROM article_comment WHERE tenant_id = ? AND source = 'reader' AND del_flag = '0'",
      [A.tenantId]));
    j.expect('seededComments 与库里逐表一致', num(stats.seededComments), await dbNum(
      "SELECT COUNT(*) AS n FROM article_comment WHERE tenant_id = ? AND source = 'ai_seed' AND del_flag = '0'",
      [A.tenantId]));
    j.expect('virtualLikes 与库里逐表一致', num(stats.virtualLikes), await dbNum(
      "SELECT COUNT(*) AS n FROM article_like WHERE tenant_id = ? AND source = 'virtual' AND del_flag = '0'",
      [A.tenantId]));
    j.expect('readerLikes 与库里逐表一致', num(stats.readerLikes), await dbNum(
      "SELECT COUNT(*) AS n FROM article_like WHERE tenant_id = ? AND source = 'reader' AND del_flag = '0'",
      [A.tenantId]));
    j.expect('排产四态：1 条真跑完、9 条还没到点、没有跳过也没有失败',
      [num(stats.seedDone), num(stats.seedPending), num(stats.seedSkipped), num(stats.seedFailed)], [1, 9, 0, 0]);
    const rejectedReader = await dbNum(
      "SELECT COUNT(*) AS n FROM article_comment WHERE tenant_id = ? AND source = 'reader' AND status = 'rejected' AND del_flag = '0'",
      [A.tenantId]);
    j.expect('readerComments = 已放行 + 待审 + 已驳回（驳回那一档也算在读过的数里，不是丢了）',
      num(stats.approvedReaderComments) + num(stats.pendingReaderComments) + rejectedReader,
      num(stats.readerComments));
    const allQueue = obj(await admin.get(`${QUEUE}?status=all&size=50`));
    j.expect('队列一屏装得下本轮所有评论', num(allQueue.total),
      num(stats.readerComments) + num(stats.seededComments));
    const qCounts = rec(allQueue.counts);
    j.expect('队列三档计数与总账口径一致',
      [num(qCounts.pending), num(qCounts.approved), num(qCounts.rejected)],
      [num(stats.pendingReaderComments),
        num(stats.approvedReaderComments) + num(stats.seededComments),
        await dbNum("SELECT COUNT(*) AS n FROM article_comment WHERE tenant_id = ? AND status = 'rejected' AND del_flag = '0'", [A.tenantId])]);
    j.check('队列里的补写条目带得出「系统按开关补的示例评论」这句话',
      listOf(allQueue).some(c => str(c.sourceText) === '系统按开关补的示例评论'), true);
    j.check('队列回文章标题（租户看队列要知道是哪篇）',
      listOf(allQueue).every(c => str(c.articleTitle).length > 0), true);
    // 形状就地登记：同一份控制器里 /comments 回 {items,total,counts}，/seed-tasks 直接回一个数组
    // （WorkspaceInteractionController:200-229 → ApiResponse<List<Map>>）⇒ 这里剥的是 data 本身
    const seedResp = await admin.get(`${SEEDS}?articleId=${articleId}&limit=20`);
    const seedList = recArr(seedResp.data);
    j.note('排产清单口的回体形状与队列口不同（数组 vs {items,total,counts}），本轮如实测出来一次',
      { dataType: Array.isArray(seedResp.data) ? 'array' : typeof seedResp.data, length: seedList.length });
    j.expect('排产清单口回得到这一篇的 10 条', seedList.length, 10);
    j.check('时刻字段回给界面了（「不要太有规律」要能在界面上看）',
      seedList.every(t => str(t.fireAt).length > 0), true);
    j.expect('还没到点的行不带跳过原因（skipReasonText 只给真被拦下的那些）',
      seedList.filter(t => str(t.status) === 'PENDING' && t.skipReasonText !== null && str(t.skipReasonText) !== ''), []);

    // ── 14 摘除 = 软删：前台立刻消失，行仍留在库里 ───────────────────────
    const removed = obj(await admin.post(`/api/workspace/interaction/comments/${commentId}/moderate`, { action: 'remove' }));
    j.expect('摘除回的状态是 removed（不是 approved 也不是 rejected）', str(removed.status), 'removed');
    const expectApproved = await dbNum(
      "SELECT COUNT(*) AS n FROM article_comment WHERE article_id = ? AND status = 'approved' AND del_flag = '0'",
      [articleId]);
    j.expect('前台显示的条数 = 库里「已放行且没删」的行数（口径只有一处）',
      num(obj(await publicComments()).total), expectApproved);
    j.expect('摘除的那一行还物理存在（del_flag=1，读者写过什么这件事留得住）', await dbNum(
      "SELECT COUNT(*) AS n FROM article_comment WHERE id = ? AND del_flag = '1'", [commentId]), 1);
    j.expect('活着的行数比全部行数少 1', await dbNum(
      "SELECT COUNT(*) AS n FROM article_comment WHERE article_id = ? AND del_flag = '0'", [articleId]),
      await dbNum("SELECT COUNT(*) AS n FROM article_comment WHERE article_id = ?", [articleId]) - 1);

    // ── 15 三条现状如实记 note，不写进断言 ───────────────────────────────
    const translate = await anon.call('PUT', `/api/portal/public/comments/${commentId}/translate-reply`,
      { targetLocale: 'en' });
    j.note('G-09 的英文回复按拍板 B-3b 并入 G-06，这一条口仍然不存在（实测留档）',
      { status: translate.status, code: translate.code });
    j.note('留言板不是「文章下面留言」：portal_guestbook 没有 article_id 这一列', await db.rows<{ c: number }>(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'portal_guestbook' AND column_name = 'article_id'`));
    j.note('「靠预览令牌翻开的候选站不收评论、不记点赞」这一支现场不可达：站级令牌只由建站链内部签发'
      + '（ReviewSessionService.createForSite ← ClientDecisionService / SiteProposalOrchestrator），'
      + '管理端 POST /api/portal/review-sessions 只发 page 作用域的令牌 ⇒ 该分支由单测覆盖，不手写库行逼出来',
      { previewAuthorizedBranch: 'covered-by-unit-test' });

    // ── 局部 helper（放最后，闭包里的 A/articleId 已经稳定）───────────────
    async function submitAndFindId(content: string): Promise<number> {
      const res = await postComment(content);
      j.expect('提交回 OK', res.code, 'OK');
      const found = await db.rows<{ id: number }>(
        'SELECT id FROM article_comment WHERE article_id = ? AND content = ? ORDER BY id DESC LIMIT 1',
        [articleId, content]);
      const id = num(found[0]?.id);
      j.check('这一条落库了，拿到 id', id, id > 0);
      return id;
    }
  } finally {
    if (probeConn) await probeConn.end().catch(() => undefined);
    if (A) {
      const again = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
      await retireTenant(again.api, j, A);
      j.note('收尾：租户软删之后互动四表的行数（登记表清理链没接这一块的现状）', {
        tenant_interaction_config: await db.count(
          'SELECT COUNT(*) AS n FROM tenant_interaction_config WHERE tenant_id = ?', [A.tenantId]),
        article_comment_all: await db.count(
          'SELECT COUNT(*) AS n FROM article_comment WHERE tenant_id = ?', [A.tenantId]),
        article_comment_live: await db.count(
          "SELECT COUNT(*) AS n FROM article_comment WHERE tenant_id = ? AND del_flag = '0'", [A.tenantId]),
        article_like_all: await db.count('SELECT COUNT(*) AS n FROM article_like WHERE tenant_id = ?', [A.tenantId]),
        comment_seed_task: await db.count(
          'SELECT COUNT(*) AS n FROM comment_seed_task WHERE tenant_id = ?', [A.tenantId]),
        article: await db.count('SELECT COUNT(*) AS n FROM article WHERE tenant_id = ?', [A.tenantId]),
      });
      j.note('★登记待办：租户软删不会带走评论/点赞/排产/配置四张表的行', {
        原因: 'V167/V168 都没接清理，e2e 一次性清理端点也没覆盖互动域',
        处置: '本轮留下的是探针租户的数据，写进报告而不静默扩大清理范围',
      });
    }
    const left = await residue(db);
    j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
    j.note('残留清点', left);
    await db.close();
  }
  j.assertClean();
});
