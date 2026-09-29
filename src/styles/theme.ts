/**
 * 后台唯一主题出处（Spec-F §9.2-1）。
 *
 * 色值不是设计拍脑袋：全部取仓库里现有硬编码值中出现频次最高的那一支，
 * 保证「挂上 config-provider 的今天」与「昨天」观感一致。
 * - colorPrimary #1890ff：src 内 112 处硬编码蓝（stat-icon 渐变、链接色），是事实主色；
 * - colorSuccess #52c41a（75 处）、colorWarning #faad14（23 处；#fa8c16 那 46 处是装饰橙不算警告语义）、
 *   colorError #ff4d4f（37 处）；
 * - colorTextPlaceholder #bfbfbf、borderRadius 6 / fontSize 14 / controlHeight 32
 *   与 antd v4 默认一致，避免控件尺寸与字号今天跳动。
 */
export const ADMIN_THEME_TOKEN = {
  colorPrimary: '#1890ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorTextPlaceholder: '#bfbfbf',
  borderRadius: 6,
  fontSize: 14,
  controlHeight: 32,
} as const

export type AdminThemeToken = typeof ADMIN_THEME_TOKEN

/** 间距只允许 8 的倍数（Spec-F §9.5）。less 侧同名变量见 styles/admin-tokens.less。 */
export const SPACING = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
} as const

export type SpacingKey = keyof typeof SPACING
