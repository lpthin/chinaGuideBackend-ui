<script setup lang="ts">
/**
 * 真向导（Spec-F §9.2-4）：步骤条 + 每步校验钩子 + 可持久化的步骤状态。
 * 状态存在 modelValue 这个对象里，由调用方负责落库/写 localStorage ⇒ 刷新后把同一个对象传回来就回到原步。
 * beforeNext(to) 返回 string＝校验不过并把该句显示在步底；返回 true/undefined＝放行。
 */
import { computed, ref } from 'vue'
import type { WizardState, WizardStepDef } from './wizardModel'

const props = defineProps<{
  steps: WizardStepDef[]
  modelValue: WizardState
  beforeNext?: (to: number) => boolean | string | undefined | Promise<boolean | string | undefined>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: WizardState): void
}>()

const hint = ref('')

const current = computed(() => {
  const idx = props.modelValue.current
  return Math.min(Math.max(idx, 0), props.steps.length - 1)
})
const isLast = computed(() => current.value >= props.steps.length - 1)

async function go(to: number) {
  if (to < 0 || to >= props.steps.length) return
  if (to > current.value && props.beforeNext) {
    const verdict = await props.beforeNext(to)
    if (typeof verdict === 'string') {
      hint.value = verdict
      return
    }
    if (verdict === false) {
      hint.value = '请先完成本步的必填项'
      return
    }
  }
  hint.value = ''
  emit('update:modelValue', {
    current: to,
    maxReached: Math.max(props.modelValue.maxReached, to),
  })
}
</script>

<template>
  <div class="admin-wizard">
    <a-steps :current="current" size="small">
      <a-step v-for="step in steps" :key="step.key" :title="step.title" />
    </a-steps>
    <div class="admin-wizard__body">
      <slot v-if="steps[current]" :name="`step-${steps[current].key}`" />
    </div>
    <div v-if="hint" class="admin-wizard__hint">{{ hint }}</div>
    <div class="admin-wizard__nav">
      <a-button :disabled="current === 0" @click="go(current - 1)">上一步</a-button>
      <a-button v-if="!isLast" type="primary" @click="go(current + 1)">下一步</a-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.admin-wizard {
  &__body {
    margin-top: 24px;
  }

  &__hint {
    margin-top: 8px;
    color: #ff4d4f;
    font-size: 12px;
  }

  &__nav {
    margin-top: 24px;
    display: flex;
    gap: 8px;
  }
}
</style>
