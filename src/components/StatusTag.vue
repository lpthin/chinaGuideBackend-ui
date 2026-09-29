<script setup lang="ts">
/**
 * 状态标签唯一出口（Spec-F §9.2-4）：颜色与兜底文案只认 utils/statusTokens.ts，
 * 组件内不接受 color prop——17 处硬编码 a-tag color 由下一包收进来。
 * label 是后端词表（statuses 端点）覆盖位：词表到手时用它，到手前用映射表兜底。
 */
import { computed } from 'vue'
import { statusMeta, type StatusDomain } from '../utils/statusTokens'

const props = defineProps<{
  domain: StatusDomain
  status?: string | null
  label?: string | null
}>()

const meta = computed(() => statusMeta(props.domain, props.status, props.label))
</script>

<template>
  <a-tag :color="meta.color">{{ meta.label }}</a-tag>
</template>
