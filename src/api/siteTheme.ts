import http from './http'
import type { ThemePreset } from './themePresets'

/**
 * 站级主题（`site.theme_json`，Spec-M §9.1）：整站唯一的样式源。
 *
 * 三条口径在这里说清，免得前端各猜一份：
 * 1. **整份替换**——写进去的就是这一站的全部样式变量，不是增量；想「只改一个键」也得把其余的一起带上；
 * 2. **空白 = 清空**——这一站没有站级主题，各页各自的覆盖位与骨架默认生效（后端走显式写 NULL 的口，
 *    不是那个会把 null 剔出 SET 的 `updateById`）；
 * 3. 这三个口都挂在 `/api/admin/sites/**` 下，整棵要 `portal:build:manage`（平台侧口，不是租户自助口）。
 */
export interface SiteThemeRow {
  id: number
  name?: string | null
  themeJson: string | null
  /** 套自哪一份沉淀，只留痕不读侧取数 */
  themePresetId: number | null
  themeUpdatedAt: string | null
}

export const siteThemeApi = {
  get: (siteId: number) => http.get<SiteThemeRow>(`/admin/sites/${siteId}`),

  /** 空白串就是「清空这一站的站级主题」，不是「这一列不动」 */
  update: (siteId: number, themeJson: string) =>
    http.put<SiteThemeRow>(`/admin/sites/${siteId}/theme`, { themeJson }),

  /** 存皮肤 = 把这一站现在的站级样式变量抽成一份沉淀 */
  saveSkin: (siteId: number, name: string) =>
    http.post<ThemePreset>(`/admin/sites/${siteId}/theme/skin`, { name }),

  /** 套皮肤 = 写站级主题（逐页不动，读侧合成后全站生效） */
  applySkin: (siteId: number, presetId: number) =>
    http.post<SiteThemeRow>(`/admin/sites/${siteId}/theme/apply-skin`, { presetId }),
}
