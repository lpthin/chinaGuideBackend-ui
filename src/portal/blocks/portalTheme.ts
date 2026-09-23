import type { RenderedPage } from '../api/portalPublic'

/**
 * theme_json → CSS 变量的唯一一处映射。
 *
 * 允许的键由后端 LayoutValidator 白名单化（决策 D4：运行时换肤只动这些旋钮），
 * 前端只搬运不解释；访客页、搭建器预览、AI 草稿比对框都用这一份，
 * 抄第二处的话「预览里的效果」和「线上效果」就会不一致。
 */
export const THEME_VARS: Record<string, string> = {
  colorPrimary: '--portal-color-primary',
  colorBg: '--portal-color-bg',
  colorText: '--portal-color-text',
  colorMuted: '--portal-color-muted',
  radius: '--portal-radius',
  sectionMaxWidth: '--portal-section-max-width',
  fontScale: '--portal-font-scale',
  spacingScale: '--portal-spacing-scale'
}

export function themeVars(theme: RenderedPage['theme'] | undefined): Record<string, string> {
  const style: Record<string, string> = {}
  if (!theme) {
    return style
  }
  Object.entries(THEME_VARS).forEach(([token, cssVar]) => {
    const value = theme[token]
    if (value !== undefined && value !== null && value !== '') {
      style[cssVar] = String(value)
    }
  })
  return style
}
