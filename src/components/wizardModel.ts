/**
 * WizardSteps 的状态模型（放独立文件：`<script setup>` 里不许有 ES 值导出）。
 * 调用方把这个对象落库/写 localStorage，刷新后原样传回 modelValue 即回到原步。
 */
export type WizardStepDef = { key: string; title: string }
export type WizardState = { current: number; maxReached: number }

export const createWizardState = (): WizardState => ({ current: 0, maxReached: 0 })
