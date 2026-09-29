<script setup lang="ts">
/**
 * 词表标签（Spec-F §9.2-4）：品牌词 / 竞品词 / 命中类型这类「词表成员」标记，
 * 颜色语义固定：brand=绿、competitor=橙、hit=蓝、neutral=default。
 * 与 StatusTag 的分工：StatusTag 管生命周期状态，DictTag 管词归类，互不顶替。
 */
import { computed } from 'vue'
import { PH_DASH } from '../utils/display'

export type DictTagKind = 'brand' | 'competitor' | 'hit' | 'neutral'

const props = withDefaults(
  defineProps<{
    kind?: DictTagKind
    value?: string | null
  }>(),
  { kind: 'neutral', value: null }
)

const COLORS: Record<DictTagKind, string> = {
  brand: 'green',
  competitor: 'orange',
  hit: 'blue',
  neutral: 'default',
}

const color = computed(() => COLORS[props.kind])
const text = computed(() => props.value || PH_DASH)
</script>

<template>
  <a-tag :color="color">{{ text }}</a-tag>
</template>
