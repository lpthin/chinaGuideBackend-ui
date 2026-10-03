import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J10 AI 留痕与失败面（判据 G-12「所有 AI 生成内容都有状态、来源和失败记录」design.md:871）
 *
 * 一句话结论先摆在这里，跑完拿数对：往 ai_call_log 写行的只有 AiCallLogService（insertLog 三处：
 * 成功 :105、末次失败 :113、流式补记 :85），而**文章正文那一步（AiCallStep.java:19 走 AiFailoverService）
 * 与翻译那一步（TranslationStep.java:56 走 DynamicAiClient）都不经过它** ⇒ 这两跳真花了钱、真出了稿子，
 * 表里一行都没有。静态证据在 scratch/p3-trace-coverage.txt（30 处有留痕的 purpose 名单 vs 12 个直接持有
 * 客户端的文件），行为证据就是本条：跑完一次真生成，按 purpose 数给看。
 *
 * 失败面要测的是「记录并且不吞」：故意在探针租户名下挂一条坏模型行（model_type=chat、sort_order 最小、
 * api_endpoint 指向 127.0.0.1:9 这个必然拒绝连接的端口），让 DynamicAiClient.java:190-207 那个
 * 「租户自己的行优先、借平台是兜底」的选择顺序把这一发引到坏行上。
 * 之后断言三件：日志里有 status='failed' 那一行、error_message 没被吞成空、这一笔不计进额度
 * （AiCallLogService.java:106 只在成功分支 incrementUsage）。
 *
 * 本条真花钱：1 次好蒸馏 + 1 次注定失败的蒸馏（几乎不花钱，端口立刻拒）+ 1 次真生成（实测 55~91s）。
 */

interface LogRow {
  id: number; purpose: string; status: string; success: number; provider: string; model: string;
  input_hash: string | null; output_summary: string | null; error_message: string | null;
  token_estimate: number | null; call_duration_ms: number | null; site_id: number | null; run_id: number | null;
}

test('SYS-J10 AI 留痕与失败面：四要素、坏模型不吞、生成那一跳的缺口', async () => {
  test.info().setTimeout(900_000);
  const j = new Journal('SYS-J10');
  const db = new Db(j);

  let A: Awaited<ReturnType<typeof provisionTenant>> | undefined;
  let brokenModelId = 0;
  try {
    j.card({
      用例号: 'SYS-J10-01',
      判据: 'G-12',
      层级: 'API',
      前置: `后端 ${env.apiBase}；探针租户现开（名下本来没有模型行 ⇒ 借平台模型）；`
        + `本条自己在租户名下挂一条坏模型行，测完删掉；模型调用 2 次 + 生成 1 次`,
      步骤: [
        '1 开探针租户 A，导 3 条关键词，记下 ai_call_log 与 tenant_usage 的基线数',
        '2 真蒸馏一次（成功面，走 ?preview=true 这一支——只有它把 distillSource/usedRuleFallback 放进回体）：ai_call_log 新增一行，四要素逐个查（状态/来源/耗时/输入指纹）',
        '3 额度一致性：成功那一笔计进 tenant_usage(api_call)，且只计一次',
        '4 超管在 A 家挂一条坏模型行（api_endpoint=127.0.0.1:9，sort_order 最小 ⇒ 优先选中）',
        '5 再真蒸馏一次（失败面）：接口回 200 但 distillSource 从 ai_model 翻成 rule_fallback；日志里必须有 status=failed 那一行，error_message 非空；额度不再涨',
        '6 摘掉坏行 ⇒ 证明那发失败是这条行引的，不是模型网关抖（随后真生成能跑完就是证据）',
        '7 覆盖面（★G-12 的红）：跑一次真生成，按 purpose 数给看——文章正文那一跳在 ai_call_log 里有没有行',
      ],
      期望: [
        '步骤 2 那一行：status=success 且 success=1、provider/model 不是 unknown、call_duration_ms>0、input_hash 是 64 位十六进制、output_summary 非空、token_estimate>0、site_id=本站、run_id 为空',
        '步骤 5 失败那一行：status=failed、success=0、error_message 有内容、call_duration_ms 有值（不许是 null）',
        '步骤 5 额度：api_call 计数在失败这一笔前后不变',
        '步骤 7 判据原话是「所有 AI 生成内容都有状态、来源和失败记录」⇒ 生成那一跳必须留痕（按现状这一格是红的）',
      ],
      反例: ['坏模型不许让接口 500 蒙混（要看得见退化）', '失败不许只留在日志服务自己的 error_message 里就完事：状态位与来源位也要落',
        '摘掉坏行后同一家同样的调用必须恢复（证明引火的是那条行，不是网络）'],
      收尾: '先 DELETE /api/ai/model-configs/{id} 删掉坏模型行，再 DELETE /api/admin/tenants/{id} 软删探针租户；'
        + '坏行删除后按 id 复查一次它确实不在了（这条行如果被留着，会把下一轮的探针租户一起带沟里）',
    });

    const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
    A = await provisionTenant(sa.api, db, j, 'J10');
    const admin = A.admin;

    const logsOf = async (): Promise<LogRow[]> => db.rows<LogRow>(
      `SELECT id, purpose, status, success, provider, model, input_hash, output_summary, error_message,
              token_estimate, call_duration_ms, site_id, run_id
       FROM ai_call_log WHERE tenant_id = ? ORDER BY id`, [A!.tenantId]);
    const usageSum = async (): Promise<number> => Number((await db.rows<{ s: number }>(
      `SELECT COALESCE(SUM(used_count),0) AS s FROM tenant_usage WHERE tenant_id = ? AND usage_type = ?`,
      [A!.tenantId, 'api_call']))[0]?.s ?? 0);

    // ── 1 基线 ─────────────────────────────────────────────────────────────
    const imported = await admin.post('/api/workspace/keywords/import', {
      keywords: ['种植牙集采后价格降了多少', '正畸期间怎么刷牙', '儿童涂氟有没有必要'],
    });
    j.expect('导 3 条关键词回 OK', imported.code, 'OK');
    const baseline = await logsOf();
    const usage0 = await usageSum();
    j.expect('探针租户开局没有任何 ai_call_log 行（否则下面的「新增一行」就不是这一发引的）', baseline.length, 0);

    // ── 2 成功面：四要素 ───────────────────────────────────────────────────
    // 取 preview=true 这一支：只有它把 distillSource / usedRuleFallback 放进回体
    // （WorkspaceController.java:1154-1172，preview=false 那支只回 clusters/clusterCount/preview 三项，
    //  落库那一发本身不报来源）。界面走的正是 preview→confirm 两阶段，所以「这次不是 AI 干的」在人界面上看得见。
    const d1 = await admin.post('/api/workspace/clusters/distill?preview=true');
    j.expect('第一次蒸馏回 OK', d1.code, 'OK');
    j.expect('第一次蒸馏的来源 = 真模型在跑', (d1.data as Record<string, unknown>)?.distillSource, 'ai_model');
    const ok = await logsOf();
    j.expect('成功这一发留了一行', ok.length, 1);
    const row = ok[0];
    j.note('这一行原样（G-12 的四个要素都在这里面）', row);
    j.expect('① 状态：status 字面 = success', row.status, 'success');
    j.expect('① 状态：success 位与它一致（历史上这两列有 51 行不一致，判据看的是现在）', row.success, 1);
    j.expect('② 来源：provider 不是 unknown', row.provider !== 'unknown', true);
    j.expect('② 来源：model 不是 unknown', row.model !== 'unknown', true);
    j.check('③ 耗时：call_duration_ms 落了值且 > 0', row.call_duration_ms ?? 0, (row.call_duration_ms ?? 0) > 0);
    j.expect('④ 输入指纹：input_hash 是 64 位十六进制（不是原文，也不算明文存提示词）',
      /^[0-9a-f]{64}$/.test(String(row.input_hash ?? '')), true);
    j.check('④ 输出摘要非空（钱花在哪，看得见形状）', (row.output_summary ?? '').length, (row.output_summary ?? '').length > 0);
    j.check('token 估算落了值', row.token_estimate ?? 0, (row.token_estimate ?? 0) > 0);
    j.expect('site_id 落在这一家的站上（哪一套花的钱）', row.site_id, A.siteId);
    j.expect('run_id 为空（这一发不属于任何一轮 GEO 诊断）', row.run_id, null);
    j.expect('purpose 字面值 = keyword_distill（词表就是代码里那一个）', row.purpose, 'keyword_distill');

    // ── 3 额度一致性：成功才计，且只计一次 ─────────────────────────────────
    const usage1 = await usageSum();
    j.expect('成功一笔 ⇒ tenant_usage(api_call) +1', usage1 - usage0, 1);

    // ── 4 挂一条坏模型行 ───────────────────────────────────────────────────
    const broken = await sa.api.post('/api/ai/model-configs', {
      tenantId: A.tenantId, name: 'E2E 坏模型探针', provider: 'openai', modelName: 'e2e-broken-chat',
      modelType: 'chat', apiKey: 'e2e-invalid-key', isActive: true, isDefault: false, sortOrder: -1,
      apiEndpoint: 'http://127.0.0.1:9/v1/chat/completions', apiProtocol: 'openai',
    });
    j.expect('超管在探针租户名下挂坏模型行回 OK', broken.code, 'OK');
    brokenModelId = Number((broken.data as Record<string, unknown>)?.id ?? 0);
    j.check('拿到那条模型行的 id', brokenModelId, brokenModelId > 0);
    // 回体里的 key 必须是打码的（这张表里存的是密文，接口不许把 key 念出来）；字段名按 Jackson 的 camelCase 读
    const returnedKey = String((broken.data as Record<string, unknown>)?.apiKey ?? '');
    j.expect('创建回体里没有把 apiKey 原样念出来', returnedKey.includes('e2e-invalid-key'), false);
    j.expect('挂的那一行确实是 chat 类型（不是 chat/text，findChatModel 不会选它）',
      (broken.data as Record<string, unknown>)?.modelType, 'chat');
    // 再导 3 条，否则第二次蒸馏没有 pending 关键词可吃，根本不会去调模型
    const imported2 = await admin.post('/api/workspace/keywords/import', {
      keywords: ['成人矫正要多久', '牙周袋深度多少要手术', '智齿发炎期间能拔牙吗'],
    });
    j.expect('第二次导入回 OK', imported2.code, 'OK');

    // ── 5 失败面 ───────────────────────────────────────────────────────────
    // 这一发只有 6 条 pending 关键词（preview 不落库、不改状态），批次上限 30 ⇒ 仍然只调一次模型，
    // 所以「总数 2」这个账成立。
    const d2 = await admin.post('/api/workspace/clusters/distill?preview=true');
    j.expect('★失败不抛错、走退化，但退化写在回体里看得见（这一发仍然是 200/OK）', d2.code, 'OK');
    j.expect('★失败不吞在明面上：来源翻成 rule_fallback（人看得见「这次不是 AI 干的」）',
      (d2.data as Record<string, unknown>)?.distillSource, 'rule_fallback');
    j.expect('usedRuleFallback 位与它一致', (d2.data as Record<string, unknown>)?.usedRuleFallback, true);
    const afterFail = await logsOf();
    j.expect('失败也留了一行（总数 2）', afterFail.length, 2);
    const bad = afterFail.find(l => l.status === 'failed');
    j.expect('那一行的 status 字面 = failed（不是 success 配 success=0）', bad === undefined, false);
    j.expect('失败行的 purpose 也是 keyword_distill（同一支调用，状态不同）', bad?.purpose, 'keyword_distill');
    j.expect('失败原因没被吞成空：error_message 有内容',
      (bad?.error_message ?? '').length > 0, true);
    j.note('失败行原样（provider/model/耗时/token 各是什么写法）', bad);
    // 本地端口拒绝连接可能快到取整成 0ms，所以判的是「记没记」，不是「够不够长」
    j.expect('失败那一行也记了耗时（不是 null：重试过两次，时长是要钱的）',
      bad?.call_duration_ms === null || bad?.call_duration_ms === undefined, false);
    const usage2 = await usageSum();
    j.expect('失败这一笔不计额度（AiCallLogService.java:106 只在成功分支涨）', usage2, usage1);

    // ── 6 摘掉坏行 ─────────────────────────────────────────────────────────
    const del = await sa.api.del(`/api/ai/model-configs/${brokenModelId}`);
    j.expect('删掉坏模型行回 OK', del.code, 'OK');
    const goneRow = await db.count('SELECT COUNT(*) AS n FROM ai_model_config WHERE id = ? AND del_flag = ?',
      [brokenModelId, '0']);
    j.expect('按 id 复查：这条行不再活着（软删真落地）', goneRow, 0);
    brokenModelId = 0;

    // ── 7 覆盖面：真生成那一跳留没留痕 ────────────────────────────────────
    const gen = await admin.post('/api/workspace/articles/generate-async', { keyword: '种植牙集采后价格降了多少' });
    j.expect('提交生成回 OK（摘掉坏行后回落平台模型 ⇒ 还能跑，说明引火的确实是那条行）', gen.code, 'OK');
    const taskId = Number((gen.data as Record<string, unknown>)?.taskId ?? 0);
    j.check('拿到 taskId', taskId, taskId > 0);
    const deadline = Date.now() + 420_000;
    let task: Record<string, unknown> = {};
    for (;;) {
      await new Promise(r => setTimeout(r, 5_000));
      const s = await admin.get(`/api/workspace/articles/generate/${taskId}/status`);
      task = (s.data ?? {}) as Record<string, unknown>;
      j.note(`任务 ${taskId} 轮询`, { status: task.status, stage: task.stage, progress: task.progress });
      if (typeof task.status === 'string'
        && ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'CONTENT_REJECTED'].includes(task.status)) break;
      if (Date.now() > deadline) throw new Error(`任务 ${taskId} 超时未终态：${JSON.stringify(task)}`);
    }
    j.expect('生成任务跑完了（能跑完 = 引火的是那条坏行，不是网关）', task.status, 'COMPLETED');
    const genLogs = await logsOf();
    const purposes = [...new Set(genLogs.map(l => l.purpose))];
    j.note('整条链跑完后这一家的 ai_call_log 按 purpose 的账（★G-12 的红就在这张表里）',
      { 行数: genLogs.length, 出现过的purpose: purposes, 各purpose行数: genLogs.reduce<Record<string, number>>((acc, l) => {
        acc[l.purpose] = (acc[l.purpose] ?? 0) + 1; return acc; }, {}) });
    // 这一发真金白银写了 1 篇文章（正文 + 可能还有内链/_geo_增强/翻译的若干次模型调用），
    // 而判据原话是「所有 AI 生成内容都有状态、来源和失败记录」。
    const articlePurposeRows = genLogs.filter(l => /article|generat|translat/i.test(l.purpose));
    j.expect('★生成与翻译那一跳在 ai_call_log 里有行（按判据原话该 ≥1；实测为 0 就是缺口）',
      articlePurposeRows.length, 1);
    // 但稿子那一侧不是完全没留痕：版本行上写着是谁写的
    const versionTrace = await db.rows<{ ai_model: string | null }>(
      `SELECT ai_model FROM article_version WHERE article_id = ? AND del_flag = ?`,
      [Number(task.articleId ?? 0), '0']);
    j.expect('article_version.ai_model 留了模型名（来源这一半在稿子上，不在日志里）',
      versionTrace.length, 1);
    j.check('那个模型名是个非空字符串（不钉死是哪一个：换默认模型不该把这条测成红）',
      versionTrace[0]?.ai_model ?? '', typeof versionTrace[0]?.ai_model === 'string' && versionTrace[0].ai_model.length > 0);
  } finally {
    if (brokenModelId > 0) {
      // 上一次删除没走到就得补一刀：这条行留着会把后来任何借模型的探针租户带进沟里
      try {
        const api = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
        await api.del(`/api/ai/model-configs/${brokenModelId}`);
        j.note('收尾补删坏模型行', { brokenModelId });
      } catch (e) {
        j.note('补删坏模型行失败（要人工清）', { brokenModelId, error: String(e) });
      }
    }
    if (A) {
      const api = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
      await retireTenant(api, j, A);
      j.note('A 家（已注销）留下的留痕账', {
        ai_call_log: await db.count('SELECT COUNT(*) AS n FROM ai_call_log WHERE tenant_id = ?', [A.tenantId]),
        tenant_usage_rows: await db.count('SELECT COUNT(*) AS n FROM tenant_usage WHERE tenant_id = ?', [A.tenantId]),
        article: await db.count('SELECT COUNT(*) AS n FROM article WHERE tenant_id = ?', [A.tenantId]),
      });
      const left = await residue(db);
      j.expect('收尾后本轮活租户残留 = 0', left.tenants, 0);
      j.note('残留清点', left);
    }
    await db.close();
  }
  j.assertClean();
});
