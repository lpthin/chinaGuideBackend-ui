import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J02 内容生产闭环（判据 G-03「人只负责审核和必要时修改，不用每天手工写文章」design.md:30）
 *
 * spec §5 的链条：关键词输入 → 蒸馏/聚合 → AI 出中文候选 → 人工改 → 通过 → 门户公开口读得到。
 * 全程由这一家的 SITE_ADMIN 自己走（不是超管代跑）—— G-03 说的「人」就是租户侧那个人。
 * 每一跳都按 `file:line` 摘出来的字面键断言，不靠「接口 200 了」蒙过去：
 *   导入 `POST /api/workspace/keywords/import` 回 {imported,total}（WorkspaceController.java:806-821）
 *   蒸馏 `POST /api/workspace/clusters/distill?preview=`，preview=true 一律不写库（KeywordService.java:237-240）
 *   生成 `POST /api/workspace/articles/generate-async` 回 {taskId,status:'PENDING'}（:379-406），
 *        轮询 `GET .../generate/{taskId}/status` 的键是 taskId,status,progress,stage,articleId,errorMessage,totalTimeMs,modelName（:408-438）
 *   发布 `POST /api/workspace/publish/{articleId}`，没审核过会回 HTTP **200** 但 code='PUBLISH_VALIDATION_FAILED'
 *        （PublishExecutor.java:275-297 + GlobalExceptionHandler.java:36-40）⇒ 判拒必须看 code，不能看状态码
 *   公开口 `GET /api/portal/public/articles?site=<站码>`：只认 status='published' 且 del_flag='0'
 *        （PortalAggregationService.java:205-213），标题正文取自最新一条 article_version（PortalContentService.java:118-124）
 *
 * 这一条会真花钱：蒸馏 2 次 + 出选题 1 次 + 生成 1 次。现测的实测耗时（run 1003-162940，都在这次的证据里）：
 * 蒸馏预览 24.2s、蒸馏落库 18.6s、按聚类出选题 35.4s、生成 90.6s（qwen3.7-plus，探针租户没有自己的模型行 ⇒ 借平台模型，
 * DynamicAiClient.java:197-205 那句 log.warn「本次借用平台模型」就是这件事的留痕）。
 */

interface GenStatus {
  status?: string;
  progress?: number;
  stage?: string;
  articleId?: number | null;
  errorMessage?: string | null;
  totalTimeMs?: number | null;
  modelName?: string | null;
}

const TERMINAL = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'CONTENT_REJECTED'];

/** 轮询到终态：每 5s 一次，最多 budgetMs；到了终态把最后一次响应原样交出去 */
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

test('SYS-J02 内容生产闭环：关键词→AI 候选→人改→审核→门户读得到', async () => {
  test.info().setTimeout(900_000);
  const j = new Journal('SYS-J02');
  const db = new Db(j);
  const tag = process.env.E2E_J02_TAG ?? `J02${Date.now()}`;

  let A: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let B: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let articleId = 0;

  try {
    j.card({
      用例号: 'SYS-J02-01',
      判据: 'G-03',
      层级: 'API',
      前置: `后端 ${env.apiBase}；探针租户 ${tag} 由 POST /api/admin/tenants 现开（站 enabled，SITE_ADMIN 自己跑全程）；`
        + `真调模型：蒸馏 2 次 + 出选题 1 次 + 生成 1 次（那 4 发的实测耗时 24.2s / 18.6s / 35.4s / 90.6s）`,
      步骤: [
        '1 开两家探针租户 A/B（B 只做跨租户反例，不跑 AI）',
        '2 A 家管理员导 3 条关键词 → 库里 3 行 keyword.status=pending',
        '3 蒸馏 preview=true：必须回 clusterCount，且 keyword 一条都不许被改状态（写了就是谎报「预览」）',
        '4 蒸馏 preview=false：聚类落库 + 涉及的 keyword 翻成 distilled',
        '5 由聚类出内容选题 → GET /api/workspace/suggestions 读到 status=candidate',
        '6 生成一篇中文候选：generate-async → 轮询到 COMPLETED → articleId 非空',
        '7 库里对账：article.status=draft、source_locale=zh-CN、article_version 恰好 1 行且正文非空',
        '8 人工只改标题（PUT /api/workspace/articles/{id}），正文一个字都不写',
        '9 反例：没审核就发布 → code=PUBLISH_VALIDATION_FAILED（HTTP 是 200，判拒要看 code）',
        '10 反例：B 家 token 改 A 家这篇文章 → 租户拦截器让它读不到（报「文章不存在」），标题没变',
        '11 提审 → 通过 → 发布（三次状态转移各查一次库）',
        '12 公开口读：列表里认得到这条 slug，详情里读得到改过的那个标题',
      ],
      期望: [
        '步骤 6 任务终态就是 COMPLETED，且有 articleId 与 modelName（G-03 的「AI 写」必须真发生）',
        '步骤 7 draft 状态下正文已经完整（content_md 长度 > 200），人工没有写任何一个字',
        '步骤 11 状态按 draft→pending_review→approved→published 逐级转移，越级被拦',
        '步骤 12 匿名（无 token）公开口读得到这一篇，标题就是人改过的那一个',
      ],
      反例: ['越级发布被拦：PUBLISH_VALIDATION_FAILED', '跨租户改稿被拦：这一家读不到那篇（租户条件在数据层就拼上了）',
        'preview=true 不许写库（这一步反过来证明「预览」这两个字是真的）'],
      收尾: 'A/B 两家探针租户走 DELETE /api/admin/tenants/{id} 软删；'
        + '本轮留下的 article/keyword 行数按前缀清点并原样记进日志（注销租户之后接口删不掉，账在 Q-P2b）',
    });

    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    A = await provisionTenant(sa.api, db, j, tag);
    B = await provisionTenant(sa.api, db, j, `${tag}B`);
    const admin = A.admin;
    j.note('两家探针租户（A 跑全程，B 只做跨租户反例）',
      { A: { id: A.tenantId, siteCode: A.siteCode }, B: { id: B.tenantId, siteCode: B.siteCode } });

    // ── 2 关键词导入：AI 的输入口 ───────────────────────────────────────────
    const words = ['儿童近视防控有哪些方法', '青少年近视防控门诊流程', '近视防控年度报告怎么读'];
    const imported = await admin.post('/api/workspace/keywords/import', { keywords: words });
    j.expect('导入关键词回 OK', imported.code, 'OK');
    // 后端回的是 Map.of("imported",…,"total",…)（WorkspaceController.java:821），Map.of 没有稳定遍历顺序
    // ⇒ 逐字段比，不许按 JSON 键序整体比（1003-172048 那次就是键序换了个位，误报一条红）
    const importData = (imported.data ?? {}) as Record<string, unknown>;
    j.expect('回体里的 imported 等于提交的条数', importData.imported, words.length);
    j.expect('回体里的 total 等于提交的条数', importData.total, words.length);
    const kwRows = await db.rows<{ id: number; status: string }>(
      'SELECT id, status FROM keyword WHERE tenant_id = ? AND del_flag = ?', [A.tenantId, '0']);
    j.expect('库里落了三行 keyword', kwRows.length, 3);
    j.expect('导入后的状态一律是 pending（蒸馏只吃 pending）',
      [...new Set(kwRows.map(r => r.status))], ['pending']);

    // ── 3 蒸馏（预览档）：不许写库 ──────────────────────────────────────────
    const preview = await admin.post('/api/workspace/clusters/distill?preview=true');
    j.expect('蒸馏预览回 OK', preview.code, 'OK');
    const previewData = preview.data as Record<string, unknown>;
    j.note('蒸馏预览回体（distillSource 是这一跳最要紧的数：ai_model=真模型在跑，rule_fallback=退化成规则）',
      { clusterCount: previewData?.clusterCount, distillSource: previewData?.distillSource,
        usedRuleFallback: previewData?.usedRuleFallback, processedKeywords: previewData?.processedKeywords,
        remainingKeywords: previewData?.remainingKeywords });
    // distillSource 只作记录不作断言：模型退化成规则不是 G-03 的判据，硬断言会把「今天网络抖了一下」写成一个红
    const stillPending = await db.count(
      'SELECT COUNT(*) AS n FROM keyword WHERE tenant_id = ? AND status = ? AND del_flag = ?',
      [A.tenantId, 'pending', '0']);
    j.expect('预览档一条都不写：三行还是 pending', stillPending, 3);

    // ── 4 蒸馏（落库档）：聚类落地 + 关键词翻状态 ────────────────────────────
    const saved = await admin.post('/api/workspace/clusters/distill?preview=false');
    j.expect('蒸馏落库回 OK', saved.code, 'OK');
    const clusterCount = Number((saved.data as Record<string, unknown>)?.clusterCount ?? 0);
    j.check('至少聚出 1 个聚类', clusterCount, clusterCount >= 1);
    const distilled = await db.count(
      'SELECT COUNT(*) AS n FROM keyword WHERE tenant_id = ? AND status = ? AND del_flag = ?',
      [A.tenantId, 'distilled', '0']);
    j.check('涉及的关键词状态翻成 distilled（>0；翻不动说明「蒸馏」这一步是空的）', distilled, distilled > 0);

    const clusters = await db.rows<{ id: number }>(
      'SELECT id FROM keyword_cluster WHERE tenant_id = ? AND del_flag = ? ORDER BY id', [A.tenantId, '0']);
    j.check('keyword_cluster 表里有这一家的行', clusters.length, clusters.length >= 1);

    // ── 5 选题（人不用自己想题目：AI 出题，人只挑） ──────────────────────────
    const sug = await admin.post(`/api/workspace/clusters/${clusters[0].id}/generate-suggestions`);
    j.expect('按聚类生成选题回 OK', sug.code, 'OK');
    const sugList = Array.isArray(sug.data) ? sug.data as Array<Record<string, unknown>> : [];
    j.check('选题不止一条（后端每簇最多出 5 条）', sugList.length, sugList.length >= 1);
    j.expect('选题的 status 字面就是 candidate', [...new Set(sugList.map(s => s.status))], ['candidate']);

    // ── 6 生成一篇中文候选（真花钱的那一跳） ────────────────────────────────
    const gen = await admin.post('/api/workspace/articles/generate-async', { keyword: words[0] });
    j.expect('提交生成回 OK', gen.code, 'OK');
    const taskId = Number((gen.data as Record<string, unknown>)?.taskId ?? 0);
    j.check('拿到 taskId', taskId, taskId > 0);
    j.expect('刚提交时状态是 PENDING', (gen.data as Record<string, unknown>)?.status, 'PENDING');

    const done = await waitTask(admin, j, taskId, 300_000);
    j.expect('任务终态 = COMPLETED（不是 FAILED/限流/审核不过）', done.status, 'COMPLETED');
    articleId = Number(done.articleId ?? 0);
    j.check('COMPLETED 必须带出 articleId', articleId, articleId > 0);
    j.note('这一次生成的实测账（G-03 的「AI 写」在这三个数上）',
      { modelName: done.modelName, totalTimeMs: done.totalTimeMs, stage: done.stage });
    j.check('模型名落进任务行了（借平台模型也要留痕）', done.modelName, typeof done.modelName === 'string' && done.modelName.length > 0);

    // ── 7 库里对账：AI 交出来的是一篇完整草稿，不是一个空壳 ─────────────────
    const art = await db.rows<{ status: string; source_locale: string; del_flag: string; site_id: number }>(
      'SELECT status, source_locale, del_flag, site_id FROM article WHERE id = ?', [articleId]);
    j.expect('文章一行', art.length, 1);
    j.expect('AI 交出来的初始状态 = draft（不是 pending_review，更不是 published）', art[0]?.status, 'draft');
    j.expect('中文稿的 source_locale = zh-CN', art[0]?.source_locale, 'zh-CN');
    const versions = await db.rows<{ n: number; body: string | null; title: string | null }>(
      `SELECT COUNT(*) AS n, MAX(CHAR_LENGTH(v.content_md)) AS body, MAX(v.title) AS title
       FROM article_version v WHERE v.article_id = ? AND v.del_flag = '0'`, [articleId]);
    j.expect('article_version 恰好 1 行（没传 targetLocales 就不该有第二行）', Number(versions[0]?.n), 1);
    j.check('正文是真写出来的（长度 > 200，人一个字没写）', Number(versions[0]?.body ?? 0), Number(versions[0]?.body ?? 0) > 200);
    const aiModel = await db.count(
      `SELECT COUNT(*) AS n FROM article_version WHERE article_id = ? AND ai_model IS NOT NULL AND ai_model <> '' AND del_flag = '0'`,
      [articleId]);
    j.expect('版本行上留着是哪个模型写的（G-12 的来源这一半）', aiModel, 1);

    const beforeTitle = String(versions[0]?.title ?? '');
    // ── 8 人工只改标题：G-03 里人能做的动作就这一个 ─────────────────────────
    const editedTitle = `${beforeTitle}｜人工核过标题`;
    const put = await admin.put(`/api/workspace/articles/${articleId}`, { title: editedTitle });
    j.expect('改标题回 OK', put.code, 'OK');
    j.expect('回体里的 title 就是改过的那个（回的是 version 的键 content，不是 contentMd）',
      (put.data as Record<string, unknown>)?.title, editedTitle);
    const stillDraft = await db.count('SELECT COUNT(*) AS n FROM article WHERE id = ? AND status = ?', [articleId, 'draft']);
    j.expect('改稿不许自动把状态推走（不带 status 就不动 status）', stillDraft, 1);

    // ── 9 反例：没审核就发布 ───────────────────────────────────────────────
    const early = await admin.post(`/api/workspace/publish/${articleId}`);
    j.expect('反例①越级发布被拦：code=PUBLISH_VALIDATION_FAILED', early.code, 'PUBLISH_VALIDATION_FAILED');
    j.check('反例①被拦时 HTTP 仍是 200（所以判拒只能看 code，这条纪律在这里落一次地）', early.status, early.status === 200);
    j.note('反例①的原文话术', early.message);

    // ── 10 反例：别家 token 改这篇 ─────────────────────────────────────────
    // 拦点在数据层：MyBatisPlusConfig.java:20-24 给 article 拼了租户条件，
    // 所以别家连 selectById 都是空的 —— 报的是「文章不存在」（连存在性都不确认），不是 FORBIDDEN。
    // WorkspaceController.java:1873 那句 TenantGuard.checkOwnership 因此是第二道闸，这一发测不到它。
    const cross = await B.admin.put(`/api/workspace/articles/${articleId}`, { title: '别家来改一笔' });
    j.expect('反例②跨租户改稿被拦：这一家读不到那篇文章', cross.code, 'ERROR');
    j.expect('反例②话术 =「文章不存在」（不确认存在性）', cross.message, '文章不存在');
    const titleUnchanged = await db.count(
      'SELECT COUNT(*) AS n FROM article_version WHERE article_id = ? AND title = ? AND del_flag = ?',
      [articleId, editedTitle, '0']);
    j.expect('反例②之后标题还是人改过那一个（没被别家写进去）', titleUnchanged, 1);

    // ── 11 提审 → 通过 → 发布，三次转移各查一次库 ───────────────────────────
    const submit = await admin.post(`/api/workspace/articles/${articleId}/submit-review`);
    j.expect('提审回 OK', submit.code, 'OK');
    j.expect('提审后状态 = pending_review', submit.data && (submit.data as Record<string, unknown>).status, 'pending_review');

    const approve = await admin.post(`/api/workspace/reviews/${articleId}/approve`, { comment: '人工过目，可以发' });
    j.expect('审核通过回 OK', approve.code, 'OK');
    const approved = await db.rows<{ status: string; reviewer: string | null; reviewed_at: string | null }>(
      'SELECT status, reviewer, reviewed_at FROM article WHERE id = ?', [articleId]);
    j.expect('审核把状态推到 approved', approved[0]?.status, 'approved');
    j.expect('审核人记的是这一家的管理员用户名（不是 system、不是空）', approved[0]?.reviewer, A.adminUsername);
    j.check('审核时间落了值', approved[0]?.reviewed_at ?? null, approved[0]?.reviewed_at !== null);

    const publish = await admin.post(`/api/workspace/publish/${articleId}`);
    j.expect('发布回 OK', publish.code, 'OK');
    j.expect('发布回体 status=success（PublishExecutor 的即时档）',
      (publish.data as Record<string, unknown>)?.status, 'success');
    const published = await db.rows<{ status: string; published_at: string | null }>(
      'SELECT status, published_at FROM article WHERE id = ?', [articleId]);
    j.expect('终态 = published', published[0]?.status, 'published');
    j.check('发布时间落了值（门户列表按它排序）', published[0]?.published_at ?? null, published[0]?.published_at !== null);

    // ── 12 公开口：读者那一头确实点得到 ────────────────────────────────────
    const pub = Api.anonymous(env.apiBase, j);
    const list = await pub.get(`/api/portal/public/articles?site=${A.siteCode}&page=1&size=20`);
    j.expect('匿名读公开文章列表回 OK', list.code, 'OK');
    const records = ((list.data as Record<string, unknown>)?.records ?? []) as Array<Record<string, unknown>>;
    const mine = records.find(r => Number(r.id) === articleId);
    j.expect('这一篇出现在公开列表里（找不到就是 undefined）', mine === undefined, false);
    j.expect('公开列表里的标题就是人改过那一个（读的是最新一条 version）',
      String(mine?.title ?? ''), editedTitle);

    const slug = await db.count('SELECT COUNT(*) AS n FROM article WHERE id = ? AND slug IS NOT NULL AND slug <> ?',
      [articleId, '']);
    j.expect('有 slug（公开详情口按它寻址）', slug, 1);
    const detail = await pub.get(`/api/portal/public/articles/${articleId}?site=${A.siteCode}`);
    j.expect('匿名读公开详情回 OK', detail.code, 'OK');
    j.expect('详情标题与列表一致', (detail.data as Record<string, unknown>)?.title, editedTitle);
    const detailBody = String((detail.data as Record<string, unknown>)?.contentMd ?? '');
    j.check('详情正文非空且就是 AI 写的那一篇（长度 > 200）', detailBody.length, detailBody.length > 200);

    // 反例③：别人家的公开口读不到这一篇（站码是租户身份的唯一来源）
    const crossRead = await pub.get(`/api/portal/public/articles?site=${B.siteCode}&page=1&size=20`);
    const bRecords = ((crossRead.data as Record<string, unknown>)?.records ?? []) as Array<Record<string, unknown>>;
    j.expect('反例③ B 家的公开列表里没有 A 家这篇', bRecords.some(r => Number(r.id) === articleId), false);
  } finally {
    if (A) await retireTenant(await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password).then(x => x.api), j, A);
    if (B) await retireTenant(await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password).then(x => x.api), j, B);
    if (A) {
      // 注销之后这些行还是活的，而且业务接口删不掉（租户没了归属）—— Q-P2b 要的就是这个数
      // ai_call_log 按 purpose 摊开报：这一跳真发了「蒸馏×2 + 选题×1 + 写正文×1」四次模型调用，
      // 表里少哪一个 purpose，就是 G-12 那个「谁写的」缺口（口径见 J-10）
      const logPurposes = await db.rows<{ purpose: string; n: number }>(
        'SELECT purpose, COUNT(*) AS n FROM ai_call_log WHERE tenant_id = ? GROUP BY purpose ORDER BY purpose', [A.tenantId]);
      j.note('A 家（已注销）本轮留下的行数：article / article_version / keyword / 任务 / ai_call_log 按 purpose', {
        article: await db.count('SELECT COUNT(*) AS n FROM article WHERE tenant_id = ?', [A.tenantId]),
        article_version: await db.count(
          'SELECT COUNT(*) AS n FROM article_version v JOIN article a ON a.id = v.article_id WHERE a.tenant_id = ?', [A.tenantId]),
        keyword: await db.count('SELECT COUNT(*) AS n FROM keyword WHERE tenant_id = ?', [A.tenantId]),
        task: await db.count('SELECT COUNT(*) AS n FROM article_generation_task WHERE tenant_id = ?', [A.tenantId]),
        ai_call_log_by_purpose: logPurposes,
      });
    }
    if (db) {
      const left = await residue(db);
      j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
      j.note('残留清点（含上一段那些注销租户名下的行）', left);
    }
    await db.close();
  }
  j.assertClean();
});
