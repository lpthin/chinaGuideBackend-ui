<script setup lang="ts">
/**
 * 表格统一出口（Spec-F §9.2-4）：包 a-table，分页默认 20/页、可切、上限 100（§7.3 列表一律分页），
 * 自带加载 / 空 / 错误三态，页面不再各写 13 种分页配置、不再 :pagination="false" 裸奔。
 * 其余 a-table 属性与事件（columns 除外）经 $attrs 透传。
 *
 * G12（Spec-G P0）：`scroll` 也在这里兜底，不再靠每个页面自己想起来写。
 * 上一轮的实测账是「10 个页面 import 这个组件、13 处挂载点，只有 4 处写了 :scroll」，
 * 漏掉的那几屏在 375 档把表格压成「一字一行」（就绪评估 F13）。
 * 兜底 = `{ x: 'max-content' }`（全仓 68 处 `:scroll` 里 47 处写的就是这一个词）：
 * 窄屏让表按内容长宽、由容器横向滚，而不是把每一列碾成一字一行。
 * 页面显式传 `:scroll` 时以页面的为准（传 false = 这张表明确不要横向滚动）——
 * 模板里 `v-bind="$attrs"` 写在 `:scroll` 后面，页面传的值天然覆盖兜底；这里读一次 attrs 只为认 false。
 *
 * 真跑账（同一支判据两头各量一遍；夹具 scratch/geo-viewport-harness.html + 跑批 scratch/p6g-sweep.py，
 * 存档 scratch/p6g-out/squeeze-m-old2.json / squeeze-m-new2.json / squeeze-pc-new2.json）：
 * 改之前 375 档 5 屏里 4 屏 FAIL、合计 29 格被压扁，最狠的每行只排 1 个字、格宽 30~46px；
 * 上一轮那条「越界才判 FAIL」的旧判据对这 4 屏全绿——它量不到压缩这件事。
 * 改之后 5 屏 0 格，页面上渲染出的 10 张表全部有可用的横向滚动层；
 * 1440 档两头都是 0 格且滚动层没被激活，兜底不给宽屏添一条没人要的横向滚动条。
 */
import { computed, useAttrs } from 'vue'
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

const attrs = useAttrs()

const DEFAULT_SCROLL_X = 'max-content'

const mergedScroll = computed(() => {
  const fromPage = attrs.scroll as false | Record<string, unknown> | undefined
  if (fromPage === false) return undefined
  if (fromPage) return fromPage
  return { x: DEFAULT_SCROLL_X }
})

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
  <a-table v-else :data-source="dataSource" :loading="loading" :row-key="rowKey" :pagination="mergedPagination" :scroll="mergedScroll" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotData"><slot :name="name" v-bind="slotData ?? {}" /></template>
  </a-table>
</template>

<style scoped lang="less">
/* 分页尺寸上限由 mergedPagination 保证（100）；样式交给 antd 与主题 */
</style>
