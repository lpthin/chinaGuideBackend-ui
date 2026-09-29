<script setup lang="ts">
/**
 * 三态块（Spec-F §9.2-4）：空 / 错 / 未取到，三态语义不许互换（display.ts 的 PH_NONE / PH_NOT_MEASURED），
 * 每态自带一条「下一步做什么」，消灭 v-if 整块消失后用户面对空白。
 */
import { computed } from 'vue'
import { PH_NONE, PH_NOT_MEASURED } from '../utils/display'

const props = defineProps<{
  state: 'empty' | 'error' | 'not-measured'
  title?: string
  detail?: string
  next?: string
}>()

const TEXTS = {
  empty: { title: PH_NONE, next: '调整筛选条件，或新建一条记录' },
  error: { title: '读取失败', next: '稍后重试；持续失败请把页面上的原因或 traceId 提交工单' },
  'not-measured': { title: PH_NOT_MEASURED, next: '完成一次诊断/取数后这里才会出数，空着不代表是 0' },
} as const

const shownTitle = computed(() => props.title || TEXTS[props.state].title)
const shownNext = computed(() => props.next || TEXTS[props.state].next)
</script>

<template>
  <div class="admin-state-block" :data-state="state">
    <div class="admin-state-block__title">{{ shownTitle }}</div>
    <div v-if="detail" class="admin-state-block__detail">{{ detail }}</div>
    <div class="admin-state-block__next">{{ shownNext }}</div>
    <div v-if="$slots.default" class="admin-state-block__extra">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="less">
.admin-state-block {
  padding: 24px;
  text-align: center;
  color: #8c8c8c;

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #595959;
  }

  &__detail {
    margin-top: 8px;
    font-size: 12px;
  }

  &__next {
    margin-top: 8px;
    font-size: 12px;
  }

  &__extra {
    margin-top: 16px;
  }
}
</style>
