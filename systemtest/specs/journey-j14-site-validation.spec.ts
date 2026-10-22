import { test, type Page } from '@playwright/test';
import { Api } from '../lib/api';
import { Db } from '../lib/db';
import { Journal } from '../lib/journal';
import { provisionTenant, residue, retireTenant, type SeededTenant } from '../lib/seed';
import { env } from '../lib/env';

/**
 * SYS-J14 交付前校验这一套到底管不管用（设计文档 `docs/门户网站校验模块设计.md` §5 的四条用例 + 两条防线）
 *
 * 判的是四件事，一件都不许拿单测代替：
 * 1. **查得出**：把这次现场量到的毛病真造进一套跑完的候选站，检测必须逐条报出，报不出就是没做成。
 * 2. **拦得住**：带拦项的那一套，客户读口里不出现、客户答复里选不上、转正一发被拒（判据先比 `code`，本仓业务错统一 HTTP 200）。
 * 3. **改齐后能过**：把值改齐之后复核必须转 pass，客户看得见，并且那句「已通过 N 项自动检查」的 N 来自后端。
 * 4. **不烧钱**：整条检测—改齐—复核的腿一次模型都不调，`ai_call_log` 在这一段必须一格不多。
 *
 * 前置：后端带 `PORTAL_CANDIDATE_ENABLED=true` 起（与 SYS-J05 同一条前置）；出图保持关。
 * 真实租户（1、15、558）只读不写：本程全部写落在 `E2E-<runId>` 探针租户里，收尾软删。
 *
 * 一条与设计文档不同的地方要在这里说明白，而且这条在本程里改过一次口径（J14-03 那格当场测出来的）：
 * §5 用例 1 点名的第三形「页脚词与导航词不同」，我最初判它「造不进库、只是前端截了条目数」，那句是错的。
 * 现扫候选站 611 量到的是：页脚那一份默认列表的词，后端是从区块目录的固定名（「服务」）取的，
 * 而导航与页标题取的是 portal_page.title（「服务项目」）——同一个东西在库里真有两份词，八页全中八条。
 * 修法按 Q8 走在源头（PortalAggregationService.defaultFooterLinks 改成读页自己的标题），不在检测那头放宽。
 * 于是这一形在业务写口上仍然造不出来（列表槽只接受数据绑定，PortalBlockTemplate 那份 schema 直接拒字面数组），
 * 但拒的原因是「预防」做到了，不是「测不到」：本程因此钉两件事——
 * ①新出的一套候选站里这一形必须一条都不报（J14-02），②业务写口对字面数组的拒因原文留在证据里（J14-03），
 * 至于「查得出」本身，拿写得进业务口的两形（两张 logo、页头两个站点名）钉。
 */

const STAGES = ['queued', 'site', 'plan', 'copy', 'seo', 'demo', 'image', 'shots', 'validate', 'preview', 'done'];
const TERMINAL = ['succeeded', 'failed'];

/** 这一版判据一共查五项（唯一出处是 SiteCrossPageScanner.CHECK_ITEMS），客户那句「已通过 N 项」的 N 必须是这个数 */
const CHECK_COUNT = 5;

const LOGO_A = '/uploads/e2e/j14-logo-a.png';
const LOGO_B = '/uploads/e2e/j14-logo-b.png';
const NAME_1 = 'E2E 蓝杉之旅（甲）';
const NAME_2 = 'E2E 蓝杉之旅（乙）';

type Rec = Record<string, unknown>;

const asArray = (v: unknown): Rec[] => (Array.isArray(v) ? v as Rec[] : []);
const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 轮询到本轮所有子任务进终态；与 SYS-J05 同一把尺，慢在哪一格要看得见 */
async function waitRound(j: Journal, sa: Api, briefId: number, expectCandidates: number): Promise<Rec[]> {
  const started = Date.now();
  let last: Rec[] = [];
  for (let i = 0; i < 210; i += 1) {
    const res = await sa.get(`/api/admin/site-briefs/${briefId}/progress`);
    last = asArray(res.data);
    const terminal = last.filter(r => TERMINAL.includes(str(r.status)));
    j.record('poll', `第 ${i + 1} 次轮 progress（${Math.round((Date.now() - started) / 1000)} 秒）`, {
      计数: last.map(r => ({ 第几套: r.candidateNo, 阶段: r.stage, 状态: r.status })),
    });
    if (last.length >= expectCandidates && terminal.length === last.length) return last;
    await new Promise(r => setTimeout(r, 10_000));
  }
  j.note('progress 轮询超时（35 分钟），把最后一次原样留下', { last });
  return last;
}

/** 一个页的页头那一格：从库里那份版式读出来，只改 logoUrl / siteName 两位，其余一个字不动 */
interface HeaderPage {
  pageId: number;
  version: number;
  pageKind: string;
  title: string;
  blocks: Rec[];
  headerInstance: string | null;
}

function parseHeader(row: { id: number; version: number | null; page_kind: string | null; title: string | null; layout_json: string | null }): HeaderPage {
  const layout = JSON.parse(String(row.layout_json ?? '{}')) as Rec;
  const blocks = asArray(layout.blocks);
  const header = blocks.find(b => str(b.blockKey) === 'site-header');
  return {
    pageId: Number(row.id),
    version: Number(row.version ?? 1),
    pageKind: str(row.page_kind),
    title: str(row.title),
    blocks,
    headerInstance: header ? str(header.instanceId) : null,
  };
}

/**
 * 写字面值进页头：业务写口只认 PUT /api/portal/pages/{id}/layout，直改库等于把「接口放不放人」测成假的。
 *
 * <p>只写点名的那一位（`logoUrl` 或 `siteName`），另一位一个字都不动。这不是省事：现场读到新生成的那一套里
 * 页头写的是 `{"$data": "companyInfo.name"}` 这种取数引用（10-22 现测 648 的 4441/4443/4444），
 * 渲染时才解析成站名；要是顺手把首页那两位一起覆盖成字面量，首页就成了新的基线，
 * 其余每一页都会被判成「站点名不一致」，造出来的就不是「一页叫另一个名字」而是「我把六页改跑了」。</p>
 */
async function writeHeader(api: Api, page: HeaderPage, values: { logoUrl?: string; siteName?: string }, note: string) {
  const blocks = page.blocks.map(block => (str(block.blockKey) === 'site-header'
    ? { ...block, props: { ...(block.props as Rec), ...values } }
    : block));
  return api.call('PUT', `/api/portal/pages/${page.pageId}/layout`, {
    baseVersion: page.version,
    layoutJson: JSON.stringify({ blocks }),
    changeSource: 'manual',
    note,
  });
}

/** 把两形改回全站同一份：处置①在流水线里做的就是这件事（刷成全站那一张 / 那一个名字），这里用手改复现它的结果 */
async function alignAll(api: Api, pages: HeaderPage[], logoUrl: string, siteName: string, note: string) {
  for (const page of pages) {
    if (page.headerInstance === null) continue;
    const res = await writeHeader(api, page, { logoUrl, siteName }, note);
    if (!res.success) throw new Error(`改齐页头失败（页 ${page.pageId}）：${res.code} ${res.message}`);
  }
}

async function publishedPages(db: Db, siteId: number): Promise<HeaderPage[]> {
  const rows = await db.rows<{ id: number; version: number | null; page_kind: string | null; title: string | null; layout_json: string | null }>(
    'SELECT id, version, page_kind, title, layout_json FROM portal_page '
    + 'WHERE site_id = ? AND del_flag = ? AND status = ? AND is_demo = 0 ORDER BY nav_sort, id',
    [siteId, '0', 'published']);
  return rows.map(parseHeader);
}

async function scan(j: Journal, api: Api, siteId: number, label: string): Promise<{ run: Rec; findings: Rec[] }> {
  const res = await api.post(`/api/portal/validation/scan?siteId=${siteId}`);
  const data = (res.data as Rec) ?? {};
  j.record('scan', `手跑校验：${label}`, {
    code: res.code,
    轮次: (data.run as Rec)?.round,
    结论: (data.run as Rec)?.verdict,
    读了页: (data.run as Rec)?.pagesScanned,
    拦项: (data.run as Rec)?.blockerCount,
    提醒: (data.run as Rec)?.warnCount,
    findings: asArray(data.findings).map(f => ({ 类型: f.findingType, 页: f.pageId, 指纹: f.dedupKey, 原话: str(f.message).slice(0, 90) })),
  });
  if (!res.success) throw new Error(`校验这一发没打成：${res.status} ${res.code} ${res.message}`);
  return { run: (data.run as Rec) ?? {}, findings: asArray(data.findings) };
}

/**
 * 访客那一屏上实际渲染出来的页头页脚：导航条目（文字+地址）、logo 的 src、站点名、页脚链接文字。
 *
 * <p>为什么要在真浏览器里读而不是读接口回包：数据腿一致不代表渲染腿一致——
 * 10-21 现场量到的「首页 8 条、详情页 6 条」就是库里同一份、前端详情页自己截了一次条目数
 * （`PortalPageShell.vue` 那句 `.slice(0, 6)`），检测只看数据永远看不见这一形。Q-D 定的就是
 * 真浏览器这条腿只放在测试里，不进生产运行时。</p>
 */
async function readChromeInBrowser(page: Page): Promise<{ nav: { 文字: string; 地址: string }[]; logo: string; 站点名: string; 页脚: string[] }> {
  await page.waitForSelector('.pb-header__nav .pb-header__link', { timeout: 20_000 });
  return page.evaluate(() => {
    const nav = Array.from(document.querySelectorAll('.pb-header__nav .pb-header__link')).map(a => ({
      文字: (a.textContent ?? '').trim(),
      地址: a.getAttribute('href') ?? '',
    }));
    const img = document.querySelector('.pb-header__brand img');
    const name = document.querySelector('.pb-header__brand span');
    const footer = Array.from(document.querySelectorAll('.pb-footer__links a')).map(a => (a.textContent ?? '').trim());
    return {
      nav,
      logo: img ? (img.getAttribute('src') ?? '') : '',
      站点名: name ? (name.textContent ?? '').trim() : '',
      页脚: footer,
    };
  });
}

/** 素材地址可能被签名器补上查询串：比的是路径那一段 */
function srcPath(src: string): string {
  return (src ?? '').split('?')[0];
}

/** 带令牌翻到某一页（整页加载，不靠前端把参数一直挂着）：访客从搜索结果直链进来就是这一形 */
async function openWithToken(page: Page, base: string, path: string, token: string, j: Journal, label: string) {
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const withToken = `${url}${url.includes('?') ? '&' : '?'}reviewToken=${token}`;
  const res = await page.goto(withToken, { waitUntil: 'networkidle' });
  const chrome = await readChromeInBrowser(page);
  j.record('browser', `打开 ${label}`, {
    地址: withToken.replace(token, `${token.slice(0, 6)}…`),
    http状态: res?.status(),
    导航条数: chrome.nav.length,
    导航: chrome.nav,
    logo: chrome.logo,
    站点名: chrome.站点名,
    页脚: chrome.页脚,
  });
  return chrome;
}

test('SYS-J14 交付前校验：查得出、拦得住、改齐能过、全程不烧模型', async ({ page }) => {
  test.info().setTimeout(2_700_000);
  const j = new Journal('SYS-J14');
  const db = new Db(j);
  const B = env.apiBase;

  try {
    // ── J14-00 前置：探针租户 + 联系方式硬闸先过 + 三张新表的账在册 ─────────
    j.card({
      用例号: 'SYS-J14-00',
      判据: 'N-03（前置）、V-197/V-198/V-199 落库',
      层级: 'API',
      前置: `后端 ${B} 带 PORTAL_CANDIDATE_ENABLED=true；出图关`,
      步骤: [
        '0 超管登录 + 现开一家售前探针租户（交付态 presale）',
        '1 PUT /api/company/info 补一项联系方式：转正有三道闸，企业信息那道在最前面，不补就会把「校验拦下来」测成「资料没填全」',
        '2 GET /api/portal/validation/options：结论档、触发口径、级别、类型名单一次读全（界面不许自己抄第二份）',
        '3 库里确认 V197/V198/V199 三条迁移都装过了',
      ],
      期望: [
        'options 回得到 pass/blocked/error 三档与 post_generation / before_delivery / daily_patrol / manual 四种触发口径',
        '拦级名单只有跨页那三条（nav_mismatch / header_asset_mismatch / term_mismatch），别的一条都不许进',
        'flyway_schema_history 里 197、198、199 三行 success=1',
      ],
      反例: ['探针租户的交付态不是 presale（说明上一轮的 delivered 没清干净）'],
      收尾: '软删探针租户；残留逐表清点',
    });
    const sa = await Api.login(B, j, env.superAdmin.username, env.superAdmin.password);
    const superApi = sa.api;
    const T: SeededTenant = await provisionTenant(superApi, db, j, 'J14A');
    const tenantScoped = superApi.withTenant(T.tenantId, T.code);
    j.expect('探针租户起点的交付态 = presale', (await db.rows<{ delivery_state: string }>('SELECT delivery_state FROM tenant WHERE id = ?', [T.tenantId]))[0]?.delivery_state, 'presale');

    const company = await tenantScoped.put('/api/company/info', {
      siteId: T.siteId, name: `E2E-${env.runId}-J14 蓝杉之旅`, description: '系统测试 J-14：交付前校验用，内容全是示意',
      phone: '010-88880000', email: 'j14@e2e.invalid', address: '北京市朝阳区测试路 1 号',
    });
    j.check('企业信息补上一项联系方式（转正三道闸的最前面那道先过掉）', { code: company.code, success: company.success }, company.success);

    const options = await tenantScoped.get('/api/portal/validation/options');
    const O = (options.data as Rec) ?? {};
    j.expect('结论三档读得到', Object.keys((O.verdicts as Rec) ?? {}).sort(), ['blocked', 'error', 'pass']);
    j.expect('触发口径四种读得到', Object.keys((O.triggers as Rec) ?? {}).sort(), ['before_delivery', 'daily_patrol', 'manual', 'post_generation']);
    // 现场订正（10-22 第二跑）：options 的 types 形状是 `{key,label,aiFixMode,hint}`（`HealthFindingTypes.TypeInfo:107`），
    // **不带 level**——拦/提醒这一档在后端只有一个 `sitevalidation.BlockLevel` 知道，界面拿到的拦项数是 `run.blockerCount`。
    // 所以这里不假装词表能读出「哪几条是拦级」（那是我上一版凭空写的字段），钉的是这三条类型在词表里读得到；
    // 「这三条真的拦得住交付」由 J14-03（造两条 → blockerCount=2）与 J14-04（带着拦项转正被拒）两处现场证。
    const crossPageTypes = ['header_asset_mismatch', 'nav_mismatch', 'term_mismatch'];
    j.expect('跨页那一族三条类型在词表里读得到',
      crossPageTypes.filter(k => !Object.keys((O.types as Rec) ?? {}).includes(k)), []);
    j.expect('拦/提醒两档的说法读得到（界面念的那两句的唯一出处）',
      Object.keys((O.levels as Rec) ?? {}).sort(), ['block', 'warn']);

    const migrations = await db.rows<{ version: string; success: number }>(
      'SELECT version, success FROM flyway_schema_history WHERE version IN (?,?,?)', ['197', '198', '199']);
    j.expect('V197/V198/V199 三条迁移都装过且都成功', migrations.map(m => `${m.version}:${m.success}`).sort(), ['197:1', '198:1', '199:1']);

    // ── J14-01 真出一套候选（真调模型，后面所有造形都长在它身上） ──────────
    j.card({
      用例号: 'SYS-J14-01',
      判据: 'V-197 第一跑（post_generation）',
      层级: 'API',
      前置: `探针租户 ${T.tenantId}`,
      步骤: [
        '1 录一张 1 套候选的需求单（演示内容 lite，出图关）',
        '2 estimate + generate（真调模型，异步跑），轮询到终态',
        '3 取这一套候选站与它已发布的页',
      ],
      期望: ['这一套进 succeeded；它至少有 2 个已发布页（跨页这件事要有两页才成立）'],
      反例: ['整套失败 ⇒ 本程判红，因为后面没有可造的样本'],
      收尾: '候选站留给 J14-02～05',
    });
    const briefForm = {
      tenantId: T.tenantId, status: 'ready', candidateCount: 1, demoContentMode: 'lite',
      brandName: 'E2E 蓝杉之旅（系统测试 J14）', primaryGoal: 'inquiry', tone: 'professional', scale: 'standard',
      businessModel: 'brand', industry: '本地生活', subIndustry: '到店服务',
      audiences: ['企业决策者'], mustHave: [], languages: ['zh-CN'], brandColor: '#1b6ef3',
      businessScope: '入境旅行定制与英文向导', uvp: '十四年只做一件事', trustAnchors: [],
      pagePlan: [], homeLayout: [], referenceUrls: [], notes: '系统测试 J-14，内容全是示意',
    };
    const briefRes = await superApi.post('/api/admin/site-briefs', briefForm);
    const briefId = num((briefRes.data as Rec).id);
    j.check('需求单建成（1 套候选）', { code: briefRes.code, briefId }, briefRes.success && briefId > 0);

    const est = await superApi.post(`/api/admin/site-briefs/${briefId}/estimate`);
    const E = (est.data as Rec) ?? {};
    const gen = await superApi.post(`/api/admin/site-briefs/${briefId}/generate`,
      { confirm: true, estimateId: str(E.estimateId), expectedTokens: num((E.estimate as Rec)?.estimatedTokens) });
    j.check('出方案起跑（闸③也顺带证明出方案开关是开的：关着会先回 SITE_PROPOSAL_DISABLED）',
      { code: gen.code, success: gen.success, 起了几套: asArray((gen.data as Rec).candidates).length },
      gen.success && asArray((gen.data as Rec).candidates).length === 1);

    const round = await waitRound(j, superApi, briefId, 1);
    j.expect('轮询到这一套', round.length, 1);
    const outcome = round[0] ?? {};
    j.note('这一套的终态', { 阶段: outcome.stage, 状态: outcome.status, 骨架: outcome.skeletonKey, 错误: str(outcome.errorMessage).slice(0, 120), 说明: asArray(outcome.notices as unknown[]) });
    j.check('这一套跑成功了（不成后面没有可造的样本）', { 状态: outcome.status, 阶段: outcome.stage }, str(outcome.status) === 'succeeded' && str(outcome.stage) === 'done');

    const siteRow = await db.rows<{ id: number; status: string }>('SELECT id, status FROM site WHERE build_brief_id = ? ORDER BY candidate_no LIMIT 1', [briefId]);
    const siteId = num(siteRow[0]?.id);
    j.expect('候选站在库里是 candidate 状态', siteRow[0]?.status, 'candidate');
    const pages = await publishedPages(db, siteId);
    j.check('这套站至少有 2 个已发布页（跨页比较要有两页才成立）', { 已发布页数: pages.length, 页种: pages.map(p => p.pageKind) }, pages.length >= 2);
    j.check('每个已发布页都带页头那一格（造形才有地方落笔）',
      pages.map(p => ({ 页: p.pageId, 页种: p.pageKind, 有页头: p.headerInstance !== null })),
      pages.every(p => p.headerInstance !== null));

    // 生成链自己那跑校验的账：post_generation 那一行是本模块写下的第一笔，缺了它「交付前必须自检」就是一句空话
    const generationRuns = await db.rows<Rec>(
      'SELECT round, trigger_source, verdict, pages_scanned, blocker_count, checker_version FROM site_validation_run '
      + 'WHERE site_id = ? AND trigger_source = ? ORDER BY round', [siteId, 'post_generation']);
    j.check('生成链尾巴真跑了一轮交付前自检并落了账', generationRuns.map(r => ({
      轮次: r.round, 触发: r.trigger_source, 结论: r.verdict, 读了页: r.pages_scanned, 拦项: r.blocker_count, 判据版本: r.checker_version,
    })), generationRuns.length >= 1 && generationRuns.every(r => str(r.trigger_source) === 'post_generation'));

    // ── J14-02 两条防线：假阳性为零 + 读的页数与库里真行数对平 ─────────────
    j.card({
      用例号: 'SYS-J14-02',
      判据: '§5 外加两条防线（假阳性防线 / 不空跑）',
      层级: 'API',
      前置: `候选站 ${siteId} 刚生成完，一个字没改过`,
      步骤: [
        '1 POST /api/portal/validation/scan?siteId= 手跑一遍（trigger_source=manual）',
        '2 断言死链判据在正常站上一条都不报（反面教材：上一轮我的探针把地址切错一位，一次报出 10 条假死链）',
        '3 断言 pages_scanned 与 portal_page 里「已发布且非演示」的真行数对平（这条纪律来自 M-P42 那次 dryRun 报 28、真删 22）',
        '4 断言这一跑结论是 pass 且零拦项',
        '5 断言新出的一套里「页脚词与导航词不同」那一形一条都不报 —— 预防腿在数据上的判据（611 那八条就是这一形）',
      ],
      期望: [
        'link_dead 误报 0 条',
        'pages_scanned == 库里已发布非演示页数',
        'verdict=pass、blocker_count=0',
        'term_mismatch 0 条（页脚那份默认列表的词 == 页自己的标题）',
      ],
      反例: ['校验器不走访客自己那条取数路径 ⇒ 误报（这条就是要钉住它）', '拿「改齐之后才 0 条」蒙掉这一格：新出的一套本来就该是 0 条'],
      口径: '取页口径与访客侧同源：status=published 且 is_demo=0，按 nav_sort,id 排。判据里如果有页读不动，结论会是 error 而不是 pass，'
        + '那种情况本格判红并留下页号，不许退化成「没查出来就是通过」。',
      收尾: '流水表继续留着，J14-03 要比轮次',
    });
    const callsBeforeChecks = await db.count('SELECT COUNT(*) AS n FROM ai_call_log');
    const baseline = await scan(j, tenantScoped, siteId, '正常站基线（假阳性防线）');
    j.expect('正常站基线：死链判据一条都不报（假阳性 0）',
      baseline.findings.filter(f => str(f.findingType) === 'link_dead').length, 0);
    j.expect('正常站基线：新出的一套里「页脚词与导航词不同」一条都不报（611 那八条已被源头修掉）',
      baseline.findings.filter(f => str(f.findingType) === 'term_mismatch').map(f => ({ 页: f.pageId, 原话: str(f.message).slice(0, 90) })), []);
    j.expect('正常站基线：零拦项', num(baseline.run.blockerCount), 0);
    j.expect('正常站基线：结论是 pass', str(baseline.run.verdict), 'pass');
    j.expect('读的页数与库里真行数对平（不许空跑）', num(baseline.run.pagesScanned), pages.length);
    j.expect('手跑这一发落的是 manual 口径', str(baseline.run.triggerSource), 'manual');
    j.expect('判据版本落账', str(baseline.run.checkerVersion), 'cross-page-v1');

    // ── J14-03 查得出：把这次现场量到的毛病真造进去，逐条报出来 ────────────
    j.card({
      用例号: 'SYS-J14-03',
      判据: 'V-12 页头素材跨页一致、V-14 同一个东西全站同一个名字、Q10 不指定来源只要求同一张',
      层级: 'API',
      前置: `候选站 ${siteId}（基线 0 拦项）`,
      步骤: [
        '1 造形①（两张 logo）：第 1 页写 LOGO_A、第 2 页写 LOGO_B —— 这是 10-21 现场量到的第一形',
        '2 造形②（两个名字）：第 3 页的页头站点名写成另一个写法 —— 现场第三形「同一个东西两处不同名」在数据腿上的同族',
        '3 POST /scan 复核：每个造进去的页各报一条，不许按站塌成一条',
        '4 反形：同一形同一个页扫第二遍，指纹相同的 open 行不许多出一条',
        '5 当场再测一遍列表槽的写口：POST /api/portal/pages/validate 递一份字面数组进去，看它是拒还是收（611 那一形是从后端默认列表长出来的，不是人手写进去的，这里钉的是「界面/接口这条造形路也被堵着」）',
      ],
      期望: [
        'header_asset_mismatch 一条、报在第 2 页上，原话同时带出两张图与「全站那一份」在哪一页',
        'term_mismatch 一条、报在第 3 页上，级别是拦',
        'blocker_count=2、verdict=blocked、轮次比基线那一跑 +1',
        '列表槽那一形：业务写口按 schema 拒字面数组（拒因原文进证据）——这一形的来路是后端自己那份默认列表，已在源头按 Q8 单源化（J14-02 钉它 0 条）',
      ],
      反例: ['报了 1 条就当报了 2 条', '级别写成提醒（提醒级不会拦交付）', '同一形重复扫两遍多出 finding 行'],
      口径: '基线是「按访客看到的顺序里第一个写了这一格的页」，不是出现次数最多的那一个：多数派要扫完全站才算得出来，'
        + '并列时谁赢由遍历顺序说了算，而 Q10 只要求全站同一张、没指定来源。第 1 页就是那一页，改齐也是往它上面刷。',
      收尾: '造进去的两形留给 J14-04 拦客户，J14-05 改齐',
    });
    // 每次动笔前重新读一遍页头（版本号会被上一发放空）：第一放没踩到，改齐那一放就是拿旧版本号写的，
    // 现场回了 PORTAL_PAGE_VERSION_CONFLICT（当前版本 5，你基于 4）。
    const pagesForPlant = await publishedPages(db, siteId);
    const [pageA, pageB, pageC] = pagesForPlant;
    const putA = await writeHeader(tenantScoped, pageA, { logoUrl: LOGO_A }, 'J14 造形：全站那一份 logo 落在这一页（站点名一位不动，它才是基线）');
    const putB = await writeHeader(tenantScoped, pageB, { logoUrl: LOGO_B }, 'J14 造形：这一页自带第二张 logo');
    const putC = pageC ? await writeHeader(tenantScoped, pageC, { siteName: NAME_2 }, 'J14 造形：这一页页头叫另一个名字') : null;
    j.check('三页页头都写进去了（写走业务口，不是直改库）',
      { A: putA.code, B: putB.code, C: putC?.code ?? '这套站只有两页，第三形没造' },
      putA.success && putB.success && (putC === null || putC.success));

    const planted = await scan(j, tenantScoped, siteId, '造形之后复核');
    const logoFindings = planted.findings.filter(f => str(f.findingType) === 'header_asset_mismatch');
    const nameFindings = planted.findings.filter(f => str(f.findingType) === 'term_mismatch');
    j.expect('两张 logo 报出几条（一页一条，不许塌成一条）',
      logoFindings.map(f => ({ 报在第几页: f.pageId, 指纹: str(f.dedupKey).slice(0, 24) })),
      [{ 报在第几页: pageB.pageId, 指纹: str(logoFindings[0]?.dedupKey).slice(0, 24) }]);
    j.expect('两个名字报出几条', nameFindings.map(f => f.pageId), pageC ? [pageC.pageId] : []);
    const logoMessage = str(logoFindings[0]?.message);
    j.check('原话同时带出两张图与「全站那一份」的出处（超管看一眼就知道改哪页）',
      { 原话: logoMessage.slice(0, 160) },
      logoMessage.includes(LOGO_B) && logoMessage.includes(LOGO_A));
    const nameMessage = str(nameFindings[0]?.message);
    // 基线那一页的站名是渲染时从 companyInfo 解析出来的（新生成的一套页头写的是取数引用，不是字面量），
    // 所以这里只判「造进去的那个写法」和「指得出全站那一份在哪一页」，不拿一个我自己编的名字去比。
    j.check('名字那条带出两个写法与拦级', { 原话: nameMessage.slice(0, 160) },
      pageC === null || (nameMessage.includes(NAME_2) && nameMessage.includes('全站那一份')));
    const expectedBlockers = pageC ? 2 : 1;
    j.expect('拦项条数与造进去的形数对平', num(planted.run.blockerCount), expectedBlockers);
    j.expect('结论转成 blocked', str(planted.run.verdict), 'blocked');
    j.expect('轮次比基线那一跑 +1', num(planted.run.round), num(baseline.run.round) + 1);

    // 反形：同一形再扫一遍不许长出第二行账（否则改齐之后它消不掉，界面会永远挂着一条老毛病）
    const rescan = await scan(j, tenantScoped, siteId, '同形再扫一遍（反形：不重复计数）');
    j.expect('再扫一遍拦项条数不变', num(rescan.run.blockerCount), expectedBlockers);
    const openRows = await db.rows<Rec>(
      "SELECT dedup_key, COUNT(*) AS n FROM portal_health_finding WHERE site_id = ? AND status = 'open' AND finding_type IN (?,?) GROUP BY dedup_key HAVING COUNT(*) > 1",
      [siteId, 'header_asset_mismatch', 'term_mismatch']);
    j.expect('同一指纹的 open 行没有多出来的（两条判据各占一行）', openRows, []);
    const crossPageRuns = await db.count(
      'SELECT COUNT(*) AS n FROM site_validation_run WHERE site_id = ?', [siteId]);
    // 轮次口径＝nextRound(siteId)＝本站最大轮次 +1（SiteValidationService:214-219），所以「行数 == 最新那一跑的轮次」
    j.expect('每一跑都留了一行账（事后能问「第 2 轮那两条是被谁修掉的」）', crossPageRuns, num(rescan.run.round));

    // 设计文档 §5 用例 1 点名的第三形能不能从业务口造进去：当场测，不猜
    const listLiteral = await tenantScoped.post('/api/portal/pages/validate', {
      layoutJson: JSON.stringify({ blocks: [{ instanceId: 'b1', blockKey: 'site-footer', props: { copyright: 'x', links: [{ title: '服务', url: '/services' }, { title: '关于', url: '/about' }] } }] }),
    });
    const rejectText = str(asArray((listLiteral.data as Rec)?.errors)[0] ?? '');
    j.check('字面数组进列表槽这条路是堵着的（写口按 schema 拒）：611 那一形因此只能从后端默认列表长出来，已单源化，界面上手打不出来',
      { 拒因原文: rejectText }, rejectText.includes('array') && rejectText.includes('object'));

    // ── J14-04 拦得住：客户看不见、选不上，转正一发被拒 ────────────────────
    j.card({
      用例号: 'SYS-J14-04',
      判据: 'Q1 不合格那套不给客户看、Q4 不给人工放行口、§5 用例 2',
      层级: 'API',
      前置: `候选站 ${siteId} 此刻有 ${expectedBlockers} 条拦项，需求单 #${briefId} 还在 awaiting_client`,
      步骤: [
        '1 签发预览令牌（令牌本身照发，客户看不见这套不靠藏令牌）',
        '2 免鉴权 GET /api/portal/public/brief/{token}：这一套不出现，candidateCount 跟着减',
        '3 反例：绕过界面直接把这一套的 siteId 递进答复口 ⇒ 整条丢弃，site_build_decision 零行、需求单不进 decided',
        '4 改齐 → 复核 pass → 客户读口重新出现，并念得出「已通过 ' + CHECK_COUNT + ' 项自动检查」（N 来自后端，不是前端数）',
        '5 客户选定落库（需求单进 decided），再把两形原样造回去',
        '6 POST /promote：必须被拒，拒因码 SITE_BRIEF_VALIDATION_FAILED，并且一行都不动',
      ],
      期望: [
        '步骤 2：candidates 里没有这套站；candidateCount=0',
        '步骤 3：答复对外仍是 200，库里不加行（与蜜罐同一形状，区别只在日志）',
        '步骤 4：candidateCount=1 且 autoCheckCount=' + CHECK_COUNT,
        '步骤 6：需求单还是 decided、站还是 candidate、租户还是 presale、留痕行数不变',
      ],
      反例: ['拿 HTTP 状态码判拒（本仓业务错统一 200）', '被拒之后还是把站转成了 enabled', '客户读口把拦项那套的「已通过 N 项」念成 0 项'],
      口径: '转正有三道闸，顺序是企业信息 → 这一套生成完了没 → 交付前校验（SiteBriefDeliveryService.promote:190/206/213）。'
        + '本程在 J14-00 就把第一道过掉了，所以步骤 6 回 SITE_BRIEF_VALIDATION_FAILED 只可能是第三道拦的，不会认错人。'
        + '转正那一步自己会按 before_delivery 重跑一遍判据，不靠界面上手跑过没手跑过。',
      收尾: '被拒的这几发不落任何写；改齐与造形只动页头那一格',
    });
    const link = await superApi.post(`/api/admin/sites/${siteId}/preview-links?label=J14-拦得住那一发`);
    const plainToken = str(((link.data as Rec) ?? {}).previewToken);
    j.check('预览令牌签得出来（藏令牌不是拦客户的手段）', { 长度: plainToken.length }, plainToken.length >= 20);

    const anon = Api.anonymous(B, j);
    const hiddenPage = await anon.get(`/api/portal/public/brief/${plainToken}`);
    const HP = (hiddenPage.data as Rec) ?? {};
    j.expect('带拦项那套在客户读口里不出现',
      asArray(HP.candidates).map(c => ({ 站: c.siteId, 已通过几项: c.autoCheckCount })), []);
    j.expect('一套都不合格时读口回的是与「令牌无效」同一形状的空数据', num(HP.candidateCount), 0);
    j.note('产品观察（本程不改）：整套都不合格时客户看到的就是那张空页，与链接过期同形——'
      + '抬头那一格（需求单号/状态）也随之变 null，因为他本来就不该知道这套存在',
      { 需求单: HP.briefId ?? null, 状态: HP.briefStatus ?? null, 演示说明还在: str(HP.demoNotice).length > 0 });

    const decisionsBefore = await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]);
    const forced = await anon.post(`/api/portal/public/brief/${plainToken}/decide`, { chosenSiteId: siteId, clientNote: '就要这一套' });
    j.check('绕过界面硬选不合格那套：对外仍是 200 + OK、回执不带「记下了」的说法（与蜜罐同一形状，区别只在日志）',
      { code: forced.code, 回执数据: forced.data === null ? 'null' : typeof forced.data },
      forced.code === 'OK' && forced.data === null);
    j.expect('但库里一行都不落',
      await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]), decisionsBefore);
    j.expect('需求单没被推进 decided',
      (await db.rows<{ status: string }>('SELECT status FROM site_build_brief WHERE id = ?', [briefId]))[0]?.status, 'awaiting_client');

    // 改齐 → 复核 → 客户重新看得见，并且那句「已通过 N 项」念得出数
    await alignAll(tenantScoped, await publishedPages(db, siteId), LOGO_A, NAME_1, 'J14 改齐：刷成全站那一张与那一个名字');
    const fixed = await scan(j, tenantScoped, siteId, '改齐之后复核');
    j.expect('改齐之后拦项归零', num(fixed.run.blockerCount), 0);
    j.expect('结论转 pass', str(fixed.run.verdict), 'pass');
    j.check('改齐这一段一次模型都没调（检测—改齐—复核是纯代码的腿）',
      { 新增留痕行: (await db.count('SELECT COUNT(*) AS n FROM ai_call_log')) - callsBeforeChecks },
      (await db.count('SELECT COUNT(*) AS n FROM ai_call_log')) === callsBeforeChecks);
    const visiblePage = await anon.get(`/api/portal/public/brief/${plainToken}`);
    const VP = (visiblePage.data as Rec) ?? {};
    const shownCandidate = asArray(VP.candidates)[0] ?? {};
    j.expect('改齐后客户读口重新摆出这一套', num(VP.candidateCount), 1);
    j.expect(`那句「已通过 N 项自动检查」的 N 来自后端（=${CHECK_COUNT}，界面不许自己数）`,
      num(shownCandidate.autoCheckCount), CHECK_COUNT);
    j.note('客户读口这一套读得到的字段（不许出现内部词与英文码）',
      Object.keys(shownCandidate).map(k => ({ 键: k, 值: str(shownCandidate[k]).slice(0, 24) })));

    const chosen = await anon.post(`/api/portal/public/brief/${plainToken}/decide`, { chosenSiteId: siteId, clientNote: '就要这一套，案例想放首页第一屏' });
    j.expect('合格之后同一枚令牌答复就落库了（之前丢的是规则不是额度）', chosen.code, 'OK');
    j.expect('留痕多了 1 行',
      await db.count('SELECT COUNT(*) AS n FROM site_build_decision WHERE brief_id = ?', [briefId]), decisionsBefore + 1);
    j.expect('需求单进 decided',
      (await db.rows<{ status: string }>('SELECT status FROM site_build_brief WHERE id = ?', [briefId]))[0]?.status, 'decided');

    // ── J14-04R 渲染腿：访客那一屏上，导航与标志全站只有一份（Q-D：真浏览器只放测试）──
    j.card({
      用例号: 'SYS-J14-04R',
      判据: 'Q3 跨页导航逐条完全相等（含顺序）、Q9「栏目不统一」＝同一套站跨页不一致、Q10 页头 logo 全站同一张、P0 渲染单源',
      层级: '浏览器',
      前置: `候选站 ${siteId} 刚改齐并通过复核，此刻 ${plainToken.slice(0, 6)}… 这枚令牌有效`,
      步骤: [
        `1 真 Chromium 打开首页 ${env.uiBase}/?reviewToken=…（视口 1280×720，宽到不会触发窄屏折叠）`,
        '2 从首页 DOM 里读导航条目（文字+href），拿前 3 个非首页地址当访客直链的目标页',
        '3 逐个整页加载那些地址（每次都带令牌，模拟搜索结果点进来）',
        '4 逐页比：导航条目序列、页脚链接文字序列、.pb-header__brand img 的 src、站点名',
      ],
      期望: [
        '每一页的导航与首页逐条相等（文字与顺序都不许多一条少一条）——这就是 10-21「首页 8 条 vs 详情页 6 条」那条形',
        '每一页的页脚链接与首页逐条相等',
        '每一页的 logo src == 全站那一张（库里那一格 LOGO_A），站点名 == NAME_1',
      ],
      反例: ['只读接口回包就宣布「渲染一致」：数据同源不等于出口同源，上一轮缺陷就长在这个缝上',
        '拿 `.pb-header__link` 全局计数：窄屏抽屉那份也用同一个类名，点了汉堡才会多出一份'],
      口径: '看的是 getAttribute(src/href) 与 textContent，不是像素与截图：这一格判的是「同一个出口、同一份列表」，'
        + '那张图本身是不是一个真文件由素材那条判据管（这里用的是探针地址，图片加载失败不影响 src 的比较）。'
        + '选择器取自 SiteHeaderBlock.vue / SiteFooterBlock.vue 的模板，不是猜的 class。',
      收尾: '只读不写；接着回 API 腿做「再造形 → 转正被拒」',
    });
    const homeChrome = await openWithToken(page, env.uiBase, '/', plainToken, j, '首页（访客第一屏）');
    j.check('首页确实渲染出了导航（一条都没有就是这一屏没取到站点级真相）',
      { 条数: homeChrome.nav.length, 导航: homeChrome.nav.map(n => n.文字) }, homeChrome.nav.length >= 2);
    const detailPaths = homeChrome.nav.map(n => n.地址).filter(href => href !== '/' && href.length > 1).slice(0, 3);
    j.check('首页导航里点得出目标页（一个都没有就没法比跨页，本格判红而不是跳过）',
      { 目标页: detailPaths }, detailPaths.length >= 1);
    for (const href of detailPaths) {
      const chrome = await openWithToken(page, env.uiBase, href, plainToken, j, `详情页 ${href}`);
      j.expect(`${href} 的导航与首页逐条相等（文字与顺序）`, chrome.nav, homeChrome.nav);
      j.expect(`${href} 的页脚链接与首页逐条相等`, chrome.页脚, homeChrome.页脚);
      j.expect(`${href} 的页头 logo 与首页同一张`, srcPath(chrome.logo), srcPath(homeChrome.logo));
      j.expect(`${href} 的页头站点名与首页同一个`, chrome.站点名, homeChrome.站点名);
    }
    // 素材那一格可能带签名查询串（MediaAccessSigner），比的是路径那一段，不比整串
    j.check('访客看到的那张 logo 就是库里全站那一份（不是前端自己补的占位图）',
      { 浏览器里的src: homeChrome.logo, 库里全站那一份: LOGO_A }, srcPath(homeChrome.logo) === LOGO_A);
    j.expect('访客看到的那个站点名就是全站那一个', homeChrome.站点名, NAME_1);

    // 选定之后再把两形造回去：转正那一步自己会重跑判据，不靠界面上手跑过没手跑过
    const pagesForReplant = await publishedPages(db, siteId);
    const pageB2 = pagesForReplant[1] ?? pagesForReplant[0];
    const pageC2 = pagesForReplant[2] ?? null;
    await writeHeader(tenantScoped, pageB2, { logoUrl: LOGO_B }, 'J14 再造形：转正前那道重跑要拦的就是它');
    if (pageC2) await writeHeader(tenantScoped, pageC2, { siteName: NAME_2 }, 'J14 再造形：名字两样');
    const runsBeforePromote = await db.count('SELECT COUNT(*) AS n FROM site_validation_run WHERE site_id = ?', [siteId]);
    const promoteDenied = await tenantScoped.post(`/api/admin/site-briefs/${briefId}/promote`, {});
    j.expect('不合格那套转正被拒：先比 code（本仓业务错统一 HTTP 200）', promoteDenied.code, 'SITE_BRIEF_VALIDATION_FAILED');
    j.check('拒因话术点名到条数与页，不说「校验没过」这种要人去猜的话',
      { 原话: promoteDenied.message.slice(0, 220) },
      promoteDenied.message.includes('还不能转正') && promoteDenied.message.includes('条拦项') && promoteDenied.message.includes(LOGO_B));
    j.expect('被拒之后需求单还是 decided（一道都没写）',
      (await db.rows<{ status: string }>('SELECT status FROM site_build_brief WHERE id = ?', [briefId]))[0]?.status, 'decided');
    j.expect('被拒之后候选站还是 candidate',
      (await db.rows<{ status: string }>('SELECT status FROM site WHERE id = ?', [siteId]))[0]?.status, 'candidate');
    j.expect('被拒之后租户交付态还是 presale（计费起点没被误开）',
      (await db.rows<{ delivery_state: string }>('SELECT delivery_state FROM tenant WHERE id = ?', [T.tenantId]))[0]?.delivery_state, 'presale');
    j.expect('转正这一发按 before_delivery 自己重跑了一遍并落了账',
      await db.count("SELECT COUNT(*) AS n FROM site_validation_run WHERE site_id = ? AND trigger_source = 'before_delivery'", [siteId]), 1);
    j.expect('流水表只多了那一行（读口/答复那几发不再另立账）',
      await db.count('SELECT COUNT(*) AS n FROM site_validation_run WHERE site_id = ?', [siteId]), runsBeforePromote + 1);

    // ── J14-05 改齐之后转正走得完 + 交棒 ─────────────────────────────────
    j.card({
      用例号: 'SYS-J14-05',
      判据: '§5 用例 3「打回后能过」的交付腿、G-02',
      层级: 'API',
      前置: `需求单 #${briefId} 已 decided，此刻又被造回 ${expectedBlockers} 条拦项`,
      步骤: [
        '1 第二次改齐（同一段代码：把每一页的页头刷成全站那一张、那一个名字）',
        '2 POST /promote：这回必须过，回执带交棒清单',
        '3 库里对账：选中 enabled+promoted_at、需求单回填 site_id、租户进 delivered、全部预览令牌撤销',
      ],
      期望: [
        'promote 回 success 且 briefStatus=promoted',
        '转正这一步自己重跑的那一跑结论是 pass（trigger_source=before_delivery 那一行）',
        '撤销令牌条数 ≥ 1：不合格期间发出去的那枚预览链接，转正后必须打不开',
      ],
      反例: ['界面上手跑过才放行（真判据是转正自己重跑）', '改齐靠的是把另外两页刷成第 2 页那份错的'],
      口径: '基线取「按访客顺序里第一个写了这一格的页」，所以改齐的方向是把后两页往第 1 页刷，不是反过来。'
        + '这一格里第 1 页的值一个字没动过，改完库里三页的 logoUrl 逐字相等就是这件事的证明。',
      收尾: '交付态留给 J14-06 的账，收尾随探针租户软删',
    });
    await alignAll(tenantScoped, await publishedPages(db, siteId), LOGO_A, NAME_1, 'J14 第二次改齐：转正前重跑要过的就是它');
    const alignedLogos = await db.rows<{ id: number; layout_json: string | null }>(
      'SELECT id, layout_json FROM portal_page WHERE site_id = ? AND del_flag = ?', [siteId, '0']);
    const logoSet = new Set(alignedLogos.map(r => {
      const header = asArray(JSON.parse(String(r.layout_json ?? '{}')).blocks).find(b => str(b.blockKey) === 'site-header');
      return str(((header?.props as Rec) ?? {}).logoUrl);
    }));
    j.check('改齐之后逐页页头 logo 逐字相等（而且全站只剩这一张）', { 不同的值有几个: logoSet.size, 是哪一个: [...logoSet] }, logoSet.size === 1 && logoSet.has(LOGO_A));

    const promote = await tenantScoped.post(`/api/admin/site-briefs/${briefId}/promote`, {});
    const R = (promote.data as Rec) ?? {};
    j.check('改齐之后转正走得完', { code: promote.code, briefStatus: R.briefStatus, 站: R.siteId, 撤销令牌: R.revokedTokenCount },
      promote.success && str(R.briefStatus) === 'promoted');
    j.expect('选中那套转成 enabled', (await db.rows<{ status: string }>('SELECT status FROM site WHERE id = ?', [siteId]))[0]?.status, 'enabled');
    j.expect('租户交付态这一刻进 delivered', (await db.rows<{ delivery_state: string }>('SELECT delivery_state FROM tenant WHERE id = ?', [T.tenantId]))[0]?.delivery_state, 'delivered');
    j.expect('转正自己重跑那一跑结论是 pass',
      (await db.rows<{ verdict: string }>("SELECT verdict FROM site_validation_run WHERE site_id = ? AND trigger_source = 'before_delivery' ORDER BY id DESC LIMIT 1", [siteId]))[0]?.verdict, 'pass');
    const revokedProof = await anon.get(`/api/portal/public/site?reviewToken=${plainToken}`);
    j.check('不合格期间那枚令牌转正后打不开', { success: revokedProof.success, code: revokedProof.code },
      !revokedProof.success || revokedProof.data === null);

    // ── J14-06 台账：这一程到底花了几次外呼，逐笔对得上 ────────────────────
    j.card({
      用例号: 'SYS-J14-06',
      判据: '§5 用例 3 后半句「ai_call_log 台账逐笔对得上」+ 设计文档「检测零模型」',
      层级: 'DB',
      前置: `本程跑完：出方案一轮 + 校验若干跑`,
      步骤: [
        '1 按 purpose 分组数这一程的留痕行',
        '2 断言校验族（造形/改齐/复核/转正前重跑）那几发一次外呼都没有',
        '3 断言新 purpose site_brief_unify_v1 这一程 0 行，并写明为什么不是「没做」：它只在生成链里模型自己产出不齐时才发生，界面上没有一条口能把旧站打进那一腿（处置①②③的账由 SiteProposalValidationLoopTest 等 26 例单测钉着，本批现跑全绿）',
        '4 每日巡检默认关：库里不该有 daily_patrol 那一档的账，也不该有本租户的巡检站内信',
      ],
      期望: [
        'J14-02～05 这一段 ai_call_log 增量 0 行',
        "purpose='site_brief_unify_v1' 增量 0 行",
        'site_validation_run 里 trigger_source=daily_patrol 零行；alert_record 里本租户零行',
      ],
      反例: ['把「没测到」写成「通过」（这一格明确登记哪条腿没真跑）'],
      口径: 'V199 种的那条提示词在库里存在、purpose 名单里也有它，但「存在」不等于「这一程走过」。'
        + '报告里这一条要写成「渲染与闭环的单测覆盖、真外呼重问腿未现场触发」，不许写成全绿。',
      收尾: '逐表清点残留并软删探针租户',
    });
    const callsAfterChecks = await db.count('SELECT COUNT(*) AS n FROM ai_call_log');
    j.expect('检测—造形—改齐—复核—转正这一整段零模型外呼', callsAfterChecks, callsBeforeChecks);
    const purposes = await db.rows<{ purpose: string; n: number }>(
      'SELECT purpose, COUNT(*) AS n FROM ai_call_log WHERE created_at >= DATE_SUB(NOW(), INTERVAL 3 HOUR) GROUP BY purpose ORDER BY purpose');
    j.note('近三小时各用途的外呼笔数（本程那一单只可能落在建站那几个用途上）', purposes.map(r => ({ 用途: r.purpose, 笔数: num(r.n) })));
    j.expect('重问用途 site_brief_unify_v1 这一程 0 笔（见本格口径那句：不是没做，是没被现场触发）',
      num(purposes.find(p => str(p.purpose) === 'site_brief_unify_v1')?.n ?? 0), 0);
    const unifyPromptSeeded = await db.count(
      "SELECT COUNT(*) AS n FROM prompt_template WHERE purpose = ? AND del_flag = ?", ['site_brief_unify_v1', '0']);
    j.check('V199 那条提示词确实在库里（闭环那腿的代码有词可用）', { 行数: unifyPromptSeeded }, unifyPromptSeeded >= 1);
    j.expect('每日巡检默认关：库里没有 daily_patrol 那一档的账',
      await db.count("SELECT COUNT(*) AS n FROM site_validation_run WHERE trigger_source = 'daily_patrol'"), 0);
    j.expect('本租户没被巡检发过站内信',
      await db.count('SELECT COUNT(*) AS n FROM alert_record WHERE tenant_id = ?', [T.tenantId]), 0);

    // ── 收尾 ────────────────────────────────────────────────────────────
    const res0 = await residue(db);
    j.note('软删前的残留清点', res0);
    await retireTenant(superApi, j, T);
    j.expect('探针租户已软删', await db.count('SELECT COUNT(*) AS n FROM tenant WHERE id = ? AND del_flag = ?', [T.tenantId, '0']), 0);
    j.note('软删后的残留清点（交付站与页头改动仍挂在这家名下）', await residue(db));

    j.assertClean();
  } finally {
    await db.close();
  }
});
