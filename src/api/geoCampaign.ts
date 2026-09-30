import http from './http'

/**
 * GEO 诊断计划 / 轮次 / 报告（Spec-F §11.3 P2）。
 *
 * 形状逐字跟后端 `GeoCampaignDtos`（`/api/geo/campaign`）：读与预估挂 `geo:campaign:view`，
 * 建改删与起跑挂 `geo:campaign:run`。三件事在这里钉住，界面不再各写一份：
 * - 状态与指标的中文名来自 `vocabulary()`，不在 TS 里抄第二份词表；
 * - `estimate.notice` 非空 = 这一轮不会受理，它是数据而不是错误码（预估一次模型都不调）；
 * - 指标行的 `value` 为 null = 分母为 0，也就是「没测过」，界面显示「未取到」而不是 0%（§9.6）。
 */

export interface GeoCampaignForm {
  siteId: number | null
  brandProfileId: number | null
  name: string
  platformIds: number[]
  questionIds: number[]
  repeatTimes: number | null
  wizardState: string | null
  note: string
}

/** 改计划：只改还没跑过的中间态；null 字段表示「这一项不动」（后端按 null 判） */
export type GeoCampaignUpdateForm = Partial<Omit<GeoCampaignForm, 'siteId' | 'brandProfileId'>>

export interface GeoCampaign {
  id: number
  tenantId: number
  siteId: number
  brandProfileId: number
  name: string
  platformIds: number[]
  questionIds: number[]
  questionCount: number
  platformCount: number
  repeatTimes: number
  costEstimateCalls: number
  costEstimateTokens: number
  confirmState: string
  confirmStateLabel: string
  wizardState: string | null
  note: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
  latestRun: GeoRun | null
}

export interface GeoEstimate {
  campaignId: number
  questionCount: number
  platformCount: number
  repeatTimes: number
  /** 提问那一段的调用次数（第一段花出去的钱），不含下面 judgeCallCount */
  callCount: number
  /** 提问那一段的预计 token，跟下面 judgeEstimatedTokens 各归各的账（§6.2 两段式） */
  estimatedTokens: number
  estimatedMinutes: number
  remainingTokens: number
  campaignEnabled: boolean
  tenantBearsCost: boolean
  notice: string | null
  /**
   * 判定那一段（§11.4）：一条成功回答一次外呼、一次判全部主体，所以条数 = 本轮提问次数。
   * 它不在 callCount 里，也不许被加起来显示成一个数——那是两段各花的钱。
   */
  judgeCallCount: number
  judgeEstimatedTokens: number
  totalCallCount: number
  totalEstimatedTokens: number
  /**
   * 有几道题的核心词判不了覆盖率（#142）：没填、少于 3 字、或落在通用标题词里。
   * 判得了的题才进分子分母，所以「机会清单是空的」有两种完全不同的原因——这个数用来把它们分开。
   */
  unmeasurableQuestions: number
  /**
   * 上面那个数对应的那句话；0 道题判不了时是 null。
   *
   * 与 {@link notice} 性质相反：notice 非空 ⇒ 这一轮不受理、必须禁用主按钮；
   * 这一句只是「在花之前把已知会白跑的那一段讲清楚」，<b>按钮照样能点</b>。
   */
  unmeasurableNotice: string | null
}

export interface GeoRun {
  id: number
  campaignId: number
  tenantId: number
  brandProfileId: number
  siteId: number
  status: string
  statusLabel: string
  stageText: string | null
  progress: number | null
  accessChannel: string | null
  questionCount: number | null
  platformCount: number | null
  repeatTimes: number | null
  callCount: number | null
  failedCallCount: number | null
  promptTokens: number | null
  completionTokens: number | null
  errorMessage: string | null
  /**
   * 「这一轮停着不动」的那句实话，只在轮次还在跑却太久没进度时非空（#108 判据：
   * 卡住的病是「没人知道它停着」，所以治它的是把话说清楚，不是给它加一个新状态词）。
   * 界面对它只做一件事——原样念出来，不许改写成「失败」。
   */
  stalledReason: string | null
  /**
   * 「这一轮还在排队」的那句实话（#143）：派单成功了，但提问线程只有一条，它还没被拿走。
   *
   * <p>形状与 {@code stalledReason} 完全相反，所以两句不能共用：排队那一轮的心跳本来就不动，
   * 后端先问队列这本账，因此它 {@code stalledReason} 是空的、{@code queuedReason} 非空。
   * 少这一句，界面就会把「等着」念成「在跑」——更要紧的是过 15 分钟它会被念成「已中断、可以再起一轮」，
   * 而按那句去做就是同一批题付两遍钱。界面同样只原样念，不加状态词。</p>
   */
  queuedReason: string | null
  /**
   * 判定那一段的状态（JUDGING / DONE / FAILED，null = 这一轮从没判过）。
   * 它和上面 `status` 是【两份词表】，刻意的：「提问已完成、判定还在跑」可以同时成立，
   * 合成一列就把「报告上那些率还空着」说成「这一轮跑完了」（GeoJudgeStates 的类注释同一条判据）。
   */
  judgeState: string | null
  judgeStateLabel: string | null
  judgeCallCount: number | null
  judgePromptTokens: number | null
  judgeCompletionTokens: number | null
  judgePromptVersion: string | null
  judgeErrorMessage: string | null
  /** 判定那一段的「停着不动」：同样是服务端算好的一句实话，界面只原样念（#108） */
  judgeStalledReason: string | null
  startedAt: string | null
  finishedAt: string | null
  createdBy: string | null
  createdAt: string | null
}

/** 一行指标 + 它自带的中文名与分母口径：口径句子跟着数据走（§5 单源） */
export interface GeoMetricRow {
  id: number
  scope: 'BRAND' | 'COMPETITOR' | string
  subject: string
  modelConfigId: number | null
  modelLabel: string | null
  metric: string
  metricLabel: string | null
  definition: string | null
  numerator: number
  denominator: number
  value: number | null
  ciLow: number | null
  ciHigh: number | null
  computedAt: string | null
  /** 情感占比那一卡才有：一档一行，POS/NEU/NEG；推荐率行与非判定行都是 null */
  sentiment: string | null
  sentimentLabel: string | null
  /**
   * 这一格里「判不成」的条数（§11.4 四道校验不过的那些）。
   * 它不是失败次数：分母照样是那些成功回答，只是这一条没能落进任何一档，
   * 所以三档加起来不到 100% 时，界面对得上的就是这个数。
   */
  notMeasuredCount: number | null
  /** 这一行的数出自哪一版判定提示词：旧版那几行不会被新版覆盖，所以它必须能被念出来 */
  judgePromptVersion: string | null
}

export interface GeoReport {
  run: GeoRun
  platforms: string[]
  mentionRate: GeoMetricRow[]
  /** 推荐率（语义判定，§11.4）：与提及率各占一格、共用同一个分母，界面上永远不相加 */
  recommendRate: GeoMetricRow[]
  sovShare: GeoMetricRow[]
  /** 情感三档：本品牌一行一档，分母是「提到本品牌的回答数」，与上面两卡都不是同一个分母 */
  sentimentShare: GeoMetricRow[]
  promptCoverage: GeoMetricRow | null
  callCount: number
  failedCallCount: number
  unmeasuredSubjects: string[]
  unmeasuredQuestions: string[]
  accessChannelNote: string
  /** 这一版的率是谁判的：提示词版本 + 判定模型名（读的是判定行上那一刻的模型，不是「当前默认模型」） */
  judgePromptVersion: string | null
  judgeModelLabel: string | null
  /** 四道校验没过、被降成「未测量」的那几条：三档加起来不到 100% 的唯一诚实解释 */
  notMeasuredJudgments: number
  generatedAt: string | null
}

/** 平台卡片唯一出处：后端 `ai_model_config` 的启用聊天模型行，界面不许自己列「支持哪几家」 */
export interface GeoPlatformOption {
  id: number
  name: string
  provider: string | null
  modelName: string | null
  modelType: string | null
}

export interface GeoVocabulary {
  runStatuses: Record<string, string>
  metrics: Record<string, string>
  metricDefinitions: Record<string, string>
  confirmStates: Record<string, string>
  /** 判定那一段的词表：与 runStatuses 两份，一份都不许在 TS 里抄（§11.4） */
  judgeStates: Record<string, string>
  prominences: Record<string, string>
  prominenceDefinitions: Record<string, string>
  /** `position_rank` 唯一的界面叫法——§5 禁令里「排名」那个词不许出现在这一屏 */
  positionLabel: string
  sentiments: Record<string, string>
  sentimentDefinitions: Record<string, string>
  accessChannelNote: string
  /**
   * 下面五族是 P4 才加进 `vocabulary()` 的，所以标可选：前端先上、后端还没上的那半天里，
   * 这一屏要落到「原样显示状态码」的兜底，而不是整页读不出来。视图一律走 `?.[]` 取值。
   */
  /** 缺口四档（§11.5）：中文名与判据各一份，视图里一份都不抄 */
  gapTypes?: Record<string, string>
  gapDefinitions?: Record<string, string>
  /** 四个动作：全部是「转交给已经在花钱的那条流水线」，界面上不许出现第五个动作 */
  opportunityActions?: Record<string, string>
  opportunityActionDefinitions?: Record<string, string>
  /** 机会状态四格：`PUBLISHED` 只能读出来，所以界面上永远没有「标记已发布」那一发 */
  opportunityStates?: Record<string, string>
}

/**
 * 一条机会问题（Spec-F §11.5，10-6）。
 *
 * 三格中文（`gapTypeLabel` / `actionLabel` / `stateLabel`）与两句判据（`gapDefinition`、
 * `verificationNote`）都是后端算好发回来的：视图自己拼一份，就是下一次「界面上说的和库里算的
 * 对不上」的来源。`evidenceNumerator/Denominator` 是这道题这一轮的观测（引用到我们的回答数 /
 * 成功回答数），它撑起了「引用得不稳」那一档，所以必须跟着行走。
 */
export interface GeoOpportunity {
  id: number
  runId: number
  campaignId: number
  questionId: number
  coreWord: string | null
  questionText: string
  kind: string | null
  gapType: string
  gapTypeLabel: string | null
  gapDefinition: string | null
  actionType: string | null
  actionLabel: string | null
  evidenceNumerator: number | null
  evidenceDenominator: number | null
  /** 这一条产出的东西：`page:33` / `faq:8` / `article_task:9` / `case:5`，前缀就是它的出身 */
  draftRef: string | null
  state: string
  stateLabel: string | null
  dismissedReason: string | null
  verifiedRunId: number | null
  verifiedGapType: string | null
  verifiedAt: string | null
  /** 「未验证」/「轮次 N 已验证」那一句：它是一句话，不是第五个状态词（§11.5 第四条） */
  verificationNote: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 某一轮的机会清单：三个数各有出处，`unmeasuredQuestions` 为 null = P4 之前的老轮次没算过 */
export interface GeoOpportunityList {
  runId: number
  unmeasuredQuestions: number | null
  items: GeoOpportunity[]
  opportunityCount: number
  resolvedCount: number
}

/**
 * 一键成内容的回执（后端 `OpportunityDraftVo`）。
 *
 * `nextStep` 是「刚刚产出的那份东西还差哪一步才对访客可见」——页面草稿还缺 seo_title、问答条目
 * 默认没启用、文章任务刚排队。它必须被念出来：按完按钮只说「成功」，客户就会以为草稿已经上线。
 */
export interface GeoOpportunityDraftResult {
  opportunity: GeoOpportunity
  nextStep: string | null
}

/** 一次状态搬迁的留痕（抽屉那条时间线）：`actor=system` 是读出来的，不是人点的 */
export interface GeoOpportunityStateLog {
  id: number
  fromState: string | null
  fromStateLabel: string | null
  toState: string
  toStateLabel: string | null
  actionType: string | null
  actionLabel: string | null
  draftRef: string | null
  actor: string | null
  reason: string | null
  createdAt: string | null
}

/**
 * 一个动作的预估（§11.5：一次模型都不调）。
 *
 * `notice` 非空 ⇒ 按下去也不会受理，它是数据不是错误码；`accounting` 是「这笔钱走哪条账」那句
 * 必须念出来的话——四个动作里三个的账在别的流水线那边，不念清楚客户就以为按一次扣两次。
 */
export interface GeoOpportunityEstimate {
  opportunityId: number
  actionType: string
  actionLabel: string | null
  actionDefinition: string | null
  callCount: number
  estimatedTokens: number
  remainingTokens: number
  tenantBearsCost: boolean
  draftEnabled: boolean
  accounting: string | null
  notice: string | null
}

/**
 * 一条判定（报告抽屉的数据源，也是「另有 N 条未测量」点进去看到的那些行）。
 *
 * 一行要么三档都有、要么一档都不给：`prominence`/`sentiment` 为 null 而 `notMeasuredReason`
 * 非空，就是四道校验里某一道没过（§11.4）。界面对这一行的处理只有「原样念那句原因」，
 * 不许把它渲染成 0%、也不许替它挑一档。
 */
export interface GeoJudgment {
  id: number
  callId: number
  scope: string
  subjectId: number | null
  subject: string
  prominence: string | null
  prominenceLabel: string | null
  positionRank: number | null
  /** 「在推荐清单里的第几项」——词表给的那句，不是「排名」 */
  positionLabel: string | null
  sentiment: string | null
  sentimentLabel: string | null
  sentimentReason: string | null
  /** 原文引句：点不开抽屉里这句话就等于没证据，所以它跟三档一起来 */
  evidenceQuote: string | null
  /** 确定性匹配命中的那段字，抽屉里高亮用的就是它 */
  matchedText: string | null
  judgeModelId: number | null
  judgePromptVersion: string | null
  notMeasuredReason: string | null
  createdAt: string | null
}

/** 溯源抽屉：完整回答原文 + 它名下所有判定行（后端保证这一份里没有任何模型凭据） */
export interface GeoAnswerTrace {
  callId: number
  modelConfigId: number | null
  modelName: string | null
  provider: string | null
  questionText: string | null
  questionKind: string | null
  sampleSeq: number | null
  createdAt: string | null
  answerText: string | null
  judgments: GeoJudgment[]
}

export interface GeoPaged<T> {
  total: number
  page: number
  size: number
  records: T[]
}

export const geoCampaignApi = {
  createCampaign: (form: GeoCampaignForm) => http.post<GeoCampaign>('/geo/campaign', form),

  updateCampaign: (id: number, form: GeoCampaignUpdateForm) => http.put<GeoCampaign>(`/geo/campaign/${id}`, form),

  deleteCampaign: (id: number) => http.delete<void>(`/geo/campaign/${id}`),

  listCampaigns: (params: { brandProfileId?: number | null; page?: number; size?: number }) =>
    http.get<GeoPaged<GeoCampaign>>('/geo/campaign/list', { params }),

  getCampaign: (id: number) => http.get<GeoCampaign>(`/geo/campaign/${id}`),

  /** 只算不调：打完这一发，`ai_call_log` 不该多一行（§11.3 的验收点） */
  estimate: (id: number) => http.get<GeoEstimate>(`/geo/campaign/${id}/estimate`),

  platforms: (siteId: number) => http.get<GeoPlatformOption[]>('/geo/campaign/platforms', { params: { siteId } }),

  /** confirm 一律由调用方给真值：默认 true 就等于把「先看价再点头」这条闸在前端拆掉 */
  run: (id: number, confirm: boolean) => http.post<GeoRun>(`/geo/campaign/${id}/run`, { confirm }),

  runs: (id: number) => http.get<GeoRun[]>(`/geo/campaign/${id}/runs`),

  getRun: (runId: number) => http.get<GeoRun>(`/geo/campaign/run/${runId}`),

  getReport: (runId: number) => http.get<GeoReport>(`/geo/campaign/run/${runId}/report`),

  /**
   * 按【当前竞品勾选】重算这一轮的 SOV（§11.3 的验收点：勾 2 个与勾 5 个各算一次）。
   * 它一次模型都不调用——SOV 判的是「回答里有没有出现这个名字」，那些回答已经存在库里，
   * 换勾选只是换一遍计数。所以它挂 `geo:campaign:run` 却不烧额度，也不新增轮次。
   * 情感判定不在这一条路上：那条要重新过模型，见 Spec §11.4。
   */
  recalculateSov: (runId: number) => http.post<GeoReport>(`/geo/campaign/run/${runId}/sov`),

  /**
   * 判定这一轮（两段式的第二段，§11.4）：一条成功回答一次外呼、一次判全部主体。
   *
   * 它与 `recalculateSov` 是两件相反的事——那一个不花钱，这一个花钱，所以 `confirm` 同样必须由
   * 调用方给真值；重按只补还缺的那几条（「只剔不删」），不会把已判过的重判一遍、也不会重复扣钱。
   */
  judge: (runId: number, confirm: boolean) => http.post<GeoRun>(`/geo/campaign/run/${runId}/judge`, { confirm }),

  /** 这一轮的判定行（含未测量那些）：一次模型都不调，所以它是读口、挂 geo:report:view */
  judgments: (runId: number) => http.get<GeoJudgment[]>(`/geo/campaign/run/${runId}/judgments`),

  /** 抽屉那一格：原文 + 高亮片段 + 判定行（这一份里没有凭据，§11.4 第四条） */
  answer: (callId: number) => http.get<GeoAnswerTrace>(`/geo/campaign/answer/${callId}`),

  vocabulary: () => http.get<GeoVocabulary>('/geo/campaign/vocabulary'),

  // ---------------- 机会问题与一键成内容（P4，§11.5） ----------------

  /**
   * 某一轮的机会清单。它一次模型都不调（所以挂读码），但后端会顺手把「内容自己已经发布」
   * 那几格状态读齐——`PUBLISHED` 只能这样读出来，界面上没有那个按钮。
   */
  opportunities: (runId: number, includeResolved = false) =>
    http.get<GeoOpportunityList>(`/geo/campaign/run/${runId}/opportunities`, { params: { includeResolved } }),

  /** 一条机会的时间线：谁在什么时候把它搬到哪一格、依据什么 */
  opportunityStateLog: (id: number) =>
    http.get<GeoOpportunityStateLog[]>(`/geo/campaign/opportunity/${id}/state-log`),

  /** 一个动作的预估：与 `estimate` 同一条纪律，打完这一发 `ai_call_log` 不该多一行 */
  opportunityEstimate: (id: number, actionType?: string | null) =>
    http.get<GeoOpportunityEstimate>(`/geo/campaign/opportunity/${id}/estimate`, { params: { actionType } }),

  /**
   * 一键成内容：这一屏唯一真花钱的那一发，所以 `confirm` 必须由调用方给真值。
   *
   * 回执里的 `nextStep` 一定要念出来——文章那一个动作只是「任务已经排队」，草稿页还差发布那一步，
   * 把它说成「已生成」就是界面谎报。
   */
  opportunityDraft: (id: number, actionType: string | null, confirm: boolean) =>
    http.post<GeoOpportunityDraftResult>(`/geo/campaign/opportunity/${id}/draft`, { actionType, confirm }),

  /** 放弃这一条：理由必填，且是终态（要往回走只能等下一轮按观测重算） */
  opportunityDismiss: (id: number, reason: string) =>
    http.post<GeoOpportunity>(`/geo/campaign/opportunity/${id}/dismiss`, { reason }),
}

/** 轮次终态：进度轮询到这里就可以停手（判据跟后端 GeoRunStatuses.isTerminal 同一条） */
export function geoRunIsSettled(status: string | null | undefined): boolean {
  return status === 'SUCCEEDED' || status === 'PARTIAL' || status === 'FAILED'
}

export function geoRunIsInFlight(status: string | null | undefined): boolean {
  return status === 'PENDING' || status === 'RUNNING'
}

/** 起跑失败时的排队出口：后端队列满会抛 GEO_CAMPAIGN_QUEUE_FULL，那句话本身就写了重按不会重复扣钱 */
export const GEO_QUEUE_FULL_CODE = 'GEO_CAMPAIGN_QUEUE_FULL'

/**
 * 判定那一段还在跑吗（判据跟后端 `GeoJudgeStates.isInFlight` 同一条）。
 *
 * `null` 是「这一轮从没判过」，与 `FAILED`（判过、失败了）是两件事：前者界面上写「未判定」，
 * 后者写「判定失败」并给原因——合成一格，读的人就分不清该点一次「判定这一轮」还是该回去修模型配置。
 */
export function geoJudgeIsInFlight(state: string | null | undefined): boolean {
  return state === 'JUDGING'
}

/** 判定队列满的出口：与起跑那一发同一条纪律——重按只补缺的那几条，不会重复扣钱 */
export const GEO_JUDGE_QUEUE_FULL_CODE = 'GEO_JUDGE_QUEUE_FULL'
