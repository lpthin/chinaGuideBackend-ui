import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J04 两级审核与多语言版（判据 G-05、G-06）
 *
 * G-05（design.md：AI 先审、人复核；AI 不许替人把状态推走）：
 *   `POST /api/workspace/articles/{id}/ai-prereview` 只往 article_ai_review 追加一行，
 *   一个字节都不碰 article.status（ArticlePreReviewService.java:59-94 —— 里面没有 articleMapper.updateById）。
 *   预审给的 verdict 也不当闸门：approve 只认「状态=pending_review」这一条（WorkspaceController.java:2070-2073），
 *   AI 说 reject 人照样能过，AI 说 pass 文章也不会自己往上走一步。这两向都在这里各落一次地。
 *
 * G-06（design.md：同一篇要有中文版与英文版）：
 *   写侧：生成任务参数带 targetLocales 才翻译（TranslationStep.java:34-37 无参直接 return），
 *        译稿是**新插一行** article_version，locale=目标语、translation_status='translated'、ai_model 留痕（:65-79）。
 *   读侧：公开口根本没有 locale 参数（PortalPublicController 全文 0 处 locale），版本只有一版能摆出去，
 *        所以「哪一版算数」就是这一格的判据本体。
 *        修之前：列表与详情都取「id 最大的那一版」（PortalContentService.java / PortalAggregationService.java），
 *        译稿 id 更大 ⇒ 中文读者读到的是英文那版（run 1003-163357 实测红，见 §3D）。
 *        修之后：处处走 ArticleVersions.preferred —— 认文章/站点的 source_locale 那一版，同语言多行取其中最新，
 *        没有源语言行才回落最新一条（老数据不许因此读不到东西）；16 个调用点列在报告 §3D 的表里。
 *        run 1003-172048 复跑：公开口回的是中文标题（绿），预审 versionId 与待审列表标题也一起对上源语言行。
 *   仍未解决：全站在读者侧和后台都没有「切语言」的入口（api/workspace.ts:185 compareVersions 无调用方）
 *        ⇒ 英文版实际无人能读。这一条不判绿，等 Q-P3 拍板。
 *
 * 真花钱：1 次生成（含 1 次翻译；run 1003-163357 实测这一发全程 172s，同一家不带 targetLocales 的那一篇
 * 是 90.6s ⇒ 差额就是翻译那一跳的模型调用）+ 2 次预审（purpose=article_review，各一行留痕）。
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

test('SYS-J04 两级审核与多语言版：AI 只出意见、人盖章；译稿要读得到', async () => {
  test.info().setTimeout(900_000);
  const j = new Journal('SYS-J04');
  const db = new Db(j);

  let A: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let articleId = 0;
  const statusAt = async (id: number) => (await db.rows<{ status: string }>(
    'SELECT status FROM article WHERE id = ?', [id]))[0]?.status;

  try {
    j.card({
      用例号: 'SYS-J04-01',
      判据: 'G-05、G-06',
      层级: 'API',
      前置: `后端 ${env.apiBase}；探针租户由 POST /api/admin/tenants 现开；真调模型 3 次（生成 1 + 翻译内含 + 预审 2）`,
      步骤: [
        '1 开探针租户 A，生成一篇中文草稿：本次带 targetLocales=["en-US"]（G-06 的写侧）',
        '2 库里对账两版：zh-CN 是 source、en-US 是 translated，两版正文都非空、ai_model 都留了痕',
        '3 反例：draft 状态直接 approve → code=ERROR「只有待审核的文章可以审核通过」，状态没动',
        '4 提审 → pending_review',
        '5 AI 预审第 1 次：回体十个键 + article_ai_review 追加一行；关键断言 article.status 一个字都没变（G-05）',
        '6 待审列表 GET /api/workspace/reviews/pending 里认得到这篇，且带着这次预审的分与结论（预审是给人看的，不是藏起来的）；列表标题必须是源语言那一版的标题',
        '7 AI 预审第 2 次：追加不覆盖（重新预审留历史，界面取最新一条）',
        '8 人盖章 approve → 状态到 approved，reviewer=这个管理员',
        '9 发布 → published，公开口读得到（读侧按源语言那一版判，本站 source_locale=zh-CN）',
      ],
      期望: [
        '步骤 2 两版都在，译稿 translation_status=translated（不是 source、不是 pending）；且译稿行 id 大于源语言行（反例形状成立，后面两条才测得出取的是哪一版）',
        '步骤 5 预审前后 article.status 全等（AI 不许推状态）；预审给的 verdict 是 pass/caution/reject 之一；versionId=源语言那一版',
        '步骤 7 同一篇有 ≥2 行预审记录（追加语义，不是 upsert 覆盖）',
        '步骤 9 只有人盖过章的才发得出去；中文读者读到的是中文版（G-06 读侧）',
      ],
      反例: ['draft 直接 approve 被拦', 'AI 说 pass 之后状态仍然没动',
        '没提审的文章不出现在待审列表里（这一步反证 pending_review 是唯一的入列表凭据）',
        '读侧若退回「id 最大的那一版」，步骤 2 那条反例形状 + 步骤 5/6 的 versionId 与标题会同时变红'],
      收尾: 'DELETE /api/admin/tenants/{id} 软删探针租户；article / article_version / article_ai_review 残留逐张报数',
    });

    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    A = await provisionTenant(sa.api, db, j, 'J04');
    const admin = A.admin;

    // ── 1 生成：这一次带上 targetLocales，走 TranslationStep ────────────────
    const gen = await admin.post('/api/workspace/articles/generate-async', {
      keyword: '种植牙和正畸的区别', targetLocales: ['en-US'],
    });
    j.expect('提交生成回 OK', gen.code, 'OK');
    const taskId = Number((gen.data as Record<string, unknown>)?.taskId ?? 0);
    j.check('拿到 taskId', taskId, taskId > 0);
    const done = await waitTask(admin, j, taskId, 420_000);
    j.expect('任务终态 = COMPLETED（译稿失败在 TranslationStep 里是 catch 掉继续跑的，所以「完成」不等于「两版都有」，下一步单独查库）',
      done.status, 'COMPLETED');
    articleId = Number(done.articleId ?? 0);
    j.check('COMPLETED 带出 articleId', articleId, articleId > 0);

    // ── 2 两版对账（G-06 写侧） ────────────────────────────────────────────
    const versions = await db.rows<{ id: number; locale: string; title: string; translation_status: string; body: number; ai_model: string | null }>(
      `SELECT id, locale, title, translation_status, CHAR_LENGTH(content_md) AS body, ai_model
       FROM article_version WHERE article_id = ? AND del_flag = '0' ORDER BY id`, [articleId]);
    const byLocale = new Map(versions.map(v => [v.locale, v]));
    // 「源语言那一版」的出处要和 ArticleVersions.preferred 同口径：同语言多行时取其中最新的一条
    const zhRows = versions.filter(v => v.locale === 'zh-CN');
    const sourceVersion = zhRows[zhRows.length - 1];
    const newestRow = versions[versions.length - 1];
    j.expect('中文版在（source_locale=zh-CN）', byLocale.has('zh-CN'), true);
    j.expect('英文版在（targetLocales 传了就该多一行）', byLocale.has('en-US'), true);
    j.check('反例形状成立：译稿那行的 id 确实大于源语言行（否则下面两条测不出旧规则）',
      { newestId: newestRow?.id, newestLocale: newestRow?.locale, sourceId: sourceVersion?.id },
      newestRow?.locale === 'en-US' && sourceVersion !== undefined && newestRow.id > sourceVersion.id);
    j.expect('中文版的 translation_status=source', byLocale.get('zh-CN')?.translation_status, 'source');
    j.expect('英文版的 translation_status=translated', byLocale.get('en-US')?.translation_status, 'translated');
    j.check('英文版正文是真翻出来的（长度 > 200）',
      byLocale.get('en-US')?.body ?? 0, (byLocale.get('en-US')?.body ?? 0) > 200);
    j.expect('两版各自留了模型名（哪一版是谁写的）',
      [...new Set(versions.map(v => (v.ai_model ? '有' : '无')))], ['有']);
    j.expect('两版标题不是一个字符串（否则下面「列表标题」那条测不出取的是哪一版）',
      sourceVersion?.title !== newestRow?.title, true);
    j.note('两版行号、标题与正文长度（译稿的 id 更大 ⇒ 凡是按「id 最大的那一版」认版本的读口都会命中英文，本用例测的就是它不再命中）',
      versions.map(v => ({ id: v.id, locale: v.locale, title: v.title, body: v.body })));

    // ── 3 反例：没提审就让人盖章 ───────────────────────────────────────────
    const earlyApprove = await admin.post(`/api/workspace/reviews/${articleId}/approve`, { comment: '想直接过' });
    j.expect('反例①draft 直接 approve 被拦：code=ERROR', earlyApprove.code, 'ERROR');
    j.expect('反例①HTTP 仍是 200（判拒看 code 这条纪律在内容链里第二次落）', earlyApprove.status, 200);
    j.check('反例①话术点名「只有待审核的文章可以审核通过」',
      earlyApprove.message, earlyApprove.message.includes('只有待审核的文章可以审核通过'));
    j.expect('反例①之后状态还是 draft', await statusAt(articleId), 'draft');

    // 反例②：没进 pending_review 就不该出现在待审列表里
    const pendingBefore = await admin.get('/api/workspace/reviews/pending?page=1&size=50');
    j.expect('提审前读待审列表回 OK', pendingBefore.code, 'OK');
    const beforeIds = ((pendingBefore.data as Record<string, unknown>)?.records ?? []) as Array<Record<string, unknown>>;
    j.expect('反例②这篇不在待审列表里（pending_review 是唯一的入列表凭据）',
      beforeIds.some(r => Number(r.articleId ?? r.id) === articleId), false);

    // ── 4 提审 ─────────────────────────────────────────────────────────────
    const submit = await admin.post(`/api/workspace/articles/${articleId}/submit-review`);
    j.expect('提审回 OK', submit.code, 'OK');
    j.expect('提审后 article.status=pending_review', await statusAt(articleId), 'pending_review');

    // ── 5 AI 预审（G-05 的关键一跳） ───────────────────────────────────────
    const pre1 = await admin.post(`/api/workspace/articles/${articleId}/ai-prereview`);
    j.expect('AI 预审回 OK', pre1.code, 'OK');
    const pv = (pre1.data ?? {}) as Record<string, unknown>;
    j.note('预审回体（原样，不挑键）', pv);
    j.expect('预审回体带齐了给人看的那几样', Object.keys(pv).sort(),
      ['aiOpinion', 'aiReviewedAt', 'aiRiskFlags', 'aiVerdict', 'articleId', 'model', 'originalScore', 'provider', 'qualityScore', 'versionId']);
    // 服务只在「两个分都缺」时才报错（ArticlePreReviewService.java:89-91）⇒ 这里也按同一口径判，不逼模型两个都给
    const inRange = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 100;
    j.check('两个分至少有一个落在 0~100（另一个模型可能没给，服务端就是这个口径）',
      [pv.originalScore, pv.qualityScore].filter(inRange).length,
      [pv.originalScore, pv.qualityScore].some(inRange));
    j.expect('verdict 只有三种写法（pass/caution/reject）',
      ['pass', 'caution', 'reject'].includes(String(pv.aiVerdict)), true);
    j.expect('预审审的是源语言那一版（versionId = zh-CN 行，不是 id 最大的英文译稿）',
      Number(pv.versionId), sourceVersion?.id);
    // ★ G-05 的判据本体：AI 审完，状态一个字都没动
    j.expect('★AI 预审不许推状态：预审后仍然精确等于 pending_review', await statusAt(articleId), 'pending_review');
    const reviewRows1 = await db.count('SELECT COUNT(*) AS n FROM article_ai_review WHERE article_id = ?', [articleId]);
    j.expect('预审落库一行', reviewRows1, 1);
    j.expect('预审行上写着 provider/model（G-12 的「谁写的」在这一跳也有）',
      (await db.count(`SELECT COUNT(*) AS n FROM article_ai_review WHERE article_id = ? AND provider IS NOT NULL AND provider <> '' AND model IS NOT NULL AND model <> ''`,
        [articleId])), 1);

    // 预审这一跳有没有进 ai_call_log？purpose 字面值 = article_review（ArticlePreReviewService.java:72 走的是 aiCallLogService.complete）
    const logRows = await db.rows<{ purpose: string; status: string; success: number }>(
      `SELECT purpose, status, success FROM ai_call_log WHERE tenant_id = ? AND purpose = ? ORDER BY id`,
      [A.tenantId, 'article_review']);
    j.expect('预审在 ai_call_log 里留了一行（与上面那句「只有 AiCallLogService.complete 会写表」对上）', logRows.length, 1);
    j.note('预审那一行的 status/success 两列写法', logRows[0]);
    // 反证：生成与翻译这两跳走的是别的口子，留没留痕按实测报（G-12 的缺口在这三个数上）
    const allLogs = await db.rows<{ purpose: string; n: number }>(
      'SELECT purpose, COUNT(*) AS n FROM ai_call_log WHERE tenant_id = ? GROUP BY purpose', [A.tenantId]);
    j.note('这一家 ai_call_log 按 purpose 的行数（生成/翻译留痕缺失就是这里的空洞）', allLogs);

    // ── 6 待审列表把预审摆出来了 ───────────────────────────────────────────
    const pending = await admin.get('/api/workspace/reviews/pending?page=1&size=50');
    j.expect('提审后读待审列表回 OK', pending.code, 'OK');
    const records = ((pending.data as Record<string, unknown>)?.records ?? []) as Array<Record<string, unknown>>;
    const mine = records.find(r => Number(r.articleId ?? r.id) === articleId);
    j.expect('这篇出现在待审列表里（找不到就是 undefined）', mine === undefined, false);
    j.expect('列表里的标题就是源语言那一版的标题（读侧不许再取 id 最大，否则中文审核看到的会是英文译稿）',
      String(mine?.title ?? ''), sourceVersion?.title);
    j.expect('列表里带着预审的结论（人复核时看得见，与预审回体逐字一致）', mine?.aiVerdict, pv.aiVerdict);
    j.expect('列表里带着预审的原创度分（逐字一致，缺就两边一起缺）', mine?.originalScore, pv.originalScore);
    // 待审列表是跨租户的高危口：这一家手里不许看到别人家的文章（J-12 那一格在这里按真实数据再走一遍）
    const listedIds = records.map(r => Number(r.articleId ?? r.id));
    j.expect('待审列表回的行数与数组长度一致（不是先截断再报总数）', listedIds.length, records.length);
    const foreign = await db.rows<{ id: number }>(
      `SELECT id FROM article WHERE id IN (${listedIds.map(() => '?').join(',') || '0'}) AND tenant_id <> ?`,
      [...listedIds, A.tenantId]);
    j.expect('待审列表里没有一行是别人家的文章', foreign.length, 0);

    // ── 7 第二次预审：追加，不覆盖 ─────────────────────────────────────────
    const pre2 = await admin.post(`/api/workspace/articles/${articleId}/ai-prereview`);
    j.expect('第二次预审回 OK', pre2.code, 'OK');
    const reviewRows2 = await db.count('SELECT COUNT(*) AS n FROM article_ai_review WHERE article_id = ?', [articleId]);
    j.expect('重新预审是追加一行（不是 upsert 覆盖掉历史）', reviewRows2, 2);
    j.expect('第二次预审之后状态仍然没动', await statusAt(articleId), 'pending_review');

    // ── 8 人盖章 ───────────────────────────────────────────────────────────
    const approve = await admin.post(`/api/workspace/reviews/${articleId}/approve`, { comment: '人工复核，可以发' });
    j.expect('人盖章回 OK（AI 的 verdict 不参与这个判断）', approve.code, 'OK');
    const stamped = await db.rows<{ status: string; reviewer: string | null; reviewed_at: string | null }>(
      'SELECT status, reviewer, reviewed_at FROM article WHERE id = ?', [articleId]);
    j.expect('状态由人推到 approved', stamped[0]?.status, 'approved');
    j.expect('审核人是这个管理员账号', stamped[0]?.reviewer, A.adminUsername);
    j.check('审核时间落了值', stamped[0]?.reviewed_at ?? null, stamped[0]?.reviewed_at !== null);

    // ── 9 发布 + 公开口 ────────────────────────────────────────────────────
    const publish = await admin.post(`/api/workspace/publish/${articleId}`);
    j.expect('发布回 OK', publish.code, 'OK');
    j.expect('发布回体 status=success', (publish.data as Record<string, unknown>)?.status, 'success');
    j.expect('终态 = published', await statusAt(articleId), 'published');

    const pub = Api.anonymous(env.apiBase, j);
    const zh = await db.rows<{ title: string }>(
      'SELECT title FROM article_version WHERE article_id = ? AND locale = ? AND del_flag = ? ORDER BY id DESC LIMIT 1',
      [articleId, 'zh-CN', '0']);
    const en = await db.rows<{ title: string }>(
      'SELECT title FROM article_version WHERE article_id = ? AND locale = ? AND del_flag = ? ORDER BY id DESC LIMIT 1',
      [articleId, 'en-US', '0']);
    const detail = await pub.get(`/api/portal/public/articles/${articleId}?site=${A.siteCode}`);
    j.expect('匿名读公开详情回 OK', detail.code, 'OK');
    const served = String((detail.data as Record<string, unknown>)?.title ?? '');
    const srcLocale = (await db.rows<{ source_locale: string }>(
      'SELECT source_locale FROM article WHERE id = ?', [articleId]))[0]?.source_locale;
    j.note('公开口这一发实际摆出来的是哪一版（判据是 article.source_locale，不是站点的 default_locale）',
      { sourceLocale: srcLocale, servedTitle: served, zhTitle: zh[0]?.title, enTitle: en[0]?.title });
    // ★ G-06 读侧：立项原话是「同一篇有中文版和英文版」，对外那一条按文章的源语言给（ArticleVersions.preferred）
    j.expect('★中文读者读到的是中文版（公开口没有 locale 参数，源语言那一版才算数）', served, zh[0]?.title);
  } finally {
    if (A) {
      const api = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
      await retireTenant(api, j, A);
      j.note('A 家（已注销）本轮留下的行数', {
        article: await db.count('SELECT COUNT(*) AS n FROM article WHERE tenant_id = ?', [A.tenantId]),
        article_version: await db.count(
          'SELECT COUNT(*) AS n FROM article_version v JOIN article a ON a.id = v.article_id WHERE a.tenant_id = ?', [A.tenantId]),
        article_ai_review: await db.count('SELECT COUNT(*) AS n FROM article_ai_review WHERE tenant_id = ?', [A.tenantId]),
        ai_call_log: await db.count('SELECT COUNT(*) AS n FROM ai_call_log WHERE tenant_id = ?', [A.tenantId]),
      });
      const left = await residue(db);
      j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
      j.note('残留清点', left);
    }
    await db.close();
  }
  j.assertClean();
});
