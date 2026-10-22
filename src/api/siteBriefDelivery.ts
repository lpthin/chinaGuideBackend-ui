import http from './http';

/**
 * 客户确认这一段的两张面（Spec-C §5 的 public brief 两行 + P4 的 promote/regenerate/decisions 三行）。
 *
 * 为什么单独一个文件而不是往 `siteBriefs.ts` 里加：那份文件里的 P3 用例钉着「P4 的口今天连函数都不许写」，
 * 而 P4 的契约口（`PortalBriefPublicController` / `SiteBriefDeliveryController`，cgBackendP4 的
 * `sitebrief/decision/` 包）这次是真的建出来了。两条面各自的鉴权也完全不同——
 * 公开那一读一写免鉴权、管理侧那三口是 `portal:build:manage`——放在一起迟早有人「顺手」复用错。
 *
 * 路径/动词逐字对齐后端源码，**猜的部分集中在本文件末尾的 `GUESSED_SHAPES` 一份清单里**，
 * 视图不许自己补字段。后端的静默失败口径（§9-7）也要在这里看得懂：
 * `decide` 恒回 200，成没成只进日志，所以本文件**不**替它编一个 `recorded` 字段。
 */

// ------------------------------------------------------------------
// 公开面：客户选择页的数据与提交（免鉴权，令牌即准入 = 拍板 10）
// ------------------------------------------------------------------

/**
 * `ClientBriefView.Candidate`：一套候选在一屏对比里的样子。
 * 后端注释明确**故意没有**缩略图/截图字段（§6.7 内部预览域截不了图）。
 *
 * <p>`focus` / `tone` 是 2026-10-13 现场对账时补上的两根：后端 `ClientBriefView.Candidate`
 * 早就带这两列（读自 `site_proposal_candidate`，拍板 5A 要客户看得见门禁的依据），
 * 而这一头写的是当年猜的 `differentiation`——那个名字在响应里从来不存在，于是客户那一屏
 * 永远走「后端没随这条链接下发差异说明」那条文案，而现场真回包里有两句 focus 原话。
 * 界面因此念了一句假话（现场截图见 scratch/m-p13-e2e-p7/p7-01-client-page.png）。
 * 现在只认后端真有的这两个键，取不到（那一套在 plan 之前就被门禁拦下）就照实少一句。</p>
 */
export interface ClientBriefCandidate {
  siteId: number;
  candidateNo: number | null;
  name: string | null;
  skeletonKey: string | null;
  /** 骨架的中文名（后端读自 `portal_skeleton.name`）；这一格才是给客户看的，`skeletonKey` 只用于比对 */
  skeletonName: string | null;
  /** plan 落库的「这套侧重什么」原话；那一套没跑到 plan 时后端回 null */
  focus: string | null;
  /** 这一套的语气档位（门禁按「语气不重复」拦三套） */
  tone: string | null;
  /** 这一套自己的预览地址（令牌绑站不绑页）；未配 preview-base-url 时是相对路径，由前端按当前 origin 拼 */
  previewUrl: string | null;
  /**
   * 这一套过了交付前自检几项（后端唯一出处 `SiteCrossPageScanner.CHECK_COUNT`）；
   * 自检没通过的那套后端根本不会随链接下发，所以取到 0 或没带这一格时，界面都不许替它说「已通过」。
   * 可选是因为这一格比这一屏老，回包缺它时界面走「少一句」而不是报错。
   */
  autoCheckCount?: number;
}

/** `ClientBriefView`：所有失败场景都是「同一个形状 + 空 candidates」（§9-7），所以这里没有 error 字段 */
export interface ClientBriefView {
  briefId: number | null;
  /** 需求单状态英文码（词表），界面只用来决定按钮形态 */
  briefStatus: string | null;
  /** 抬头那一句（后端取的是租户名） */
  title: string | null;
  candidateCount: number;
  candidates: ClientBriefCandidate[];
  /** §9-4 原话：演示内容由 AI 生成、交付后可替换 */
  demoNotice: string | null;
  /** §6.7 原话：候选阶段只有可点开的预览链接 */
  previewNotice: string | null;
}

/**
 * `ClientDecisionForm`：字段就是这三根，多一根都没有（拍板 10 不索取任何身份/联系方式）。
 * `website` 是蜜罐——界面上不初值、真实用户看不见；非空即按机器人处理（回执仍是成功、一行不落）。
 */
export interface ClientDecisionPayload {
  chosenSiteId: number | null;
  clientNote: string | null;
  website?: string;
}

/** 需求单在客户面上的两态（`ClientDecisionService.CLIENT_FACING_STATUSES`）：其余态一律当「这条链接现在没东西」 */
export const CLIENT_FACING_BRIEF_STATUSES = ['awaiting_client', 'decided'] as const;

/**
 * 单子状态念给客户听的那一句（2026-10-22 全流程走查第 5 条）。
 *
 * 这一页以前把响应里的原始状态码 `decided` 直接印在客户那一屏上——和后端为什么要给语气码做
 * `toneLabel`（{@code ClientDecisionService}）是同一件事：给客户看的必须是中文说法，不是内部码。
 * 词表只有这两种：第三种状态（生成中、已作废、已交付）在这条链接上根本打不开这一页
 * （{@code ClientDecisionService#resolve} 的判据），所以这里回空串，由界面照实说「这条链接没说明」。
 */
export function clientBriefStatusLabel(status: string | null | undefined): string {
  if (status === 'decided') return '已经收到过你的答复';
  if (status === 'awaiting_client') return '还在等你答复';
  return '';
}

/**
 * 这一套骨架念给客户听的那一句（2026-10-22 全流程走查第 6 条）。
 *
 * 这一屏以前印的是 `skeletonKey`（`corporate-base` 那一串）——那是我们内部的标识，不是产品名词。
 * 中文名后端读自 `portal_skeleton.name`（一处出处，界面不再自己编名单），读不到就回空串，
 * 界面那一行跟着不显示：少一句好过念一串客户看不懂的码。
 */
export function clientSkeletonLabel(candidate: Pick<ClientBriefCandidate, 'skeletonName'>): string {
  return (candidate.skeletonName ?? '').trim();
}

/**
 * 这一套的自动检查那一句（设计文档 §6：客户侧只念结果，不念过程）。
 *
 * 项数只从后端那一个数来（`SiteCrossPageScanner.CHECK_COUNT` 经 `autoCheckCount` 下发），
 * 界面不再自己数一遍。取到 0 就回空串：那一套要么没做过自检、要么没通过（没通过的本来就不会随链接下发），
 * 两种都不许界面替它说「已通过」。
 */
export function clientAutoCheckLabel(candidate: Pick<ClientBriefCandidate, 'autoCheckCount'>): string {
  const count = Number(candidate.autoCheckCount ?? 0);
  return count > 0 ? `这一套已通过 ${count} 项自动检查` : '';
}

/**
 * 预览地址解析：后端没配 `app.portal.candidate.preview-base-url` 时回的是相对路径（`/?reviewToken=…`），
 * 由前端按当前 origin 拼（`ClientBriefView` 注释里写明这是有意的退化路径）。
 * 绝对地址原样透传。空值给空串——调用方据此走「这一套没有可点开的预览」那条文案，不摆死链。
 */
export function resolvePreviewUrl(url: string | null | undefined, origin?: string): string {
  const value = (url ?? '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
  return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
}

/**
 * 三套「看得出差异」那句话的唯一拼法（拍板 5A）。
 *
 * 只用响应里真有的字段：`focus` 是 plan 落库的「这套侧重什么」原话，有就一个字不改地念；
 * 骨架 key 是它没落库时唯一看得见的差异证据。两套骨架同名时不许说「各不相同」——
 * 那正是客户看不出差别的那种场合。
 * 有几套就是没这句 focus（那一套在 plan 之前被门禁拦下）时，把「缺几套」也念出来，
 * 不许让这一句看起来像三套都齐了。
 *
 * 2026-10-22 全流程走查第 5 条：这一句是念给买单的人听的，所以里面一个内部词都不许有。
 * 客户选择页上曾经原样印着「（后端原话）」「差异原话属 P3 的 plan 字段」——
 * 「后端」「P3」「plan 字段」这些字出现在给客户的那一屏上，等于把工程内部的话术摊到客户面前。
 * 反例闸是 `site-brief-delivery-api.spec.ts` 里那条「四个分支都不许带内部词」，改文案先跑它。
 */
export function clientCandidatesDifference(candidates: ClientBriefCandidate[]): {
  text: string;
  /** 差异是否真的看得出来（有 focus 原话，或骨架各不相同） */
  visible: boolean;
} {
  const lines = candidates
    .filter(candidate => (candidate.focus || '').trim())
    .map(candidate => `第 ${candidate.candidateNo ?? '?'} 套：${(candidate.focus || '').trim()}`);
  if (lines.length) {
    const missing = candidates.length - lines.length;
    return {
      text: `这几套分别侧重什么：${lines.join(' ｜ ')}`
        + (missing ? ` ｜ 另外 ${missing} 套没有这句说明：那几套在出方案的第一步就没产出说明，请点开各自的预览对比` : ''),
      visible: true
    };
  }

  const skeletonKeys = candidates.map(candidate => (candidate.skeletonKey || '').trim());
  const known = skeletonKeys.filter(key => key);
  if (!known.length) {
    return {
      text: '这一屏看不出各套差在哪（这条链接只带了每套的名字、骨架与预览地址，没带侧重说明）',
      visible: false
    };
  }
  const distinct = new Set(known).size === candidates.length && known.length === candidates.length;
  // 比对「是不是同一份骨架」用 key，念给客户的那一句读名字（走查第 6 条：以前这里念的是
  // `corporate-base` 那串内部码，客户读不出任何信息）
  const perCard = candidates
    .map(candidate => `第 ${candidate.candidateNo ?? '?'} 套：${clientSkeletonLabel(candidate) || '这一套没有骨架名'}`)
    .join(' ｜ ');
  return distinct
    ? { text: `${candidates.length} 套的骨架各不相同，这就是这一屏看得见的差异：${perCard}`, visible: true }
    : {
        text: `这几套用的骨架是同一份（${perCard}）：这条链接没带各套的侧重说明，看不出差别请找平台对接人问`,
        visible: false
      };
}

export const clientBriefApi = {
  /** `GET /api/portal/public/brief/{token}`：令牌就是唯一凭证，没有任何身份参数 */
  fetch: (token: string) =>
    http.get<ClientBriefView>(`/portal/public/brief/${encodeURIComponent(token)}`),

  /**
   * `POST /api/portal/public/brief/{token}/decide`：恒回 200。
   * 返回值今天没有任何可据以判断「收没收到」的信息（静默失败是刻意的），所以这里声明成 void，
   * 视图**不许**把它当「平台已看到」的证据——那句文案写的是本地锁。
   */
  decide: (token: string, payload: ClientDecisionPayload) =>
    http.post<void>(`/portal/public/brief/${encodeURIComponent(token)}/decide`, payload)
};

// ------------------------------------------------------------------
// 超管面：转正交棒 / 重跑收口 / 客户答复留痕（portal:build:manage）
// ------------------------------------------------------------------

/**
 * `SiteBriefDeliveryService.HandoverItem`（Spec-D D5-3）：交棒清单里的一条落地页。
 *
 * <p>`key` 是稳定标识（showcase/case/company），中文 `label` 只给人读——界面拿 key 之外的一切
 * 原样显示，绝不按 label 判断（改了措辞就判错的教训后端注释里写着）。`url` 是后端拼好的那一条，
 * 前端不再抄第二份路径（I-1）；`urlRelative` 每条自带，因为这条链接要能被原样复制出去发给租户。</p>
 */
export interface HandoverItem {
  key: string;
  label: string;
  url: string;
  urlRelative: boolean;
  notice: string | null;
}

/** `SiteBriefDeliveryService.PromoteReceipt`：字段名逐一对齐后端 record，界面只渲染它给了的那些 */
export interface PromoteReceipt {
  briefId: number;
  siteId: number;
  siteName: string;
  briefStatus: string;
  briefStatusLabel: string | null;
  tenantName: string | null;
  /** 可复制的租户维护地址（§6.3 R-1 那条硬验收到这一刻才兑现） */
  maintenanceUrl: string;
  /** true = `admin-base-url` 没配，这条是相对路径：界面上必须原话说出来，别让人以为是完整地址 */
  maintenanceUrlRelative: boolean;
  archivedSiteIds: number[];
  revokedTokenCount: number;
  /** N-3 那句原话：另外几套归档、需要对比找平台 */
  archivedNotice: string;
  /** D5-3 那句原话：这三处是示意内容，请替换（逐条地址在 `handoverItems`） */
  handoverNotice: string | null;
  /** D5-3 的三条落地页：链接只用后端给的 `url`，这一头不拼第二份 */
  handoverItems: HandoverItem[] | null;
}

/** `RegenerateReceipt`（拍板 3A）：归档几套、撤几条令牌、下一步做什么，全是后端那句话 */
export interface RegenerateReceipt {
  briefId: number;
  archivedSiteIds: number[];
  revokedTokenCount: number;
  nextStepNotice: string;
}

/** `CancelReceipt`（2026-10-21 流程评审拍板②）：作废收口的回执，口径与重跑一致（归档不删） */
export interface CancelReceipt {
  briefId: number;
  briefStatus: string;
  briefStatusLabel: string;
  archivedSiteIds: number[];
  revokedTokenCount: number;
  notice: string;
}

/** `SiteBriefDeliveryController.DecisionView`：哪条链接、选了哪套、说了什么、什么时候（没有第五件事实） */
export interface BriefDecisionView {
  id: number;
  sessionId: number | null;
  chosenSiteId: number | null;
  chosenSiteName: string | null;
  candidateNo: number | null;
  clientNote: string | null;
  createdAt: string | null;
}

export const siteBriefDeliveryApi = {
  /**
   * `POST /api/admin/site-briefs/{id}/promote`。
   * 不带 body 时后端取「本单最近一条客户选定了的答复」——界面默认走的就是这一条路，
   * 只有超管要替客户定（客户打电话答复）时才传 `siteId`，两个都给会被后端中文拒。
   */
  promote: (id: number, form: { decisionId?: number | null; siteId?: number | null } = {}) =>
    http.post<PromoteReceipt>(`/admin/site-briefs/${id}/promote`, {
      decisionId: form.decisionId ?? null,
      siteId: form.siteId ?? null
    }),

  /** `POST /api/admin/site-briefs/{id}/regenerate`：只收口（归档 + 撤令牌 + 回到 ready），不调模型、不花钱 */
  regenerate: (id: number) => http.post<RegenerateReceipt>(`/admin/site-briefs/${id}/regenerate`),

  /**
   * `POST /api/admin/site-briefs/{id}/cancel`：客户不做了的收尾（拍板②）。
   * 原因必填（后端中文拒空串），候选全部归档（不删）+ 令牌全撤，需求单落 cancelled。
   */
  cancel: (id: number, reason: string) =>
    http.post<CancelReceipt>(`/admin/site-briefs/${id}/cancel`, { reason }),

  /** `GET /api/admin/site-briefs/{id}/decisions`：客户答复留痕（不回 ip_hash，那一列不是给人看的） */
  decisions: (id: number) => http.get<BriefDecisionView[]>(`/admin/site-briefs/${id}/decisions`)
};

/** 这一单有没有「客户真的选了某一套」的留痕：转正按钮只认这一条判据，不按状态猜 */
export function hasChosenDecision(rows: BriefDecisionView[] | null | undefined): boolean {
  return (rows ?? []).some(row => row.chosenSiteId != null);
}

/**
 * 本轮按后端源码逐字核对过 / 纯靠猜的两份清单（任务要求列出来给人审）。
 * 视图里出现任何一处「补字段」都算越界——要改先改这里。
 */
export const GUESSED_SHAPES = [
  'ClientBriefView.Candidate 的 focus / tone 两根已改成后端真回的那两个键名（2026-10-13 现场用免鉴权读口对账：'
    + '回包里每套都带 focus 原话与 tone 档位）。这一头以前猜的是 `differentiation`——响应里从来没这个名字，'
    + '于是客户那一屏永远念「后端没随这条链接下发差异说明」，是一句假话。',
  '公开两口的前端地址形态 —— 后端只定义了 API 路径；选择页自身的路由（/brief/:token，令牌在路径里）是本前端定的。',
  'previewUrl 的相对路径退化 —— 按「未配 app.portal.candidate.preview-base-url 时由前端按当前 origin 拼」的注释实现；'
    + '若门户与管理前端不同源，必须后端配那一项，前端拼不出来也不该拼。',
  'decide 的回执语义 —— 后端恒 200、recorded 不进响应体，所以前端无法知道「平台收没收到」。'
    + '提交后的文案因此只承诺本地锁（不再接受第二次答复），不承诺已入库。',
  'promote 响应体里今天的形状 —— 按 SiteBriefDeliveryService.PromoteReceipt 的字段名逐字对齐（含 maintenanceUrlRelative，'
    + 'Spec-D D5-3 起还有 handoverNotice/handoverItems 两格，每条链接的 url 也只认后端那一份）。'
    + '它随 P4 一起在建，字段若变这里先红，不会把错字段演成空值。',
  '预览令牌的手动口（§5 的发放与撤销）后端已经建出来了：'
    + '声明在 `api/siteBriefs` 的 briefGenerationApi.previewLink / revokePreviewLinks（同一个 record 形状，'
    + '不在这份文件里写第二份）。D0-5 之后读口一条都不签，画廊只在人点「发放/重新发放预览地址」时调一次。'
].join('\n');
