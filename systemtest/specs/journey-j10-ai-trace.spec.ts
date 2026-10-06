import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, retireTenant, residue } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J10 AI 留痕与失败面（判据 G-12「所有 AI 生成内容都有状态、来源和失败记录」design.md:871）
 *
 * 一句话结论先摆在这里，跑完拿数对：往 ai_call_log 写行的原本只有 AiCallLogService 一层，
 * 而**正文生成那一步（AiCallStep.java:19 走 AiFailoverService）与翻译那一步（TranslationStep 走 DynamicAiClient）
 * 都不经过它** ⇒ P3 那一轮实测「生成 + 翻译 真出了稿子，表里一行都没有」，G-12 就判在未达成。
 * P9-D 按拍板「在新路一处补落库」把两处的口子接上了（AiFailoverService 一处 + TranslationStep 一处），
 * 本条第 7、8 步判的就是这个：生成与翻译那一跳现在必须有行，换模型那条路的失败面也必须有行。
 *
 * 失败面测两条路，手法相同：在**探针租户自己名下**挂一条坏模型行（model_type=chat、sort_order 最小、
 * api_endpoint 指向 127.0.0.1:9 这个必然拒绝连接的端口），让「租户自己的行优先、借平台是兜底」的顺序
 * 把这一发引到坏行上（DynamicAiClient.java:190-207 / AiFailoverService.java:186-199）。之后断言三件：
 * 日志里有 status='failed' 那一行、error_message 没被吞成空、这一笔不计进额度
 * （AiCallLogService.java:106 只在成功分支 incrementUsage）。
 * 第 8 步是同一个手法用在换模型那条路上：这一家只挂了这一条行、且这一家有行就不借平台
 * ⇒ 无处可换 ⇒ 注定失败，而 error_message 要写出「试过 1 台均不可用：openai/… → 原因」。
 *
 * ★「挂在这一家名下」必须走 X-Tenant-Id 声明头（本条用 api.withTenant(A.tenantId) 那一份），
 *   只在请求体里写 tenantId 是不生效的：AiModelConfigController.java:390-399 的 effectiveTenantId
 *   先取令牌里那个家（超管令牌 = 平台 1），只有它为空时才认体里那个号。10-06 那一轮就是这么踩的：
 *   体里写 tenantId=575、回体与实际入库都是 tenant_id=1 ⇒ 坏行挂进了平台列表，
 *   第 8 步「无处可换」的前提整个不成立（换到平台里下一台照样 COMPLETED），两条断言红。
 *   现在除了前提，还额外把「回体与库里的 tenant_id 都得是这一家」钉成断言，走错口当场红。
 *   顺带一条本条自己欠的账：上一轮那两条坏行虽按序删掉了，但删除前的两分钟里它们是
 *   平台列表里 sort_order=-1 的第一台 ⇒ 那一段时间内任何借平台模型的租户都会先撞上它。
 *   挂在自己名下之后这个侧面风险就没了。
 *
 * 本条真花钱：2 次好蒸馏 + 1 次注定失败的蒸馏 + 1 次真生成带 1 次翻译（实测 55~172s）+ 1 次注定失败的生成（端口立刻拒，几乎不花钱）。
 * 第 8 步中间睡 65s：换模型那条路的「这一家有哪些模型」有 60s 缓存（AiFailoverService 的 Caffeine），
 * 不等过去那一发读到的是第 7 步缓存下来的平台模型行，反而成功 ⇒ 测不到失败面。
 */

interface LogRow {
  id: number; purpose: string; status: string; success: number; provider: string; model: string;
  input_hash: string | null; output_summary: string | null; error_message: string | null;
  token_estimate: number | null; call_duration_ms: number | null; site_id: number | null; run_id: number | null;
}

test('SYS-J10 AI 留痕与失败面：四要素、坏模型不吞、生成与翻译那一跳补上的留痕（P9-D）', async () => {
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
        + `本条自己在这一家名下挂两条坏模型行（第 5 步、第 8 步各一条，走 X-Tenant-Id 声明头挂在 A 家而不是平台家），测完删掉；模型调用 2 次 + 生成 2 次（第 2 发注定失败）+ 翻译 1 次`,
      步骤: [
        '1 开探针租户 A，导 3 条关键词，记下 ai_call_log 与 tenant_usage 的基线数',
        '2 真蒸馏一次（成功面，走 ?preview=true 这一支——只有它把 distillSource/usedRuleFallback 放进回体）：ai_call_log 新增一行，四要素逐个查（状态/来源/耗时/输入指纹）',
        '3 额度一致性：成功那一笔计进 tenant_usage(api_call)，且只计一次',
        '4 超管切进 A 家（X-Tenant-Id）挂一条坏模型行（api_endpoint=127.0.0.1:9，sort_order 最小 ⇒ 优先选中），并验这一行确实落在 A 家名下（回体 + 库里两处都查）',
        '4b 同一档再发一发「体里点平台 1 家、声明头是 A 家」的建模型行（N-P9d-1）：必须当场拒、话术点名两个值、库里一行都不许多',
        '5 再真蒸馏一次（老路的失败面）：接口回 200 但 distillSource 从 ai_model 翻成 rule_fallback；日志里必须有 status=failed 那一行，error_message 非空；额度不再涨',
        '6 摘掉坏行 ⇒ 证明那发失败是这条行引的，不是模型网关抖（随后真生成能跑完就是证据）',
        '7 覆盖面（★G-12 的本体）：带 targetLocales=["en-US"] 跑一次真生成，按 purpose 数给看——正文生成与翻译那两跳现在必须有行，且每行过同样的四要素',
        '8 新路的失败面：再挂一条只属于这一家的坏模型行（这一家有行 ⇒ 不借平台 ⇒ 无处可换 ⇒ 注定失败），等 60s 模型列表缓存过期后再提交一发生成；断言终态不是 COMPLETED、日志里有 status=failed 那一行、error_message 点名是哪台坏的、这一笔不计额度',
      ],
      期望: [
        '步骤 2 那一行：status=success 且 success=1、provider/model 不是 unknown、call_duration_ms>0、input_hash 是 64 位十六进制、output_summary 非空、token_estimate>0、site_id=本站、run_id 为空',
        '步骤 4：回体里的 tenantId 与库里那一行的 tenant_id 都等于 A 家 —— 只在请求体里写 tenantId 而不带声明头会被令牌里那个家顶掉（AiModelConfigController.java:390-399），这一格钉的就是这个坑',
        '步骤 5 失败那一行：status=failed、success=0、error_message 有内容、call_duration_ms 有值（不许是 null）',
        '步骤 5 额度：api_call 计数在失败这一笔前后不变',
        '步骤 7 判据原话是「所有 AI 生成内容都有状态、来源和失败记录」⇒ 正文生成那一跳与翻译那一跳都要在 ai_call_log 里有成功的行（P3 实测 0，P9-D 补的就是这一处），并且两行各自的四要素与步骤 2 同尺',
        '步骤 8：换模型那条路的失败同样落一行，provider/model 记的是真试过的那台（不是 unknown），error_message 里写明「试过几台、各是怎么坏的」',
      ],
      反例: ['坏模型不许让接口 500 蒙混（要看得见退化）', '失败不许只留在日志服务自己的 error_message 里就完事：状态位与来源位也要落',
        '摘掉坏行后同一家同样的调用必须恢复（证明引火的是那条行，不是网络）',
        '补的那几行不许顺手把 tenant_usage 涨上去：留痕与计量是两件事（P9-D 正档 §4 明写的口径差）'],
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

    // 超管切进 A 家那一档的口子：这一条要往「这一家自己名下」挂模型行，只能走声明头。
    // 只带 X-Tenant-Id 后端也会去库里把 code 验一遍（TenantFilter.java:63-83），两个头都带上是界面 TenantSwitcher 的走法。
    const saAt = sa.api.withTenant(A.tenantId, A.code);
    /** 在 A 家名下挂一条注定连不上的 chat 模型行，返回它的 id（sort_order=-1 ⇒ 两处选模型都排第一） */
    const hangBrokenModel = async (标签: string, 第几名: number): Promise<number> => {
      const r = await saAt.post('/api/ai/model-configs', {
        tenantId: A!.tenantId, name: `E2E 坏模型探针 ${标签}`, provider: 'openai',
        modelName: `e2e-broken-chat-${第几名}`,
        modelType: 'chat', apiKey: 'e2e-invalid-key', isActive: true, isDefault: false, sortOrder: -1,
        apiEndpoint: 'http://127.0.0.1:9/v1/chat/completions', apiProtocol: 'openai',
      });
      j.expect(`挂第 ${第几名} 条坏模型行回 OK（超管切进 A 家这一档）`, r.code, 'OK');
      const id = Number((r.data as Record<string, unknown>)?.id ?? 0);
      j.check(`拿到第 ${第几名} 条模型行的 id`, id, id > 0);
      // ★这一格是 10-06 那一轮两条红的根：不带声明头时体里的 tenantId 会被令牌里那个家（平台 1）顶掉，
      //   坏行挂进平台列表 ⇒ 「这一家无处可换」的前提不成立。回体与库里两处都验，走错口当场红。
      j.expect(`第 ${第几名} 条坏行回体的 tenantId = A 家（不是被静默改成平台 1）`,
        Number((r.data as Record<string, unknown>)?.tenantId ?? 0), A!.tenantId);
      const dbOwner = await db.rows<{ tenant_id: number }>(
        'SELECT tenant_id FROM ai_model_config WHERE id = ?', [id]);
      j.expect(`第 ${第几名} 条坏行库里的 tenant_id = A 家`, dbOwner[0]?.tenant_id, A!.tenantId);
      // 回体里的 key 必须是打码的（这张表里存的是密文，接口不许把 key 念出来）；字段名按 Jackson 的 camelCase 读
      j.expect('创建回体里没有把 apiKey 原样念出来',
        String((r.data as Record<string, unknown>)?.apiKey ?? '').includes('e2e-invalid-key'), false);
      j.expect(`第 ${第几名} 条坏行的 model_type 字面 = chat（老路的 findChatModel 按这一列挑，写成别的值这一发引不到火）`,
        (r.data as Record<string, unknown>)?.modelType, 'chat');
      return id;
    };

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

    // ── 4 挂一条坏模型行（挂在这一家自己名下）───────────────────────────────
    brokenModelId = await hangBrokenModel('1', 1);

    // ── 4b 体与声明头不一致 ⇒ 当面拒（N-P9d-1，2026-10-06 拍板）────────────────
    // 这一发是上一轮两条红的反面教材：旧写法「有上下文就一律按上下文走」，于是「体里点平台 1 家、
    // 这次声明的是 A 家」会静默把行挂到点名的那一家去吗——不，它按上下文走，回体还回 OK，
    // 调用方以为给 A 家建好了。现在必须当场拒，而且库里一行都不许多（不许先落库再报错）。
    const mismatch = await saAt.post('/api/ai/model-configs', {
      tenantId: 1, name: 'E2E 归属不一致探针', provider: 'openai',
      modelName: 'e2e-mismatch-probe', modelType: 'chat', apiKey: 'e2e-invalid-key',
      isActive: true, isDefault: false, sortOrder: 99,
      apiEndpoint: 'http://127.0.0.1:9/v1/chat/completions', apiProtocol: 'openai',
    });
    j.expect('★体和声明头不一致时回的是拒绝，不是静默按一家建（旧写法这一发回 OK）',
      mismatch.code, 'AI_MODEL_CONFIG_TENANT_MISMATCH');
    const mismatchMessage = String((mismatch as { message?: string }).message ?? '');
    j.note('被拒的那一句原样（两个值都要点名，只回「不一致」等于让调用方回去猜）', mismatchMessage);
    j.expect('拒的那一句点名了「这次站的是哪家」（含它的站码）',
      mismatchMessage.includes(`租户 ${A!.tenantId}`) && mismatchMessage.includes(A!.code), true);
    j.expect('拒的那一句点名了「体里点的是哪家」', /参数里点的是租户 1(?!\d)/.test(mismatchMessage), true);
    const ghostRows = await db.rows<{ c: number }>(
      'SELECT COUNT(*) AS c FROM ai_model_config WHERE name = ?', ['E2E 归属不一致探针']);
    j.expect('被拒那一发在库里一行都没留', ghostRows[0]?.c, 0);
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
    // N-P9d-2（2026-10-06 拍板「为空退回异常类名」）：以前 e.getMessage() 是 null 时，这一格念的是
    // 「AI 调用失败: null」——留痕等于没留。现场这一发连的是本地拒绝端口，异常带原话，
    // 所以这一条判的是「念出来的那一句里有名头」，那个空消息的分支由单测钉（DynamicAiClientFailureReasonTest）。
    j.expect('★老路失败行念得出原因，不是「: null」这种没有名头的句子',
      /:\s*null(\s|$)/.test(String(bad?.error_message ?? '')), false);
    j.note('失败行原样（provider/model/耗时/token 各是什么写法）', bad);
    // 本地端口拒绝连接可能快到取整成 0ms，所以判的是「记没记」，不是「够不够长」
    j.expect('失败那一行也记了耗时（不是 null：重试过两次，时长是要钱的）',
      bad?.call_duration_ms === null || bad?.call_duration_ms === undefined, false);
    const usage2 = await usageSum();
    j.expect('失败这一笔不计额度（AiCallLogService.java:106 只在成功分支涨）', usage2, usage1);

    // ── 6 摘掉坏行（删除也得站在 A 家这一档：requireOwnership 拿声明头比）───
    const del = await saAt.del(`/api/ai/model-configs/${brokenModelId}`);
    j.expect('删掉坏模型行回 OK', del.code, 'OK');
    const goneRow = await db.count('SELECT COUNT(*) AS n FROM ai_model_config WHERE id = ? AND del_flag = ?',
      [brokenModelId, '0']);
    j.expect('按 id 复查：这条行不再活着（软删真落地）', goneRow, 0);
    brokenModelId = 0;

    // ── 7 覆盖面：真生成与翻译那一跳留没留痕（★G-12 的本体）────────────────
    // 带 targetLocales=["en-US"]：J-04 实测这一发全程约 172s，同形那一种不带的那一篇少一次翻译调用。
    // 翻译那一跳走的是第三条路（直连 DynamicAiClient，不经 failover 也不经日志服务），
    // P9-D 之前它在 ai_call_log 里 0 行，所以这一趟要把它点出来。
    const gen = await admin.post('/api/workspace/articles/generate-async',
      { keyword: '种植牙集采后价格降了多少', targetLocales: ['en-US'] });
    j.expect('提交生成回 OK（摘掉坏行后回落平台模型 ⇒ 还能跑，说明引火的确实是那条行）', gen.code, 'OK');
    const taskId = Number((gen.data as Record<string, unknown>)?.taskId ?? 0);
    j.check('拿到 taskId', taskId, taskId > 0);
    const usageBeforeGen = await usageSum();
    const logsBeforeGen = (await logsOf()).length;
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
    j.note('整条链跑完后这一家的 ai_call_log 按 purpose 的账（这一张表以前缺 article_generate 与 translation 两个 purpose）',
      { 行数: genLogs.length, 出现过的purpose: purposes, 各purpose行数: genLogs.reduce<Record<string, number>>((acc, l) => {
        acc[l.purpose] = (acc[l.purpose] ?? 0) + 1; return acc; }, {}) });
    j.check('跑完一趟生成确实新增了行（修前这一趟只留预审那一行，正文与翻译都不在表里）',
      genLogs.length - logsBeforeGen, genLogs.length > logsBeforeGen);
    const genOk = genLogs.filter(l => l.purpose === 'article_generate' && l.status === 'success')[0];
    const transOk = genLogs.filter(l => l.purpose === 'translation' && l.status === 'success')[0];
    j.expect('★正文生成那一跳在 ai_call_log 里有成功的行（P9-D 修前实测 0 ⇒ 这一格就是靠这条判未达成）',
      genOk === undefined, false);
    j.expect('★翻译那一跳同样有成功的行（走的是第三条路，落点在 TranslationStep 自己那一处）',
      transOk === undefined, false);
    const byPurpose = (row: LogRow | undefined, 标签: string): void => {
      if (!row) { j.expect(`${标签}：找不到那一行`, false, true); return; }
      j.note(`${标签}那一行原样`, row);
      j.expect(`${标签}：① 状态 status=success 且 success 位一致`, [row.status, row.success], ['success', 1]);
      j.expect(`${标签}：② 来源 provider 不是 unknown（是真服务它的那台，不是配置里排第一台）`,
        row.provider !== 'unknown', true);
      j.expect(`${标签}：② 来源 model 不是 unknown`, row.model !== 'unknown', true);
      j.check(`${标签}：③ 耗时 call_duration_ms 有值且 > 0`,
        row.call_duration_ms ?? 0, (row.call_duration_ms ?? 0) > 0);
      j.expect(`${标签}：④ 输入指纹是 64 位十六进制`, /^[0-9a-f]{64}$/.test(String(row.input_hash ?? '')), true);
      j.check(`${标签}：④ 输出摘要非空`, (row.output_summary ?? '').length, (row.output_summary ?? '').length > 0);
      j.check(`${标签}：token 估算落了值`, row.token_estimate ?? 0, (row.token_estimate ?? 0) > 0);
      j.expect(`${标签}：site_id 落在这一家的站上`, row.site_id, A!.siteId);
      j.expect(`${标签}：run_id 为空（这一发不属于任何一轮 GEO 诊断）`, row.run_id, null);
    };
    byPurpose(genOk, '正文生成');
    byPurpose(transOk, '翻译');
    // 10-06 那一轮的教训摆在这里：那两条红的真正形状是「成功行里写着 前 1 台不通（openai/E2E 坏模型探针 2）
    // ⇒ 换到 … 才成功」——我自己挂的坏行被换掉了，所以终态照样 COMPLETED。坏行挂对家之后这一幕不该再出现，
    // 但平台网关真抖一次也会写成这个样子，所以判的是「不许点名我自己的行」，不是「必须为 null」。
    const 我自己那两条 = ['E2E 坏模型探针 1', 'E2E 坏模型探针 2'];
    for (const [标签, row] of [['正文生成', genOk], ['翻译', transOk]] as [string, LogRow | undefined][]) {
      const msg = String(row?.error_message ?? '');
      j.note(`${标签}那一行的 error_message（成功行只该在换过台时非空）`, msg || null);
      j.expect(`★${标签}的成功行不许点名本条自己挂的坏行（挂了=坏行还赖在选中的列表里）`,
        我自己那两条.some(n => msg.includes(n)), false);
    }
    // 内容安全闸那一跳发几发取决于流程（拒时还会回落成 article_generate 那一支），所以只登记不钉数
    j.note('内容安全闸那一跳的行数（不钉死：一趟里可能一发也没有，也可能两发）',
      genLogs.filter(l => l.purpose === 'content_safety').length);
    // 已登记的口径差（P9-D 正档 §4）：补的这几行只写日志、不动 tenant_usage。
    // 这里只把两边各自的数量摆出来，不在本轮判「该不该扣量」——那是计费决定。
    j.note('★口径差事实：这一趟新增的留痕行数 vs tenant_usage(api_call) 的增量（两条不相等，本轮不判）',
      { 新增留痕行: genLogs.length - logsBeforeGen, 额度增量: (await usageSum()) - usageBeforeGen });
    // 稿子那一侧的留痕本来就有（这一趟带翻译 ⇒ 中文版 + 英文版，两行都写着是哪台模型写的）
    const versionTrace = await db.rows<{ locale: string; ai_model: string | null }>(
      `SELECT locale, ai_model FROM article_version WHERE article_id = ? AND del_flag = ? ORDER BY id`,
      [Number(task.articleId ?? 0), '0']);
    const modelByLocale = new Map(versionTrace.map(v => [v.locale, v.ai_model]));
    j.expect('中文版那一行在', modelByLocale.has('zh-CN'), true);
    j.expect('英文版那一行在（这一趟带了 targetLocales）', modelByLocale.has('en-US'), true);
    j.expect('两行的 ai_model 都不是空（来源这一半在稿子上，日志里那一半现在也齐了）',
      versionTrace.every(v => typeof v.ai_model === 'string' && (v.ai_model ?? '').length > 0), true);
    j.note('版本行上的模型名原样（不钉死是哪一个：换默认模型不该把这条测成红）', versionTrace);

    // ── 8 新路（换模型重试那一条）的失败面：不只要成功有账，失败也要有账 ─────
    // 为什么单开这一步：步骤 4~6 测的是老路（AiCallLogService 自己重试）的失败面，
    // 而 P9-D 补的正是另一条路；它的形状是「全部不通时落一行 status=failed，
    // error_message 写「试过 N 台均不可用：provider/name → 原因」」（AiFailoverService.java:99-100）。
    // 打成这一支要靠「这一家自己名下只有这一条坏行」：借平台那一支的前提是
    // 这一家一条行都没有（AiFailoverService.java:192 的 models.isEmpty()），有这一条就不借 ⇒ 无处可换。
    // 10-06 那一轮没打中就是因为坏行挂到了平台家（体里写 tenantId 不顶事，见文件头那段），
    // 于是换到平台里下一台照样 COMPLETED ⇒ 这一支现场没测到。
    // 失败得很快（本地端口立刻拒绝）⇒ 这一发不烧 token。
    brokenModelId = await hangBrokenModel('2', 2);
    // 换模型那一条的模型列表有 60s 缓存（AiFailoverService 的 Caffeine），
    // 不等过去就会读到步骤 7 那一次缓存下来的平台模型行 ⇒ 这一发反而成功，测不到失败面
    j.note('等模型列表缓存过期（60s + 5s 余量）再提交那一发', {});
    await new Promise(r => setTimeout(r, 65_000));
    const logsBeforeBroken = (await logsOf()).length;
    const usageBeforeBroken = await usageSum();
    const gen2 = await admin.post('/api/workspace/articles/generate-async', { keyword: '智齿发炎期间能拔牙吗' });
    j.expect('第二次提交回 OK（任务本身照样收得下）', gen2.code, 'OK');
    const taskId2 = Number((gen2.data as Record<string, unknown>)?.taskId ?? 0);
    const deadline2 = Date.now() + 240_000;
    let task2: Record<string, unknown> = {};
    for (;;) {
      await new Promise(r => setTimeout(r, 5_000));
      const s = await admin.get(`/api/workspace/articles/generate/${taskId2}/status`);
      task2 = (s.data ?? {}) as Record<string, unknown>;
      j.note(`任务 ${taskId2} 轮询（注定失败那一发）`, { status: task2.status, stage: task2.stage });
      if (typeof task2.status === 'string'
        && ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'CONTENT_REJECTED'].includes(task2.status)) break;
      if (Date.now() > deadline2) throw new Error(`任务 ${taskId2} 超时未终态：${JSON.stringify(task2)}`);
    }
    j.expect('★坏行在的时候这一发跑不完（终态不是 COMPLETED）', String(task2.status ?? '') !== 'COMPLETED', true);
    j.note('注定失败那一发的终态与阶段', { status: task2.status, stage: task2.stage });
    const failRows = (await logsOf()).slice(logsBeforeBroken)
      .filter(l => l.status === 'failed' && (l.purpose === 'article_generate' || l.purpose === 'content_safety'));
    j.expect('★新路的失败也落了行（修前这一条路成功与失败都一行都没有）', failRows.length >= 1, true);
    const failRow = failRows[failRows.length - 1];
    j.note('失败那一行原样（error_message 要能点名是哪台坏的）', failRow);
    if (failRow) {
      j.expect('来源记的是真试过的那台（不是 unknown：坏行的 provider/name 就在配置行上）',
        [failRow.provider, failRow.model], ['openai', 'E2E 坏模型探针 2']);
      j.check('失败原因没被吞：error_message 非空', (failRow.error_message ?? '').length,
        (failRow.error_message ?? '').length > 0);
      j.expect('这一行说了实话：试过几台、各是怎么坏的', (failRow.error_message ?? '').includes('均不可用'), true);
      j.expect('★新路失败行同样不念「: null」（AiFailoverService 那一句和老路共用同一个取原因的口子）',
        /:\s*null(\s|$)/.test(String(failRow.error_message ?? '')), false);
      j.expect('失败那一行也记了耗时（不是 null）',
        failRow.call_duration_ms === null || failRow.call_duration_ms === undefined, false);
      j.expect('失败的那一笔没有用量 ⇒ 费用那格是空的不是 0', failRow.token_estimate, null);
    }
    j.expect('失败的那一笔不计额度（新路与老路同一口径：只有成功才 +1）', await usageSum(), usageBeforeBroken);
    const del2 = await saAt.del(`/api/ai/model-configs/${brokenModelId}`);
    j.expect('摘掉第二条坏模型行回 OK', del2.code, 'OK');
    const goneRow2 = await db.count('SELECT COUNT(*) AS n FROM ai_model_config WHERE id = ? AND del_flag = ?',
      [brokenModelId, '0']);
    j.expect('按 id 复查：这条行不再活着（软删真落地）', goneRow2, 0);
    brokenModelId = 0;
  } finally {
    if (brokenModelId > 0) {
      // 上一次删除没走到就得补一刀：这条行留着会把后来任何借模型的探针租户带进沟里
      try {
        const api = (await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password)).api;
        // 坏行现在挂在 A 家名下 ⇒ 删除也要站在这一家那一档，否则 requireOwnership 直接 FORBIDDEN
        // （AiModelConfigController.java:211-220 + :401-406）
        await (A ? api.withTenant(A.tenantId, A.code) : api).del(`/api/ai/model-configs/${brokenModelId}`);
        j.note('收尾补删坏模型行', { brokenModelId, tenantId: A?.tenantId });
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
