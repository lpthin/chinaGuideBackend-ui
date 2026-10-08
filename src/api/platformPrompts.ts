import http from './http'

/**
 * 平台默认提示词（Spec-M D2，后端 PlatformPromptTemplateController + V173）。
 *
 * 三口的分工：列表不带正文（八份正文一起回就是让界面自己卡住）；详情带正文与变量清单；
 * 保存只 PUT 正文/名称/版本/启停。这里没有新增也没有删除——一份提示词的存在由迁移决定，
 * 界面上给一个「新增 purpose」就是允许造出没有任何 Java 变量表喂它的行。
 *
 * 变量清单、中文标题、能占的位、拦下的理由全部来自后端回包：前端抄一份清单就是第二份真相，
 * 两边哪天不同步，没人说得清模型看见的是哪一份。
 */

/** 列表行：正文不在这里（id 为 null = 这一支迁移还没落，界面要显式念「缺」） */
export interface PlatformPromptSummary {
  id: number | null
  purpose: string
  title: string
  stage: string
  name: string | null
  version: string | null
  enabled: boolean
  isSystem: boolean
  updatedAt: string | null
  charCount: number
  placeholders: string[]
  unknownPlaceholders: string[]
}

/** 详情：variables 是这一步能占的位 → 一句话说明（后端 SiteBriefPromptCatalogue 那一份） */
export interface PlatformPromptDetail {
  summary: PlatformPromptSummary
  templateText: string | null
  variables: Record<string, string>
  note: string
  notices: string[]
}

/** 写口入参：没有 purpose，它不可改 */
export interface PlatformPromptForm {
  name?: string | null
  version?: string | null
  templateText?: string | null
  enabled?: boolean | null
}

/** 各站正在盖着这一份全局措辞的覆盖行（只读，一站一行 = 生成真会拿的那条） */
export interface PlatformPromptOverride {
  id: number
  siteId: number
  /** null = 站点行读不到（已删/脏数据），界面点名缺，不编名字 */
  siteName: string | null
  name: string | null
  version: string | null
  enabled: boolean
  updatedAt: string | null
  charCount: number
  unknownPlaceholders: string[]
}

export const platformPromptApi = {
  list: () => http.get<PlatformPromptSummary[]>('/admin/prompt-templates/platform'),

  detail: (purpose: string) =>
    http.get<PlatformPromptDetail>(`/admin/prompt-templates/platform/${purpose}`),

  /** PUT：保存后直接回详情（含「这一改有没有留下填不上的位」），前端不必再读一遍 */
  save: (purpose: string, form: PlatformPromptForm) =>
    http.put<PlatformPromptDetail>(`/admin/prompt-templates/platform/${purpose}`, form),

  overrides: (purpose: string) =>
    http.get<PlatformPromptOverride[]>(`/admin/prompt-templates/platform/${purpose}/overrides`)
}
