import type { ThemeTokenField } from '../api/themePresets'

/**
 * design token 的界面词表：只放中文标签与示例值。
 *
 * 键名、种类（颜色/长度/比例）与比例类的合法区间的唯一真相在后端 `LayoutValidator`，
 * 由 `GET /portal/theme-presets/tokens` 回传，搭建器照那份清单渲输入框。
 * 这里曾经是一份 8 个旋钮的完整声明——服务端哪天加第 9 个，界面不会报错，只会安静少一个输入框。
 * 值域判定也从来不在前端：界面上出现的是校验器回传的中文原因。
 */

const LABEL_BY_KEY: Record<string, string> = {
  colorPrimary: '主色',
  colorBg: '背景色',
  colorText: '正文色',
  colorMuted: '次要文字色',
  radius: '圆角',
  sectionMaxWidth: '区块最大宽度',
  fontScale: '字号比例',
  spacingScale: '间距比例'
}

const PLACEHOLDER_BY_KEY: Record<string, string> = {
  colorPrimary: '#1677ff',
  colorBg: '#ffffff',
  colorText: '#1f1f1f',
  colorMuted: '#666666',
  radius: '12px',
  sectionMaxWidth: '1120px'
}

/** 后端有、这里没配中文名的键退回显示原始键名：难看，但看得见，不会变成「少了一个输入框」 */
export function designTokenLabel(key: string): string {
  return LABEL_BY_KEY[key] ?? key
}

export function designTokenPlaceholder(key: string): string | undefined {
  return PLACEHOLDER_BY_KEY[key]
}

export type { ThemeTokenField }
