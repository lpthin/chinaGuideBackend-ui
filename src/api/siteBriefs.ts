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

/** 这道题是不是「走元信息、不进勾选袋」的那两块（参考站 / 补充说明） */
export function isIntakeStaticKey(key: string): boolean {
  return (INTAKE_STATIC_KEYS as readonly string[]).includes(key);
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
    if (question.select === 'text') {
      row.value = String(readBriefSelections([question], brief)[question.key] ?? '');
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
 * 演示内容档位的中文（含拍板 7 那句「几篇文章几条案例」的数量口径）：
 * 只取词表 `demoContentModes`，查不到就露码 + 一句原话。
 */
export function briefDemoModeText(
  vocabulary: SiteBriefVocabulary | null,
  mode: string | null | undefined
): string {
  if (!mode) return '没填（保存时由后端按系统默认档落）';
  const found = (vocabulary?.demoContentModes ?? []).find(entry => entry.value === mode);
  return found ? `${found.label}（文章 ${found.articleCount} 篇 / 案例 ${found.caseCount} 条）` : mode;
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
 * `POST /admin/site-briefs/{id}/estimate` 的回包（零模型调用）。
 * 形状沿用组装预估的先例（`api/portalAssemble` 的 AssembleEstimate）：
 * estimatedTokens/remainingTokens/aiEnabled/notice 四个名字是后端已验证的口径，不另发明。
 * `breakdown` 是那句「N 套 × 每套几页 × 演示内容几篇」的人话，由后端拼、界面原样显示——
 * 前端自己乘一遍就是抄了第二份口径（拍板 7 的数量归后端词表与配置管）。
 */
export interface BriefEstimate {
  briefId: number;
  candidateCount: number;
  estimatedTokens: number;
  remainingTokens: number | null;
  /** 后端开关没开时给 false：这不是一个可以花的报价，界面据此连确认框都不给勾 */
  aiEnabled: boolean;
  breakdown?: string | null;
  /** 「缺哪个开关」之类的中文说明，有就原样带上 */
  notice?: string | null;
  notices?: string[] | null;
}

/**
 * `GET /admin/site-briefs/{id}/progress` 里每候选站的一条（§5：每候选站当前阶段与失败原因；
 * §6.1 落库的 differentiation「这套侧重什么」与 §6.2 末尾签发的预览地址也从这一条下来）。
 * 所有中文（statusLabel/stageLabel）都应由后端带；查不到就露原码，前端不抄第二份阶段词表。
 */
export interface BriefCandidateProgress {
  siteId: number | null;
  candidateNo: number | null;
  /** V115 站点状态码（candidate/archived/…）：界面读 siteStatusText 那一份说法 */
  siteStatus?: string | null;
  /** 子任务状态码 + 后端给的中文（取不到中文就露码） */
  status: string;
  statusLabel?: string | null;
  /** 当前阶段码（骨架/文案/SEO/演示内容/配图/截图/令牌…）：中文名只认 stageLabel */
  stage?: string | null;
  stageLabel?: string | null;
  /** 这一套选定的骨架（key 与后端给的名字；没生成到那一步就没有） */
  skeletonKey?: string | null;
  skeletonName?: string | null;
  /** plan 落库的「这套侧重什么」原话（§6.1）；界面一个字都不改写 */
  differentiation?: string | null;
  /** 失败原因中文（后端写的）；任一步失败只影响该套，界面照实列该套 */
  errorMessage?: string | null;
  /** 带 reviewToken 的预览地址：生成链路末尾签发后随进度下发；前端永不自己拼 */
  previewUrl?: string | null;
}

export interface BriefProgress {
  briefId: number;
  /** 需求单当前状态码（进度头部用；中文仍走词表 statusLabels） */
  briefStatus?: string | null;
  candidates: BriefCandidateProgress[];
}

/**
 * §9-1 的那句原话：`output-tokens-per-call` 不动（用户明令缓决），后果是估算闸门偏松，
 * 所以「四个实测样本低估 1.23×~4.2×」必须作为人话摆在数字旁边——让人以为估出来的就是账单，
 * 就是这一节明令不许的藏法。收在适配层一处，视图只引用，免得第二页抄一遍抄歪。
 */
export const ESTIMATE_UNDERESTIMATE_DISCLAIMER =
  '这个预估按历史 4 个实测样本低估 1.2~4.2 倍算的，不是最终账单：实耗以逐笔落账为准';

/** §6.7 / N-4 的截图口径原话：候选阶段截图位必须空着并说清为什么，不许放假缩略图 */
export const CANDIDATE_SHOT_UNAVAILABLE_TEXT =
  '截图这一档在内部预览域上不可用：sidecar 的内网 host 闸拒收预览域，口径是不为截图放宽 SSRF 闸。'
  + '候选阶段给你的是可点开的预览链接，转正并绑上公网域名后截图链路才可用——所以这一格今天空着，不放一张假缩略图';

/** §9-4 的防纠纷标注：演示内容在预览与画廊里必须原话挂着这一句 */
export const DEMO_CONTENT_DISCLAIMER_TEXT = 'AI 生成的演示内容，交付后可替换';

/** 预览链接这一格没有可发的地址时界面说的那句原话（口径见拍板 3A：转正/归档即收回全部令牌） */
export const PREVIEW_LINK_PENDING_TEXT =
  '这一套现在没有可发的预览链接：要么出方案还没走到它，要么本单已转正/归档——按拍板 3A，'
  + '转正那一刻候选令牌全部收回，界面不再补发。还是候选身份时，可复制的地址随进度下发到这一格';

export const briefGenerationApi = {
  /** 零模型调用的预估：只算不花，所以它不需要 confirm，也不该被省掉 */
  estimate: (id: number) => http.post<BriefEstimate>(`/admin/site-briefs/${id}/estimate`),

  /**
   * 真正花钱的那一发：`confirm` 只可能是界面上人亲手勾的那个值，任何调用方都不许替它填 true。
   * 未勾确认在界面层就被拦住（canGenerate），真发出去被后端中文拒时错误原样显示。
   */
  generate: (id: number, confirm: boolean) =>
    http.post<{ briefId?: number }>(`/admin/site-briefs/${id}/generate`, { confirm }),

  /** 每候选站一条子任务的进度：哪套在跑、哪套失败、失败缺什么（§6.2 任一步失败只影响该套） */
  progress: (id: number) => http.get<BriefProgress>(`/admin/site-briefs/${id}/progress`)
};
