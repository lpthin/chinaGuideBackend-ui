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
 * - colorInfo 必须显式写：antd 的 seed 里 `colorInfo: '#1677ff'` 是**独立的一支**，
 *   不跟 colorPrimary 走（`es/theme/themes/seed.js` 定 seed，`shared/genColorMapToken.js`
 *   再按它单独生成 info 色板）。浏览器 UI 验收量到的事实：诊断工作台 14 处、品牌档案 2 处、
 *   关键词 2 处、诊断报告 6 处计算色是 rgb(22, 119, 255)，而主按钮与链接是 rgb(24, 144, 255)
 *   ⇒ 同一屏两支蓝。并到主色之后全站只剩一支。
 */
/**
 * 中文字体栈（Spec-Q P0）。
 *
 * 为什么放在主题令牌里而不是全局样式：ant-design-vue 4 的 CSS-in-JS 是**按组件元素**写 font-family 的
 * （th / .ant-btn / label / td 各来一条），所以 `body { font-family: ... }` 那一条对整片后台样式是无效的。
 * 2026-11-06 实量：挂上 body 规则之后，门店页 9 个采样点的计算字体仍然全是 antd 默认那支
 * `-apple-system … Arial, Noto Sans, sans-serif, 表情符号`，里面**一个中文字体都没有**
 * ⇒ 中文一律落到浏览器最后的 `sans-serif` 兜底，客户机上装了什么字体就显示什么。
 * 只有把 fontFamily 交进 token，antd 生成的那一片规则才会跟着换。
 *
 * 与 styles/admin-tokens.less 的 `--admin-font-family` 同值（同 SPACING 那对的处理办法：
 * TS 这份是给 antd 的，less 那份是给页面自己写的裸元素用的，改一处要同时改另一处）。
 */
export const ADMIN_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif"

export const ADMIN_THEME_TOKEN = {
  colorPrimary: '#1890ff',
  colorInfo: '#1890ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorTextPlaceholder: '#bfbfbf',
  borderRadius: 6,
  fontSize: 14,
  controlHeight: 32,
  fontFamily: ADMIN_FONT_FAMILY,
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
