import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, residue, retireTenant, type SeededTenant } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J05 建站交付链：前采 → AI 出 1~3 套候选 → 客户在选择页上定 → 转正交棒 → 交付后租户能独立运营（判据 G-02「能交付」、N-03）
 *
 * 这条链在 2026-10-04 之前从未真 HTTP 端到端跑过（单元/契约测试齐全，见 SiteProposalPipelineTest 与
 * SiteBriefDeliveryServiceTest，但「三套候选真出来、客户真点、转正真改 delivery_state」没有一份可重放的档）。
 * 前置：后端必须带 `PORTAL_CANDIDATE_ENABLED=true` 起（仓库默认 false，见 scratch/start-backend-p7j05.sh）；
 * 骨架库里有 3 套 published（preflight.md）；出图保持关 —— 配图那一格是 N-06 的账，不混进本程的断言。
 * 真实租户（1、15）只读不写：本程全部写落在 E2E-<runId> 前缀的探针租户里。
 */

const STAGES = ['queued', 'site', 'plan', 'copy', 'seo', 'demo', 'image', 'shots', 'preview', 'done'];
const TERMINAL = ['succeeded', 'failed'];

type Rec = Record<string, unknown>;

const asArray = (v: unknown): Rec[] => (Array.isArray(v) ? v as Rec[] : []);
const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 轮询到本轮所有子任务进终态；每一轮都落盘，慢在哪一格要看得见 */
async function waitRound(j: Journal, sa: Api, briefId: number, expectCandidates: number): Promise<Rec[]> {
  const started = Date.now();
  let last: Rec[] = [];
  for (let i = 0; i < 210; i += 1) {
    const res = await sa.get(`/api/admin/site-briefs/${briefId}/progress`);
    last = asArray(res.data);
    const terminal = last.filter(r => TERMINAL.includes(str(r.status)));
    j.record('poll', `第 ${i + 1} 次轮 progress（${Math.round((Date.now() - started) / 1000)} 秒）`, {
      计数: last.map(r => ({ 第几套: r.candidateNo, 阶段: r.stage, 状态: r.status, 已花token: num(r.promptTokens) + num(r.completionTokens) })),
    });
    if (last.length >= expectCandidates && terminal.length === last.length) return last;
    await new Promise(r => setTimeout(r, 10_000));
  }
  j.note('progress 轮询超时（35 分钟），把最后一次原样留下', { last });
  return last;
}

test('SYS-J05 建站交付链：前采→三套候选→客户选定→转正交棒→交付后能运营与计费', async () => {
  test.info().setTimeout(2_700_000);
  const j = new Journal('SYS-J05');
  const db = new Db(j);
  const B = env.apiBase;

  try {
    // ── 0 超管登录 + 探针租户（售前） ────────────────────────────────────
    j.card({
      用例号: 'SYS-J05-00',
      判据: 'G-02、N-03（前置）',
      层级: 'API',
      前置: `后端 ${B} 带 PORTAL_CANDIDATE_ENABLED=true；骨架 3 套 published（preflight.md）；出图关`,
      步骤: [
        '0 超管登录 + POST /api/admin/tenants 现开一家售前探针租户（delivery_state 默认 presale）',
        '1 GET /api/admin/site-briefs/vocabulary 读词表（界面那几栏的词只从这里来）',
        '2 出方案总开关的现探挪到 J05-02 的闸③：confirm=true 配假凭据，回来 ESTIMATE_STALE 而不是 DISABLED 才证明开关开着',
      ],
      期望: [
        '步骤 0 新租户 delivery_state=presale，且它不是 1 也不是 15',
        '步骤 1 词表带 candidateMaxCount / questions / statusLabels',
      ],
      反例: ['SITE_PROPOSAL_DISABLED 说明环境变量没生效，本程判红（在 J05-02 那格判）'],
      收尾: '软删探针租户；残留逐表清点',
    });
    const sa = await Api.login(B, j, env.superAdmin.username, env.superAdmin.password);
    const superApi = sa.api;
    const T: SeededTenant = await provisionTenant(superApi, db, j, 'J05A');
    const state0 = await db.rows<{ delivery_state: string }>('SELECT delivery_state FROM tenant WHERE id = ?', [T.tenantId]);
    j.expect('探针租户起点的 delivery_state = presale（计费闸的起点）', state0[0]?.delivery_state, 'presale');
    j.check('探针租户不是真实租户', T.tenantId, T.tenantId !== 1 && T.tenantId !== 15);

    const briefsBefore = await db.count('SELECT COUNT(*) AS n FROM site_build_brief');
    const candsBefore = await db.count('SELECT COUNT(*) AS n FROM site_proposal_candidate');
    const callsBefore = await db.count('SELECT COUNT(*) AS n FROM ai_call_log');
    const billsBefore = await db.count('SELECT COUNT(*) AS n FROM billing_consume_log WHERE tenant_id = ?', [T.tenantId]);

    // ── 词表（界面那几栏的词全从这里读，不是前端抄一份） ─────────────────
    const vocab = await superApi.get('/api/admin/site-briefs/vocabulary');
    const V = vocab.data as Rec;
    j.check('词表回得到 candidateMaxCount / questions / siteProfile / statusLabels',
      { candidateMaxCount: V.candidateMaxCount, 题数: asArray(V.questions).length, 状态标签数: Object.keys((V.statusLabels as Rec) ?? {}).length },
      num(V.candidateMaxCount) >= 1 && asArray(V.questions).length > 0);

    // ── 出方案总开关的现探 ─────────────────────────────────────────────
    // 闸的真实顺序是 requireBrief → confirm → 开关 → 凭据（SiteProposalOrchestrator.start:287-308），
    // 所以「开关开没开」只能拿一张真单、confirm=true 配假凭据去探：回来 ESTIMATE_STALE 才说明已经越过开关那道闸。
    // 探在 J05-02 的闸③那一条上，这里不重复打（拿不存在的单号探会先撞 requireBrief，测不到开关）。

    // ── SYS-J05-01 前采录单 ─────────────────────────────────────────────
    j.card({
      用例号: 'SYS-J05-01',
      判据: 'G-02（能交付·第一段）、G-01',
      层级: 'API',
      前置: `探针租户 ${T.tenantId}（售前）`,
      步骤: [
        '1 POST /api/admin/site-briefs 录一张 ready 的单（3 套候选、演示内容 lite）',
        '2 库里对账 site_build_brief：状态、候选数、requirements_summary 是谁写的',
        '3 反例：不认识的选项码 / 缺那两题必填 / 状态写成中文',
      ],
      期望: [
        '建单回 success=true 且 id>0，requirements_summary 由服务端渲染（客户端没有这一栏可填）',
        '库行 status=ready、candidate_count=3、site_id 为空（还没转正）',
        '三条反例各回各的错码，不许 200 蒙混',
      ],
      反例: ['SITE_BRIEF_UNKNOWN_OPTION', '缺必填的中文拒', '状态词表外的值被拒'],
      收尾: '随探针租户软删',
    });
    const briefForm = {
      tenantId: T.tenantId, status: 'ready', candidateCount: 3, demoContentMode: 'lite',
      brandName: 'E2E 景天口腔（系统测试）', primaryGoal: 'inquiry', tone: 'professional', scale: 'standard',
      businessModel: 'brand', industry: '本地生活', subIndustry: '到店服务',
      audiences: ['企业决策者'], mustHave: [], languages: ['zh-CN'], brandColor: '#1b6ef3',
      businessScope: '口腔诊疗与隐形矫正', uvp: '当天出方案的社区诊所', trustAnchors: [],
      pagePlan: [], homeLayout: [], referenceUrls: [], notes: '系统测试 J-05，内容全是示意',
    };
    const briefRes = await superApi.post('/api/admin/site-briefs', briefForm);
    const brief = briefRes.data as Rec;
    const briefId = num(brief.id);
    j.check('录单成功并拿到需求单 id', { code: briefRes.code, briefId }, briefRes.success && briefId > 0);
    j.check('requirements_summary 由服务端渲染出来（客户端没提交这一栏）',
      { 字数: str(brief.requirementsSummary).length, 起头: str(brief.requirementsSummary).slice(0, 40) },
      str(brief.requirementsSummary).length > 0);
    const briefRow = await db.rows<Rec>('SELECT status, candidate_count, site_id, tenant_id, demo_content_mode FROM site_build_brief WHERE id = ?', [briefId]);
    j.expect('库行：状态 ready', briefRow[0]?.status, 'ready');
    j.expect('库行：候选数 3', num(briefRow[0]?.candidate_count), 3);
    j.expect('库行：转正前 site_id 为空', briefRow[0]?.site_id ?? null, null);

    const badOption = await superApi.post('/api/admin/site-briefs', { ...briefForm, primaryGoal: 'convert_me_harder' });
    j.expect('反例①：不认识的选项码被拒（不是默默收下）', badOption.code, 'SITE_BRIEF_UNKNOWN_OPTION');
    const noBrand = await superApi.post('/api/admin/site-briefs', { ...briefForm, brandName: '' });
    j.check('反例②：两题必填缺一题 → 拒', { code: noBrand.code, success: noBrand.success, message: noBrand.message.slice(0, 60) }, !noBrand.success);
    const badStatus = await superApi.post('/api/admin/site-briefs', { ...briefForm, status: '待出方案' });
    j.check('反例③：状态写中文（词表外的值）→ 拒', { code: badStatus.code, message: badStatus.message.slice(0, 60) }, !badStatus.success);
    const tenantAdminTry = await T.admin.post('/api/admin/site-briefs', briefForm);
    j.check('反例④：租户自己的管理员够不到前采口（这条链是超管的手工活）',
      { status: tenantAdminTry.status, code: tenantAdminTry.code }, tenantAdminTry.status === 403 || tenantAdminTry.code === 'PERMISSION_DENIED');
    j.expect('四条反例之后需求单没多出行', await db.count('SELECT COUNT(*) AS n FROM site_build_brief'), briefsBefore + 1);

    // ── SYS-J05-02 估算 + 四道确认闸 ────────────────────────────────────
    j.card({
      用例号: 'SYS-J05-02',
      判据: 'G-02、N-02（计费闸的另一半）',
      层级: 'API',
      前置: `需求单 #${briefId} 已 ready`,
      步骤: [
        '1 POST /{id}/estimate 拿 estimateId + estimatedTokens（零模型调用、零写库）',
        '2 反例四连：不带 confirm / 带 confirm 不带凭据 / 编一个 estimateId / 漏 expectedTokens',
        '3 断言每一次拒绝都没有留下任何候选行、没花一次模型',
      ],
      期望: [
        '估算回 tenantBearsCost=false（这家还是售前，钱不该算在他头上）、aiEnabled=true',
        '四道闸各回各的中文错码，且都是 HTTP 200 + success:false（BusinessException 的形状）',
        'site_proposal_candidate 行数在四连拒之后一格没动',
      ],
      反例: ['SITE_PROPOSAL_CONFIRM_REQUIRED', 'SITE_PROPOSAL_ESTIMATE_REQUIRED', 'SITE_PROPOSAL_ESTIMATE_STALE'],
      收尾: '凭据留给 J05-03 的真跑',
    });
    const est = await superApi.post(`/api/admin/site-briefs/${briefId}/estimate`);
    const E = est.data as Rec;
    const estimate = (E.estimate ?? {}) as Rec;
    const estimateId = str(E.estimateId);
    const expectedTokens = num(estimate.estimatedTokens);
    j.check('估算出 estimateId 与价格', { estimateId: estimateId.slice(0, 16) + '…', expectedTokens }, estimateId.length === 64 && expectedTokens > 0);
    j.expect('售前租户：这一轮的 token 不算在他头上（tenantBearsCost=false）', estimate.tenantBearsCost, false);
    j.expect('模型侧开关：aiEnabled=true', estimate.aiEnabled, true);
    j.note('估算里摆出来的开关缺口（missingSwitches）', { missingSwitches: estimate.missingSwitches ?? [], 每套页数: estimate.pagesPerCandidate, 演示文章: estimate.demoArticles, imageAvailable: estimate.imageAvailable });
    j.expect('估算零模型调用：ai_call_log 行数不动', await db.count('SELECT COUNT(*) AS n FROM ai_call_log'), callsBefore);
    j.expect('估算零写库：候选行数不动', await db.count('SELECT COUNT(*) AS n FROM site_proposal_candidate'), candsBefore);

    const noConfirm = await superApi.post(`/api/admin/site-briefs/${briefId}/generate`, { confirm: false, estimateId, expectedTokens });
    j.expect('闸①：没勾确认 → CONFIRM_REQUIRED', noConfirm.code, 'SITE_PROPOSAL_CONFIRM_REQUIRED');
    const noCred = await superApi.post(`/api/admin/site-briefs/${briefId}/generate`, { confirm: true });
    j.expect('闸②：勾了确认但不带价格 → ESTIMATE_REQUIRED（这一条以前是 NPE 回「系统异常」）', noCred.code, 'SITE_PROPOSAL_ESTIMATE_REQUIRED');
    const stale = await superApi.post(`/api/admin/site-briefs/${briefId}/generate`, { confirm: true, estimateId: 'f'.repeat(64), expectedTokens });
    j.expect('闸③：凭据对不上现场重算 → ESTIMATE_STALE（顺带证明出方案总开关是开的：关着会先回 DISABLED）', stale.code, 'SITE_PROPOSAL_ESTIMATE_STALE');
    const wrongPrice = await superApi.post(`/api/admin/site-briefs/${briefId}/generate`, { confirm: true, estimateId, expectedTokens: expectedTokens + 1 });
    j.check('闸③续：价格抄错一位也不放行', { code: wrongPrice.code }, wrongPrice.code === 'SITE_PROPOSAL_ESTIMATE_STALE' || !wrongPrice.success);
    j.expect('四连拒之后候选行仍然一格没动', await db.count('SELECT COUNT(*) AS n FROM site_proposal_candidate'), candsBefore);

    // ── SYS-J05-03 真出方案（真调模型） ─────────────────────────────────
    j.card({
      用例号: 'SYS-J05-03',
      判据: 'G-02（AI 出 1~3 套候选）、N-03',
      层级: 'API',
      前置: `需求单 #${briefId}；真实凭据 estimateId=前 12 位见证据；模型真调、异步线程池跑`,
      步骤: [
        '1 POST /{id}/generate（confirm + estimateId + expectedTokens）→ 立刻返回，brief 进 generating',
        '2 每 10 秒轮 /progress 直到三套全进终态（succeeded/failed），上限 35 分钟',
        '3 库里逐表对账：site(candidate×3)/site_proposal_candidate/portal_page/article(is_demo=1)/operation_case/portal_showcase_item/portal_review_session',
        '4 断言「三套各不相同」：skeleton_key / focus / tone 三个维度不许两套一样',
        '5 断言售前不记账：billing_consume_log 零行，而 ai_call_log 有行（钱真花了，但没算在租户头上）',
      ],
      期望: [
        'RoundStart.attempt=1、candidates 3 行、estimatedTokens>0',
        'brief.status 终态 = awaiting_client（任一套成功就该发给客户）',
        '每套候选：≥1 个门户页 + ≥1 篇 is_demo=1 的文章 + 一枚预览令牌行',
        '三套的 focus 与 tone 两两不同（门禁就是拿这两条拦重复的）',
      ],
      反例: ['整套失败要写明 stage 与中文 error_message，不许停在 running'],
      口径: '售前那本账判的是金额不是行数：读池子会当场补一行 used_tokens=0 的 tenant_usage（TokenQuotaService#getCurrentUsage:240-255），'
        + '所以「这一行存在」不构成记账，判据是 billing_consume_log 零行 + tenant_usage 的 used_count/used_tokens 都是 0。',
      收尾: '候选站留给 J05-04/05/06；转正时才归档',
    });
    const gen = await superApi.post(`/api/admin/site-briefs/${briefId}/generate`,
      { confirm: true, estimateId, expectedTokens });
    const G = gen.data as Rec;
    j.check('generate 立刻返回一轮回执（异步，不在 HTTP 里等模型）',
      { code: gen.code, attempt: G.attempt, 起了几套: asArray(G.candidates).length, estimatedTokens: G.estimatedTokens },
      gen.success && num(G.attempt) === 1 && asArray(G.candidates).length === 3);
    const statusNow = await db.rows<{ status: string }>('SELECT status FROM site_build_brief WHERE id = ?', [briefId]);
    j.expect('需求单当场进 generating', statusNow[0]?.status, 'generating');

    const round = await waitRound(j, superApi, briefId, 3);
    j.expect('轮询到三套', round.length, 3);
    const failed = round.filter(r => str(r.status) === 'failed');
    j.note('本轮三套的终态与各自花的钱', round.map(r => ({
      第几套: r.candidateNo, 阶段: r.stage, 状态: r.status, 骨架: r.skeletonKey, 侧重: str(r.focus).slice(0, 30), 语气: r.tone,
      prompt: num(r.promptTokens), completion: num(r.completionTokens), 演示文章: r.demoArticles, 演示案例: r.demoCases,
      配图: { done: r.imageDone, failed: r.imageFailed, skipped: r.imageSkipped }, 待人工: r.needsHuman ?? null,
      错误: str(r.errorMessage), 说明: asArray(r.notices as unknown[]).length ? (r.notices as string[]) : [],
    })));
    j.check('每一套都进了终态（不许有停在 running/queued 的）',
      round.map(r => ({ 第几套: r.candidateNo, 状态: r.status, 阶段: r.stage })),
      round.length === 3 && round.every(r => TERMINAL.includes(str(r.status)) && STAGES.includes(str(r.stage))));
    const succeeded = round.filter(r => str(r.status) === 'succeeded');
    j.check('至少一套成功（全失败本程判红，因为交付链断了）', { 成功: succeeded.length, 失败: failed.length }, succeeded.length >= 1);
    j.expect('三套都成功（Spec-C 的判据是「出 3 套」，只出 1 套算部分）', succeeded.length, 3);

    const briefEnd = await db.rows<{ status: string }>('SELECT status FROM site_build_brief WHERE id = ?', [briefId]);
    j.expect('跑完需求单进 awaiting_client', briefEnd[0]?.status, 'awaiting_client');

    const siteRows = await db.rows<Rec>(
      'SELECT id, code, name, status, domain, build_brief_id, candidate_no FROM site WHERE build_brief_id = ? ORDER BY candidate_no', [briefId]);
    j.expect('库里长出 3 套候选站', siteRows.length, 3);
    j.note('候选站的形状：status=candidate、domain 为 NULL（拍板 1A：预览不占域名）',
      siteRows.map(s => ({ id: s.id, code: s.code, status: s.status, domain: s.domain ?? null, 第几套: s.candidate_no })));
    j.check('三套站全是 candidate 且都没有域名', siteRows.map(s => ({ 状态: s.status, 域名: s.domain ?? null })),
      siteRows.every(s => s.status === 'candidate' && (s.domain === null || s.domain === undefined)));

    for (const s of siteRows) {
      const pages = await db.count('SELECT COUNT(*) AS n FROM portal_page WHERE site_id = ? AND del_flag = ?', [s.id, '0']);
      const demoArticles = await db.count('SELECT COUNT(*) AS n FROM article WHERE site_id = ? AND is_demo = 1 AND del_flag = ?', [s.id, '0']);
      const cases = await db.count('SELECT COUNT(*) AS n FROM operation_case WHERE site_id = ? AND is_demo = 1', [s.id]);
      const showcase = await db.count('SELECT COUNT(*) AS n FROM portal_showcase_item WHERE site_id = ? AND is_demo = 1 AND del_flag = ?', [s.id, '0']);
      j.check(`候选站 ${s.id} 有内容可看（页 ≥1、演示文章 ≥1）`, { 门户页: pages, 演示文章: demoArticles, 演示案例: cases, 展示条目: showcase },
        pages >= 1 && demoArticles >= 1);
    }

    const candRows = await db.rows<Rec>(
      'SELECT candidate_site_id, attempt, skeleton_key, focus, tone, stage, status, prompt_tokens, completion_tokens, needs_human, notices_json ' +
      'FROM site_proposal_candidate WHERE brief_id = ? AND attempt = 1 ORDER BY candidate_no', [briefId]);
    j.check('子任务表 3 行、每行都停在 done/succeeded（不是靠把期望拼成实际值凑绿的）',
      candRows.map(r => ({ 第几套: r.candidate_no, 阶段: r.stage, 状态: r.status, 错误: str(r.error_message) })),
      candRows.length === 3 && candRows.every(r => r.stage === 'done' && r.status === 'succeeded'));
    const modelTokens = candRows.reduce((a, r) => a + num(r.prompt_tokens) + num(r.completion_tokens), 0);
    j.check('模型真花了 token（不是降级成 0）', { 三套合计: modelTokens }, modelTokens > 0);

    const focusSet = new Set(candRows.map(r => str(r.focus)));
    const toneSet = new Set(candRows.map(r => str(r.tone)));
    const skelSet = new Set(candRows.map(r => str(r.skeleton_key)));
    j.check('三套「各不相同」：侧重两两不同', { 侧重视为几套: focusSet.size, 语气: toneSet.size, 骨架: skelSet.size },
      focusSet.size === candRows.length);
    j.note('三套的骨架/侧重/语气逐条原话', candRows.map(r => ({ 骨架: r.skeleton_key, 侧重: str(r.focus), 语气: r.tone, 待人工: r.needs_human })));

    // 售前记账口径：模型真花了钱，但不该记在这个租户头上。
    // 注意 tenant_usage 那一行「存在」不等于「扣了钱」：读池子时 getCurrentUsage 会当场补一行 0（TokenQuotaService:240-255），
    // 所以判的是金额那一列（used_tokens / used_count）没长，而不是「这一行不存在」。
    const callsAfter = await db.count('SELECT COUNT(*) AS n FROM ai_call_log');
    const billsAfter = await db.count('SELECT COUNT(*) AS n FROM billing_consume_log WHERE tenant_id = ?', [T.tenantId]);
    const usageRows = await db.rows<Rec>(
      'SELECT usage_type, used_count, used_tokens FROM tenant_usage WHERE tenant_id = ? AND usage_type IN (?,?) ORDER BY usage_type',
      [T.tenantId, 'AI_TOKEN', 'AI_GEO']);
    const usageSum = usageRows.reduce((a, r) => a + num(r.used_tokens) + num(r.used_count), 0);
    j.check('售前：ai_call_log 涨了（真调用），但这个租户 billing_consume_log 零行、tenant_usage 金额为 0（平台承担）',
      { 新增留痕: callsAfter - callsBefore, 该租户流水: billsAfter - billsBefore, 该租户额度行: usageRows, 金额合计: usageSum },
      callsAfter > callsBefore && billsAfter === billsBefore && usageSum === 0);

    // ── SYS-J05-04 预览令牌即准入 ───────────────────────────────────────
    j.card({
      用例号: 'SYS-J05-04',
      判据: 'G-02、G-01',
      层级: 'API',
      前置: `三套候选站已生成（brief #${briefId}）`,
      步骤: [
        '1 GET /{id}/candidates：读口不许吐出明文令牌（库里只有散列）',
        '2 POST /api/admin/sites/{id}/preview-links 首发明文令牌，并拿去 GET 公开门户口',
        '3 候选站不带令牌对外不可见（拍板 1A）；令牌绑站不绑页：拿 A 套的令牌读不到 B 套',
        '4 反例：对非候选站签发令牌',
      ],
      期望: [
        'candidates 的 previewToken/previewUrl 恒为 null，但 previewIssued 与 previewExpiresAt 说得出「发没发过」',
        '明文令牌只在签发那一刻出现一次；库里的 token_hash ≠ 明文散列对得上',
        '凭本站令牌 GET /api/portal/public/site 读得到这一套；别套读不到',
        '非候选站签发 → SITE_PROPOSAL_NOT_CANDIDATE',
      ],
      反例: ['拿 A 套令牌请求 B 套', '给租户默认站（enabled）签发预览令牌'],
      收尾: '转正时全部撤销，由 J05-06 验',
    });
    const cands = await superApi.get(`/api/admin/site-briefs/${briefId}/candidates`);
    const candList = asArray(cands.data);
    j.expect('候选列表 3 行', candList.length, 3);
    j.check('读口不签发：previewToken / previewUrl 恒空',
      candList.map(c => ({ token: c.previewToken ?? null, url: c.previewUrl ?? null, 发过: c.previewIssued, 到期: c.previewExpiresAt ?? null })),
      candList.every(c => (c.previewToken ?? null) === null && (c.previewUrl ?? null) === null));
    const noticesWithUrl = candList.map(c => str((c.notices as string[] | undefined)?.join(' | ') ?? ''))
      .filter(n => n.includes('http') || n.includes('/preview') || n.includes('reviewToken'));
    j.note('生成时那句带预览地址的说明（明文进 notices_json 的既有取舍）', { 含链接的说明条数: noticesWithUrl.length, 样例: noticesWithUrl[0]?.slice(0, 200) ?? null });

    const chosen = candList[0];
    const chosenSiteId = num(chosen.siteId);
    const link = await superApi.post(`/api/admin/sites/${chosenSiteId}/preview-links?label=J05-首发明文`);
    const L = link.data as Rec;
    const plainToken = str(L.previewToken);
    j.check('首发明文令牌拿到且像令牌（长度 ≥ 20）', { 长度: plainToken.length, 预览地址: str(L.previewUrl).slice(0, 120) }, plainToken.length >= 20);
    const sess = await db.rows<Rec>('SELECT token_hash, scopes, expires_at, revoked_at, site_id FROM portal_review_session WHERE site_id = ? ORDER BY id DESC LIMIT 1', [chosenSiteId]);
    j.check('库里存的是散列而不是明文，且 scopes 绑到本站',
      { hash起头: str(sess[0]?.token_hash).slice(0, 16), scopes: sess[0]?.scopes, 撤了没: sess[0]?.revoked_at ?? null },
      str(sess[0]?.token_hash) !== plainToken && str(sess[0]?.scopes).includes(`site:${chosenSiteId}`));

    const anon = Api.anonymous(B, j);
    const siteWithToken = await anon.get(`/api/portal/public/site?reviewToken=${plainToken}`);
    j.check('候选站凭本站令牌对外可读（免鉴权，令牌即准入）',
      { code: siteWithToken.code, 站名: str((siteWithToken.data as Rec)?.name ?? (siteWithToken.data as Rec)?.siteName).slice(0, 30) },
      siteWithToken.success);
    const otherToken = await anon.get(`/api/portal/public/site?reviewToken=${'n'.repeat(plainToken.length)}`);
    j.check('反例：假令牌读不到候选站', { code: otherToken.code, success: otherToken.success, 数据: otherToken.data === null }, !otherToken.success || otherToken.data === null);
    const noSite = await anon.get('/api/portal/public/site');
    j.note('不带任何令牌时公开口落在谁身上（dev 档 allow-site-param=true，见证据）',
      { code: noSite.code, 站名: str((noSite.data as Rec)?.name ?? '').slice(0, 30) ?? null });
    const otherSiteId = num(candList[1]?.siteId);
    const link2 = await superApi.post(`/api/admin/sites/${otherSiteId}/preview-links?label=J05-第二套的令牌`);
    const plainToken2 = str((link2.data as Rec).previewToken);
    const otherWithToken = await anon.get(`/api/portal/public/site?reviewToken=${plainToken2}`);
    j.check('第二套也凭自己那枚令牌可读（令牌绑站不绑页）',
      { code: otherWithToken.code, success: otherWithToken.success }, otherWithToken.success);
    const crossSiteToken = await anon.get(`/api/portal/public/site?site=${str(candList[2]?.siteCode)}&reviewToken=${plainToken2}`);
    j.note('拿第二套的令牌去指第三套（令牌绑站不绑页的实测形状，只登记不判分）',
      { code: crossSiteToken.code, success: crossSiteToken.success });

    const notCandidate = await superApi.post(`/api/admin/sites/${T.siteId}/preview-links?label=J05-反例`);
    j.expect('反例：给租户默认站（enabled）签发预览令牌 → SITE_PROPOSAL_NOT_CANDIDATE', notCandidate.code, 'SITE_PROPOSAL_NOT_CANDIDATE');

    // ── SYS-J05-05 公开选择页与客户答复 ─────────────────────────────────
    j.card({
      用例号: 'SYS-J05-05',
      判据: 'G-02（客户决策这一环）、G-01',
      层级: 'API',
      前置: `明文令牌 ${plainToken.slice(0, 8)}…（免鉴权口 /api/portal/public/brief/{token}）`,
      步骤: [
        '1 免鉴权 GET 选择页：三套并排、带 focus/tone、demoNotice 与 previewNotice 原话在响应里',
        '2 反例：无效令牌 → 与真数据同构的空形状（不许回 404 泄露「这单不存在」）',
        '3 蜜罐 website 非空 → 200 但整条丢弃（库里不加行）',
        '4 正路先走：第一套的令牌只花 1 发额度，选定 + clientNote 有字 → 落库并把单子推到 decided',
        '5 三发反例排在第二套那枚令牌上（正好花完 3 次额度）：清洗后什么都不剩的意见 / 空串意见 / 别单的候选 —— 一、三丢，二按「空串=null」落库',
        '6 限流单独测：第三套那枚全新令牌一分钟内连发 4 次，对 3 次/分钟的门限打',
        '7 标签清洗另起第四枚令牌：<script> 那种意见落库的是剥掉标签剩下的文字',
        '8 GET /{id}/decisions 回留痕但不回 ip_hash（这一口带 TenantGuard：超管要声明「切进这一家」才打得开）',
      ],
      期望: [
        '选择页 candidateCount 与需求单一致；每一套的 focus/tone 看得见',
        '被规则丢掉的答复对外都是 200 + 同一形状，区别只在日志与库里',
        '真答复落 1 行 site_build_decision（session_id 非空、ip_hash 是 64 位十六进制）',
        '空串意见那一发照样落库、client_note 为 NULL（与「没写意见」同义，不是丢弃）',
        '一枚干净令牌 4 发只落 3 行（额度实测），留痕口不出现 ip_hash 键',
      ],
      反例: ['无效令牌', '蜜罐', '清洗后什么都不剩的意见', '不属于本单的候选', '超频答复'],
      口径: '单令牌 3 次/分钟：反例若全挤一枚令牌，第四发「真答复」会被额度吃掉，判红的是限流不是规则（run 1004-122355 实测）。'
        + '意见那一格的判据是 ClientDecisionService#cleanNote（:398-412）+ decide（:193-203）：null 与 trim 后为空 ⇒ 意见列 NULL、选定照落；'
        + '只有「写了字但清洗后为空」或「超 2000 字」⇒ 整条答复连选定一起丢。界面（ClientDecisionView.vue:165）空意见传 null 不传空串，'
        + '所以「空串落库」这一格测的是服务端形状，不是界面形状。',
      收尾: '留痕行随探针租户软删',
    });
    const page = await anon.get(`/api/portal/public/brief/${plainToken}`);
    const P = page.data as Rec;
    j.check('选择页免鉴权读得到三套并排 + 两句法务口径原话', {
      需求单: P.briefId, 状态: P.briefStatus, 抬头: str(P.title).slice(0, 30), 候选数: P.candidateCount,
      每套: asArray(P.candidates).map(c => ({ 站: c.siteId, 第几套: c.candidateNo, 骨架: c.skeletonKey, 侧重: str(c.focus).slice(0, 24), 语气: c.tone, 预览: str(c.previewUrl).slice(0, 40) })),
      演示说明: str(P.demoNotice).slice(0, 40), 预览说明: str(P.previewNotice).slice(0, 40),
    }, num(P.briefId) === briefId && asArray(P.candidates).length === 3 && str(P.demoNotice).length > 0);
    j.note('响应里有没有前端类型怀疑的那个 differentiation 键（UI 把它标成「后端今天没有」）',
      { 第一套的键: Object.keys(asArray(P.candidates)[0] ?? {}), 有没有differentiation: 'differentiation' in (asArray(P.candidates)[0] ?? {}) });

    const bogus = await anon.get('/api/portal/public/brief/deadbeef-not-a-token');
    j.check('无效令牌 → 与真数据同构的空形状（不泄露这单存不存在）',
      { code: bogus.code, briefId: (bogus.data as Rec)?.briefId ?? null, 候选数: (bogus.data as Rec)?.candidateCount ?? null, 候选: asArray((bogus.data as Rec)?.candidates).length },
      bogus.success && num((bogus.data as Rec)?.candidateCount) === 0);

    // 令牌维的额度是「单令牌 3 次/分钟」（ClientDecisionRateLimiter；超了照样回 200、什么都不落）。
    // 所以四格反例各排各的令牌：全挤在同一枚上，被吃掉的那一发说不清是规则拦的还是额度拦的
    // （第一轮 run 1004-122355 就是这么被掐断的：三发反例把额度花光，第四发「真答复」根本没进库）。
    const decisionsBefore = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
    const honeypot = await anon.post(`/api/portal/public/brief/${plainToken}/decide`,
      { chosenSiteId, clientNote: '我是机器人', website: 'http://spam.example' });
    j.check('蜜罐：对外 200，库里一行不加', { status: honeypot.status, code: honeypot.code },
      honeypot.success && honeypot.status === 200);
    j.expect('蜜罐之后留痕行数不变', await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]), decisionsBefore);

    // 正路：本单选定，走的是界面真实形状（意见为空时前端传 null，不传空串）
    const real = await anon.post(`/api/portal/public/brief/${plainToken}/decide`, { chosenSiteId, clientNote: '就要第一套，案例想放首页第一屏' });
    const afterReal = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
    const decisionRows = await db.rows<Rec>(
      'SELECT id, session_id, chosen_site_id, client_note, ip_hash FROM site_build_decision WHERE brief_id = ? ORDER BY id DESC LIMIT 1', [briefId]);
    j.check('真答复落库：1 行、session_id 非空、ip_hash 是 64 位十六进制', {
      status: real.status, 新增行数: afterReal - decisionsBefore, 行数: decisionRows.length, session: decisionRows[0]?.session_id ?? null,
      选定: decisionRows[0]?.chosen_site_id, 哈希长: str(decisionRows[0]?.ip_hash).length, 意见: str(decisionRows[0]?.client_note).slice(0, 20),
    }, afterReal - decisionsBefore === 1 && decisionRows[0]?.session_id !== null && str(decisionRows[0]?.ip_hash).length === 64);
    const decidedStatus = await db.rows<{ status: string }>('SELECT status FROM site_build_brief WHERE id = ?', [briefId]);
    j.expect('客户选定之后需求单进 decided', decidedStatus[0]?.status, 'decided');

    // 三发反例排在第二套那枚令牌上（正好花完 3 次/分钟的额度 ⇒ 丢它只可能是因为规则）
    // 判据读的是 ClientDecisionService.cleanNote（:398-412）：null 与「trim 后为空」都算「没写意见」→ 意见存 NULL、选定照样落库；
    // 只有「写了字但清洗后什么都不剩」或「超过 2000 字」才是整条答复不可信、连他选的那一套一起丢（:193-198）。
    const tagsOnly = await anon.post(`/api/portal/public/brief/${plainToken2}/decide`,
      { chosenSiteId, clientNote: '<p></p><br/>   ' });
    const afterTags = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
    j.check('反例：意见清洗后什么都不剩（只有空标签）⇒ 整条答复（连同他选的这一套）被丢弃，仍是 200',
      { status: tagsOnly.status, 留痕新增: afterTags - afterReal }, afterTags === afterReal);
    const emptyStringNote = await anon.post(`/api/portal/public/brief/${plainToken2}/decide`,
      { chosenSiteId, clientNote: '' });
    const afterEmpty = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
    const emptyNoteRow = await db.rows<Rec>(
      'SELECT id, client_note FROM site_build_decision WHERE brief_id = ? ORDER BY id DESC LIMIT 1', [briefId]);
    j.check('空串意见实测不是「整条丢掉」：空串与 null 同义（cleanNote 把 trim 后为空判成没写），选定照样落库、意见列为 NULL',
      { status: emptyStringNote.status, 留痕新增: afterEmpty - afterReal, 意见列: emptyNoteRow[0]?.client_note ?? null },
      afterEmpty - afterReal === 1 && emptyNoteRow[0]?.client_note === null);

    const ownSiteIds = candList.map(c => num(c.siteId));
    const foreign = await db.rows<{ candidate_site_id: number; brief_id: number }>(
      'SELECT candidate_site_id, brief_id FROM site_proposal_candidate WHERE brief_id <> ? AND candidate_site_id IS NOT NULL ORDER BY id DESC LIMIT 1', [briefId]);
    if (foreign.length === 1) {
      const injected = num(foreign[0].candidate_site_id);
      j.check('反例用的确实是别单的候选（站号不在本单三套里）',
        { 用的siteId: injected, 别单: foreign[0].brief_id, 本单三套: ownSiteIds }, !ownSiteIds.includes(injected));
      const crossBrief = await anon.post(`/api/portal/public/brief/${plainToken2}/decide`, { chosenSiteId: injected, clientNote: null });
      const afterCross = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
      // 基线必须是「上一发空串意见之后」那一瞬的数：afterReal 之后还落了空串那一条（合法的 1 行），
      // 拿 afterReal 当基线会把那一行算成注入成功（1004-131200 首轮就是这么假红的）
      j.check('反例：把别单的候选塞进本单的答复 → 丢弃（否则转正就会去动别人的站）',
        { status: crossBrief.status, code: crossBrief.code, 留痕新增: afterCross - afterEmpty },
        crossBrief.status === 200 && afterCross === afterEmpty);
    } else {
      j.note('库里找不到别的单的候选行，这一格反例本轮没跑（不是通过，是没测）', { foreign });
    }

    // 限流用第三套那枚全新令牌测：一发都不先花，4 发对着 3 次/分钟的门限打
    const link3 = await superApi.post(`/api/admin/sites/${num(candList[2]?.siteId)}/preview-links?label=J05-第三套的令牌`);
    const plainToken3 = str((link3.data as Rec).previewToken);
    const afterReal2 = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
    const limiterHits: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const again = await anon.post(`/api/portal/public/brief/${plainToken3}/decide`, { chosenSiteId, clientNote: `限流探测第 ${i + 1} 发` });
      limiterHits.push(`${again.status}/${again.code}`);
    }
    const afterLimit = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
    j.note('限流实测：一枚干净令牌一分钟内连发 4 次，对外全是 200',
      { 四次回体: limiterHits, 落库: afterLimit - afterReal2, 阈值出处: 'app.portal.decision.max-per-token-per-minute=3' });
    j.check('限流起作用（4 发只落 3 发，丢的那发照样回 200）',
      { 发了: 4, 落了: afterLimit - afterReal2 }, afterLimit - afterReal2 === 3 && limiterHits.every(h => h.startsWith('200/')));

    // 标签清洗那一格另起一枚令牌。run 1004-134640 实测的原话：意见里的 `<script>alert(1)</script>`
    // 是被**入口 XssFilter（@Order(1)，正则整段删，连标签里的文字一起删）**抹掉的，
    // 服务层拿到的已经是空白串 ⇒ cleanNote 判成「没写」（返回 null，不是 ""）⇒ 答复行照样落库、client_note 为 NULL。
    // 所以这一格证的是「标签意见不会污染库、也不会整条丢弃」，**不能**写成「保留了 alert(1)」——那是话术过头。
    const link4 = await superApi.post(`/api/admin/sites/${chosenSiteId}/preview-links?label=J05-清洗实测的令牌`);
    const plainToken4 = str((link4.data as Rec).previewToken);
    const beforeScript = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
    const scriptNote = await anon.post(`/api/portal/public/brief/${plainToken4}/decide`,
      { chosenSiteId, clientNote: '<script>alert(1)</script>   ' });
    const scriptRow = await db.rows<Rec>(
      'SELECT client_note, client_note IS NULL AS is_null FROM site_build_decision WHERE brief_id = ? ORDER BY id DESC LIMIT 1', [briefId]);
    const afterScript = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
    j.check('带标签的意见实测：入口 XssFilter 整段抹掉 script（连文字）⇒ 意见列为 NULL，但答复行仍落库（不是整条丢弃）',
      { status: scriptNote.status, 留痕新增: afterScript - beforeScript, 存进去的意见: str(scriptRow[0]?.client_note).slice(0, 40), 是NULL: num(scriptRow[0]?.is_null) === 1 },
      afterScript - beforeScript === 1 && !/<|>/.test(str(scriptRow[0]?.client_note)));
    j.note('产品观察（不改）：客户在意见里写的一段代码会被边缘清洗整段吃掉，对外仍是 200/OK，库里意见列 NULL —— 一句话没留也没人告诉他',
      { 送进去的: '<script>alert(1)</script>   ', 库里: scriptRow[0]?.client_note ?? null, 清洗器两处: 'XssFilter.java:29（正则，连内容删） + RichTextSanitizer.stripAll（jsoup text()）' });

    // 留痕口与转正口都在 SiteBriefDeliveryController：类级 portal:build:manage + service 里 TenantGuard 归属判
    // （:92-97）⇒ 超管要带着「切进这一家」的租户声明头才打得开，界面那一站就是租户选择器干的事。
    const tenantScoped = superApi.withTenant(T.tenantId, T.code);
    const decisionList = await tenantScoped.get(`/api/admin/site-briefs/${briefId}/decisions`);
    const D = asArray(decisionList.data);
    j.check('留痕口回得到「谁选了什么、原话」，但不回 ip_hash',
      { 条数: D.length, 键: Object.keys(D[0] ?? {}), 有ip_hash: D.some(d => 'ipHash' in d || 'ip_hash' in d) },
      D.length >= 1 && !D.some(d => 'ipHash' in d || 'ip_hash' in d));

    // ── SYS-J05-06 转正交棒 ─────────────────────────────────────────────
    j.card({
      用例号: 'SYS-J05-06',
      判据: 'G-02（转正交棒）、N-02（计费起点）',
      层级: 'API',
      前置: `需求单 #${briefId} 已 decided；三套候选都在；令牌未撤`,
      步骤: [
        '1 反例：decisionId 与 siteId 同时给 → AMBIGUOUS（本单先探，探不动再转正）',
        '2 POST /{id}/promote 空 body = 用本单最近一条「客户选定了」的答复',
        '3 库里对账：选中 enabled+promoted_at、另两套 archived（一行不删）、brief.site_id 回填、tenant.delivery_state=delivered',
        '4 全部预览令牌撤销：拿转正前那一条明文地址再读一次，必须读不到（含刚签发的、含 notices_json 里那句）',
        '5 幂等：二次转正只回同一张回执，行数不再动',
        '6 已转正的单不许重跑 → SITE_BRIEF_ALREADY_PROMOTED',
      ],
      期望: [
        '回执带 maintenanceUrl（相对路径，siteId 显式写在查询串上）与三处交棒清单 showcase/case/company',
        'briefStatusLabel = 已转正交付',
        '撤销条数 ≥ 候选站数（生成时一套一枚 + 手工签发的那些）',
      ],
      反例: ['两个 id 都给', '二次转正改行数', '转正后旧明文链接还能打开'],
      口径: 'promote / regenerate / decisions 这一组三口都在 SiteBriefDeliveryController 里过 TenantGuard.checkOwnership(brief.tenant_id, effectiveTenantId(null))'
        + '（:92-97、:148）：超管声明的租户号（X-Tenant-Id，界面上就是右上角那个租户选择器）必须就是这一家，否则回 FORBIDDEN「无权限操作该需求单」。'
        + 'run 1004-123624 第一次就是这么撞红的：带着平台档（tenant 1）的声明去转 tenant 515 的单。',
      收尾: '交付态留给 J05-07 翻计费口径',
    });
    const wrongTenant = await superApi.post(`/api/admin/site-briefs/${briefId}/promote`, {});
    j.note('反例形状（现场撞出来的，非本程设计）：超管停在平台档（声明租户 1）去转别家的单 ⇒ 回 FORBIDDEN，一行不动',
      { status: wrongTenant.status, code: wrongTenant.code, 说的: str(wrongTenant.message).slice(0, 30), 需求单归属: T.tenantId });
    j.expect('带错租户声明的转正没有改需求单状态',
      (await db.rows<{ status: string }>('SELECT status FROM site_build_brief WHERE id = ?', [briefId]))[0]?.status, 'decided');
    const ambiguous = await tenantScoped.post(`/api/admin/site-briefs/${briefId}/promote`,
      { decisionId: num(decisionRows[0]?.id), siteId: chosenSiteId });
    j.expect('反例：decisionId 与 siteId 同时给 → AMBIGUOUS（并且没动任何行）', ambiguous.code, 'SITE_BRIEF_PROMOTE_AMBIGUOUS');
    j.expect('AMBIGUOUS 之后需求单还没被改状态',
      (await db.rows<{ status: string }>('SELECT status FROM site_build_brief WHERE id = ?', [briefId]))[0]?.status, 'decided');

    const promote = await tenantScoped.post(`/api/admin/site-briefs/${briefId}/promote`, {});
    const R = promote.data as Rec;
    j.check('转正回执：状态、站、交棒地址、归档几套、撤了几条令牌', {
      code: promote.code, briefStatus: R.briefStatus, 标签: R.briefStatusLabel, siteId: R.siteId,
      归档: R.archivedSiteIds, 撤销令牌: R.revokedTokenCount, 维护地址: R.maintenanceUrl, 相对: R.maintenanceUrlRelative,
      租户名: R.tenantName, 交棒条目: asArray(R.handoverItems).map(h => h.key),
    }, promote.success && str(R.briefStatus) === 'promoted' && str(R.briefStatusLabel) === '已转正交付');
    j.expect('交棒清单三处：showcase / case / company', asArray(R.handoverItems).map(h => h.key), ['showcase', 'case', 'company']);
    j.check('维护地址把 siteId 显式写进查询串（不靠「租户第一个站」兜底）',
      str(R.maintenanceUrl), str(R.maintenanceUrl).includes(`siteId=${num(R.siteId)}`));

    const siteAfter = await db.rows<Rec>(
      'SELECT id, status, promoted_at, domain FROM site WHERE build_brief_id = ? ORDER BY candidate_no', [briefId]);
    j.note('转正后每一套的库状态', siteAfter.map(s => ({ 站: s.id, 状态: s.status, promoted_at: s.promoted_at ?? null, 域名: s.domain ?? null })));
    j.expect('选中的那套 candidate→enabled 并盖了 promoted_at',
      siteAfter.filter(s => num(s.id) === num(R.siteId)).map(s => s.status)[0], 'enabled');
    const chosenRow = siteAfter.find(s => num(s.id) === num(R.siteId));
    j.check('选中的那套 promoted_at 非空、域名仍然为 NULL（转正不发域名）',
      { 盖了时间: chosenRow?.promoted_at !== null, 域名: chosenRow?.domain ?? null },
      chosenRow !== undefined && chosenRow.promoted_at !== null && (chosenRow.domain === null || chosenRow.domain === undefined));
    j.expect('另外两套转 archived（只超管可查，一行没删）',
      siteAfter.filter(s => num(s.id) !== num(R.siteId)).map(s => s.status), ['archived', 'archived']);
    const briefAfter = await db.rows<Rec>('SELECT status, site_id FROM site_build_brief WHERE id = ?', [briefId]);
    j.expect('需求单回填 site_id 并置 promoted', { 状态: briefAfter[0]?.status, 站: num(briefAfter[0]?.site_id) }, { 状态: 'promoted', 站: num(R.siteId) });
    const tenantAfter = await db.rows<{ delivery_state: string }>('SELECT delivery_state FROM tenant WHERE id = ?', [T.tenantId]);
    j.expect('转正这一刻租户进 delivered（计费起点，V142 的唯一写入点）', tenantAfter[0]?.delivery_state, 'delivered');

    const revoked = await db.rows<Rec>(
      'SELECT site_id, revoked_at, token_hash FROM portal_review_session WHERE site_id IN (?,?,?)',
      siteAfter.map(s => num(s.id)));
    j.check('这套单名下所有预览令牌都撤了（含选中那套自己的）',
      { 总条数: revoked.length, 未撤: revoked.filter(r => r.revoked_at === null).length, 回执报的数: num(R.revokedTokenCount) },
      revoked.length > 0 && revoked.every(r => r.revoked_at !== null));
    const revokedProof = await anon.get(`/api/portal/public/site?reviewToken=${plainToken2}`);
    j.check('撤得干净的可执行证明：几分钟前还能打开的那枚令牌，转正后同一个地址读不到了',
      { success: revokedProof.success, code: revokedProof.code, 数据是否为空: revokedProof.data === null },
      !revokedProof.success || revokedProof.data === null);
    const closedPage = await anon.get(`/api/portal/public/brief/${plainToken2}`);
    j.check('选择页对这枚已撤销的令牌关门：回的是同构的空形状（0 套、状态为 null）',
      { 候选数: num((closedPage.data as Rec)?.candidateCount), 状态: (closedPage.data as Rec)?.briefStatus ?? null },
      asArray((closedPage.data as Rec)?.candidates).length === 0);
    const archivedPublic = await anon.get(`/api/portal/public/site?site=${str(candList[1]?.siteCode)}`);
    j.note('归档站按站号公开读的样子（archived 连合法令牌都不给过，这里是不带令牌的公开读）',
      { code: archivedPublic.code, success: archivedPublic.success, 站名: str((archivedPublic.data as Rec)?.name ?? '').slice(0, 24) });
    j.note('选中那套转正后按状态对外开了 —— 这一格不能拿来当「令牌已撤」的证据（站是被 enabled 放出来的，不是被旧令牌放出来的）',
      { 站: num(R.siteId), 状态: 'enabled' });

    const promoteAgain = await tenantScoped.post(`/api/admin/site-briefs/${briefId}/promote`, {});
    const RA = promoteAgain.data as Rec;
    j.check('幂等：二次转正回同一张回执，归档数不再增长',
      { 站点: RA.siteId, 归档: RA.archivedSiteIds, 撤销: RA.revokedTokenCount, 状态: RA.briefStatus },
      num(RA.siteId) === num(R.siteId) && num(RA.revokedTokenCount) === 0);
    const regenAfterPromote = await tenantScoped.post(`/api/admin/site-briefs/${briefId}/regenerate`);
    j.expect('已转正的单不许重跑 → SITE_BRIEF_ALREADY_PROMOTED', regenAfterPromote.code, 'SITE_BRIEF_ALREADY_PROMOTED');

    // ── SYS-J05-07 交付后：租户能独立运营 + 计费口径翻过来 ──────────────
    j.card({
      用例号: 'SYS-J05-07',
      判据: 'G-02（交付后能运营、能计费）、G-01、N-02',
      层级: 'API',
      前置: `租户 ${T.tenantId} 现在是 delivered；交付站 ${num(R.siteId)}（enabled、无域名）`,
      步骤: [
        '1 该家管理员登录读自己的站与站点信息（租户侧口只有 GET，没有写站名的口）',
        '2 公开门户读得到交付站（dev 档 ?site=；生产要靠超管绑域名 —— 两条分开报）',
        '3 管理员够不到超管那半条链（前采口、候选口、转正口全 403）',
        '4 再录一张单：estimate 的 tenantBearsCost 现在必须是 true（口径翻转）',
        '5 真跑 1 套（delivered 之后）：billing_consume_log 落在这个租户名下、tenant_usage.used_tokens 与流水同源',
        '6 regenerate 不收钱：归档 + 回 ready + attempt+1，模型留痕与流水零增长',
      ],
      期望: [
        '租户侧只读口成功；三条超管口各回 403/PERMISSION_DENIED',
        '第二张单的估算 tenantBearsCost=true（同一家、只因为转正了，账就改他承担）',
        '第二轮真扣费：流水行 > 0 且 Σtoken_amount == 候选行 prompt+completion 增量',
        'regenerate 前后 ai_call_log 与 billing_consume_log 一模一样',
      ],
      反例: ['租户 admin 打转正口', '租户 admin 打候选口', 'regenerate 被算成一次花钱的重跑'],
      收尾: '两张单、交付站与探针租户随软删收口，逐表清点',
    });
    const tenantSites = await T.admin.get('/api/portal/sites');
    const tsList = asArray(tenantSites.data);
    j.check('该家管理员读得到自己的站（含刚转正那一套）',
      { 条数: tsList.length, 码: tenantSites.code, 站: tsList.map(s => ({ id: s.id, code: s.code, 域名: s.domain ?? null })) },
      tenantSites.success);
    const siteInfo = await T.admin.get(`/api/portal/site-info?siteId=${num(R.siteId)}`);
    j.note('租户侧读站点信息（GEO/SEO 那些字段的家）', { code: siteInfo.code, success: siteInfo.success, 键数: Object.keys((siteInfo.data as Rec) ?? {}).length });
    for (const path of [`/api/admin/site-briefs/${briefId}`, `/api/admin/site-briefs/${briefId}/candidates`, `/api/admin/site-briefs/${briefId}/progress`]) {
      const denied = await T.admin.get(path);
      j.check(`反例：租户管理员打超管那半条链 ${path} → 拒`,
        { status: denied.status, code: denied.code }, denied.status === 403 || denied.code === 'PERMISSION_DENIED');
    }

    const deliveredCode = str(candList.find(c => num(c.siteId) === num(R.siteId))?.siteCode ?? '');
    const deliveredStatus = siteAfter.find(s => num(s.id) === num(R.siteId))?.status ?? null;
    const publicDelivered = await anon.get(`/api/portal/public/site?site=${deliveredCode}`);
    j.check('交付站的公开读得到（dev 档 ?site= 认站；生产 allow-site-param=false，那时必须超管绑域名）',
      { 站号: deliveredCode, 库状态: deliveredStatus, code: publicDelivered.code, 回读站名: str((publicDelivered.data as Rec)?.name ?? '').slice(0, 30) },
      publicDelivered.success && deliveredStatus === 'enabled');
    const domainWrite = await T.admin.put(`/api/admin/sites/${num(R.siteId)}`, { domain: 'j05.example.invalid' });
    j.check('租户自己绑不了域名（这条口是超管的 portal:build:manage）',
      { status: domainWrite.status, code: domainWrite.code }, domainWrite.status === 403 || domainWrite.code === 'PERMISSION_DENIED');

    // 同一家的第二张单：转正之后口径必须翻过来
    const brief2Res = await superApi.post('/api/admin/site-briefs', { ...briefForm, candidateCount: 1, notes: 'J-05 第二张单：验交付后的计费口径' });
    const brief2Id = num((brief2Res.data as Rec).id);
    j.check('第二张单建成（同一家，已 delivered）', { brief2Id, code: brief2Res.code }, brief2Res.success && brief2Id > 0);
    const est2 = await superApi.post(`/api/admin/site-briefs/${brief2Id}/estimate`);
    const estimate2 = (est2.data as Rec).estimate as Rec;
    j.expect('交付之后同一家出方案的口径翻成「租户承担」（tenantBearsCost=true）', estimate2?.tenantBearsCost, true);

    const bills2Before = await db.count('SELECT COUNT(*) AS n FROM billing_consume_log WHERE tenant_id = ?', [T.tenantId]);
    const calls2Before = await db.count('SELECT COUNT(*) AS n FROM ai_call_log');
    const usage2Before = await db.rows<Rec>("SELECT used_tokens FROM tenant_usage WHERE tenant_id = ? AND usage_type = 'AI_TOKEN'", [T.tenantId]);
    const gen2 = await superApi.post(`/api/admin/site-briefs/${brief2Id}/generate`,
      { confirm: true, estimateId: str((est2.data as Rec).estimateId), expectedTokens: num(estimate2?.estimatedTokens) });
    j.check('第二张单开跑（1 套）', { code: gen2.code, 起了几套: asArray((gen2.data as Rec).candidates).length },
      gen2.success && asArray((gen2.data as Rec).candidates).length === 1);
    const round2 = await waitRound(j, superApi, brief2Id, 1);
    j.note('第二张单的终态', round2.map(r => ({ 第几套: r.candidateNo, 阶段: r.stage, 状态: r.status, prompt: num(r.promptTokens), completion: num(r.completionTokens), 错误: str(r.errorMessage).slice(0, 80) })));
    const bills2After = await db.count('SELECT COUNT(*) AS n FROM billing_consume_log WHERE tenant_id = ?', [T.tenantId]);
    const flow2 = await db.rows<Rec>(
      "SELECT biz_type, biz_id, token_amount, usage_type FROM billing_consume_log WHERE tenant_id = ? AND biz_type = 'AI_SITE_PROPOSAL' ORDER BY id", [T.tenantId]);
    const usage2After = await db.rows<Rec>("SELECT used_tokens FROM tenant_usage WHERE tenant_id = ? AND usage_type = 'AI_TOKEN'", [T.tenantId]);
    const cand2Tokens = await db.count(
      'SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS n FROM site_proposal_candidate WHERE brief_id = ?', [brief2Id]);
    const flowSum = flow2.reduce((a, r) => a + num(r.token_amount), 0);
    j.check('交付后这一轮真扣在租户头上：流水有行、Σ流水 == 候选行 token 合计',
      { 新增流水行: bills2After - bills2Before, 流水合计: flowSum, 候选合计: cand2Tokens, 池子: flow2.map(f => f.usage_type) },
      bills2After > bills2Before && flowSum === cand2Tokens);
    j.check('额度账与流水同源（tenant_usage.used_tokens 增量 == 本轮流水合计）',
      { 前: num(usage2Before[0]?.used_tokens), 后: num(usage2After[0]?.used_tokens), 本轮流水: flowSum },
      num(usage2After[0]?.used_tokens) - num(usage2Before[0]?.used_tokens) === flowSum);

    const callsMid = await db.count('SELECT COUNT(*) AS n FROM ai_call_log');
    const billsMid = await db.count('SELECT COUNT(*) AS n FROM billing_consume_log WHERE tenant_id = ?', [T.tenantId]);
    const regen = await tenantScoped.post(`/api/admin/site-briefs/${brief2Id}/regenerate`);
    const RG = (regen.data as Rec) ?? {};
    const regenSites = await db.rows<Rec>('SELECT status FROM site WHERE build_brief_id = ?', [brief2Id]);
    const regenStatus = (await db.rows<{ status: string }>('SELECT status FROM site_build_brief WHERE id = ?', [brief2Id]))[0]?.status;
    j.check('regenerate 只收口不花钱：这一单的候选全转 archived、单子回 ready', {
      code: regen.code, 回执归档: asArray(RG.archivedSiteIds).length, 回执撤销令牌: RG.revokedTokenCount,
      单子状态: regenStatus, 库里站状态: regenSites.map(s => s.status),
    }, regen.success && regenStatus === 'ready' && regenSites.length > 0 && regenSites.every(s => s.status === 'archived'));
    j.expect('regenerate 之后 ai_call_log 一行没多', await db.count('SELECT COUNT(*) AS n FROM ai_call_log'), callsMid);
    j.expect('regenerate 之后该租户流水一行没多', await db.count('SELECT COUNT(*) AS n FROM billing_consume_log WHERE tenant_id = ?', [T.tenantId]), billsMid);
    j.note('整条链的模型账（本程真花掉的）', {
      第一张单三套合计: modelTokens,
      第二张单本程留痕新增: callsMid - calls2Before,
      全链ai_call_log新增: callsMid - callsBefore,
    });

    // ── 收尾 ────────────────────────────────────────────────────────────
    const res0 = await residue(db);
    j.note('软删前的残留清点', res0);
    await retireTenant(superApi, j, T);
    const res1 = await residue(db);
    j.note('软删后的残留清点（租户软删，交付站与演示内容行仍在这家名下）', res1);
    j.expect('探针租户已软删', await db.count('SELECT COUNT(*) AS n FROM tenant WHERE id = ? AND del_flag = ?', [T.tenantId, '0']), 0);

    j.assertClean();
  } finally {
    await db.close();
  }
});
