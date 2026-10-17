import http from './http'

/**
 * 建站说明书（Spec-M D1/D7，后端 V172 + SiteSpecController）。
 *
 * 四口全部挂在需求单下，且全部只有超管能碰（D3 拍板「入口仍只给超管」）：
 * 读 / 逐段写 / AI 出初稿 / 确认签字。这里没有任何一条是「进页面就自己发」的写口——
 * 出初稿那一发既花租户配额，又会整份覆盖超管改过的字。
 *
 * 七段的段名、标题、顺序、上限全部来自后端回包（I-1：界面不抄第二份清单），
 * 所以这个文件里没有任何一个段名字面量，前端也不许按数组下标认段。
 */

/** 一段的显示模型：段名与上限都只认后端那一份 */
export interface SpecSection {
  key: string
  /** 界面上那一行的标题，带序号（后端 SiteSpecSections.title()） */
  title: string
  order: number
  content: string | null
  charCount: number
  blank: boolean
  overLimit: boolean
}

export interface SpecDocumentView {
  specId: number | null
  briefId: number
  tenantId: number | null
  /** false = 这一单从来没有过说明书，界面念「还没有说明书」而不是念「草稿」 */
  exists: boolean
  status: string | null
  statusLabel: string
  specVersion: number
  confirmedBy: string | null
  confirmedAt: string | null
  aiDraftProvider: string | null
  aiDraftModel: string | null
  aiDraftAt: string | null
  /**
   * 「AI 出初稿」这<em>一次任务</em>的状态（RUNNING / SUCCEEDED / FAILED），与上面的 status 是两回事：
   * 那一族说的是<b>文档</b>（草稿 / 已确认），这一族说的是<b>那一次异步外呼</b>。
   * null = 从来没有异步出过初稿，界面念后端给的中文标签，不自己译。
   */
  draftStatus: string | null
  draftStatusLabel: string
  draftStartedAt: string | null
  /** 已经等了多久（毫秒），只在 RUNNING 时给；null 不是「等了 0 秒」，是「没在等」 */
  draftWaitMs: number | null
  draftErrorMessage: string | null
  /** 这一发以往实测多久那一句（读自 ai_call_log，出处唯一）；没有历史读数时后端会给一句「没法说」 */
  draftLatencyNote: string | null
  maxSectionChars: number
  sections: SpecSection[]
  /** 本次动作要额外告诉人的话（签字被落回草稿、这一发有没有落账） */
  notices: string[]
  /** 确认与生成会拦下这一份的原因；空表 = 可以直接确认。界面上「为什么还不能生成」读它 */
  blockers: string[]
}

/**
 * 版本目录里的一行。
 *
 * current = 主表现在就是这一版（还没改出新的）；latestDraft 那一行的 specVersion 是
 * currentVersion+1 还是别的都不重要，界面只认后端说的「现在这一版」。
 */
export interface SpecVersionRow {
  specVersion: number
  confirmedBy: string | null
  confirmedAt: string | null
  /** 存档当时七段里写了几段 */
  filledSections: number
  /** 存档当时七段一共多少字：界面上的差额读它，不自己数 */
  totalChars: number
  current: boolean
}

export interface SpecVersionsView {
  specId: number | null
  /** 主表现在第几版：可能比任何一份存档都大（历史表之前签的那几版没留正文） */
  currentVersion: number
  status: string | null
  statusLabel: string
  versions: SpecVersionRow[]
  /** 「和现在这一版比」那一项：读的是主表全文，不是存档 */
  latestDraft: SpecVersionRow | null
  notices: string[]
}

export interface SpecSectionDiff {
  key: string
  title: string
  order: number
  changed: boolean
  charCountFrom: number
  charCountTo: number
  contentFrom: string | null
  contentTo: string | null
}

export interface SpecDiffView {
  specId: number | null
  briefId: number
  fromVersion: number | null
  fromLabel: string | null
  fromConfirmedAt: string | null
  /** null = 现在这一版（主表全文，含还没签字的改动） */
  toVersion: number | null
  toLabel: string | null
  toConfirmedAt: string | null
  changedSections: number
  sections: SpecSectionDiff[]
  notices: string[]
}

export const siteSpecApi = {
  /** GET：只读，零模型调用。进度也在这一口读（draftStatus / draftWaitMs / draftLatencyNote 三格） */
  read: (briefId: number) => http.get<SpecDocumentView>(`/admin/site-briefs/${briefId}/spec`),

  /** PUT：只写一段。正文逐字提交，前端不做 trim、不做截断（截断是这一族明令禁止的谎报） */
  saveSection: (briefId: number, sectionKey: string, content: string) =>
    http.put<SpecDocumentView>(`/admin/site-briefs/${briefId}/spec/${sectionKey}`, { content }),

  /**
   * POST：<b>受理</b>一次 AI 出初稿，不是等它跑完。整份覆盖，所以七段里已经有字时必须带 overwrite=true。
   *
   * <p>这一发会真调模型、真花配额，前端不许在任何自动路径里调它。返回的回包里 draftStatus 就是
   * RUNNING，之后由界面按进度轮询 {@link siteSpecApi.read}；后端那边的幂等闸保证第二发 POST 会被当面拒，
   * 所以按钮 disable 只是好看，不是唯一的闸（M-P33 拍板 ⑨）。</p>
   *
   * <p>这里曾经挂着 330000 毫秒的单独超时，理由是「这一发是同步等模型的一次 chat，而后端
   * `app.ai.chat-timeout-seconds` 卡着 300 秒，界面只有等得过它才看得见真话；现场实测两趟模型跑了
   * 163 秒与 212 秒，浏览器却在第 31.7 秒弹『请求超时』——同一次动作两套结论，而且那句失败是假的」。
   * 那一套形状已经不存在：POST 现在只做五道不要钱的闸（开关 / 幂等 / 覆盖 / 模板 / 余额）加一次受理写库，
   * 真外呼在 `siteSpecDraftTaskExecutor` 那一条线程里跑，请求线程几十毫秒就回来。
   * 所以跟着全局 30 秒预算走才是对的形状；留着 330 秒等于在界面上演「还在等模型」。</p>
   */
  draft: (briefId: number, overwrite: boolean) =>
    http.post<SpecDocumentView>(`/admin/site-briefs/${briefId}/spec/draft`, { overwrite }),

  /** POST：签字放行。只有签过字的版本才会被拿去生成（Spec-M §3 闸一） */
  confirm: (briefId: number) => http.post<SpecDocumentView>(`/admin/site-briefs/${briefId}/spec/confirm`),

  /**
   * GET：这一单存档了哪几版。只读、零模型调用、不花配额，所以进页面顺带发一次没关系，
   * 但也不在进页面时发——它跟七段编辑是两件事，点开「版本对比」才要。
   */
  versions: (briefId: number) => http.get<SpecVersionsView>(`/admin/site-briefs/${briefId}/spec/versions`),

  /**
   * GET：两版逐段差异。to 不给就是「和现在这一版（主表全文）比」。
   * from 必须是存档里的某一版，填错了后端点名有哪些版可填。
   */
  diff: (briefId: number, from: number, to?: number | null) =>
    http.get<SpecDiffView>(`/admin/site-briefs/${briefId}/spec/diff`, {
      params: to == null ? { from } : { from, to }
    })
}
