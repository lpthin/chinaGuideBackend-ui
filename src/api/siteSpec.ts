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
  maxSectionChars: number
  sections: SpecSection[]
  /** 本次动作要额外告诉人的话（签字被落回草稿、这一发有没有落账） */
  notices: string[]
  /** 确认与生成会拦下这一份的原因；空表 = 可以直接确认。界面上「为什么还不能生成」读它 */
  blockers: string[]
}

export const siteSpecApi = {
  /** GET：只读，零模型调用 */
  read: (briefId: number) => http.get<SpecDocumentView>(`/admin/site-briefs/${briefId}/spec`),

  /** PUT：只写一段。正文逐字提交，前端不做 trim、不做截断（截断是这一族明令禁止的谎报） */
  saveSection: (briefId: number, sectionKey: string, content: string) =>
    http.put<SpecDocumentView>(`/admin/site-briefs/${briefId}/spec/${sectionKey}`, { content }),

  /**
   * POST：AI 出初稿。整份覆盖，所以七段里已经有字时必须带 overwrite=true。
   * 这一发会真调模型、真花配额，前端不许在任何自动路径里调它。
   */
  draft: (briefId: number, overwrite: boolean) =>
    http.post<SpecDocumentView>(`/admin/site-briefs/${briefId}/spec/draft`, { overwrite }),

  /** POST：签字放行。只有签过字的版本才会被拿去生成（Spec-M §3 闸一） */
  confirm: (briefId: number) => http.post<SpecDocumentView>(`/admin/site-briefs/${briefId}/spec/confirm`)
}
