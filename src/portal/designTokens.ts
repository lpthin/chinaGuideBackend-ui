/**
 * design token 的界面描述：键名必须与后端 LayoutValidator 的白名单一致，
 * 顺序与中文标签只在这里放一份（页面搭建器与沉淀页共用，避免两处各写一套标签）。
 *
 * 值域（颜色/px/比例区间）不在这里判：那会构成第二份真相，服务端校验器判不过时
 * 会把中文原因原样透出，界面只负责显示。
 */
export type DesignTokenKind = 'text' | 'number'

export interface DesignTokenField {
  key: string
  label: string
  kind: DesignTokenKind
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

export const DESIGN_TOKEN_FIELDS: DesignTokenField[] = [
  { key: 'colorPrimary', label: '主色', kind: 'text', placeholder: '#1677ff' },
  { key: 'colorBg', label: '背景色', kind: 'text', placeholder: '#ffffff' },
  { key: 'colorText', label: '正文色', kind: 'text', placeholder: '#1f1f1f' },
  { key: 'colorMuted', label: '次要文字色', kind: 'text', placeholder: '#666666' },
  { key: 'radius', label: '圆角', kind: 'text', placeholder: '12px' },
  { key: 'sectionMaxWidth', label: '区块最大宽度', kind: 'text', placeholder: '1120px' },
  { key: 'fontScale', label: '字号比例', kind: 'number', min: 0.8, max: 1.4, step: 0.05 },
  { key: 'spacingScale', label: '间距比例', kind: 'number', min: 0.5, max: 2, step: 0.1 }
]

const LABEL_BY_KEY = new Map(DESIGN_TOKEN_FIELDS.map(field => [field.key, field.label]))

export function designTokenLabel(key: string): string {
  return LABEL_BY_KEY.get(key) ?? key
}
