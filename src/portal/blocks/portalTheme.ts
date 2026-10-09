import type { RenderedPage } from '../api/portalPublic'

/**
 * theme_json → CSS 变量的唯一一处映射。
 *
 * 允许的键由后端 LayoutValidator 白名单化（决策 D4：运行时换肤只动这些旋钮），
 * 前端只搬运不解释；访客页、搭建器预览、AI 草稿比对框都用这一份，
 * 抄第二处的话「预览里的效果」和「线上效果」就会不一致。
 *
 * theme 本身在进这里之前已经合成过一次（后端 PortalPageResolver：站级打底、页级逐键覆盖），
 * 所以这一层拿到的就是「这一页最终该长什么样」，不再区分它来自站还是来自页。
 */
export const THEME_VARS: Record<string, string> = {
  colorPrimary: '--portal-color-primary',
  colorAccent: '--portal-color-accent',
  colorBg: '--portal-color-bg',
  colorText: '--portal-color-text',
  colorMuted: '--portal-color-muted',
  radius: '--portal-radius',
  sectionMaxWidth: '--portal-section-max-width',
  fontScale: '--portal-font-scale',
  spacingScale: '--portal-spacing-scale',
  fontHeading: '--portal-font-heading',
  fontBody: '--portal-font-body'
}

/**
 * 字体标识 → CSS 字体栈（Spec-M D6：白名单只放枚举标识，栈只写这一处）。
 *
 * 为什么不把栈交给后端下发：theme_json 的值最后会变成 font-family，收自由文本等于把
 * 「不许产出任意样式」那条红线从侧面撕开。标识由后端校验器认，栈由这里翻译，
 * 两边各自封闭——后端那份 FONT_OPTIONS 的 value 必须在这一份里出现（有对账用例钉着）。
 */
export const FONT_STACKS: Record<string, string> = {
  'system-sans': '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
  'source-han-sans': '"Source Han Sans SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  pingfang: '"PingFang SC", "Microsoft YaHei", sans-serif',
  'system-serif': 'Georgia, "Times New Roman", "Songti SC", serif',
  songti: '"SimSun", "Songti SC", "STSong", serif'
}

export function themeVars(theme: RenderedPage['theme'] | undefined): Record<string, string> {
  const style: Record<string, string> = {}
  if (!theme) {
    return style
  }
  Object.entries(THEME_VARS).forEach(([token, cssVar]) => {
    const value = theme[token]
    if (value === undefined || value === null || value === '') {
      return
    }
    if (token === 'fontHeading' || token === 'fontBody') {
      // 认不出的标识宁可这一格不下发（回落到 :root 的默认栈），也不原样拼进 font-family
      const stack = FONT_STACKS[String(value)]
      if (stack) {
        style[cssVar] = stack
      }
      return
    }
    style[cssVar] = String(value)
  })
  return style
}

