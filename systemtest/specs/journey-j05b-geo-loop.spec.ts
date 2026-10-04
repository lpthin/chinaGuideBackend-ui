import { test } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, residue, retireTenant, type SeededTenant } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J05b GEO 诊断闭环（判据 N-01 的原话：计划→轮次→判定→机会→建议动作→内容落地，加四动作与 SOV 翻得动）
 *
 * 这一条链此前只有 Mockito 单测（GeoCampaignSovRecomputeTest / GeoOpportunityServiceTest / GeoCampaignGateTest…），
 * 「一次真诊断跑到底、四条动作各落一次、发布了机会行自己会不会变 PUBLISHED」在 HTTP 上没有一份可重放的档。
 * 前置：后端带 GEO_CAMPAIGN_ENABLED / GEO_OPP_DRAFT_ENABLED / PORTAL_REVIEW_AI_ENABLED（PAGE 那一路的 AI 起草）/
 * CASE_AI_DRAFT_ENABLED 起（见 scratch/start-backend-p7j05.sh），GEO_MAX_RUNS_PER_DAY=30。
 * 品牌刻意用一个模型真认识的牌子（云计算/软件类）：SOV 的分母是「本品牌 + 勾选竞品被提及次数之和」（GeoMetric:26-28），
 * 不认识的牌子会让本品牌那一格永远是 0 份额，判不出「翻得动」到底改了什么。
 * 机会条数不靠品牌：缺口是按「站内已发布内容覆不覆盖得住这道题」算的（GeoOpportunitySync:110，COVERED_CITED 不建行），
 * 新开的一家什么都没有 ⇒ 四道题各出一条 NOT_COVERED，四动作才各点得动。
 * 真实租户（1、15）只读：本程全部写落在 E2E-<runId> 前缀的探针租户。
 */

type Rec = Record<string, unknown>;
const asArray = (v: unknown): Rec[] => (Array.isArray(v) ? v as Rec[] : []);
const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
/** 被拦的回体是 `data:null`（TenantGuard 那一类），直接点属性会把整条 30 分钟的旅程崩掉 —— J-05 两轮都栽在这里 */
const D = (res: { data: unknown }): Rec => (res.data as Rec) ?? {};
const RUN_TERMINAL = ['SUCCEEDED', 'PARTIAL', 'FAILED'];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** 轮询轮次视图到终态；ask 与 judge 两段共用，每次轮询都落盘（慢在哪一格要看得见） */
async function waitRunView(j: Journal, api: Api, runId: number, phase: 'ask' | 'judge'): Promise<Rec> {
  const started = Date.now();
  let last: Rec = {};
  const budget = phase === 'ask' ? 120 : 120; // 120 × 15s = 30 分钟一段
  for (let i = 0; i < budget; i += 1) {
    const res = await api.get(`/api/geo/campaign/run/${runId}`);
    last = (res.data as Rec) ?? {};
    const done = phase === 'ask'
      ? RUN_TERMINAL.includes(str(last.status))
      : ['DONE', 'FAILED'].includes(str(last.judgeState));
    j.record('poll', `第 ${i + 1} 次轮 run/${runId}（${Math.round((Date.now() - started) / 1000)} 秒，${phase}）`, {
      状态: last.status ?? null, 阶段: last.stageText ?? null, 进度: last.progress ?? null,
      判定: last.judgeState ?? null, 提问次数: last.callCount ?? null, 判定次数: last.judgeCallCount ?? null,
      错误: str(last.errorMessage ?? last.judgeErrorMessage ?? '').slice(0, 100) || null,
    });
    if (done) return last;
    await sleep(15_000);
  }
  j.note(`${phase} 轮询超时（30 分钟），最后一次原样留下`, { last });
  return last;
}

/** 等一篇文章的任务跑完并拿到 article_id；预审拒稿也是终态（run 1004-145211 的教训：
 *  task 89 停在 CONTENT_REJECTED，只认 FAILED 的话这里白轮询 80×10 秒 = 13 分钟才放手） */
const ARTICLE_TERMINAL = ['FAILED', 'CONTENT_REJECTED', 'CANCELLED'];
async function waitArticle(j: Journal, db: Db, taskId: number): Promise<Rec | null> {
  for (let i = 0; i < 80; i += 1) {
    const rows = await db.rows<Rec>('SELECT id, status, article_id, error_message FROM article_generation_task WHERE id = ?', [taskId]);
    const row = rows[0] ?? null;
    j.record('poll', `第 ${i + 1} 次轮文章任务 ${taskId}`, { 状态: row?.status ?? null, 文章: row?.article_id ?? null, 话: str(row?.error_message).slice(0, 90) || null });
    if (row && (num(row.article_id) > 0 || ARTICLE_TERMINAL.includes(str(row.status)))) return row;
    await sleep(10_000);
  }
  return null;
}

test('SYS-J05b GEO 诊断闭环：计划→轮次→判定→机会→四动作各落一次→发布后机会自己变已发布→SOV 翻得动', async () => {
  test.info().setTimeout(3_000_000);
  const j = new Journal('SYS-J05b');
  const db = new Db(j);
  const B = env.apiBase;

  try {
    // ── 00 前置：探针租户 + 词表 + 可用平台 ─────────────────────────────
    j.card({
      用例号: 'SYS-J05b-00',
      判据: 'N-01（前置）',
      层级: 'API',
      前置: `后端 ${B} 带 GEO_CAMPAIGN_ENABLED / GEO_OPP_DRAFT_ENABLED / PORTAL_REVIEW_AI_ENABLED / CASE_AI_DRAFT_ENABLED`,
      步骤: [
        '1 超管现开一家售前探针租户（GEO 不要求先交付，计费口径另在 N-02 那格判）',
        '2 GET /api/geo/campaign/vocabulary：状态、指标、机会动作的词表全从这里读，前端一份都不抄',
        '3 GET /api/geo/campaign/platforms?siteId=：这一家能选的几个「平台」其实是 ai_model_config 的行',
        '4 清单里每一条回读库核端点，只挑真发得出去的那一条当本轮平台（回落清单里混着坏探针行，见口径）',
      ],
      期望: [
        '词表里 opportunityActions 必须正好是四动作（PAGE/FAQ/ARTICLE/CASE）',
        '平台口回得到 ≥1 行且每行有 id 与名称（本家用不到自购模型时按代码回落到平台档那批行）',
        '本轮挑定的平台 id 端点可达（https 或非同机黑洞），且 del_flag=0、is_active=1',
      ],
      反例: ['GET /platforms 不带 siteId → 参数缺失（这口把 siteId 设为必填）'],
      收尾: '探针租户软删，逐表清点',
      口径: '可选平台清单的排序 = chatCapable(tenant) 空则回落租户 1，sort_order ASC（CitationProbeService.selectableModels）；'
        + 'ModelOption 只带 id/name/provider/modelName/modelType，不带端点，所以端点只能回库核。',
    });
    const sa = await Api.login(B, j, env.superAdmin.username, env.superAdmin.password);
    const superApi = sa.api;
    const T: SeededTenant = await provisionTenant(superApi, db, j, 'J05BA');
    // 超管要「站到这一家」才能动它家对象：门户页/案例这类读写都过 TenantGuard.checkOwnership(行归属, effectiveTenantId(null))，
    // 而超管站在平台档（X-Tenant-Id=1）时 effective 就是 1 ⇒ 直接指探针租户的对象会判「无权限操作该门户页面」。
    // J-05 首轮 1004-123624 在 promote 上撞过同一个形状，这里从开头就带上这一家。
    const tenantScoped = superApi.withTenant(T.tenantId, T.code);

    const vocab = await T.admin.get('/api/geo/campaign/vocabulary');
    const V = (vocab.data as Rec) ?? {};
    // 词表这几族回的是 Map<码,中文标签>（GeoReportService.vocabulary → labels()），不是数组：按数组数就是自己给自己判红
    j.check('词表读得到四动作与判定/轮次状态词表', {
      动作码: Object.keys((V.opportunityActions as Rec) ?? {}).sort(),
      动作标签: V.opportunityActions ?? null,
      轮次状态: Object.keys((V.runStatuses as Rec) ?? {}),
      判定状态: Object.keys((V.judgeStates as Rec) ?? {}), 缺口类型: Object.keys((V.gapTypes as Rec) ?? {}),
      机会状态: Object.keys((V.opportunityStates as Rec) ?? {}),
    }, vocab.success && JSON.stringify(Object.keys((V.opportunityActions as Rec) ?? {}).sort())
      === JSON.stringify(['ARTICLE', 'CASE', 'FAQ', 'PAGE']));

    const noSite = await T.admin.get('/api/geo/campaign/platforms');
    j.note('反例：平台口不带 siteId（必填）实测回形', { status: noSite.status, code: noSite.code });
    const platforms = await T.admin.get(`/api/geo/campaign/platforms?siteId=${num(T.siteId)}`);
    const P = asArray(platforms.data);
    j.check('这一家能选的平台（模型行）≥1 且带名字', { 条数: P.length, 前几行: P.slice(0, 6).map(p => ({ id: p.id, 名: p.name, provider: p.provider })) },
      platforms.success && P.length >= 1 && num(P[0].id) > 0);

    // 这份清单不能拿第一条就用：这一家没有自购模型，代码按 sort_order ASC 回落到平台（租户 1）那批行，
    // 而那份回落是带脏历史的 —— ai_model_config 里存在过「E2E 坏模型探针」那一类行（端点 http://127.0.0.1:9/…、
    // sort_order=-1，天然排在最前），选中它，整轮诊断会把每一次提问打进一个本机九号端口的黑洞，
    // 量出来的是「模型全挂了」而不是链路本身。所以这里现场读库核一遍端点，只挑真发得出去的。
    const pIds = P.map(p => num(p.id)).filter(id => id > 0);
    const cfgRows = pIds.length === 0 ? [] : await db.rows<Rec>(
      `SELECT id, name, provider, api_endpoint, is_active, sort_order, del_flag FROM ai_model_config WHERE id IN (${pIds.map(() => '?').join(',')})`,
      pIds);
    const reachable = (u: string) => {
      const host = u.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      return u.startsWith('https://') || (u.startsWith('http://') && !['127.0.0.1', 'localhost', '0.0.0.0'].includes(host));
    };
    const goodCfg = cfgRows.filter(r => num(r.del_flag) === 0 && num(r.is_active) === 1 && reachable(str(r.api_endpoint)));
    j.check('平台清单里每一条的端点逐个核出来：哪几条是真发得出去的、哪几条是坏探针行',
      { 清单: cfgRows.map(r => ({ id: r.id, 名: r.name, 端点: str(r.api_endpoint).replace(/^(https?:\/\/[^/]+).*$/, '$1'), active: r.is_active, 排序: r.sort_order, 删: r.del_flag })),
        能用: goodCfg.map(r => num(r.id)), 坏行: cfgRows.filter(r => !goodCfg.includes(r)).map(r => ({ id: r.id, 名: r.name, 端点: str(r.api_endpoint) })) },
      goodCfg.length >= 1);
    const poison = cfgRows.filter(r => !reachable(str(r.api_endpoint)));
    // 这一句只登记我刚查得到的东西：本轮清单里有没有不可达的行（poison），以及库里那一类坏探针行今天是什么状态。
    // 之前记的「27/28 两行还挂在清单第一条」已被今天的库况证伪（它们是 del_flag=1，被 @TableLogic 滤掉了），
    // 所以这里改成现场读那两行，而不是把昨天的话说第二遍。
    const brokenProbeRows = await db.rows<Rec>(
      "SELECT id, name, api_endpoint, is_active, sort_order, del_flag FROM ai_model_config WHERE name LIKE '%坏模型探针%' ORDER BY id");
    j.note('产品观察（不改）：租户侧那份可选平台清单只回 id/名称/厂商/模型标识，不回端点'
      + '（CitationProbeService.ModelOption:432），所以清单里若混进打不通的行，从界面上看不出来。本轮实测：清单内不可达 ' + poison.length + ' 条。',
      { 本轮清单: cfgRows.map(r => ({ id: r.id, 名: r.name, 端点: str(r.api_endpoint).replace(/^(https?:\/\/[^/]+).*$/, '$1'), 可达: reachable(str(r.api_endpoint)) })),
        接口回的键: Object.keys(P[0] ?? {}), 接口回的行数: P.length,
        库里那类坏行: brokenProbeRows.map(r => ({ id: r.id, 端点: str(r.api_endpoint), is_active: r.is_active, sort_order: r.sort_order, del_flag: r.del_flag })) });
    const chosen = goodCfg.find(r => /百炼|dashscope/i.test(`${str(r.name)} ${str(r.provider)}`)) ?? goodCfg[0];
    const platformId = num(chosen?.id);
    j.check('本轮用的平台（模型行）挑的是端点可达的那一条', { 用的id: platformId, 名: chosen?.name ?? null, provider: chosen?.provider ?? null },
      platformId > 0);

    // ── 01 品牌档案 + 竞品 + 提问 ───────────────────────────────────────
    j.card({
      用例号: 'SYS-J05b-01',
      判据: 'N-01（计划要指向的四行前置）',
      层级: 'API',
      前置: `探针租户 ${T.tenantId}，站 ${T.siteId}`,
      步骤: [
        '1 POST /api/geo/brand 建品牌档案（siteId 必须是自家的）',
        '2 POST /api/geo/brand/{id}/competitors 建三家竞品（SOV 的分母只数「启用的竞品」，card 08 关掉的就是这三家之一）',
        '3 POST /api/geo/brand/{id}/questions 建 8 条 MENTION 提问（各带自己的核心词，核心词是覆盖率那条线的分子）',
        '   —— 为什么是 8 条而不是 4 条：机会行是「一题一行」，四动作各要占一条，PAGE 那一路要留一条重试的余量（run 1004-142519 就是 4 条刚好用光，PAGE 一撞门禁就没行可换），'
        + 'ARTICLE 那一路还要留一条（run 1004-145211：草稿落成了，文章却被自家内容安全闸判「广告营销」拒掉，得换一道题再点一次）',
        '4 反例：品牌档案名留空 / MENTION 的问题里写了自家品牌名（这条红线是判据，不是提示）',
      ],
      期望: [
        'geo_brand_profile 落 1 行，tenant_id 是这一家、status=active（开通/转正都不会自动长这一行，只有这一口会写）',
        '三家竞品 enabled=1；全部提问（本站 8 条）origin=MANUAL、enabled=1、review_state=ACCEPTED',
        '反例各回各的错码，不许 200 蒙混',
      ],
      反例: ['品牌名为空', 'MENTION 问题里含品牌词'],
      收尾: '随探针租户软删',
    });
    const BRAND = '阿里巴巴';
    // 品牌词必须有一条 ≥3 字且真出现在回答里的写法：CitationMatcher 的长度门槛是 MIN_BRAND_CHARS=3，
    // 两字的「阿里」会被当场挡掉（judgeable 那条注释就是这么写的），而模型答「阿里云」时不会写「阿里巴巴集团」。
    // run 1004-142519 四条回答里三条含「阿里云」却全算 brand_mentioned=0，就是这一格数据没喂对（产品的判定是对的）。
    const brandRes = await T.admin.post('/api/geo/brand', {
      siteId: T.siteId, brandName: '阿里巴巴集团（系统测试）', brandWords: [BRAND, '阿里云'],
      officialUrls: ['https://www.alibaba.com'], brandIntro: '系统测试用的品牌档案，只验 GEO 闭环机制。',
    });
    const brandId = num(D(brandRes).id);
    j.check('品牌档案建成', { code: brandRes.code, brandId, 回体状态: D(brandRes).status ?? null }, brandRes.success && brandId > 0);
    const profile = await db.rows<Rec>('SELECT tenant_id, site_id, brand_name, status FROM geo_brand_profile WHERE id = ?', [brandId]);
    j.expect('库里这一行的归属：tenant_id 是这一家、status=active',
      { 租户: num(profile[0]?.tenant_id), 状态: profile[0]?.status }, { 租户: T.tenantId, 状态: 'active' });
    const emptyBrand = await T.admin.post('/api/geo/brand', { siteId: T.siteId, brandName: '  ' });
    j.check('反例：品牌名留空被拒（不许 200）', { status: emptyBrand.status, code: emptyBrand.code, msg: str(emptyBrand.message).slice(0, 40) }, !emptyBrand.success);

    const compNames: { name: string, words: string[] }[] = [
      { name: '腾讯云', words: ['腾讯', '腾讯云', '腾讯混元'] },
      { name: '华为云', words: ['华为', '华为云', '盘古'] },
      { name: '火山引擎', words: ['字节', '字节跳动', '火山引擎', '豆包'] },
    ];
    const compIds: number[] = [];
    for (const cn of compNames) {
      const r = await T.admin.post(`/api/geo/brand/${brandId}/competitors`, { name: cn.name, words: cn.words });
      compIds.push(num(D(r).id));
      j.check(`竞品「${cn.name}」建成且默认启用`, { code: r.code, id: num(D(r).id), enabled: D(r).enabled ?? null }, r.success && num(D(r).id) > 0);
    }
    const compRows = await db.rows<Rec>('SELECT id, enabled, origin, tenant_id FROM geo_brand_competitor WHERE brand_profile_id = ? ORDER BY id', [brandId]);
    j.check('三家竞品在库里：enabled=1、origin=MANUAL、归属这一家',
      compRows.map(r => ({ id: r.id, enabled: r.enabled, origin: r.origin, 租户: r.tenant_id })),
      compRows.length === 3 && compRows.every(r => num(r.enabled) === 1 && str(r.origin) === 'MANUAL'));

    const questions = [
      { text: '国内有哪些值得关注的云计算品牌？请给出具体名称和理由。', core: '云计算' },
      { text: '企业采购协同办公软件时，国内常见的厂商有哪些？', core: '协同办公' },
      { text: '做电商技术支持和客服系统，国内哪些公司比较常被提到？', core: '客服系统' },
      { text: '想要一套数据库与大数据分析方案，国内常推荐的供应商有哪些？', core: '大数据分析' },
      { text: '企业做数字化转型，国内常被点名的技术供应商有哪些？', core: '数字化转型' },
      { text: '国内做智能客服和对话机器人的厂商，常被提到的是哪几家？', core: '智能客服' },
      { text: '企业级云存储与网盘服务，国内常被提到的是哪几家？', core: '云存储' },
      { text: '做上云迁移和混合云管理，国内讨论得比较多的服务商有哪些？', core: '混合云' },
    ];
    const QNUM = questions.length;
    const qIds: number[] = [];
    for (const [i, q] of questions.entries()) {
      const r = await T.admin.post(`/api/geo/brand/${brandId}/questions`, { kind: 'MENTION', coreWord: q.core, questionText: q.text, variantSeq: 0 });
      qIds.push(num(D(r).id));
      j.check(`提问 ${i + 1} 建成`, { code: r.code, id: num(D(r).id) }, r.success && num(D(r).id) > 0);
    }
    const qRows = await db.rows<Rec>(
      `SELECT id, kind, origin, enabled, review_state, core_word FROM geo_track_question WHERE id IN (${qIds.map(() => '?').join(',')}) ORDER BY id`, qIds);
    j.check(`${QNUM} 条提问在库里：kind=MENTION、origin=MANUAL、enabled=1、review_state=ACCEPTED`,
      qRows.map(r => ({ id: r.id, kind: r.kind, origin: r.origin, enabled: r.enabled, 审: r.review_state })),
      qRows.length === QNUM && qRows.every(r => str(r.origin) === 'MANUAL' && num(r.enabled) === 1 && str(r.review_state) === 'ACCEPTED'));
    const brandInQuestion = await T.admin.post(`/api/geo/brand/${brandId}/questions`,
      { kind: 'MENTION', coreWord: '红线', questionText: `${BRAND}这家云计算厂商靠谱吗？`, variantSeq: 0 });
    j.check('反例：MENTION 的问题里写了自家品牌名 → 拒（红线写在服务端，不靠界面）',
      { status: brandInQuestion.status, code: brandInQuestion.code, msg: str(brandInQuestion.message).slice(0, 60) }, !brandInQuestion.success);

    // ── 02 建计划 + 三道闸 ─────────────────────────────────────────────
    j.card({
      用例号: 'SYS-J05b-02',
      判据: 'N-01（计划这一拍）',
      层级: 'API',
      前置: `品牌 ${brandId} / 平台 ${platformId} / 提问 ${QNUM} 条`,
      步骤: [
        '1 POST /api/geo/campaign 建计划（1 平台 × N 问 × 1 次 = N 发外呼）',
        '2 GET /{id}/estimate：calls 与 token 估算、走哪本账',
        '3 反例：没确认就起跑 → GEO_CAMPAIGN_CONFIRM_REQUIRED',
        '4 反例：把别家的站号写进计划（归属判在服务端）',
      ],
      期望: ['计划行 confirm_state 起点是 PENDING_CONFIRM，question_count/platform_count/repeat_times 与请求一致',
        '估算回得到 calls=N 与一个正数 token', '反例回错码而不是 200'],
      反例: ['未确认起跑', '站号不属于这一家'],
      收尾: '随探针租户软删',
    });
    const campRes = await T.admin.post('/api/geo/campaign', {
      siteId: T.siteId, brandProfileId: brandId, name: `E2E-${env.runId} J05b 闭环 · 1 平台 × ${QNUM} 问 × 1 次`,
      platformIds: [platformId], questionIds: qIds, repeatTimes: 1, note: '系统测试 N-01 闭环取证',
    });
    const CAM = (campRes.data as Rec) ?? {};
    const campaignId = num(CAM.id);
    j.check('计划建成，回体带题数/平台数/次数与成本估算', {
      code: campRes.code, campaignId, 题数: CAM.questionCount, 平台数: CAM.platformCount, 次数: CAM.repeatTimes,
      确认态: CAM.confirmState, 估算调用: CAM.costEstimateCalls, 估算token: CAM.costEstimateTokens,
    }, campRes.success && campaignId > 0 && num(CAM.questionCount) === QNUM && num(CAM.costEstimateCalls) === QNUM);
    const campRow = await db.rows<Rec>('SELECT tenant_id, site_id, brand_profile_id, question_count, confirm_state FROM geo_campaign WHERE id = ?', [campaignId]);
    j.expect('计划行归属与确认态（起跑前是待确认）',
      { 租户: num(campRow[0]?.tenant_id), 站: num(campRow[0]?.site_id), 档案: num(campRow[0]?.brand_profile_id), 确认: campRow[0]?.confirm_state },
      { 租户: T.tenantId, 站: num(T.siteId), 档案: brandId, 确认: 'PENDING_CONFIRM' });

    const est = await T.admin.get(`/api/geo/campaign/${campaignId}/estimate`);
    const EST = D(est);
    // 字段名以 GeoCampaignDtos.Estimate:60 为准：callCount / estimatedTokens / judgeCallCount / totalCallCount /
    // unmeasurableQuestions / tenantBearsCost。「1 平台 × N 问 × 1 次 = N 发」这句判据要能在估算口上数出来，
    // 而且「判不了覆盖率的题数」必须是 0 —— 否则这一轮的钱会白烧（商用 #142 就是这个形状）。
    j.check(`估算口读得到规模与钱（${QNUM} 发、正数 token、零道判不了的题）`,
      { code: est.code, callCount: EST.callCount, estimatedTokens: EST.estimatedTokens, 判定发数: EST.judgeCallCount,
        合计发数: EST.totalCallCount, 判不了: EST.unmeasurableQuestions, 租户承担: EST.tenantBearsCost, 开关: EST.campaignEnabled,
        拦话: str(EST.notice).slice(0, 60) || null },
      est.success && num(EST.callCount) === QNUM && num(EST.estimatedTokens) > 0 && num(EST.unmeasurableQuestions) === 0);
    const runNoConfirm = await T.admin.post(`/api/geo/campaign/${campaignId}/run`, { confirm: false });
    j.expect('反例：没勾选确认就起跑 → GEO_CAMPAIGN_CONFIRM_REQUIRED', runNoConfirm.code, 'GEO_CAMPAIGN_CONFIRM_REQUIRED');
    const foreignSite = await db.rows<{ id: number }>('SELECT id FROM site WHERE tenant_id <> ? AND del_flag = ? ORDER BY id LIMIT 1', [T.tenantId, '0']);
    if (foreignSite.length === 1) {
      const bad = await T.admin.post('/api/geo/campaign', {
        siteId: num(foreignSite[0].id), brandProfileId: brandId, name: '反例：把别家的站写进计划',
        platformIds: [platformId], questionIds: qIds, repeatTimes: 1,
      });
      j.check('反例：站号不属于这一家 → 建不成计划', { status: bad.status, code: bad.code, id: num(D(bad).id) }, !bad.success || num(D(bad).id) === 0);
    }

    // ── 03 轮次：真外呼、真落库 ────────────────────────────────────────
    j.card({
      用例号: 'SYS-J05b-03',
      判据: 'N-01（轮次这一拍）',
      层级: 'API',
      前置: `计划 ${campaignId}，${QNUM} 发外呼`,
      步骤: [
        '1 POST /{id}/run（confirm=true）：先落库、事务提交后才派线程池',
        '2 轮询 GET /run/{runId} 到终态，逐次落盘',
        `3 库里对账：run 行的 token 与次数、portal_citation_call 每发一行（应为 ${QNUM} 行）`,
        `4 只跑这一轮：本程串行，「上一轮还在飞时再按起跑」那一道在飞闸不在这里试（再起跑要真烧 ${QNUM} 发第二次的外呼，判据由单测 GeoCampaignGateTest 钉）`,
      ],
      期望: [
        '轮次行到终态（SUCCEEDED 或 PARTIAL；FAILED 判红）',
        `call_count + failed_call_count = ${QNUM}、prompt/completion token 都是正数、归属三行齐全`,
        'PARTIAL 那一档要能当场对上账：stage_text 念得出「未取到 N」，且每一发没取到的都在 portal_citation_call 留了一行带原因的记录（N-05 的诚实态）',
        `portal_citation_call 按 campaign_run_id 数出 ${QNUM} 行，成功那几行有答案散列`,
        '至少一发的 brand_mentioned=1（品牌词刻意挑了模型真会写出来的写法，否则这一轮的账全是「没提到」，判了也判不出东西）',
      ],
      反例: ['未确认起跑（已在 02 判）'],
      收尾: '轮次行随探针租户软删（GEO 表无 del_flag 的按归属清点）',
    });
    const callsBefore = await db.count('SELECT COUNT(*) AS n FROM ai_call_log');
    const runRes = await T.admin.post(`/api/geo/campaign/${campaignId}/run`, { confirm: true });
    const RUN = (runRes.data as Rec) ?? {};
    const runId = num(RUN.id);
    j.check('起跑回轮次行（状态先落库），runId>0', { code: runRes.code, runId, 状态: RUN.status, 阶段: RUN.stageText }, runRes.success && runId > 0);
    const runView = await waitRunView(j, T.admin, runId, 'ask');
    j.check('轮次跑到终态且不是 FAILED', { 状态: runView.status, 阶段: runView.stageText, 未取到: runView.failedCallCount, 错误: str(runView.errorMessage).slice(0, 120) },
      str(runView.status) !== 'FAILED' && RUN_TERMINAL.includes(str(runView.status)));
    const runRow = await db.rows<Rec>('SELECT status, call_count, failed_call_count, prompt_tokens, completion_tokens, question_count, platform_count, repeat_times, brand_profile_id, site_id FROM geo_campaign_run WHERE id = ?', [runId]);
    const RR = runRow[0] ?? {};
    // 「全成」不是判据，「发了的 + 没取到的 = 这一轮该发的数，且没取到的那些如实写在话术里」才是。
    // run 1004-145211 实测：6 发里第 4 发回 error_message=「AI 调用失败: request timed out」（上游超时），
    // 轮次当场转 PARTIAL、stage_text=「已问 6/6 次（成功 5，未取到 1）」⇒ 上一版按 failed_call_count===0 判红，
    // 那是把我自己的期望当成了判据（N-01 判的是闭环走不走得通，不是上游模型每次都不超时）。
    j.check(`库里这一轮：发了的 + 没取到的 = ${QNUM}、token 是正数、归属三行齐全`, {
      状态: RR.status, 发了: RR.call_count, 失败: RR.failed_call_count, prompt: RR.prompt_tokens, completion: RR.completion_tokens,
      题: RR.question_count, 平台: RR.platform_count, 次数: RR.repeat_times, 档案: RR.brand_profile_id, 站: RR.site_id,
    }, num(RR.call_count) + num(RR.failed_call_count) === QNUM && num(RR.call_count) > 0
      && num(RR.prompt_tokens) > 0 && num(RR.completion_tokens) > 0
      && num(RR.brand_profile_id) > 0 && num(RR.site_id) > 0 && num(RR.question_count) > 0);
    const failedN = num(RR.failed_call_count);
    if (failedN > 0) {
      const errRows = await db.rows<Rec>('SELECT id, success, LEFT(error_message, 60) AS err FROM portal_citation_call WHERE campaign_run_id = ? AND success = 0 ORDER BY id', [runId]);
      j.check('PARTIAL 要如实报：轮次话术念得出「未取到 N」，且每一发没取到的都留了一行带原因的外呼记录', {
        状态: RR.status, 阶段话术: str(RR.stage_text), 未取到: failedN, 留痕: errRows.map(r => ({ 调用: r.id, 原因: str(r.err) })),
      }, str(RR.status) === 'PARTIAL' && str(RR.stage_text).includes(`未取到 ${failedN}`) && errRows.length === failedN);
    } else {
      j.expect('全成的那一轮终态是 SUCCEEDED（0 未取到就不该出现 PARTIAL 话术）', str(RR.status), 'SUCCEEDED');
    }
    const cited = await db.rows<Rec>('SELECT id, success, brand_mentioned, cited_count, answer_sha256, sample_seq FROM portal_citation_call WHERE campaign_run_id = ? ORDER BY id', [runId]);
    j.check(`每一发都留了答案行（portal_citation_call 按 campaign_run_id 数得出 ${QNUM} 行，成功那几行答案散列非空）`,
      { 行数: cited.length, 成功: cited.map(c => c.success), 提及品牌: cited.map(c => c.brand_mentioned), 散列长: str(cited[0]?.answer_sha256).length },
      cited.length === QNUM && cited.filter(c => num(c.success) === 1).every(c => str(c.answer_sha256).length === 64));
    // 品牌真被认出来才算这一轮的判定有料可判：run 1004-142519 六发全含「阿里云」却 4 发全 0，
    // 那是因为词表只给了两字的「阿里」（被 MIN_BRAND_CHARS=3 当场挡掉）。这一格把数据口径钉住。
    j.check('至少一发的答案里认出了本品牌（brand_mentioned=1）',
      { 提及: cited.map(c => c.brand_mentioned).join(','), 品牌词: [BRAND, '阿里云'] },
      cited.some(c => num(c.brand_mentioned) === 1));
    const callsAfterAsk = await db.count('SELECT COUNT(*) AS n FROM ai_call_log');
    j.check('这一轮在 ai_call_log 里留了痕（外呼不是无痕的）', { 新增留痕: callsAfterAsk - callsBefore }, callsAfterAsk > callsBefore);

    // ── 04 判定：轮内自动跑完，explicit 重判按设计被拦 ────────────────────
    j.card({
      用例号: 'SYS-J05b-04',
      判据: 'N-01（判定这一拍，Spec-F §6.2「判定不是免费的后处理」）',
      层级: 'API',
      前置: `轮次 ${runId} 的提问那一段已到终态`,
      步骤: [
        '1 读轮次视图：判定那一段是 worker 在一轮之内自己跑完的（GeoCampaignWorker:220 judgePhase），不是等人按的',
        '2 反例：confirm=false 打 /run/{id}/judge → GEO_CAMPAIGN_CONFIRM_REQUIRED（确认闸排在「已经判过」那一道之前）',
        '3 反例：confirm=true 再打一次 → GEO_JUDGE_ALREADY_DONE（同一轮不原地重判，历史快照不被覆盖，§11.4）',
        '4 库里对账：geo_answer_judgment 的行只挂在「答案里确有可判主体」的那几发上；geo_metric_snapshot 有指标行',
        '5 GET /run/{runId}/judgments 与 /report 两个读口拿得到判定与指标（读的是本表，不现场重判）',
      ],
      期望: [
        'judge_state=DONE、judge_call_count>0；判定段的 token 记在 judge_prompt/completion 两列',
        '判定行数 ≥ 判定次数（一发判出来的答案是本品牌 + 各家竞品好几行），每行有 scope/subject/prominence 或未测量原因',
        'report 回得到 mentionRate/recommendRate/sovShare 三组',
      ],
      反例: ['未确认判定', '判完再判一次'],
      口径: '「4 发只判 2 发」是设计而不是漏：GeoSemanticJudge 只把答案里确有可判主体的那些发送进模型'
        + '（CitationMatcher.MIN_BRAND_CHARS=3 与 GeoSubjectTargets.judgeable 同一门槛），没主体可判的那发不烧钱。',
      收尾: '判定行随探针租户清点',
    });
    const judged = await waitRunView(j, T.admin, runId, 'judge');
    j.check('判定在轮内自动跑完：judge_state=DONE、判定次数>0（这一段是 worker 自己做的）',
      { 判定态: judged.judgeState, 判定次数: judged.judgeCallCount, 判定prompt: judged.judgePromptTokens ?? null,
        判定completion: judged.judgeCompletionTokens ?? null, 阶段: judged.stageText, 错误: str(judged.judgeErrorMessage).slice(0, 120) },
      str(judged.judgeState) === 'DONE' && num(judged.judgeCallCount) > 0);
    const judgedRow = await db.rows<Rec>('SELECT judge_state, judge_call_count, judge_prompt_tokens, judge_completion_tokens, stage_text FROM geo_campaign_run WHERE id = ?', [runId]);
    j.check('库里判定那一行的数与视图一致（判定次数与两侧 token 都记全）',
      { judge_state: judgedRow[0]?.judge_state, 次: judgedRow[0]?.judge_call_count, p: judgedRow[0]?.judge_prompt_tokens, c: judgedRow[0]?.judge_completion_tokens, 阶段: judgedRow[0]?.stage_text },
      str(judgedRow[0]?.judge_state) === 'DONE' && num(judgedRow[0]?.judge_call_count) > 0 && num(judgedRow[0]?.judge_prompt_tokens) > 0);
    const judgeNoConfirm = await T.admin.post(`/api/geo/campaign/run/${runId}/judge`, { confirm: false });
    j.expect('反例：没确认就判定 → GEO_CAMPAIGN_CONFIRM_REQUIRED（闸在「已经判过」之前）', judgeNoConfirm.code, 'GEO_CAMPAIGN_CONFIRM_REQUIRED');
    const judgeAgain = await T.admin.post(`/api/geo/campaign/run/${runId}/judge`, { confirm: true });
    j.expect('反例：判完再判一次 → GEO_JUDGE_ALREADY_DONE（一笔账按轮记，不许把同一轮再烧一遍）', judgeAgain.code, 'GEO_JUDGE_ALREADY_DONE');
    j.note('重复判定那句拒绝的原话（§11.4 历史快照不被覆盖的那一条）', { status: judgeAgain.status, msg: str(judgeAgain.message).slice(0, 160) });
    const judgedAgain = await db.rows<Rec>('SELECT judge_state, judge_call_count FROM geo_campaign_run WHERE id = ?', [runId]);
    j.expect('被拦的这次重判没有改这一轮的判定账（次数与状态一格没动）',
      { 状态: judgedAgain[0]?.judge_state, 次: judgedAgain[0]?.judge_call_count },
      { 状态: 'DONE', 次: num(judgedRow[0]?.judge_call_count) });
    const judgments = await db.rows<Rec>('SELECT id, call_id, scope, subject, prominence, position_rank, sentiment, matched_text, not_measured_reason FROM geo_answer_judgment WHERE run_id = ? ORDER BY id', [runId]);
    j.check('判定行落库：行数 ≥ 判定次数，命中片段或「为什么没测到」写得出',
      { 行数: judgments.length, 判定次数: num(judgedRow[0]?.judge_call_count), 判了几发答案: new Set(judgments.map(x => x.call_id)).size,
        样例: judgments.slice(0, 6).map(x => ({ scope: x.scope, 主体: str(x.subject).slice(0, 12), 显名: x.prominence, 命中: str(x.matched_text).slice(0, 10), 未测: x.not_measured_reason })) },
      judgments.length >= num(judgedRow[0]?.judge_call_count) && judgments.length > 0);
    const metrics = await db.rows<Rec>('SELECT metric, scope, subject, numerator, denominator, value FROM geo_metric_snapshot WHERE run_id = ? ORDER BY id', [runId]);
    j.check('指标快照落库（分母口径写在行里）',
      { 行数: metrics.length, 指标: Array.from(new Set(metrics.map(m => str(m.metric)))).join(','), 样例: metrics.slice(0, 5) },
      metrics.length > 0);
    const jv = await T.admin.get(`/api/geo/campaign/run/${runId}/judgments`);
    j.check('判定读口回的行数与库里一致（读的是本表，不是现场重判）',
      { code: jv.code, 回体行数: asArray(jv.data).length, 库行数: judgments.length, 首行键: Object.keys(asArray(jv.data)[0] ?? {}) },
      jv.success && asArray(jv.data).length === judgments.length);
    const rep = await T.admin.get(`/api/geo/campaign/run/${runId}/report`);
    const REP = (rep.data as Rec) ?? {};
    j.check('报告口三组指标都读得到（mentionRate/recommendRate/sovShare）',
      { 提及率: asArray(REP.mentionRate).length, 推荐率: asArray(REP.recommendRate).length, SOV: asArray(REP.sovShare).length },
      rep.success);

    // ── 05 机会 ───────────────────────────────────────────────────────
    j.card({
      用例号: 'SYS-J05b-05',
      判据: 'N-01（机会这一拍）',
      层级: 'API',
      前置: `轮次 ${runId} 已判定`,
      步骤: [
        '1 GET /run/{runId}/opportunities：缺口行、类型、建议动作、证据分子分母',
        '2 库里对账 geo_opportunity：状态 OPEN、题与轮次归属',
        '3 GET /opportunity/{id}/estimate?actionType= 读一次「按下去要花多少、走哪本账」',
      ],
      期望: [`至少 4 条机会（${QNUM} 道 MENTION 题、新开的一家站内没有内容覆盖得住 ⇒ 缺口是一题一条；COVERED_CITED 那种「已经答得更好」不建行）`,
        '每条带 gap_type 与建议 action_type，state=OPEN',
        '预估回得到 callCount/estimatedTokens/quotaPoolLabel 与 tenantBearsCost'],
      反例: ['预估口给一个不认识的动作'],
      收尾: '机会行随探针租户清点',
    });
    const oppRes = await T.admin.get(`/api/geo/campaign/run/${runId}/opportunities`);
    const OL = (oppRes.data as Rec) ?? {};
    const opps = asArray(OL.items);
    j.check('机会口读得到缺口清单（条数、未测量题数、总数三个数一致，且够四动作各占一条）',
      { 条数: opps.length, opportunityCount: OL.opportunityCount, 未测量: OL.unmeasuredQuestions, 样例: opps.slice(0, 6).map(o => ({ id: o.id, 缺口: o.gapType, 建议: o.actionType, 状态: o.state, 证据: `${o.evidenceNumerator}/${o.evidenceDenominator}` })) },
      oppRes.success && opps.length >= 4 && num(OL.opportunityCount) === opps.length);
    const oppIds = opps.map(o => num(o.id));
    const oppRows = await db.rows<Rec>('SELECT id, state, gap_type, action_type, run_id, question_id, tenant_id FROM geo_opportunity WHERE id IN (' + oppIds.map(() => '?').join(',') + ')', oppIds);
    j.check('库里每一条机会：state=OPEN、run_id 对得上、归属这一家',
      oppRows.map(r => ({ id: r.id, 状态: r.state, 轮次: r.run_id, 租户: r.tenant_id })),
      oppRows.length === oppIds.length && oppRows.every(r => str(r.state) === 'OPEN' && num(r.run_id) === runId && num(r.tenant_id) === T.tenantId));
    const badEst = await T.admin.get(`/api/geo/campaign/opportunity/${oppIds[0]}/estimate?actionType=NOT_A_THING`);
    j.note('反例：预估口给一个不认识的动作（回形留档）', { status: badEst.status, code: badEst.code, msg: str(badEst.message).slice(0, 80) });

    // ── 06 四动作各落一次 ─────────────────────────────────────────────
    j.card({
      用例号: 'SYS-J05b-06',
      判据: 'N-01（四动作）',
      层级: 'API',
      前置: `${opps.length} 条机会；PAGE 那一路要 PORTAL_REVIEW_AI_ENABLED、CASE 那一路要 CASE_AI_DRAFT_ENABLED`,
      步骤: [
        '1 每条机会先 GET /estimate（按下去之前那句「花多少、走哪本账」）',
        '2 POST /opportunity/{id}/draft {actionType, confirm:false} → 拦（确认闸）',
        '3 四种动作各点一次：PAGE / FAQ / ARTICLE / CASE，逐条真产草稿；PAGE 那一路允许换一条机会再按一次（草稿要过布局门禁，模型写出的 patch 不保证合法）',
        '4 库里对账 draft_ref 前缀（page:/faq:/article_task:/case:）与 state=DRAFTED、state_log 两格',
        '5 反例：同一条机会换一种动作再点 → 已被前一种动作占住，不许盖（只在草稿真落地时才跑这一格）',
      ],
      期望: [
        '四种动作都产出各自的对象行并把机会搬到 DRAFTED（一种动作连撞两发门禁就如实判这一路没测到）',
        'state_log 里 OPEN→DRAFTED 那一行带 actor 与「约 N token，走哪本账」',
        'ARTICLE 那一路只回任务号：草稿要等线程池把文章写出来（回体只有 opportunity+nextStep，任务号只能回库核）',
      ],
      反例: ['未确认按下去', '同一条换动作覆盖'],
      收尾: '草稿对象随探针租户清点',
    });
    const PLAN: { action: string, expectRef: string }[] = [
      { action: 'PAGE', expectRef: 'page:' }, { action: 'FAQ', expectRef: 'faq:' },
      { action: 'ARTICLE', expectRef: 'article_task:' }, { action: 'CASE', expectRef: 'case:' },
    ];
    const drafted: { action: string, oppId: number, ref: string, nextStep: string, pageId?: number, faqId?: number, taskId?: number, caseId?: number }[] = [];
    // PAGE 那一路允许换一条机会再按一次：run 1004-142519 实测「一键成页面」的草稿要过布局门禁
    // （LayoutValidator，§门禁1），模型那一段写出的 patch 合不合法不是我们能在这条链里定的——
    // 撞一次 PORTAL_DRAFT_GATE_FAILED 就把整条 PAGE 判成没测，等于把一次模型抖动记成产品缺陷。
    // 机会是一题一行、这条链上不可再生，所以 01 那一站建 8 道题就是为了留这两格余量（PAGE 撞门禁一发、ARTICLE 撞内容闸一发）。
    const PAGE_TRIES = 2;
    let cursor = 0;
    for (const plan of PLAN) {
      const action = plan.action;
      const maxTries = action === 'PAGE' ? Math.min(PAGE_TRIES, oppIds.length - cursor) : 1;
      let landed: { oppId: number, DV: Rec, O: Rec, code: string } | null = null;
      for (let t = 0; t < maxTries && landed === null; t += 1) {
        const oppId = oppIds[cursor];
        cursor += 1;
        const est = await T.admin.get(`/api/geo/campaign/opportunity/${oppId}/estimate?actionType=${action}`);
        const EE = D(est);
        // 回体形状 = GeoCampaignDtos.OpportunityEstimate：callCount / estimatedTokens / remainingTokens /
        // tenantBearsCost / accounting / notice / quotaPoolLabel，没有 calls·tokens·poolLabel 那种短名（照短名读就是读 null）
        j.check(`${action} 的预估读得到钱与账（含走哪一池，机会 ${oppId}）`, { 机会: oppId, callCount: EE.callCount, estimatedTokens: EE.estimatedTokens,
          池: EE.quotaPoolLabel ?? null, 剩余: EE.remainingTokens ?? null, 租户承担: EE.tenantBearsCost, 草稿开关: EE.draftEnabled ?? null,
          账: str(EE.accounting).slice(0, 60) || null, 拦话: str(EE.notice).slice(0, 50) || null },
        est.success && num(EE.callCount) === 1 && num(EE.estimatedTokens) > 0);
        const needConfirm = await T.admin.post(`/api/geo/campaign/opportunity/${oppId}/draft`, { actionType: action, confirm: false });
        j.expect(`${action}：未确认就按下去 → GEO_OPPORTUNITY_CONFIRM_REQUIRED`, needConfirm.code, 'GEO_OPPORTUNITY_CONFIRM_REQUIRED');
        const draft = await T.admin.post(`/api/geo/campaign/opportunity/${oppId}/draft`, { actionType: action, confirm: true });
        const DV = D(draft);
        const O = (DV.opportunity as Rec) ?? {};
        if (!draft.success || str(O.draftRef).length === 0) {
          j.note(`${action} 第 ${t + 1} 发（机会 ${oppId}）没落成草稿：按实测码留档，下一发换一条机会再试`,
            { code: draft.code, msg: str(draft.message).slice(0, 160), 状态: O.state ?? null, draftRef: O.draftRef ?? null });
          continue;
        }
        landed = { oppId, DV, O, code: str(draft.code) };
      }
      if (landed === null) {
        j.check(`${action} 真产出草稿并把机会搬到 DRAFTED：${maxTries} 发都没落成（这一种动作本轮没测到）`,
          { 试了几发: maxTries, 用的机会: oppIds.slice(cursor - maxTries, cursor) }, false);
        continue;
      }
      const { oppId, DV, O, code } = landed;
      const ref = str(O.draftRef);
      const idPart = num(ref.split(':').pop());
      j.check(`${action} 真产出草稿并把机会搬到 DRAFTED`, { 机会: oppId, code, draftRef: ref, 状态: O.state, 动作: O.actionType, nextStep: str(DV.nextStep).slice(0, 70) },
        str(ref).startsWith(plan.expectRef) && str(O.state) === 'DRAFTED');
      drafted.push({
        action, oppId, ref, nextStep: str(DV.nextStep),
        pageId: action === 'PAGE' ? idPart : undefined,
        faqId: action === 'FAQ' ? idPart : undefined,
        taskId: action === 'ARTICLE' ? idPart : undefined,
        caseId: action === 'CASE' ? idPart : undefined,
      });
      if (action === 'ARTICLE') {
        // 对外回体是 OpportunityDraftVo(opportunity, nextStep) —— 服务层那个 Drafted.pendingArticleTaskId
        // 在控制器就转成了线程池任务，不随 HTTP 回（GeoCampaignController:319）。所以任务号只能回库核。
        const taskRow = await db.rows<Rec>('SELECT id, status, article_id, error_message FROM article_generation_task WHERE id = ?', [idPart]);
        j.check('ARTICLE 那一路回的是任务号，且任务行真的排进了线程池',
          { draftRef: ref, 回体键: Object.keys(DV), 库里任务: taskRow.map(t => ({ id: t.id, 状态: t.status })) },
          ref.startsWith('article_task:') && idPart > 0 && taskRow.length === 1);
      }
      // 换动作覆盖：这一条已经被前一种动作占住了 —— 只在草稿真落地时才跑这一格
      // （run 1004-142519 的教训：PAGE 撞门禁之后机会还是 OPEN，那时按第二遍当然会成功，反例就成了假红）
      const other = PLAN[(PLAN.indexOf(plan) + 1) % PLAN.length].action;
      const cover = await T.admin.post(`/api/geo/campaign/opportunity/${oppId}/draft`, { actionType: other, confirm: true });
      j.check(`反例：同一条机会（${ref}）换「${other}」再点 → 拦，不许盖`,
        { status: cover.status, code: cover.code, msg: str(cover.message).slice(0, 70) }, !cover.success);
    }
    if (drafted.length < PLAN.length) {
      j.note(`四动作本轮落了 ${drafted.length} 种，缺的是 ${PLAN.filter(p => !drafted.some(d => d.action === p.action)).map(p => p.action).join('/')}（不是通过，是没测成）`,
        { 测了: drafted.map(d => d.action), 用的机会: drafted.map(d => d.oppId) });
    }
    // 机会编号是从库里读出来的整数，仍然按占位符传（IN () 在零条时会成语法错，所以先判空）
    const draftedIds = drafted.map(d => d.oppId);
    const logRows = draftedIds.length === 0 ? [] : await db.rows<Rec>(
      'SELECT opportunity_id, from_state, to_state, action_type, draft_ref, actor, reason FROM geo_opportunity_state_log WHERE opportunity_id IN ('
      + draftedIds.map(() => '?').join(',') + ') ORDER BY id', draftedIds);
    j.check('每一条落地的动作都留了状态搬迁（OPEN→DRAFTED 那一行带 actor 与「约 N token」）',
      { 行数: logRows.length, 每一条都有DRAFTED那一行: drafted.every(d => logRows.some(r => num(r.opportunity_id) === d.oppId && str(r.to_state) === 'DRAFTED' && str(r.draft_ref) === d.ref)),
        样例: logRows.slice(0, 6).map(r => ({ 机会: r.opportunity_id, 从: r.from_state, 到: r.to_state, 动作: r.action_type, 引用: r.draft_ref, 人: r.actor, 话: str(r.reason).slice(0, 40) })) },
      draftedIds.length > 0 && drafted.every(d => logRows.some(r => num(r.opportunity_id) === d.oppId && str(r.to_state) === 'DRAFTED' && str(r.draft_ref) === d.ref)));

    // ── 07 内容落地：发布之后机会行自己变 PUBLISHED ─────────────────────
    j.card({
      用例号: 'SYS-J05b-07',
      判据: 'N-01（内容落地那一拍）',
      层级: 'API',
      前置: `已产出 ${drafted.length} 份草稿`,
      步骤: [
        '1 PAGE：先按租户身份打发布口（登记它为什么发不出去），再由站到这一家的超管发；缺 SEO 描述被拦时先补描述再发',
        '2 FAQ：PUT /api/portal/showcase/{id} 整份回填、只改 enabled（那张 PUT 是全量覆盖，只传 enabled 会把正文抹掉）',
        '3 CASE：PUT /api/operation/cases/{id} 置 PUBLISHED；ARTICLE：等任务出文章→提审→过审→发布（被内容安全闸判违规而停在 CONTENT_REJECTED 时换一条机会再点一次，拒因原样进断言）',
        '4 每发一次发布，读一次 /run/{id}/opportunities：那一格该自己变成 PUBLISHED（PUBLISHED 是读出来的，没有写它的口）',
        '5 库里对账：state_log 多一行 actor=system、to_state=PUBLISHED；机会行不被删',
      ],
      期望: [
        '四路草稿各自真的能被发布（发布口自己的鉴权形状如实登记）',
        '发布后重新读机会清单，那几条从 DRAFTED 翻成 PUBLISHED，理由句念得出行号',
        '再点一次 draft 会被拦（「这一条补的内容已经发布」）',
      ],
      反例: ['已发布还继续按草稿', '租户管理员自己打页面发布口（挂 portal:build:manage，SITE_ADMIN 没这一码）'],
      口径: 'GEO 一键成的页面草稿只带标题与正文，SEO 描述为空 ⇒ 发布闸（PortalPageService#publish:528-536）先拦一次；'
        + '本程如实把这一拦记下，再用业务口补描述后发布，不绕开闸。',
      收尾: '发布出来的页/问答/文章/案例随探针租户清点',
    });
    for (const d of drafted) {
      let pub: { status: number, code: string, success: boolean } | null = null;
      if (d.action === 'PAGE' && d.pageId) {
        const before = await db.rows<Rec>('SELECT status, seo_title, seo_description, is_demo FROM portal_page WHERE id = ?', [d.pageId]);
        j.note(`PAGE 落地前的这一页（草稿是怎么一档就看得到发布闸要什么）`, { 页: d.pageId, 状态: before[0]?.status ?? null, seoTitle: before[0]?.seo_title ?? null, seoDescription: before[0]?.seo_description ?? null, 演示页: before[0]?.is_demo ?? null });
        pub = await T.admin.post(`/api/portal/pages/${d.pageId}/publish`, {});
        j.check('反例（产品观察）：租户管理员自己发不出这一页 —— 发布口挂 portal:build:manage，而 SITE_ADMIN 没有这一码',
          { status: pub.status, code: pub.code, msg: str((pub as Rec).message).slice(0, 60) }, !pub.success);
        if (!pub.success) pub = await tenantScoped.post(`/api/portal/pages/${d.pageId}/publish`, {});
        if (!pub.success && pub.code === 'PORTAL_PAGE_SEO_INCOMPLETE') {
          // 发布闸要 seo_description（PortalPageService#publish:525 只在 seo_title 空时拿标题顶上，描述没人补）
          const filled = await tenantScoped.put(`/api/portal/pages/${d.pageId}`, {
            seoTitle: str(before[0]?.seo_title) || `GEO 机会补的页面 ${d.pageId}`,
            seoDescription: '这一页由 GEO 诊断的机会清单产出，系统测试 J-05b 现场补齐 SEO 描述后发布。',
          });
          j.note('产品观察（不改）：GEO 一键成的页面草稿不带 seo_description，租户按「发布」会被 PORTAL_PAGE_SEO_INCOMPLETE 拦，得先补 SEO 描述',
            { 补口码: filled.code, 补后描述: str((filled.data as Rec)?.seoDescription).slice(0, 30) || null });
          pub = await tenantScoped.post(`/api/portal/pages/${d.pageId}/publish`, {});
        }
        const pageRow = await db.rows<Rec>('SELECT status FROM portal_page WHERE id = ?', [d.pageId]);
        j.check('页已发布（portal_page.status=published）', { 机会: d.oppId, 页: d.pageId, 状态: pageRow[0]?.status ?? null, 最后发布口: pub.code }, str(pageRow[0]?.status).toLowerCase() === 'published');
      } else if (d.action === 'FAQ' && d.faqId) {
        // 展示条目的 PUT 是「整份覆盖」（applyForm 逐字段 set，PortalShowcaseItemService:192-203），
        // 只传 {enabled:true} 会把 AI 写好的问答正文与标题一起抹掉，还会先撞 SHOWCASE_SITE_REQUIRED；
        // 所以先把库里这一行读回来原样回填，只改 enabled 这一格。
        const itemBefore = await db.rows<Rec>('SELECT site_id, kind, title, subtitle, body, value_number, value_suffix, media_id, url, industry, sort_order, enabled, is_demo FROM portal_showcase_item WHERE id = ?', [d.faqId]);
        const IB = itemBefore[0] ?? {};
        pub = await T.admin.put(`/api/portal/showcase/${d.faqId}`, {
          siteId: num(IB.site_id), kind: str(IB.kind), title: str(IB.title),
          subtitle: IB.subtitle ?? null, body: IB.body ?? null, valueNumber: IB.value_number ?? null,
          valueSuffix: IB.value_suffix ?? null, mediaId: IB.media_id ?? null, url: IB.url ?? null,
          industry: IB.industry ?? null, sortOrder: num(IB.sort_order), enabled: true, isDemo: Boolean(IB.is_demo),
        });
        j.note(`FAQ 落地：整份回填、只把 enabled 改真（${d.faqId}）`, { status: pub.status, code: pub.code, success: pub.success, msg: str((pub as Rec).message).slice(0, 60) });
        const item = await db.rows<Rec>('SELECT enabled, body FROM portal_showcase_item WHERE id = ?', [d.faqId]);
        j.check('问答条目已启用（enabled=1）且正文没被覆盖掉',
          { 机会: d.oppId, 条目: d.faqId, enabled: item[0]?.enabled ?? null, 回填后正文长度: str(item[0]?.body).length, 原本长度: str(IB.body).length },
          num(item[0]?.enabled) === 1 && str(item[0]?.body).length === str(IB.body).length);
      } else if (d.action === 'CASE' && d.caseId) {
        pub = await T.admin.put(`/api/operation/cases/${d.caseId}`, { status: 'PUBLISHED' });
        j.note(`CASE 落地：把案例置 PUBLISHED（${d.caseId}）`, { status: pub.status, code: pub.code, success: pub.success, msg: str((pub as Rec).message).slice(0, 60) });
        const cRow = await db.rows<Rec>('SELECT status FROM operation_case WHERE id = ?', [d.caseId]);
        j.check('案例已发布（operation_case.status=PUBLISHED）', { 机会: d.oppId, 案例: d.caseId, 状态: cRow[0]?.status ?? null }, str(cRow[0]?.status).toUpperCase() === 'PUBLISHED');
      } else if (d.action === 'ARTICLE' && d.taskId) {
        let taskId = d.taskId;
        let task = await waitArticle(j, db, taskId);
        let articleId = num(task?.article_id);
        const rejectedByGate: Rec[] = [];
        // run 1004-145211 实测：这一路的草稿本身落成了（draftRef=article_task:89、机会搬进 DRAFTED），
        // 但线程池把文章写出来之后，**自家内容安全闸**判它「广告营销」（模型把竞品写成了推荐话术），
        // 任务停 CONTENT_REJECTED、`article_id` 为空 ⇒ 闭环在这一拍断给一道与 GEO 无关的闸。
        // GEO 的题面本来就是「哪家值得推荐」，所以换一道题再点一次是这条链的正当用法；
        // 闸在岗不是链断，三发都被闸挡下才判这一路没落成（拒因逐条附在断言里，不藏）。
        // 每一发都是真调模型写一篇文章（实测一篇约 1.5~3 分钟），三次是这条路的预算上限。
        while (articleId === 0 && str(task?.status) === 'CONTENT_REJECTED' && rejectedByGate.length < 3) {
          rejectedByGate.push({ 机会: d.oppId, 任务: taskId, 状态: str(task?.status), 拒因: str(task?.error_message).slice(0, 300) });
          const spare = oppIds.slice(cursor)[0];
          if (!spare) break;
          cursor += 1;
          const again = await T.admin.post(`/api/geo/campaign/opportunity/${spare}/draft`, { actionType: 'ARTICLE', confirm: true });
          const AGO = (D(again).opportunity as Rec) ?? {};
          const newTask = num(str(AGO.draftRef).split(':').pop());
          j.check(`第一篇被内容安全闸挡下之后，换一条机会（${spare}）再点 ARTICLE：草稿这一拍要还能落`,
            { code: again.code, draftRef: str(AGO.draftRef) || null, 状态: AGO.state ?? null, msg: str((again as unknown as Rec).message).slice(0, 60) },
            again.success && newTask > 0);
          d.oppId = spare; d.ref = str(AGO.draftRef); d.taskId = newTask;
          taskId = newTask;
          task = await waitArticle(j, db, taskId);
          articleId = num(task?.article_id);
        }
        j.check('文章任务把文章写出来了（task.article_id 非空；被闸挡下的每一发都附拒因）', { 任务: taskId, 状态: task?.status ?? null, 文章: articleId || null, 错误: str(task?.error_message).slice(0, 120), 被闸挡下: rejectedByGate }, articleId > 0);
        if (articleId > 0) {
          const early = await T.admin.post(`/api/workspace/publish/${articleId}`);
          j.expect('没审核就发布 → PUBLISH_VALIDATION_FAILED（草稿不能一步登天）', early.code, 'PUBLISH_VALIDATION_FAILED');
          const submit = await T.admin.post(`/api/workspace/articles/${articleId}/submit-review`);
          j.check('提审进 pending_review', { code: submit.code, 状态: (submit.data as Rec)?.status ?? null }, submit.success);
          const approve = await T.admin.post(`/api/workspace/reviews/${articleId}/approve`, { comment: '系统测试过审' });
          j.check('过审进 approved', { code: approve.code, 状态: (approve.data as Rec)?.status ?? null }, approve.success);
          pub = await T.admin.post(`/api/workspace/publish/${articleId}`);
          j.note(`ARTICLE 落地：发布这一篇（${articleId}）`, { status: pub.status, code: pub.code, success: pub.success, msg: str((pub as Rec).message).slice(0, 60) });
          const aRow = await db.rows<Rec>('SELECT status FROM article WHERE id = ?', [articleId]);
          j.check('文章已发布（article.status=published）', { 机会: d.oppId, 文章: articleId, 状态: aRow[0]?.status ?? null }, str(aRow[0]?.status) === 'published');
        }
      }
    }
    const afterRes = await T.admin.get(`/api/geo/campaign/run/${runId}/opportunities?includeResolved=true`);
    const afterItems = asArray(D(afterRes).items);
    const publishedNow = afterItems.filter(o => str(o.state) === 'PUBLISHED');
    j.check('发布之后重新读机会清单：落地的每一格自己翻成 PUBLISHED（读侧对账，不是写侧盖的）',
      { 清单条数: afterItems.length, 落了草稿几份: drafted.length, 已发布: publishedNow.map(o => ({ id: o.id, ref: o.draftRef, 动作: o.actionType })), 仍草稿: afterItems.filter(o => str(o.state) === 'DRAFTED').map(o => ({ id: o.id, ref: o.draftRef })) },
      drafted.length > 0 && publishedNow.length >= drafted.length);
    // 只数本程这几条机会的留痕：那一张表是全租户共用的，按 to_state 全局数会把别家的行算进来
    // id 要在这里现读，不能复用 6.5 节那份 draftedIds —— ARTICLE 那一格如果被内容安全闸挡下、
    // 换了另一条机会再点，d.oppId 已经换人，旧清单会把新那一格的 PUBLISHED 留痕当成缺行。
    const finalIds = drafted.map(d => d.oppId);
    const sysLog = finalIds.length === 0 ? [] : await db.rows<Rec>(
      "SELECT opportunity_id, to_state, actor, reason FROM geo_opportunity_state_log WHERE to_state = 'PUBLISHED' AND opportunity_id IN ("
      + finalIds.map(() => '?').join(',') + ') ORDER BY id', finalIds);
    j.check('PUBLISHED 那一行留痕：actor=system，理由句念得出读的是哪一行',
      { 条数: sysLog.length, 每一条都有: drafted.every(d => sysLog.some(r => num(r.opportunity_id) === d.oppId)),
        样例: sysLog.slice(0, 4).map(r => ({ 机会: r.opportunity_id, 人: r.actor, 话: str(r.reason).slice(0, 60) })) },
      sysLog.length >= drafted.length && sysLog.every(r => str(r.actor) === 'system'));
    if (drafted.length > 0) {
      const again = await T.admin.post(`/api/geo/campaign/opportunity/${drafted[0].oppId}/draft`, { actionType: drafted[0].action, confirm: true });
      j.check('反例：已发布那一格再按草稿 → 拦', { status: again.status, code: again.code, msg: str(again.message).slice(0, 60) }, !again.success);
    }

    // ── 08 SOV 翻得动 ─────────────────────────────────────────────────
    j.card({
      用例号: 'SYS-J05b-08',
      判据: 'N-01（SOV 翻得动）',
      层级: 'API',
      前置: `轮次 ${runId} 已判定；竞品 ${compIds.join('/')} 都启用`,
      步骤: [
        '1 读报告里的 sovShare 作为「翻转前」',
        '2 PUT /api/geo/brand/{profileId}/competitors/{id}/enabled 关掉一个竞品（不动答案、不重跑）',
        '3 POST /run/{runId}/sov 重算（一次模型都不调、一分钱不花，但改这一轮的账）',
        '4 再读报告：sovShare 的行/数必须跟翻转前不一样',
        '5 库里对账：重算只动 metric=sov_share 那些行，别的指标行不许被顺手改了',
      ],
      期望: [
        '两次报告的 sovShare 至少有一处不同（值、分母或行数）',
        '重算前后其它 metric 行逐行相同（这才证明翻的是 SOV，不是整轮重跑）',
      ],
      反例: ['租户管理员去打竞品开关的超管口（本程用的是自家口，形状登记即可）'],
      收尾: '竞品回到启用态，随探针租户清点',
    });
    const sovBefore = asArray((((await T.admin.get(`/api/geo/campaign/run/${runId}/report`)).data as Rec) ?? {}).sovShare);
    const otherBefore = await db.rows<Rec>("SELECT id, metric, numerator, denominator, value FROM geo_metric_snapshot WHERE run_id = ? AND metric <> 'sov_share' ORDER BY id", [runId]);
    j.note('翻转前的 sovShare', { 行数: sovBefore.length, 行: sovBefore.map(s => ({ 主体: str(s.subject).slice(0, 16), 分子: s.numerator, 分母: s.denominator, 值: s.value })) });
    const flip = await T.admin.put(`/api/geo/brand/${brandId}/competitors/${compIds[0]}/enabled`, { enabled: false });
    j.check('关掉一个竞品（自家口，写侧真改 enabled）', { code: flip.code, success: flip.success }, flip.success);
    const compAfter = await db.rows<Rec>('SELECT enabled FROM geo_brand_competitor WHERE id = ?', [compIds[0]]);
    j.expect('库里那一行 enabled 回 0', num(compAfter[0]?.enabled), 0);
    const sovRes = await T.admin.post(`/api/geo/campaign/run/${runId}/sov`, {});
    const sovAfter = asArray((((sovRes.data as Rec) ?? {}).sovShare));
    j.note('翻转后的 sovShare', { 行数: sovAfter.length, 行: sovAfter.map(s => ({ 主体: str(s.subject).slice(0, 16), 分子: s.numerator, 分母: s.denominator, 值: s.value })) });
    const changed = JSON.stringify(sovBefore) !== JSON.stringify(sovAfter);
    j.check('SOV 翻得动：同一轮、不重跑，关掉一个竞品之后 sovShare 真的变了',
      { 变之前: sovBefore.length, 变之后: sovAfter.length, 不同: changed }, sovRes.success && changed);
    const otherAfter = await db.rows<Rec>("SELECT id, metric, numerator, denominator, value FROM geo_metric_snapshot WHERE run_id = ? AND metric <> 'sov_share' ORDER BY id", [runId]);
    j.expect('重算只动 sov_share：其它指标行逐行不变', otherAfter, otherBefore);
    await T.admin.put(`/api/geo/brand/${brandId}/competitors/${compIds[0]}/enabled`, { enabled: true });

    // ── 09 这一家的账：售前 ⇒ GEO 这轮不落租户名下 ──────────────────────
    j.card({
      用例号: 'SYS-J05b-09',
      判据: 'N-01（顺带核计费口径）· N-02 同源',
      层级: 'DB',
      前置: `探针租户 ${T.tenantId} 全程没转正（delivery_state 仍是 presale）`,
      步骤: [
        '1 数这一家名下的 billing_consume_log，并读 tenant_usage 的金额（不是数行数，见口径）',
        '2 数 ai_call_log 的新增（真调用一定留痕）',
        '3 读一次 /api/geo/campaign/latest-report 看这轮是不是「交付后能马上看」的那一口',
      ],
      期望: ['售前 ⇒ 流水零行、额度行里的金额为 0（与 V142 的 delivery_state 闸同一口径，N-02 已判）', 'ai_call_log 有新增'],
      反例: [],
      口径: 'tenant_usage 不许按「有没有行」判：TokenQuotaService#getCurrentUsage 读一次就补一行 used_tokens=0 的行'
        + '（J-05 首轮 1004-123624 就是按行数判被判红的），所以这一格只数金额合计。',
      收尾: '逐表清点 + 软删',
    });
    const bills = await db.count('SELECT COUNT(*) AS n FROM billing_consume_log WHERE tenant_id = ?', [T.tenantId]);
    // 与 J-05 同一堂课外：判「售前不落租户账」只数金额，不数行数
    const usageRows = await db.rows<Rec>(
      "SELECT usage_type, used_count, used_tokens FROM tenant_usage WHERE tenant_id = ? AND usage_type IN ('AI_GEO','AI_TOKEN') ORDER BY usage_type",
      [T.tenantId]);
    const usageSum = usageRows.reduce((a, r) => a + num(r.used_tokens) + num(r.used_count), 0);
    const callsEnd = await db.count('SELECT COUNT(*) AS n FROM ai_call_log');
    j.check('售前这一路：模型真花了（留痕在涨），但账不落在这个租户头上（流水零行、额度金额为 0）',
      { 该租户流水: bills, 该租户额度行: usageRows, 金额合计: usageSum, 本程留痕新增: callsEnd - callsBefore },
      bills === 0 && usageSum === 0 && callsEnd > callsBefore);
    const latest = await T.admin.get('/api/geo/campaign/latest-report');
    j.note('latest-report 读得到这一轮（工作台那张卡的入口）', { code: latest.code, runId: (latest.data as Rec)?.runId ?? null, 空话: str((latest.data as Rec)?.notice ?? '').slice(0, 40) });

    // ── 收尾 ────────────────────────────────────────────────────────────
    const geoRes0 = await db.rows<Rec>("SELECT 'campaign' t, COUNT(*) n FROM geo_campaign WHERE tenant_id = ? UNION ALL SELECT 'run', COUNT(*) FROM geo_campaign_run WHERE tenant_id = ? UNION ALL SELECT 'opportunity', COUNT(*) FROM geo_opportunity WHERE tenant_id = ? UNION ALL SELECT 'judgment', COUNT(*) FROM geo_answer_judgment WHERE tenant_id = ?",
      [T.tenantId, T.tenantId, T.tenantId, T.tenantId]);
    j.note('软删前的 GEO 域逐表行数', geoRes0);
    const res0 = await residue(db);
    j.note('软删前的残留清点', res0);
    await retireTenant(superApi, j, T);
    const res1 = await residue(db);
    j.note('软删后的残留清点（GEO 域多数表没有 del_flag，行仍留在这家名下 —— 这就是要点头删掉的那一类）', res1);
    j.expect('探针租户已软删', await db.count('SELECT COUNT(*) AS n FROM tenant WHERE id = ? AND del_flag = ?', [T.tenantId, '0']), 0);

    j.assertClean();
  } finally {
    await db.close();
  }
});
