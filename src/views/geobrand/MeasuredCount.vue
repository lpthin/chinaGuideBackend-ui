<script setup lang="ts">
/**
 * 计数显示唯一出口（§9.6 不许谎报）：没测过的数显示 PH_NOT_MEASURED，绝不显示 0 或 '—' 假装测过。
 * 真测到的 0 就是 0——「量了是 0」和「没量」是两个意思（延续 I-8 的退化显示纪律）。
 */
import { computed } from 'vue'
import { PH_NOT_MEASURED } from '../../utils/display'

const props = defineProps<{
  /** null/undefined = 这一项系统还没测过；数字（含 0）= 真值 */
  value?: number | null
}>()

const measured = computed(() => props.value !== null && props.value !== undefined)
</script>

<template>
  <span class="geobrand-measured" :data-measured="measured ? 'true' : 'false'">
    {{ measured ? value : PH_NOT_MEASURED }}
  </span>
</template>
