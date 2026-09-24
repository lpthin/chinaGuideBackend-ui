import http from './http'
import type { PortalPage } from './portalPages'

/**
 * 门户「沉淀」接口（Spec §8.1）：皮肤 = 一组 design token；平台模板 = 剥离过客户内容的区块组合。
 *
 * 两条不能靠前端自觉的规则：
 * 1. promote 只有超管能做，且来源网址 + 「已人工确认」勾选缺一不可——服务端同样判，
 *    这里的勾选框只是让人无法「没看见这个选项」；
 * 2. 可改的样式变量清单从 `GET /portal/theme-presets/tokens` 取，与后端校验器同一份真相，
 *    前端不抄第二份白名单（抄了就不会跟着后端变，历史上三套模板的词表就是这么错开的）。
 */
export interface ThemePreset {
  id: number
  tenantId?: number | null
  name: string
  /** design token 覆盖，JSON 字符串；键与值域以 /tokens 返回的白名单为准 */
  tokensJson: string | null
  /** 为空表示这行只是皮肤；非空是平台模板（文案已换成演示文本） */
  layoutJson: string | null
  sourcePageId: number | null
  /** 剥离/替换清单，JSON 数组字符串：审核人据此确认这里没有客户内容 */
  strippedJson: string | null
  createdBy: string | null
  provenanceUrl: string | null
  provenanceNote: string | null
  isPlatform: boolean | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface SaveSkinForm {
  pageId: number
  name: string
}

export interface ApplySkinForm {
  pageId: number
  /** 乐观锁基线，构建器/本页都要传当前版本；冲突时后端回 409 */
  baseVersion: number
}

export interface InstantiateForm {
  siteId?: number | null
  slug: string
  title?: string | null
}

export interface PromoteForm {
  pageId: number
  name: string
  provenanceUrl: string
  provenanceNote?: string | null
  /** 未勾选后端直接 400：平台资产被 N 个客户复用 = 一次侵权风险放大 N 倍 */
  provenanceReviewed: boolean
}

/**
 * 一个可改的样式变量：后端 LayoutValidator 的白名单条目。
 * kind 决定渲哪种输入框，min/max 只对 SCALE 有意义（COLOR/LENGTH 回 0，界面不读）。
 */
export interface ThemeTokenField {
  key: string
  kind: 'COLOR' | 'LENGTH' | 'SCALE'
  min: number
  max: number
}

export const themePresetsApi = {
  /** 可改的样式变量清单（唯一真相：LayoutValidator 里那一份声明，含种类与比例区间） */
  tokens: () => http.get<ThemeTokenField[]>('/portal/theme-presets/tokens'),

  list: () => http.get<ThemePreset[]>('/portal/theme-presets'),

  get: (id: number) => http.get<ThemePreset>(`/portal/theme-presets/${id}`),

  saveSkin: (data: SaveSkinForm) => http.post<ThemePreset>('/portal/theme-presets', data),

  apply: (id: number, data: ApplySkinForm) =>
    http.post<PortalPage>(`/portal/theme-presets/${id}/apply`, data),

  instantiate: (id: number, data: InstantiateForm) =>
    http.post<PortalPage>(`/portal/theme-presets/${id}/instantiate`, data),

  remove: (id: number) => http.delete<void>(`/portal/theme-presets/${id}`),

  /** 平台级沉淀：另一个控制器、另一个权限码（portal:template:promote），租户侧没有这个口 */
  promote: (data: PromoteForm) =>
    http.post<ThemePreset>('/admin/portal/theme-presets/promote', data),
}
