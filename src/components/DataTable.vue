<script setup lang="ts">
/**
 * 表格统一出口（Spec-F §9.2-4）：包 a-table，分页默认 20/页、可切、上限 100（§7.3 列表一律分页），
 * 自带加载 / 空 / 错误三态，页面不再各写 13 种分页配置、不再 :pagination="false" 裸奔。
 * 其余 a-table 属性与事件（columns 除外）经 $attrs 透传。
 */
import { computed } from 'vue'
import StateBlock from './StateBlock.vue'

const props = withDefaults(
  defineProps<{
    dataSource?: readonly unknown[]
    loading?: boolean
    error?: string | null
    rowKey?: string
    /** 传 false 关掉分页（详情页内嵌小表用）；传对象则与默认分页配置合并 */
    pagination?: false | Record<string, unknown>
  }>(),
  { dataSource: () => [], loading: false, error: null, rowKey: 'id', pagination: undefined }
)

const MAX_PAGE_SIZE = 100

const mergedPagination = computed(() => {
  if (props.pagination === false) return false
  const merged = {
    pageSize: 20,
    showSizeChanger: true,
    pageSizeOptions: ['20', '50', String(MAX_PAGE_SIZE)],
    ...(props.pagination ?? {}),
  }
  // §7.3 硬闸：每页最多 100 条，谁传大了按 100 收
  merged.pageSize = Math.min(Number(merged.pageSize) || 20, MAX_PAGE_SIZE)
  return merged
})

const isEmpty = computed(() => !props.loading && props.dataSource.length === 0)
</script>

<template>
  <StateBlock v-if="error" state="error" :detail="error" />
  <StateBlock v-else-if="isEmpty" state="empty" />
  <a-table v-else :data-source="dataSource" :loading="loading" :row-key="rowKey" :pagination="mergedPagination" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotData"><slot :name="name" v-bind="slotData ?? {}" /></template>
  </a-table>
</template>

<style scoped lang="less">
/* 分页尺寸上限由 mergedPagination 保证（100）；样式交给 antd 与主题 */
</style>
