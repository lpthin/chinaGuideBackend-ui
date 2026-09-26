import http from './http';

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

export type BriefSelectKind = 'single' | 'multi' | 'cascade' | 'text' | 'color';

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

/** 后端 SiteBriefService.VocabularyView 的镜像：五个顶层字段名逐一对齐 */
export interface SiteBriefVocabulary {
  questions: BriefVocabularyQuestion[];
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
    http.post<{ requirementsSummary: string }>('/admin/site-briefs/summary-preview', form)
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
 * 后端读出的需求单（平铺字段）回填成录入页的勾选袋（按 `q.key`）。与 buildBriefForm 互逆，
 * 题目 key 的三处结构差异在这里同样消化。
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
