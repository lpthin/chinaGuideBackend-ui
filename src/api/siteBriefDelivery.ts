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
 * 后端注释明确**故意没有**缩略图/截图字段（§6.7 内部预览域截不了图），也故意没有差异说明那一格
 * （差异原话在 P3 的 plan JSON 里，`site` 表上没列）——`differentiation` 是我为拍板 5A 预留的
 * **可选**读取口，后端没回时界面照实说「这一份响应里没有」，绝不本地编一句。
 */
export interface ClientBriefCandidate {
  siteId: number;
  candidateNo: number | null;
  name: string | null;
  skeletonKey: string | null;
  /** 这一套自己的预览地址（令牌绑站不绑页）；未配 preview-base-url 时是相对路径，由前端按当前 origin 拼 */
  previewUrl: string | null;
  /** 猜测字段（后端今天没有）：plan 落库的「这套侧重什么」原话，有就一个字不改地显示 */
  differentiation?: string | null;
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
 * 只用响应里真有的字段：骨架 key 是 P2 给得到的差异证据（后端注释原话「P2 只给了我 skeletonKey」）；
 * plan 的差异原话若哪天随 `differentiation` 下来，就原话显示，界面一个字都不改写。
 * 两套骨架同名时不许说「各不相同」——那正是客户看不出差别的那种场合。
 */
export function clientCandidatesDifference(candidates: ClientBriefCandidate[]): {
  text: string;
  /** 差异是否真的看得出来（骨架各不相同，或后端给了差异原话） */
  visible: boolean;
} {
  const lines = candidates
    .filter(candidate => candidate.differentiation && candidate.differentiation.trim())
    .map(candidate => `${candidate.candidateNo ?? '?'}：${(candidate.differentiation || '').trim()}`);
  if (lines.length) return { text: `这套侧重什么（后端原话）：${lines.join(' ｜ ')}`, visible: true };

  const skeletonKeys = candidates.map(candidate => (candidate.skeletonKey || '').trim());
  const known = skeletonKeys.filter(key => key);
  if (!known.length) {
    return {
      text: '这一份响应里没有写出各套差在哪（后端今天只回骨架名与预览地址，差异原话属 P3 的 plan 字段）',
      visible: false
    };
  }
  const distinct = new Set(known).size === candidates.length && known.length === candidates.length;
  const perCard = candidates
    .map(candidate => `第 ${candidate.candidateNo ?? '?'} 套：${(candidate.skeletonKey || '没有骨架名').trim()}`)
    .join(' ｜ ');
  return distinct
    ? { text: `${candidates.length} 套的骨架各不相同，这就是这一屏看得见的差异：${perCard}`, visible: true }
    : {
        text: `这几套用的骨架是同一份（${perCard}）：后端没随这条链接下发差异说明，看不出差别请回平台问`,
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
}

/** `RegenerateReceipt`（拍板 3A）：归档几套、撤几条令牌、下一步做什么，全是后端那句话 */
export interface RegenerateReceipt {
  briefId: number;
  archivedSiteIds: number[];
  revokedTokenCount: number;
  nextStepNotice: string;
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
  'ClientBriefView.Candidate.differentiation —— 后端今天的 record 里没有这一列（类注释写明故意不给，留给 P3 补读取口）。'
    + '界面按可选读取：有就原话显示，没有就写「这一份响应里没有」。',
  '公开两口的前端地址形态 —— 后端只定义了 API 路径；选择页自身的路由（/brief/:token，令牌在路径里）是本前端定的。',
  'previewUrl 的相对路径退化 —— 按「未配 app.portal.candidate.preview-base-url 时由前端按当前 origin 拼」的注释实现；'
    + '若门户与管理前端不同源，必须后端配那一项，前端拼不出来也不该拼。',
  'decide 的回执语义 —— 后端恒 200、recorded 不进响应体，所以前端无法知道「平台收没收到」。'
    + '提交后的文案因此只承诺本地锁（不再接受第二次答复），不承诺已入库。',
  'promote 响应体里今天的形状 —— 按 SiteBriefDeliveryService.PromoteReceipt 的字段名逐字对齐（含 maintenanceUrlRelative）。'
    + '它随 P4 一起在建，字段若变这里先红，不会把错字段演成空值。',
  '重发/撤销预览令牌的手动口（§5 的 POST /api/admin/sites/{id}/preview-links）后端今天还没有：'
    + '本文件不写这个函数，界面上也就没有「重发链接」按钮——拍板 11A 的撤销已由 promote/regenerate 内部兑现。'
].join('\n');
