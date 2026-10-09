/**
 * WizardSteps 的状态模型（放独立文件：`<script setup>` 里不许有 ES 值导出）。
 * 调用方把这个对象落库/写 localStorage，刷新后原样传回 modelValue 即回到原步。
 */
export type WizardStepDef = {
  key: string
  title: string
  /**
   * 这一步在真实数据上完成没有（Spec-M §7.1 建站向导要的「走到哪了」）。
   * 不给就是原来的两步表单向导（GEO 品牌诊断那一套一个字都不变）。
   * 这一步的完成与否只由调用方从后端读数判，界面不许自己勾「完成」。
   */
  status?: 'wait' | 'process' | 'finish' | 'error'
}
export type WizardState = { current: number; maxReached: number }

export const createWizardState = (): WizardState => ({ current: 0, maxReached: 0 })
