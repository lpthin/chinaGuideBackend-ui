<script setup lang="ts">
/**
 * 指标卡唯一出处（Spec-F §9.2-4、§9.5-4）：值 / 分子分母 / 置信区间 / 口径 tooltip。
 * tooltip 文本只能从 copy/metrics.ts 按 metricKey 取——组件不收解释性字符串参数，
 * 「每个页自己解释指标」这条路在这里堵死。值没测到显示 PH_NOT_MEASURED，绝不显示 0。
 */
import { computed } from 'vue'
import { METRIC_COPY, type MetricKey } from '../copy/metrics'
import { PH_DASH, PH_NOT_MEASURED } from '../utils/display'

const props = defineProps<{
  label: string
  value?: string | number | null
  numerator?: number | null
  denominator?: number | null
  /** 置信区间展示串，如 '±5.1%'；率的卡必须带（§5 置信行） */
  ci?: string | null
  metricKey: MetricKey
}>()

const copy = computed(() => METRIC_COPY[props.metricKey])
const shownValue = computed(() => (props.value === null || props.value === undefined ? PH_NOT_MEASURED : String(props.value)))
const fraction = computed(() =>
  props.denominator === null || props.denominator === undefined
    ? null
    : `${props.numerator ?? PH_DASH} / ${props.denominator}`
)
</script>

<template>
  <div class="admin-stat-card">
    <div class="admin-stat-card__head">
      <span class="admin-stat-card__label">{{ label }}</span>
      <a-tooltip :title="copy.tip">
        <span class="admin-stat-card__metric-name">（{{ copy.name }}口径）</span>
      </a-tooltip>
    </div>
    <div class="admin-stat-card__value">{{ shownValue }}</div>
    <div v-if="fraction" class="admin-stat-card__fraction">{{ fraction }}</div>
    <div v-if="ci" class="admin-stat-card__ci">{{ ci }}</div>
  </div>
</template>

<style scoped lang="less">
.admin-stat-card {
  padding: 16px;
  border-radius: var(--admin-radius-card, 12px);
  border: 1px solid #f0f0f0;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__label {
    color: #8c8c8c;
    font-size: 13px;
  }

  &__metric-name {
    color: #bfbfbf;
    font-size: 12px;
    cursor: help;
  }

  &__value {
    margin-top: 8px;
    font-size: 24px;
    font-weight: 600;
    text-align: right;
  }

  &__fraction,
  &__ci {
    margin-top: 8px;
    color: #8c8c8c;
    font-size: 12px;
    text-align: right;
  }
}
</style>
