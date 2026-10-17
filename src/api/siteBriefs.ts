import http, { currentAuthToken } from './http';
import type { SectionState } from './portalSections';

/**
 * 前采需求单与词表（Spec「建站流程重构」§4.1 / §5 / I-1）。
 *
 * <p>这里<strong>没有任何中文选项字面量</strong>：13 题的题目名、选项、单选还是多选、候选上限、
 * 演示内容档位、状态中文标签，全部来自后端那一份词表（超管侧 `GET /admin/site-briefs/vocabulary`，
 * 租户侧/站点画像下拉读 `GET /portal/vocabulary` 的同一份 `VocabularyView`）。前端一旦抄一份，
 * 超管改完词表界面上就还是老字，而 `site-brief-vocabulary.spec.ts` 会红。</p>
 *
 * <p>本文件是「后端契约 ↔ 界面模型」的<b>适配层</b>：后端是契约方。题目 key（词表里的 `key`，
 * snake_case）到需求单入参字段（`SiteBriefForm`，camelCase 平铺字段）的映射，只有这一处认得
 * 具体题目名（industry / languages / reference_urls / notes）——视图里一个题目 key 都不许出现，
 * 全部按 `q.key` 动态走。把映射写在这里而不是视图里，正是为了让 `site-brief-vocabulary.spec.ts`
 * 扫源码时视图那几份文件干净（题目 key 字面量只允许出现在本适配层）。</p>
 *
 * <p>`requirements_summary` 一律由后端渲染：界面右侧那段话只调 `summary-preview` 取，
 * 不许在这里或视图里自己拼句——拼了就等于抄了第二份词表。</p>
 */

/**
 * 后端 SiteBriefVocabulary.SELECT_KINDS 的镜像（V133 起八种）：
 * textarea 是多行原话、pages 是页面清单逐条编辑、block-order 是首页区块顺序——
 * 这三样都是「格子形状」而不是新题目，视图按 q.select 分支渲染，题目名一个都不认。
 */
export type BriefSelectKind =
  | 'single' | 'multi' | 'cascade' | 'text' | 'textarea' | 'color' | 'pages' | 'block-order';

/** 词表里的一个选项：code 是落库值，label 只用来显示（中文真相在后端） */
export interface BriefVocabularyOption {
  code: string;
  label: string;
  /** cascade 题的第二级；其它形态没有这个字段 */
  children?: BriefVocabularyOption[];
  /** 这个选项由哪些区块兑现（后端 §4.1 的「兑现证据」，前端只透传不解释） */
  blockKeys?: string[];
  /** 这个选项绑定的集合数据源名；同上，前端不消费它的语义 */
  dataSource?: string;
}

/** 后端 SiteBriefVocabulary.Question 的镜像：key/label/select/required/evidence/options，字段名逐一对齐 */
export interface BriefVocabularyQuestion {
  key: string;
  label: string;
  /**
   * 所属分段（basic/structure/content/constraint 之一，V133 起后端每题下发）。
   * 段名中文只认词表顶层 `groups` 那一份；这里没有的段（存量/新加的段）界面兜底露码，不编段名。
   */
  group?: string | null;
  /** single/multi/cascade/text/color；出现不认识的新形态时界面退化成输入框，不猜语义 */
  select: BriefSelectKind;
  /** 必填题：录入页据此打星（真正的必填闸在服务端确定性渲染器里） */
  required: boolean;
  /** 兑现证据（后端「这个选项/这道题由什么兑现」的一句话），录入页当副标题原样透传，不改写 */
  evidence?: string | null;
  options: BriefVocabularyOption[];
}

/** 演示内容档位（拍板 7：默认 full）；label 是后端词表给的中文，字段名对齐后端 record */
export interface DemoContentMode {
  value: string;
  label: string;
  articleCount: number;
  caseCount: number;
}

/** 后端 SiteBriefService.VocabularyView 的镜像：顶层字段名逐一对齐 */
export interface SiteBriefVocabulary {
  questions: BriefVocabularyQuestion[];
  /**
   * 分段码 → 中文段名（V133 / Spec-D D1：`groups`，LinkedHashMap 保序下发）。
   * 录入页的四段标题与锚点导航只读这一份——段名与「哪题属哪段」都是词表资产，界面抄一份就是第二个真相。
   */
  groups?: Record<string, string> | null;
  /** 站点画像专用词表（目标市场 regions / 9 项商业模式 business_models）——13 题里没有，画像下拉读这里 */
  siteProfile: BriefVocabularyQuestion[];
  /** 候选套数的硬上限（配置 app.portal.candidate.max-count，界面上限取它） */
  candidateMaxCount: number;
  demoContentModes: DemoContentMode[];
  /** 需求单状态的中文标签（draft→草稿…）：状态列只读这里，取不到宁可露码也不编第二份 */
  statusLabels: Record<string, string>;
}

/**
 * 需求单读出形状（后端 SiteBriefView 的镜像）：字段名与 SiteBriefForm 逐一对齐 + statusLabel。
 * 视图把它回填成表单即可编辑；`siteId` 只有读出口有（建单入参不带，转正是后链路回填）。
 */
export interface SiteBrief {
  id: number;
  tenantId: number | null;
  siteId: number | null;
  status: string;
  /** 后端带回的状态中文（取自词表 statusLabels）；界面列表另有 statusLabels 兜底 */
  statusLabel?: string | null;
  candidateCount: number;
  demoContentMode: string;
  industry: string | null;
  subIndustry: string | null;
  audiences: string[];
  primaryGoal: string | null;
  mustHave: string[];
  tone: string | null;
  languages: string[];
  scale: string | null;
  avoid: string[];
  channels: string[];
  businessModel: string | null;
  brandColor: string | null;
  referenceUrls: string[];
  notes: string | null;
  /** 后端渲染喂模型的那段中文；界面只展示、绝不自己拼 */
  requirementsSummary: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  // ---- V133（Spec-D D1）：与后端 SiteBriefView 末尾的 11 栏逐字对齐；录入页据此原样回填 ----
  brandName: string | null;
  businessScope: string | null;
  audienceNote: string | null;
  uvp: string | null;
  trustAnchors: string[];
  /** 结构化两栏：后端把 JSON 列还原成条目/有序区块名再回（SiteBriefIntake 的形状） */
  pagePlan: BriefPagePlanEntry[] | null;
  homeLayout: string[] | null;
  colorSecondary: string | null;
  fontHint: string | null;
  complianceNote: string | null;
  notDoing: string[];
}

/**
 * 写口 payload（POST/PUT/summary-preview 共用）：后端 SiteBriefForm 是平铺字段，没有 selections 袋。
 * 视图按 `q.key` 收集勾选，交给 `buildBriefForm` 拍平成这里这份形状后再发。
 */
export interface SiteBriefForm {
  tenantId: number | null;
  /** 建单只接受 draft / ready；编辑口只允许在这两个状态之间挪 */
  status?: string | null;
  candidateCount: number;
  demoContentMode: string;
  industry: string | null;
  subIndustry: string | null;
  audiences: string[];
  primaryGoal: string | null;
  mustHave: string[];
  tone: string | null;
  /** 词表是单选，这里仍按数组发（后端最多收一个元素） */
  languages: string[];
  scale: string | null;
  avoid: string[];
  channels: string[];
  businessModel: string | null;
  /** HEX 色值或 ai（AI 决定） */
  brandColor: string | null;
  referenceUrls: string[];
  notes: string | null;
  // ---- V133（Spec-D D1）：与后端 SiteBriefForm 的新字段逐字对齐（键名即 site_build_brief 新列的驼峰） ----
  /** 品牌或公司全称（本期两题必填之一；D1 起录入页只有这一题与 primary_goal 打星） */
  brandName?: string | null;
  businessScope?: string | null;
  audienceNote?: string | null;
  uvp?: string | null;
  trustAnchors?: string[];
  pagePlan?: BriefPagePlanEntry[];
  homeLayout?: string[];
  /** 取值规则与 brandColor 逐字相同（#rrggbb / #rrggbbaa 或 ai） */
  colorSecondary?: string | null;
  /** 字体调性只存选项码这一个字符串：界面不引任何外部字体文件，落地由 theme token 负责 */
  fontHint?: string | null;
  complianceNote?: string | null;
  /** 本期不做（与 avoid「永远别做」分两列，混成一份二期就分不清谁被暂缓了） */
  notDoing?: string[];
}

/**
 * 页面清单的一页（后端 `SiteBriefIntake.PagePlanEntry` 的镜像，字段名逐字对齐）。
 *
 * <p>为什么要单独 export 这一形状：page_plan 有三个读者（录入页的行编辑器、后端校验、
 * 摘要渲染），「一页该有哪些字段」只允许有一个答案；界面对着一份镜像类型填，
 * 就不会出现「界面收第七个字段、后端 record 里没有」。</p>
 */
export interface BriefPagePlanEntry {
  /** 页的稳定标识：清单内唯一，也是「这一页是不是 home/contact」的引用点 */
  key: string;
  /** 对外的 URL 段（会直接进客户站地址栏） */
  slug: string;
  title: string;
  /** 这一页干什么（给模型的一句话，不是页面正文） */
  purpose: string;
  /** 挂哪个栏目；可空：首页与自定义页本来就不属于任何栏目 */
  sectionKey: string;
  /** 这一页要哪些区块（可空＝交给规划的 plan 步骤挑） */
  blocks: string[];
  /** high / medium / low；可空＝客户没排先后 */
  priority: string;
}

export const siteBriefsApi = {
  list: (params: { tenantId?: number | null; status?: string | null } = {}) =>
    http.get<SiteBrief[]>('/admin/site-briefs', {
      params: {
        tenantId: params.tenantId ?? undefined,
        status: params.status?.trim() || undefined
      }
    }),

  get: (id: number) => http.get<SiteBrief>(`/admin/site-briefs/${id}`),

  create: (form: SiteBriefForm) => http.post<SiteBrief>('/admin/site-briefs', form),

  update: (id: number, form: SiteBriefForm) => http.put<SiteBrief>(`/admin/site-briefs/${id}`, form),

  /** 右侧「AI 将理解的这段话」的唯一来源：零模型调用，纯后端确定性渲染 */
  summaryPreview: (form: SiteBriefForm) =>
    http.post<{ requirementsSummary: string }>('/admin/site-briefs/summary-preview', form),

  /**
   * 录入页「这一页属于哪个栏目」的那份词表（形状复用 `portalSections.ts` 的 `SectionState`，
   * 栏目这件事的接口面仍然只有一处）。
   *
   * <p>不取租户侧的 `/portal/sections`：那一口按登录上下文解析租户，超管没在右上角选租户时
   * 回 `TENANT_REQUIRED`，于是录单页一进来就红一句「请先选择租户」——而这一单的租户在单上写着。
   * 传 briefId 时后端按这一单绑的站点回覆盖态，没绑站点（或不传）回的是纯词表默认，不是空列表。</p>
   */
  sectionCatalogue: (briefId?: number | null) =>
    http.get<SectionState[]>('/admin/site-briefs/section-catalogue', {
      params: { briefId: briefId ?? undefined }
    })
};

export const vocabularyApi = {
  /** 超管口：需求单录入页唯一词表来源（含 candidateMaxCount 与演示内容档位） */
  adminVocabulary: () => http.get<SiteBriefVocabulary>('/admin/site-briefs/vocabulary'),

  /** 租户口：与 admin 口同一份 VocabularyView，鉴权只到「登录」；站点画像/企业信息下拉读这一份 */
  portalVocabulary: () => http.get<SiteBriefVocabulary>('/portal/vocabulary')
};

/**
 * 站点画像/企业信息那两屏消费的五个题目 key（值是后端词表里的真名，不是界面字段名）。
 *
 * <p>industry / audiences / languages 是 13 题里的题（在 `questions`）；regions 与 business_models
 * 是站点画像专用词表、13 题里没有（在 `siteProfile`）。`findProfileQuestion` 两处都查，
 * 所以「哪一题喂哪一个下拉」的映射只认后端真名，界面字段名（targetRegions/targetAudience…）
 * 与题目 key 无关。</p>
 */
export const PROFILE_QUESTION_KEYS = {
  industry: 'industry',
  targetRegions: 'regions',
  targetAudience: 'audiences',
  businessModel: 'business_models',
  // 「站点主语言」这一题也在同一份词表里（Spec-C §4.1 第 9 题）：语言清单以前在
  // SitesView 与 CompanyInfoView 各抄了一份，逐字相同——第三处抄本就是第三个真相。
  languages: 'languages'
} as const;

/**
 * 按 key 找题：先查 13 题 `questions`，再查站点画像 `siteProfile`（目标市场/9 项商业模式在这里）。
 * 找不到回 null（调用方据此走「词表没取到」的降级，不编选项）。一处封装，两个画像页共用。
 */
export function findProfileQuestion(
  vocabulary: SiteBriefVocabulary | null,
  key: string
): BriefVocabularyQuestion | null {
  if (!vocabulary) return null;
  return (
    vocabulary.questions?.find(question => question.key === key) ??
    vocabulary.siteProfile?.find(question => question.key === key) ??
    null
  );
}

// ------------------------------------------------------------------
// 录入页 <-> 需求单入参的映射（题目 key -> SiteBriefForm 平铺字段）
// ------------------------------------------------------------------

/** snake_case 题目 key -> camelCase 入参字段名（primary_goal -> primaryGoal） */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

/**
 * 录入页循环渲染的题目：排除参考站与补充说明这两块——它们有专用控件（0~3 行 URL、可空 textarea），
 * 不在通用题目循环里再渲一遍。被排除的 key 是后端题目 key，只有这一处（适配层）认得它们，
 * 视图里因此一个题目 key 字面量都不出现。
 */
export const INTAKE_STATIC_KEYS = ['reference_urls', 'notes'] as const;

/** 这道题是不是「走元信息、不进勾选袋」的那两块（参考站 / 补充说明） */
export function isIntakeStaticKey(key: string): boolean {
  return (INTAKE_STATIC_KEYS as readonly string[]).includes(key);
}

/**
 * 那两块专用控件各自渲哪一张卡。
 *
 * <p>存在的理由：录入页改成「一屏一题」之后，参考站与补充说明也各自占一屏，
 * 于是模板里必须能问「当前这一题该摆哪张卡」。判据只有适配层认得题目 key，
 * 视图拿到的是卡片身份——视图里因此一处题目 key 字面量都不出现（I-1）。</p>
 */
export type IntakeStaticCard = 'references' | 'remarks';

export function intakeStaticCard(key: string): IntakeStaticCard | null {
  if (key === 'reference_urls') return 'references';
  if (key === 'notes') return 'remarks';
  return null;
}

export function intakeLoopQuestions(
  vocabulary: SiteBriefVocabulary | null
): BriefVocabularyQuestion[] {
  return (vocabulary?.questions ?? []).filter(q => !INTAKE_STATIC_KEYS.includes(q.key as typeof INTAKE_STATIC_KEYS[number]));
}

/**
 * 把按 `q.key` 收集的勾选结果 + 头部元信息，拍平成后端 SiteBriefForm 的平铺字段。
 *
 * <p>三处结构差异在这里消化，其余题目一律 snake→camel 直映：
 * ① 级联 `industry` 的数组拆成 industry + subIndustry；
 * ② 单选 `languages` 包成数组（后端列是 JSON、最多一个元素）；
 * ③ 参考站/补充说明从入参元信息取（不进勾选袋）。</p>
 */
export function buildBriefForm(
  meta: {
    tenantId: number | null;
    status?: string | null;
    candidateCount: number;
    demoContentMode: string;
    notes?: string | null;
    referenceUrls?: string[];
  },
  selections: Record<string, string | string[]>
): SiteBriefForm {
  const form: Record<string, unknown> = {
    tenantId: meta.tenantId,
    candidateCount: meta.candidateCount,
    demoContentMode: meta.demoContentMode,
    referenceUrls: (meta.referenceUrls ?? []).map(url => String(url).trim()).filter(Boolean),
    notes: meta.notes && String(meta.notes).trim() ? meta.notes : null
  };
  if (meta.status) form.status = meta.status;

  Object.entries(selections).forEach(([key, value]) => {
    if (INTAKE_STATIC_KEYS.includes(key as typeof INTAKE_STATIC_KEYS[number])) return;
    if (key === 'industry') {
      const arr = Array.isArray(value) ? value : value ? [value] : [];
      form.industry = arr[0] || null;
      form.subIndustry = arr[1] || null;
    } else if (key === 'languages') {
      const single = Array.isArray(value) ? value[0] : value;
      form.languages = single ? [single] : [];
    } else if (Array.isArray(value)) {
      form[snakeToCamel(key)] = value.filter(v => v !== '' && v != null);
    } else {
      form[snakeToCamel(key)] = value === '' ? null : value;
    }
  });

  return form as unknown as SiteBriefForm;
}

/**
 * 后端 `SiteBriefVocabulary.EDITABLE_STATUSES` 的前端镜像：draft / ready 之外这份单子已经
 * 「不属于录单人了」（在跑的、发给客户的、客户选完的、交付完的），PUT 必然被中文拒。
 *
 * <p>这里只放**状态码**（ASCII，落库值），不放锁单理由那句话——理由只有后端知道
 * （`statusLockReason`），词表响应今天也没下发它，前端复述一句就是编第二份说法。
 * 界面据此决定「给不给编辑入口」，真正的闸仍然在服务端。</p>
 */
export const EDITABLE_BRIEF_STATUSES = ['draft', 'ready'] as const;

export function briefIsEditable(status: string | null | undefined): boolean {
  return !!status && (EDITABLE_BRIEF_STATUSES as readonly string[]).includes(status);
}

/**
 * 后端「补跑只在哪几档开放」的前端镜像（`SiteProposalOrchestrator.refuseIfNothingToRerun`）：
 * ready（待出方案）与 awaiting_client（等客户确认）。
 *
 * <p>为什么要有这一份而不是让按钮永远亮着等后端拒：客户已经选定（decided）或已经转正交付
 * （promoted）的单子上再补一套候选，会跟交付凭证打架——后端那一刀是明令的。界面摆一个
 * <b>必被拒</b>的把手，等于让超管亲手去撞一次门禁再拿回一句红字。</p>
 *
 * <p>这里只镜像状态码这一件事。「这一轮里到底有没有失败的那一套」不在这里判，
 * 由调用方按 `progress` 真回的那几行判（同一份读数，不是第二份真相）；真正的闸仍在服务端。</p>
 */
export const RERUN_ALLOWED_BRIEF_STATUSES = ['ready', 'awaiting_client'] as const;

export function briefAllowsProposalRerun(status: string | null | undefined): boolean {
  return !!status && (RERUN_ALLOWED_BRIEF_STATUSES as readonly string[]).includes(status);
}

/**
 * 需求单状态的中文：词表有这一码就用，没有就**把原码原样露出来**。
 * 录入页头部那一格用它（那里宁可露码也不要多一句「状态未知」）。
 */
export function briefStatusLabelOrCode(
  vocabulary: SiteBriefVocabulary | null,
  code: string | null | undefined
): string {
  if (!code) return '';
  return vocabulary?.statusLabels?.[code] || code;
}

/**
 * 需求单状态的中文：优先级 后端带回的 statusLabel > 词表 statusLabels > 「状态未知（原码 x）」。
 * 取不到绝不自己编一份 draft→草稿 的映射（I-1），但一定把原码露出来给人看。
 */
export function briefStatusLabel(
  vocabulary: SiteBriefVocabulary | null,
  code: string | null | undefined,
  fromServer?: string | null
): string {
  if (fromServer) return fromServer;
  if (!code) return '状态未知（原码 ?）';
  const label = vocabulary?.statusLabels?.[code];
  return label || `状态未知（原码 ${code}）`;
}

/**
 * 把需求单上的一个选项码换成词表里的中文。级联码命中子项时把父级一起带出来
 * （父子两级用「 / 」连），词表里查不到的码原样透出——单子可能是改词表之前录的，
 * 宁可露码也不编一个中文给人（这里出现任何选项中文就等于抄了第二份词表）。
 */
export function briefOptionLabel(
  question: BriefVocabularyQuestion,
  code: string
): { text: string; known: boolean } {
  const direct = (question.options ?? []).find(option => option.code === code);
  if (direct) return { text: direct.label, known: true };
  for (const option of question.options ?? []) {
    const child = (option.children ?? []).find(item => item.code === code);
    if (child) return { text: `${option.label} / ${child.label}`, known: true };
  }
  return { text: code, known: false };
}

/**
 * 只翻这一码自己的名（命中子项也不带父级）：级联答案两级都在 codes 里时用这个，
 * 免得父名出现两遍。查不到照原码透出。
 */
function bareOptionLabel(
  question: BriefVocabularyQuestion,
  code: string
): { text: string; known: boolean } {
  const top = (question.options ?? []).find(option => option.code === code);
  if (top) return { text: top.label, known: true };
  for (const option of question.options ?? []) {
    const child = (option.children ?? []).find(item => item.code === code);
    if (child) return { text: child.label, known: true };
  }
  return { text: code, known: false };
}

/** 详情读回的一行：题目名 + 人话答案（答案里的码一律经词表换成中文） */
export interface BriefAnswerRow {
  key: string;
  label: string;
  evidence: string;
  required: boolean;
  /** 已经翻成人话的答案；没答就是空串，由界面决定写「没勾」还是「没填」 */
  value: string;
  /** 这一行的答案里有词表查不到的码（界面据此原话标注，不藏着） */
  unknown: boolean;
}

/**
 * 需求单详情「按词表读回 13 题」的唯一实现点。
 *
 * <p>为什么在适配层而不是视图里：答案与字段的对应关系（级联拆两级、语言取数组第一个、
 * 参考站/补充说明走元信息）只有这里认得题目 key，视图拿到的就是「题名 + 人话」，
 * 模板里一个题目 key、一个选项中文都不出现（`site-brief-vocabulary.spec.ts` 扫源码）。</p>
 */
export function briefAnswerRows(
  vocabulary: SiteBriefVocabulary | null,
  brief: SiteBrief
): BriefAnswerRow[] {
  return (vocabulary?.questions ?? []).map(question => {
    const row: BriefAnswerRow = {
      key: question.key,
      label: question.label,
      evidence: question.evidence || '',
      required: question.required === true,
      value: '',
      unknown: false
    };
    if (isIntakeStaticKey(question.key)) {
      // 参考站与补充说明是元信息字段，不进勾选袋（形状上仍是词表里的那两道题）
      const urls = question.key === INTAKE_STATIC_KEYS[0] ? brief.referenceUrls ?? [] : [];
      row.value = urls.length ? urls.join('、') : String(brief.notes ?? '');
      return row;
    }
    if (question.select === 'text' || question.select === 'textarea' || question.select === 'color') {
      row.value = String(readBriefSelections([question], brief)[question.key] ?? '');
      return row;
    }
    if (question.select === 'block-order') {
      // 首页区块顺序：库里存的是一串区块 key，词表在这道题上【没有】options
      // （区块名来自组件库那一格，不是这道题的勾选袋）。拿它去查本题选项必然查不到，
      // 于是每单都被标一句「词表里已经没有这个码了」——那是假报警（10-16 走查现场）。
      // 顺序本身是这一格的意思，所以按「 → 」连，不重排、不翻译。
      const picked = readBriefSelections([question], brief)[question.key];
      const keys = Array.isArray(picked) ? picked.map(String) : picked ? [String(picked)] : [];
      row.value = keys.filter(Boolean).join(' → ');
      return row;
    }
    if (question.select === 'pages') {
      // 页面清单是对象数组，String() 出来是「[object Object]」三行（10-16 走查现场）：
      // 逐页取「标题（/网址段）」，标题没填就退回 key——这两个字段都在这一行里，不是新造的事实。
      const raw = (brief as unknown as Record<string, unknown>)[snakeToCamel(question.key)];
      const pages = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
      row.value = pages
        .map(page => {
          const title = String(page?.title ?? '').trim() || String(page?.key ?? '').trim();
          const slug = String(page?.slug ?? '').trim();
          return title ? (slug ? `${title}（/${slug}）` : title) : '';
        })
        .filter(Boolean)
        .join('、');
      return row;
    }
    const picked = readBriefSelections([question], brief)[question.key];
    const codes = Array.isArray(picked) ? picked : picked ? [String(picked)] : [];
    if (question.select === 'cascade' && codes.length > 1) {
      // 级联库里存的就是「父码 + 子码」两级：每级各翻各的名再用「 / 」连，
      // 走 briefOptionLabel 会把子码再带一次父名（大类 / 大类 / 子类），那是重复不是人话
      const parts = codes.map(code => {
        const bare = bareOptionLabel(question, code);
        if (!bare.known) row.unknown = true;
        return bare.text;
      });
      row.value = parts.join(' / ');
      return row;
    }
    const parts = codes.map(code => {
      const resolved = briefOptionLabel(question, code);
      if (!resolved.known) row.unknown = true;
      return resolved.text;
    });
    // 多选题用「、」连（并列的几条）；单选只有一条
    row.value = parts.join('、');
    return row;
  });
}

/**
 * 演示内容档位的中文：只取词表 `demoContentModes.label` 那一句原话，查不到就露码。
 * 数量口径（几篇文章几条案例）由后端写在这一句话里，这里不再拼第二遍。
 */
export function briefDemoModeText(
  vocabulary: SiteBriefVocabulary | null,
  mode: string | null | undefined
): string {
  if (!mode) return '没填（保存时由后端按系统默认档落）';
  const found = (vocabulary?.demoContentModes ?? []).find(entry => entry.value === mode);
  return found ? found.label : mode;
}

/**
 * 后端读出的需求单（平铺字段）回填成录入页的勾选袋（按 `q.key`），也是详情读回答案的取值口径。
 * 与 buildBriefForm 互逆，题目 key 的三处结构差异在这里同样消化。
 */
export function readBriefSelections(
  questions: BriefVocabularyQuestion[],
  brief: SiteBrief
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  questions.forEach(question => {
    const key = question.key;
    if (INTAKE_STATIC_KEYS.includes(key as typeof INTAKE_STATIC_KEYS[number])) return;
    if (key === 'industry') {
      out[key] = [brief.industry, brief.subIndustry].filter(Boolean) as string[];
    } else if (key === 'languages') {
      out[key] = brief.languages?.[0] ?? '';
    } else {
      const raw = (brief as unknown as Record<string, unknown>)[snakeToCamel(key)];
      out[key] = Array.isArray(raw) ? (raw as string[]) : raw == null ? '' : String(raw);
    }
  });
  return out;
}

// ------------------------------------------------------------------
// Spec-D D1：page_plan / home_layout 的本地即时提示（镜像判据，不是保存闸）
// ------------------------------------------------------------------
//
// 下面这组常量与函数是后端 `SiteBriefIntake` 的**前端镜像**，目的只有一个：让人在点保存之前
// 就看见「这一条多半会被拒」。真正的判据永远在服务端——镜像可能慢半拍，所以界面既不许说
// 「本地校验过了就能存」，也不许在保存失败时把后端的中文原因换成自己编的话
// （视图把 Error.message 原样列出来，那是唯一一份拒单理由）。

/** 页面清单上限（镜像 SiteBriefIntake.PAGE_PLAN_MAX） */
export const PAGE_PLAN_MAX = 12;
/** 首页区块顺序上限（镜像 HOME_LAYOUT_MAX） */
export const HOME_LAYOUT_MAX = 16;
/** 页面标题长度（镜像 TITLE_MAX） */
export const PAGE_TITLE_MAX = 60;
/** 页面用途长度（镜像 PURPOSE_MAX） */
export const PAGE_PURPOSE_MAX = 200;
/** 优先级三档（镜像 PRIORITIES；中文说法后端没下发，界面就露这几个码 + 一句「留空＝没排先后」，不编映射） */
export const PAGE_PRIORITY_CODES = ['high', 'medium', 'low'] as const;
/** 非空清单必须含的两页（镜像 KEY_HOME / KEY_CONTACT：首页是访客点开链接第一眼，联系页是主目标的落点） */
export const REQUIRED_PAGE_KEYS = ['home', 'contact'] as const;
/** key/slug 的形状（镜像后端 SLUG 那一条：它会直接出现在客户网站的地址栏里） */
export const PAGE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/;

/** 行编辑器加一页时的空白形状：与 {@link BriefPagePlanEntry} 逐字段对齐，blocks 给新数组防共享引用 */
export function emptyPagePlanEntry(): BriefPagePlanEntry {
  return { key: '', slug: '', title: '', purpose: '', sectionKey: '', blocks: [], priority: '' };
}

/** 整行一个字没填：提交前丢掉这种行（后端对 null 条目是中文拒，对全空行同样拒「key 没填」） */
export function isBlankPagePlanEntry(entry: BriefPagePlanEntry): boolean {
  return !String(entry.key ?? '').trim() && !String(entry.slug ?? '').trim()
    && !String(entry.title ?? '').trim() && !String(entry.purpose ?? '').trim()
    && !String(entry.sectionKey ?? '').trim() && !String(entry.priority ?? '').trim()
    && (entry.blocks ?? []).every(block => !String(block ?? '').trim());
}

/**
 * 提交前的一页：丢全空行、逐字段 trim（含 blocks 每项）。
 * 只 trim 不删半空的行——「填了一半」是要被后端逐页点名的一页，规范化偷偷丢掉它就是界面谎报。
 */
export function cleanPagePlanForSubmit(plan: BriefPagePlanEntry[]): BriefPagePlanEntry[] {
  // 存量单没填过时读回来可能是空串（readBriefSelections 对 null 列的回填形状）：按空清单处理，不炸
  return (Array.isArray(plan) ? plan : [])
    .filter(entry => entry && !isBlankPagePlanEntry(entry))
    .map(entry => ({
      key: String(entry.key ?? '').trim(),
      slug: String(entry.slug ?? '').trim(),
      title: String(entry.title ?? '').trim(),
      purpose: String(entry.purpose ?? '').trim(),
      sectionKey: String(entry.sectionKey ?? '').trim(),
      blocks: (entry.blocks ?? []).map(block => String(block ?? '').trim()).filter(Boolean),
      priority: String(entry.priority ?? '').trim()
    }));
}

/**
 * 逐条中文提示（镜像判据里最常被写错的几条：缺 home/缺 contact、key/slug 形状、
 * key 与 slug 判重、标题与用途超长、优先级不认识、同页区块重名、超 12 页）。
 * 返回的是给人看的提示行，不是能替代后端拒单的断言——全空清单返回空（没填页面清单是合法的）。
 */
export function pagePlanLocalHints(plan: BriefPagePlanEntry[]): string[] {
  const rows = cleanPagePlanForSubmit(plan);
  if (!rows.length) return [];
  const hints: string[] = [];
  if (rows.length > PAGE_PLAN_MAX) {
    hints.push(`页面清单最多 ${PAGE_PLAN_MAX} 页，现在写了 ${rows.length} 页（保存会被拒，先把本期确实不做的挪去「本期不做」）`);
  }
  const seenKeys = new Map<string, number>();
  const seenSlugs = new Map<string, number>();
  rows.forEach((entry, index) => {
    const at = `第 ${index + 1} 页`;
    (['key', 'slug'] as const).forEach(field => {
      const value = entry[field];
      const label = field === 'key' ? '标识 key' : '网址段 slug';
      if (!value) hints.push(`${at} 的${label}没填：每一页都要有稳定的标识与网址段`);
      else if (!PAGE_SLUG_PATTERN.test(value)) hints.push(`${at} 的${label}「${value}」不合法：只能是小写字母、数字与连字符，且以字母或数字开头`);
    });
    if (!entry.title) hints.push(`${at}（${entry.key || '未填 key'}）没有页面标题——界面上那一个字不能靠猜`);
    else if (entry.title.length > PAGE_TITLE_MAX) hints.push(`${at} 的页面标题超过 ${PAGE_TITLE_MAX} 字（现在 ${entry.title.length} 字）`);
    if (entry.purpose.length > PAGE_PURPOSE_MAX) hints.push(`${at}（${entry.key}）的页面用途超过 ${PAGE_PURPOSE_MAX} 字：那是「这一页干什么」的一句话，不是页面正文`);
    const keyLower = entry.key.toLowerCase();
    const slugLower = entry.slug.toLowerCase();
    if (keyLower) {
      if (seenKeys.has(keyLower)) hints.push(`${at} 的 key 与第 ${seenKeys.get(keyLower)} 页重复`);
      else seenKeys.set(keyLower, index + 1);
    }
    if (slugLower) {
      if (seenSlugs.has(slugLower)) hints.push(`${at} 的 slug 与第 ${seenSlugs.get(slugLower)} 页重复：同一个站上 About 与 about 是同一页`);
      else seenSlugs.set(slugLower, index + 1);
    }
    if (entry.sectionKey && entry.sectionKey.toLowerCase() === 'home') {
      hints.push(`${at}（${entry.key}）不该把栏目写成 home：首页不属于任何栏目，这一格留空即可`);
    }
    if (entry.priority && !PAGE_PRIORITY_CODES.includes(entry.priority as typeof PAGE_PRIORITY_CODES[number])) {
      hints.push(`${at}（${entry.key}）的优先级「${entry.priority}」不认识：只能是 ${PAGE_PRIORITY_CODES.join(' / ')}，或留空表示客户没排先后`);
    }
    const seenBlocks = new Set<string>();
    entry.blocks.forEach(block => {
      if (seenBlocks.has(block)) hints.push(`${at}（${entry.key}）里区块「${block}」出现了两次——同一页摆两个同名区块没有第二份内容可填`);
      seenBlocks.add(block);
    });
  });
  REQUIRED_PAGE_KEYS.forEach(requiredKey => {
    if (!rows.some(entry => entry.key.toLowerCase() === requiredKey)) {
      hints.push(requiredKey === REQUIRED_PAGE_KEYS[0]
        ? '页面清单里没有首页（key 为 home 的那一页）：每个客户站都要有一页首页，它的栏目一格留空'
        : '页面清单里没有联系页（key 为 contact 的那一页）：留资与电话线索的落点都在这页上，不写就等于不要线索');
    }
  });
  return hints;
}

/** home_layout / 每页 blocks 的重名提示：同一份区块判据（后端「同页不许重名」）的本地镜像 */
export function duplicatedBlockKeys(blocks: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  (blocks ?? []).forEach(block => {
    if (seen.has(block)) dup.add(block);
    seen.add(block);
  });
  return [...dup];
}

// ------------------------------------------------------------------
// 站点状态（V115 钉进列注释的那四码）——与需求单状态是两件事，别混用
// ------------------------------------------------------------------

/**
 * `site.status` 的界面说法：`enabled` 正式 / `candidate` 候选（还没被客户选中）/
 * `archived` 客户没选中的旧候选（保留备查）/ `disabled` 手工停用。
 *
 * <p><b>为什么这一份说法长在前端</b>：词表响应今天只有需求单的 `statusLabels`
 * （draft/ready/…），没有站点状态那一份；`GET /api/admin/sites` 回的又是裸实体。
 * 已把它记成 P3 要后端补的字段（`vocabulary.siteStatusLabels`）。在那之前这里就是唯一一处，
 * 并且<b>认不出的码一律原码透出</b>——后端将来加第五个状态时这一处不会把它翻成别的字。</p>
 */
const SITE_STATUS_LABELS: Record<string, string> = {
  enabled: '正式站',
  active: '正式站',
  candidate: '候选站',
  archived: '已归档候选',
  disabled: '已停用'
};

const SITE_STATUS_COLORS: Record<string, string> = {
  enabled: 'green',
  active: 'green',
  candidate: 'purple',
  archived: 'default',
  disabled: 'orange'
};

export function siteStatusText(status: string | null | undefined): string {
  if (!status) return '没有状态';
  return SITE_STATUS_LABELS[status] || `未识别状态（原码 ${status}）`;
}

export function siteStatusColor(status: string | null | undefined): string {
  return SITE_STATUS_COLORS[status || ''] || 'default';
}

/** 归档/候选这两种「不是正式站」的状态要在列表里被一眼认出来，也要被单独筛出来 */
export function isCandidateSite(site: { status?: string | null }): boolean {
  return site.status === 'candidate';
}

export function isArchivedSite(site: { status?: string | null }): boolean {
  return site.status === 'archived';
}

// ------------------------------------------------------------------
// P3 生成链路：出方案这条主线的三个端点（Spec-C §5，路径/动词一字不差）
// ------------------------------------------------------------------
//
// 这一族函数与上面 CRUD 的区别必须说清楚（谁的口今天真的在）：
// - vocabulary / 需求单 CRUD / summary-preview：后端 SiteBriefController 已上线（P1，cc910ab），真口；
// - estimate / generate / progress：Spec-C §5 的 **P3 契约**，后端 SiteProposalController 已上线，真口。
//   端点缺失时这一发会拿回一句错误，界面把错误原样透出去——不静默、不假装成功，也不在本地「演算」出一份假数。
// - 客户答复留痕、转正交棒、重跑收口与那条免鉴权选择页：另在一族里（`api/siteBriefDelivery`，P4），
//   本文件刻意不重复声明，同一个口的形状不许有两份真相（I-6）。
// - 预览令牌的手动补发与撤销在站点那一侧（按站点 id 签，不按需求单），本文件也不写第二份签发口：
//   重发一次候选链接 = 再读一次候选列表（拍板 11），够了。

/**
 * `POST /admin/site-briefs/{id}/estimate` 回包里那一颗价签本体
 * （后端 `SiteProposalEstimator.Estimate`，字段名逐字对齐 2026-09-26 的真回包）。
 *
 * <p>为什么强调"逐字"：这一族曾经按组装预估（`api/portalAssemble` 那份扁平形状）抄过一遍类型，
 * 于是 `estimatedTokens` 与 `aiEnabled` 在真回包里根本不在界面上读的那一层——
 * 数字显示成 undefined、确认框永远勾不上，花钱那一发在界面上永远发不出去，
 * 而后端一切正常（同一发用 curl 带着凭据就真跑成了）。数字与开关口径都只信后端这一份。</p>
 */
export interface BriefEstimateQuote {
  candidateCount: number;
  pagesPerCandidate: number;
  demoArticles: number;
  demoCases: number;
  /** 这一套有几个图位（hero 主视觉 / 站头 logo）：配图按张记账 */
  imageSlots: number;
  tokenEquivalentsPerImage: number;
  estimatedTokens: number;
  /** 出方案开关没开时给 false：那不是可以花的报价，界面据此连确认框都不给勾 */
  aiEnabled: boolean;
  /**
   * 这一次的钱算不算在该租户头上（V142 交付态）。
   *
   * <p>超管确定交付之前，前采与候选站都是平台自己承担：这一格是 false，后端的
   * {@code breakdown} 里那句「当月剩余配额」也不会出现。界面据此改口，是因为「扣这个租户的配额」
   * 写在没交付的单子上就是一句谎话——照着它勾选确认，事后对账会发现一分钱都没扣。</p>
   */
  tenantBearsCost?: boolean;
  /** 这一路有没有可用的图像模型；false 不等于失败，图位留空、交付后由人上传（拍板 8B） */
  imageAvailable?: boolean;
  /** 「N 套 × 每套几页 × 演示内容几篇」的人话，由后端逐行拼、界面原样列 */
  breakdown?: string[] | null;
  /** 缺哪个开关的中文原话；非空时确认框不该能勾 */
  missingSwitches?: string[] | null;
  notice?: string | null;
}

/**
 * `EstimateView.platformBurn`：这一家在这条建站链上<b>已经</b>烧掉的那一份账（M-P33 拍板 6）。
 *
 * <p>与价签的区别要说死：`estimate` 是「这一趟要花多少」，这一份是「到这一刻已经花了多少」。
 * 后端的数取 `ai_call_log` 那把<b>字数尺</b>，所以每一份额度都跟着 `tokenBasis` 那句原话——
 * 界面上不许把它念成网关实报，也不许自己拼第二份中文（句子唯一出处 `WorkbenchBurnLedger`）。</p>
 *
 * <p>这一条链上<b>没有闸</b>：这一份读数的用处只有「摆出来给人看见」，
 * 前端不许因为 `cost == null` 或次数多就拦住确认按钮。</p>
 */
export interface BriefPlatformBurn {
  /** 这一族 purpose 的外呼次数 */
  calls?: number | null;
  successCalls?: number | null;
  failedCalls?: number | null;
  /** 流水表那把字数尺的合计（`ai_call_log.token_estimate`），不是账单实扣数 */
  tokenEquivalents?: number | null;
  /** 钱：这一族一条都没定过价时后端回 null（界面上是那句「未配价」的原话），不是 0 */
  cost?: number | string | null;
  /** 后端逐行拼好的中文原话，界面原样列 */
  lines?: string[] | null;
  /** 那句尺的原话，唯一出处 `TokenYardstick.callLog()` */
  tokenBasis?: string | null;
}

/**
 * `POST /admin/site-briefs/{id}/estimate` 的回包（后端 `EstimateView`，零模型调用）。
 *
 * 外层是「这是哪一单的第几次估算 + 确认凭据」，里层 {@link estimate} 才是价签。
 * `estimateId` 必须原样带回 `generate`（拍板 9A：没看过价格发不出去，看过还要带得回去）。
 */
export interface BriefEstimate {
  briefId: number;
  attempt?: number | null;
  estimateId: string;
  /** 喂给模型的那句需求原话（后端渲染，界面只转述） */
  requirementsSummary?: string | null;
  estimate: BriefEstimateQuote;
  /** 已经烧掉的那一份（只读账，不进 `estimateId` 的散列） */
  platformBurn?: BriefPlatformBurn | null;
}

/**
 * `GET /admin/site-briefs/{id}/progress` 里每候选站的一条（后端 `CandidateProgress`，
 * 字段名逐字对齐 2026-09-26 的真回包：那一端点回的是**一个数组**，不是 `{candidates:[…]}`）。
 *
 * <p>这份类型以前写了四个后端从来不回的名字（`siteStatus`/`skeletonName`/`differentiation`/
 * `previewUrl`），于是画廊上「这套侧重什么」和「预览链接」两格永远是那句「后端还没给」——
 * 而真话在 `focus` 里，预览地址要另外按套签发（{@link siteProposalApi.previewLink}）。
 * 界面读不到的字段就别写进类型：留着它，下一次还是照着一份不存在的契约写。</p>
 */
export interface BriefCandidateProgress {
  /** 这一套的候选行 id（进度与留痕都按它对齐） */
  candidateId?: number | null;
  siteId: number | null;
  /** 第几轮（重跑一次加一次）；归档的旧轮不会出现在这里 */
  attempt?: number | null;
  candidateNo: number | null;
  /** 这一套选定的骨架 key（没生成到 plan 那一步就没有） */
  skeletonKey?: string | null;
  /** plan 落库的「这套侧重什么」原话（§6.1）；界面一个字都不改写 */
  focus?: string | null;
  tone?: string | null;
  /** 当前阶段码（plan/copy/seo/demo/image/shots/preview/done）：中文名只认 stageLabel */
  stage?: string | null;
  stageLabel?: string | null;
  /** 子任务状态码 + 后端给的中文（取不到中文就露码） */
  status: string;
  statusLabel?: string | null;
  /** 失败原因中文（后端写的）；任一步失败只影响该套，界面照实列该套 */
  errorMessage?: string | null;
  /** 这一套自己的降级说明（配图失败、演示内容口径、截图不可用…），后端原话逐条列 */
  notices?: string[] | null;
  estimatedTokens?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  demoArticles?: number | null;
  demoCases?: number | null;
  /** 配图的三本账：成功几张、失败几张、跳过几张（跳过不等于失败，拍板 8B） */
  imageDone?: number | null;
  imageFailed?: number | null;
  imageSkipped?: number | null;
  /**
   * 这一套当前阶段的起点（后端 V187 那一列）。
   *
   * <p>进终态之后库里那一格<em>不清</em>，所以界面不许拿它自己减秒数——那会对着一个早就跑完的
   * 数字念「还在等」。「等了多久」只读下面那一格后端算好的。</p>
   */
  stageStartedAt?: string | null;
  /** 只在跑动中给：这一步到现在等了多久（毫秒）；null 不是「等了 0 秒」，是「没在等」或后端没回 */
  stageWaitMs?: number | null;
  /** 这一整趟（这一套从开跑到现）已经过了多久（毫秒），同样只在跑动中给 */
  roundElapsedMs?: number | null;
  /** 这一步以往实测的区间（毫秒）。null 是那两种「给不出区间」：这一步没有外呼，或还没有过一次成功回答 */
  stageLatencyMinMs?: number | null;
  stageLatencyMaxMs?: number | null;
  /** 那一句区间的中文原话（{@code StageLatencyRanges} 唯一出处，只报区间不报点估计）；界面一字不改地摆 */
  stageLatencyNote?: string | null;
}

/**
 * 后端 `ProposalStages.TERMINAL` 那一族的状态码镜像（`succeeded` / `failed`）。
 *
 * <p>这里只拿它判<b>还要不要接着听进度</b>（在跑就别停表，进终态就收流），
 * 中文一律读后端回的 `statusLabel`，前端不抄第二份词表（I-1）。
 * 为什么前端要自己认这两个码：进度那一口的回包里没有「是否终态」这一格，
 * 而等待面必须知道什么时候把那条流关掉。</p>
 */
export const CANDIDATE_TERMINAL_STATUSES = ['succeeded', 'failed'] as const;

/** 这一行是不是已经进终态：码取不到（旧后端/读失败）时按「还没终态」处理，宁可多读一眼不可提前收工 */
export function candidateStatusTerminal(status?: string | null): boolean {
  return !!status && (CANDIDATE_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * 把毫秒说成一句人话。
 *
 * <p>只用于后端回的那些读数（`stageWaitMs` 等）：null 一律念「后端这一发没回」，
 * <b>不许念成 0 秒</b>——0 是「刚开跑」，没回是「这一格我没读到」，两件事。</p>
 */
export function formatWaitMs(value: number | null | undefined): string {
  if (value == null) return '后端这一发没回时长读数（不是 0 秒）';
  const seconds = Math.max(0, Math.round(value / 1000));
  if (seconds < 60) return `约 ${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `约 ${minutes} 分 ${seconds % 60} 秒`;
  return `约 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
}

/**
 * §9-1 那句原话的**兜底副本**：正常情况下后端 `estimate.notice` 就带着它（含实测倍数），
 * 界面只显示那一份。这个常量只在后端没给时才顶上去——两处各留一份必然对不齐（这一份就先说过
 * 「四个样本全部低估」，等三套满档实测出 0.83 倍时它当场变假话）。所以口径是：数字只信后端。
 */
export const ESTIMATE_UNDERESTIMATE_DISCLAIMER =
  '这个预估不是最终账单：实耗可能比它高也可能比它低，以逐笔落账为准';

/** §6.7 / N-4 的截图口径原话：候选阶段截图位必须空着并说清为什么，不许放假缩略图 */
export const CANDIDATE_SHOT_UNAVAILABLE_TEXT =
  '截图这一档在内部预览域上不可用：sidecar 的内网 host 闸拒收预览域，口径是不为截图放宽 SSRF 闸。'
  + '候选阶段给你的是可点开的预览链接，转正并绑上公网域名后截图链路才可用——所以这一格今天空着，不放一张假缩略图';

/** §9-4 的防纠纷标注：演示内容在预览与画廊里必须原话挂着这一句 */
export const DEMO_CONTENT_DISCLAIMER_TEXT = 'AI 生成的演示内容，交付后可替换';

/**
 * 预览链接这一格还没签发时界面说的那句原话（口径见拍板 3A/11）。
 *
 * <p>以前这一句写的是「地址随进度下发到这一格」——进度口从来不回 `previewUrl`，于是这一格
 * 永远停在这句话上，而真口就在旁边（`POST /admin/sites/{id}/preview-links`）。
 * 现在这一格是「点一下才签」：令牌是准入，不在一次页面加载里给三套各发一枚。</p>
 */
export const PREVIEW_LINK_PENDING_TEXT =
  '这一套还没签发预览链接：点上面那一个「发放预览地址」才会新开一条带 reviewToken 的会话（14 天）。'
  + '本单已转正/归档时后端会拒这一发并给一句中文——按拍板 3A，转正那一刻候选令牌全部收回，不再补发';

/** 三态之一：`previewIssued=false` 且 `previewExpiresAt=null`——这条链路上从来没签过令牌 */
export const PREVIEW_LINK_NEVER_ISSUED_TEXT = '未发送预览';

/** 三态之一：`previewIssued=false` 且 `previewExpiresAt` 有值——发过，但已撤销或已过期（旧链接从此打不开） */
export const PREVIEW_LINK_REVOKED_TEXT = '预览已失效';

/** 三态之一：`previewIssued=true`——现在有一条活着的全站令牌，可它的明文已经取不回来了 */
export const PREVIEW_LINK_LIVE_TEXT = '预览已发放 · 还在有效期';

/**
 * 令牌现状没取到时说的那句（`candidates` 口失败/没回这一行）。
 *
 * <p>为什么要有第四种说法而不是退回「未发送预览」：那三个状态是后端用两个事实拼出来的，
 * 一个都没取到就是不知道，把「不知道」演成「没发过」正好是这一页反复在避免的那类假话。</p>
 */
export const PREVIEW_LINK_STATE_UNKNOWN_TEXT = '预览状态没取到（候选列表那一口没回这一套）：下面的按钮点了仍然有效';

/**
 * 刚签发那一次才说得到的那句：地址只在回执里活一次。
 *
 * <p>库里存的是令牌的 SHA-256，明文从来没有第二份（`ReviewSessionService` 的口径），所以刷新一次页面
 * 这一格就只能报「已发放」而摆不出链接。把这句话挂在能复制的那一次旁边，是要让人明白
 * 「下一条链接要点重新发放，而不是刷新页面找回来的」。</p>
 */
export const PREVIEW_LINK_ONCE_TEXT =
  '这条地址只在这次会话里给得到：库里存的是令牌散列，明文恢复不了——刷新后要重看就点重新发放（旧的那条先用旁边那颗撤销收干净）';

/** 预览链接的三态（后端那两个事实的界面说法）；null = 这一套的现状没取到 */
export type PreviewLinkState = 'never-issued' | 'expired' | 'live' | null;

/**
 * 把 `previewIssued` + `previewExpiresAt` 拼成界面说法的那一个判据。
 *
 * <p>只此一处：三个状态如果在模板里各写一遍 `v-if`，改一个忘两个是早晚的事，
 * 而这里的任何一句说错都是直接对客户说错话（「已失效」其实还活着，或反之）。</p>
 */
export function previewLinkStateOf(
    candidate: { previewIssued?: boolean | null; previewExpiresAt?: string | null } | null | undefined
  ): PreviewLinkState {
  if (!candidate) {
    return null;
  }
  if (candidate.previewIssued) {
    return 'live';
  }
  return candidate.previewExpiresAt ? 'expired' : 'never-issued';
}

/** 三态各自的那句中文（判据不在这里，见 {@link previewLinkStateOf}） */
export function previewLinkStateText(state: PreviewLinkState): string {
  if (state === 'live') return PREVIEW_LINK_LIVE_TEXT;
  if (state === 'expired') return PREVIEW_LINK_REVOKED_TEXT;
  if (state === 'never-issued') return PREVIEW_LINK_NEVER_ISSUED_TEXT;
  return PREVIEW_LINK_STATE_UNKNOWN_TEXT;
}

/** 三态各自的标签颜色：失效与没发过都是灰的，只有「现在还活着」才给绿色 */
export function previewLinkStateColor(state: PreviewLinkState): string {
  if (state === 'live') return 'green';
  if (state === 'expired') return 'red';
  return 'default';
}

/** 「现在活着，可地址取不回来」那一句：这一态必须单独有话，否则人只会以为界面坏了 */
export const PREVIEW_LINK_LIVE_HINT =
  '这一条现在还能打开，但链接的明文只在发放那一刻给过一次（库里存的是令牌散列）——'
  + '刷新页面就取不回来了。要一条能复制的新地址就点「重新发放」：后端会先撤销这一套的全部旧令牌'
  + '（旧链接当场打不开）再签一条新的，回执在这里只摆一次。';

/** 「发过但已撤销/已过期」那一句 */
export const PREVIEW_LINK_REVOKED_HINT =
  '这条预览链接已经作废或过期：客户手里的旧地址从此打不开，站与内容都还在。重新发放会签一条新的（14 天）。';

/** 「从来没发过」那一句 */
export const PREVIEW_LINK_NEVER_ISSUED_HINT =
  '这一套的预览地址还没发过：点一下才会新开一条带 reviewToken 的 14 天会话。'
  + '令牌即准入，页面加载不替三套各签一枚。';

/** 三态各自的下一句解释（判据仍是 {@link previewLinkStateOf}，这里只是给人看的那段话） */
export function previewLinkStateHint(state: PreviewLinkState): string {
  if (state === 'live') return PREVIEW_LINK_LIVE_HINT;
  if (state === 'expired') return PREVIEW_LINK_REVOKED_HINT;
  if (state === 'never-issued') return PREVIEW_LINK_NEVER_ISSUED_HINT;
  return '';
}

/** 「待人工」那枚标记本身（判据是候选列表口回的 `needsHuman`，D5-5 / V135） */
export const CANDIDATE_NEEDS_HUMAN_TEXT = '待人工';

/**
 * 「待人工」旁边的那句解释。口径对着后端 V135 的列注释「交付了但仍要人看一眼」：
 * 极限用语闸自动改写一遍仍命中的措辞已经落库，但系统不敢替客户签字——这与 failed
 * （那一套根本没跑成）是两件事，两句话各挂各的，谁也不许顶替谁。
 */
export const CANDIDATE_NEEDS_HUMAN_HINT =
  '这一套已交付、能预览，但有措辞被极限用语闸改写一遍后仍命中（广告法禁用的绝对化用语那一族）：'
  + '系统不敢替客户签字，请先人工过目相关文案再发链接。它不是失败——失败的那套会单独写明原因。';

/**
 * `GET /admin/site-briefs/{id}/candidates` 的一行（后端 `SiteProposalOrchestrator.CandidateSite`）。
 *
 * <p>这一档的要点全在那两个恒为 null 的字段上：读口<em>不再</em>签令牌（旧口径是每次读都给每套签一条
 * 新的 14 天全站会话——刷新一次界面就多一条能打开候选站的公开地址，「撤销」永远只能撤到此刻之前）。
 * 库里只有 SHA-256 散列，所以 `previewToken`/`previewUrl` 在这个视图里恒 null，链接内容只能经
 * 发放/重发那两口拿到一次；界面这一侧的纪律是同一条：<b>没有明文就不摆链接</b>，
 * 现状由 `previewIssued` + `previewExpiresAt` 两个事实说（判据收在 {@link previewLinkStateOf}）。</p>
 */
export interface BriefCandidateSite {
  candidateId: number;
  /** 站还没建起来（或被人删了）时后端回 null */
  siteId: number | null;
  siteName: string | null;
  siteCode: string | null;
  attempt?: number | null;
  candidateNo?: number | null;
  skeletonKey?: string | null;
  focus?: string | null;
  tone?: string | null;
  stage?: string | null;
  /** 中文说法只来自后端的 ProposalStages 词表（同 BriefCandidateProgress），界面不许抄第二份阶段词表 */
  stageLabel?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  /** 读口恒为 null：令牌明文只在签发那一刻存在过，这里留着这一格是为了和后端字段逐字对齐，不是给界面当链接渲 */
  previewToken: string | null;
  /** 同上，恒为 null */
  previewUrl: string | null;
  /** 最近一条全站令牌的到期时刻；null 且未发放 = 从来没发过（这正是「未发送预览」的判据） */
  previewExpiresAt: string | null;
  /** 现在是不是有一条活着的全站预览令牌 */
  previewIssued: boolean;
  /**
   * Spec-D D5-5：这一套里交付了、但极限用语闸改写一遍仍没洗干净的措辞（V135 起后端单列存，
   * 注释原话「交付了但仍要人看一眼」）。它<b>不是</b> failed：内容是落库的、站是能开的，
   * 只是系统不敢替客户签字——画廊要如实挂「待人工」，不许并进失败那一格。
   */
  needsHuman: boolean;
  notices?: string[] | null;
}


/** 一套候选的预览链接回执（后端 `PreviewLink`）：令牌绑站不绑页 */
export interface BriefPreviewLink {
  siteId: number;
  previewToken: string;
  /** 未配 app.portal.candidate.preview-base-url 时后端回的是相对路径，由按当前 origin 拼这一头补 */
  previewUrl: string;
  expiresAt?: string | null;
}

/**
 * 超管侧「建站任务总览」的一单（M-P33 批 D，后端 `SiteProposalOverview.Round`，
 * 端点 `GET /admin/site-proposal/overview`，纯读）。
 *
 * <p>`candidates` 就是 {@link BriefCandidateProgress} 那一份读数（后端内部调同一个出口），
 * 所以等待、历史实测区间那五格在这里不必再解释第二遍——界面对同一趟只许有一份真相（M-P16 #248）。</p>
 */
export interface BriefOverviewRound {
  briefId: number;
  tenantId?: number | null;
  /** 归属那一家的名字，由后端按 tenant_id 现查；读不到就是 null（界面露空，不兜「未知租户」） */
  tenantName?: string | null;
  /** 需求单状态的码与原话标签：后端那一格的组件名是 briefStatus/briefStatusLabel（不是 status），抄错等于界面永远念「没回」 */
  briefStatus?: string | null;
  briefStatusLabel?: string | null;
  attempt?: number | null;
  roundStartedAt?: string | null;
  /** 整单已跑多久（毫秒）；只有还在跑时后端才给，进终态后是 null */
  roundElapsedMs?: number | null;
  candidateTotal?: number | null;
  runningCount?: number | null;
  terminalCount?: number | null;
  /** 「已受理、一套都还没开始」那一格；中文理由在 waitingLine */
  waitingForPool?: boolean | null;
  waitingLine?: string | null;
  /** 这一轮候选行的网关实报合计（不是字数尺那把） */
  burnedTokens?: number | null;
  estimatedTokens?: number | null;
  candidates?: BriefCandidateProgress[] | null;
  /** 这一家名下这条链历史上已经烧掉的那一份账（字数尺口径，句子出处 WorkbenchBurnLedger） */
  tenantBurn?: BriefPlatformBurn | null;
}

/** 说明书异步初稿在跑的一格（批 C 拍板 ⑨ 那一族；状态词表与出方案那族不同，故后端单列） */
export interface BriefOverviewDraft {
  briefId: number;
  tenantId?: number | null;
  tenantName?: string | null;
  draftStatus?: string | null;
  draftStatusLabel?: string | null;
  startedAt?: string | null;
  waitMs?: number | null;
  errorMessage?: string | null;
}

/** 一个线程池的瞬时快照（只说这一个进程，多实例部署时不代表全平台） */
export interface BriefOverviewPool {
  name: string;
  activeCount?: number | null;
  poolSize?: number | null;
  maxPoolSize?: number | null;
  queueSize?: number | null;
  queueCapacity?: number | null;
  /** 后端拼好的那句口径，界面原样念 */
  line?: string | null;
}

export interface BriefWorkbenchOverview {
  runningRounds?: number | null;
  runningDrafts?: number | null;
  pools?: BriefOverviewPool[] | null;
  rounds?: BriefOverviewRound[] | null;
  drafts?: BriefOverviewDraft[] | null;
  /** 那一句口径（没有预测、只读、两把 token 尺各说各的） */
  note?: string | null;
}

/**
 * `POST /admin/site-briefs/{id}/generate`（以及补跑那一支）的回执：后端 `RoundStart`。
 *
 * <p>`candidates` 的每一项就是 {@link BriefCandidateProgress} 那一份形状，与 `GET /progress`
 * 同源；受理那一刻它们都在「排队中」。界面拿这一份是为了<b>立刻</b>列出这一轮开了几套，
 * 后续刷新仍走 `progress`（或批 C 那条 SSE），不许在这份快照上自己往前推状态。</p>
 */
export interface BriefRoundStart {
  briefId?: number | null;
  /** 第几轮：补跑是「同一轮原地」，所以这一格等于上一轮，不会 +1 */
  attempt?: number | null;
  candidates?: BriefCandidateProgress[] | null;
  estimatedTokens?: number | null;
  /** 受理时就定下来的那几句原话（补跑只补哪几套、截图那一格为什么不动…），界面逐字列 */
  notices?: string[] | null;
}

export const briefGenerationApi = {
  /** 零模型调用的预估：只算不花，所以它不需要 confirm，也不该被省掉 */
  estimate: (id: number) => http.post<BriefEstimate>(`/admin/site-briefs/${id}/estimate`),

  /**
   * 真正花钱的那一发：`confirm` 只可能是界面上人亲手勾的那个值，任何调用方都不许替它填 true。
   *
   * <p>凭据两样（{@link quote} 的 `estimateId` 与那颗价签的 `estimatedTokens`）必须跟着走——
   * 后端 9A 那道闸认的就是这两样，缺一样它回一句中文并且一次模型都不调。这一头以前只发
   * `{confirm}`，所以界面上「开始出方案」点了必被拒（同一发用 curl 带上凭据就真跑成了）。</p>
   */
  generate: (id: number, confirm: boolean, quote: { estimateId: string; expectedTokens: number }) =>
    http.post<BriefRoundStart>(`/admin/site-briefs/${id}/generate`, {
      confirm,
      estimateId: quote.estimateId,
      expectedTokens: quote.expectedTokens,
    }),

  /**
   * 「只补失败那一套」的那张<b>价签</b>（M-P34，`POST /admin/site-briefs/{id}/rerun-failed/estimate`）。
   *
   * <p>零模型调用、零写库，与 {@link estimate} 同一条纪律；差别在价格算给谁：这一张只数这一轮里
   * <b>失败的那几套</b>，成功的那几套一套都不计。所以 `estimateId` 与整轮那张<b>天然不是一个串</b>
   * （后端在散列里加了「mode=rerunFailed|sets=…」），拿整轮的凭据来授权补跑会被 9A 那道闸拒——
   * 反过来也一样。这不是形式，是「你看过的那张价签就是你点头的那趟活」。</p>
   *
   * <p>回执形状与 {@link estimate} 完全一致（{@link BriefEstimate}），所以界面复用那一套渲染；
   * 没有可补的那一套时后端回中文拒（`SITE_PROPOSAL_NOTHING_TO_RERUN` 等），错误原文照抄上屏。</p>
   */
  rerunEstimate: (id: number) =>
    http.post<BriefEstimate>(`/admin/site-briefs/${id}/rerun-failed/estimate`),

  /**
   * 真正花钱的那一发补跑（`POST /admin/site-briefs/{id}/rerun-failed`）：
   * 与 {@link generate} 一样只接受<b>人亲手勾过</b>的 `confirm`，而且必须带着
   * {@link rerunEstimate} 那张价签的 `estimateId` 与 `estimatedTokens`，缺一样后端一句中文拒、模型一次都不调。
   *
   * <p>后端那一手做的事：把这一轮里失败的那几行推回「排队中」并归零计数，成功的那几套
   * 站、页面、内容、已发的预览链接<b>一个字都不动</b>（所以客户手里的链接不会因为这趟补跑失效）。
   * 它不是「收口重跑」：收口重跑只归档、不花钱，这一发是真的再烧一趟——只是只烧失败那几套的量。</p>
   */
  rerunFailed: (id: number, confirm: boolean, quote: { estimateId: string; expectedTokens: number }) =>
    http.post<BriefRoundStart>(`/admin/site-briefs/${id}/rerun-failed`, {
      confirm,
      estimateId: quote.estimateId,
      expectedTokens: quote.expectedTokens,
    }),

  /** 每候选站一条子任务的进度：后端回的是数组，哪套在跑、哪套失败、失败缺什么都在各自那一行 */
  progress: (id: number) => http.get<BriefCandidateProgress[]>(`/admin/site-briefs/${id}/progress`),

  /**
   * 进度的<em>推送</em>版（M-P33 批 C，后端 `GET /admin/site-briefs/{id}/progress/stream`）。
   *
   * <p>数据<b>就是上面那一口 `progress` 的同一份读数</b>，事件名与工作台那支持久任务的流逐字一致
   * （`connected` / `progress` / `complete` / `error`），所以这里不另列字段、界面也不另算一套。</p>
   *
   * <p>令牌只能走 `?token=`：EventSource 带不了请求头（与 `api/workspace` 那支同形）。
   * 另有一条现场实测的形状要记着——这一口只认 `Accept: text/event-stream`，
   * 写成通配那种（星号 斜杠 星号）会被全仓那个异常兜底拦成 406「不支持的响应类型」
   * （浏览器发的正是前者，而 curl 默认发的是后者，取证时别拿 curl 的 406 判这一口坏了）。</p>
   */
  streamProgress: (id: number) =>
    new EventSource(`/api/admin/site-briefs/${id}/progress/stream?token=${encodeURIComponent(currentAuthToken() ?? '')}`),

  /**
   * 超管侧「建站任务总览」（M-P33 批 D，拍板 ⑩）：跨租户摆「同时在跑几单、谁在排队、
   * 各自跑到哪一步、已经烧了多少」。<b>纯读</b>：不启动、不取消、不补跑任何东西。
   *
   * <p>没有 SSE 是有意的：这一页服务的是「我手上不止一单」的那个人，他每次切回这一页就要看全平台，
   * 而 20 分钟里给一单挂一条流的成本（一条工作线程 × N 单）远高于这里每 10 秒读一次的量。
   * 一单内部的实时跟随仍走上面那支 {@link streamProgress}。</p>
   */
  overview: (tenantId?: number | null) =>
    http.get<BriefWorkbenchOverview>('/admin/site-proposal/overview', {
      params: tenantId ? { tenantId } : {}
    }),

  /**
   * 候选站列表（含每套预览令牌的<b>现状</b>）：纯读，一条令牌都不签。
   *
   * <p>这一口与 progress 的分工要说清：进度口报的是子任务跑到哪一步，这一口报的是
   * 「这一套站现在能不能被预览链接打开、那一条链接发没发过」。画廊两样都要，
   * 但预览那一格只认这一口回的 `previewIssued`/`previewExpiresAt`——进度口从来不含链接内容，
   * 而这一口的 `previewToken`/`previewUrl` 恒 null（见 {@link BriefCandidateSite}）。</p>
   */
  candidates: (id: number) => http.get<BriefCandidateSite[]>(`/admin/site-briefs/${id}/candidates`),

  /**
   * 单独给某一套候选签一条预览地址（§5 的那个手动口，后端是 POST /admin/sites/{id}/preview-links）。
   * 画廊按套点「发放预览地址」才调它：令牌是准入，不该在一次页面加载里给三套各发一枚。
   *
   * <p>回执里的那条明文地址<b>只在这里出现一次</b>：库里存的是散列，刷新页面就再也读不出来了，
   * 所以调用方要当场把它挂到卡上（界面那一侧见 CandidateGalleryView 的预览链接那一格）。</p>
   */
  previewLink: (siteId: number, label?: string) =>
    http.post<BriefPreviewLink>(
      `/admin/sites/${siteId}/preview-links`,
      undefined,
      { params: label ? { label } : {} }
    ),

  /**
   * 重发预览链接（`POST /admin/sites/{id}/preview-links/reissue`，拍板 11 里的那半个「重发」）：
   * 后端<em>先撤销该站全部旧令牌、再签一条新的</em>——与上面那个「只新增不回收」的发放口分开。
   * 「链接发错人了」要走这一条：两步并成一步，任何时刻都收得干净。回执同样只在这里出现一次明文。
   */
  reissuePreviewLink: (siteId: number, label?: string) =>
    http.post<BriefPreviewLink>(
      `/admin/sites/${siteId}/preview-links/reissue`,
      undefined,
      { params: label ? { label } : {} }
    ),

  /** 撤销这一套候选发出去的全部预览令牌（拍板 3A/11：站与内容都留着，只是不再可见） */
  revokePreviewLinks: (siteId: number) =>
    http.post<number>(`/admin/sites/${siteId}/preview-links/revoke`)
};
