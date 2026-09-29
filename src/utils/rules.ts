/**
 * 表单校验单一来源（Spec-F §9.2-6）。
 * 规矩：红星（a-form-item 上的必输标记）只能由 rules 派生——
 * 现在界面里 65 处手写 required 标记、只有 10 个文件真配了 rules，「画了红星不校验」从这里止住。
 * label 进消息文案，不再每条规则各写一句解释。
 */
import type { Rule } from 'ant-design-vue/es/form'

export const required = (label: string): Rule => ({
  required: true,
  message: `请填写${label}`,
})

/** 下拉/选择类的必选措辞与输入类分开，避免「请填写类型」这种话 */
export const requiredSelect = (label: string): Rule => ({
  required: true,
  message: `请选择${label}`,
})

export const maxLength = (n: number, label: string): Rule => ({
  max: n,
  message: `${label}不能超过 ${n} 个字`,
})

export const numberRange = (min: number, max: number, label: string): Rule => ({
  type: 'number',
  min,
  max,
  message: `${label}须在 ${min}~${max} 之间`,
})

export const pattern = (re: RegExp, message: string): Rule => ({ pattern: re, message })
