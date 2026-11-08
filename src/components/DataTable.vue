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
import { computed, shallowRef, useAttrs, watch } from 'vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import StateBlock from './StateBlock.vue'

const props = withDefaults(
  defineProps<{
    dataSource?: readonly unknown[]
    loading?: boolean
    error?: string | null
    rowKey?: string | ((record: never) => string | number)
    /** 传 false 关掉分页（详情页内嵌小表用）；传对象则与默认分页配置合并 */
    pagination?: false | TablePaginationConfig
    /** 只读页的「空」不该念「新建一条记录」时，用这一句覆盖空态第二行（不传仍是通用话术） */
    emptyLine?: string
    /** 读失败时给的一颗「重试」按钮：传页面的加载函数，不传就只念原因（页面本来有刷新按钮时可省） */
    retry?: () => unknown
    /**
     * 刷新失败时保留上一次读到的行 + 顶部提示，而不是整表撤成错误块。
     * 轮询类页面（进度、任务）必须有：后台每几秒刷一次，抖动一次就闪成「读取失败」等于谎报任务丢了。
     */
    keepStaleOnError?: boolean
  }>(),
  { dataSource: () => [], loading: false, error: null, rowKey: 'id', pagination: undefined, keepStaleOnError: false }
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
  const fromPage = props.pagination ?? {}
  const merged: Record<string, unknown> = {
    pageSize: 20,
    showSizeChanger: true,
    pageSizeOptions: ['20', '50', String(MAX_PAGE_SIZE)],
    ...fromPage,
  }
  // §7.3 硬闸：每页最多 100 条，谁传大了按 100 收
  const pageSize = Math.min(Number(merged.pageSize) || 20, MAX_PAGE_SIZE)
  merged.pageSize = pageSize
  // 档位里必须有当前每页条数：页面传 5/8/10 时，默认的 20/50/100 三个档位里没有它，
  // 尺寸下拉回显不出当前值。页面自己列了档位（如 8/16/32）的按页面的来，不掺。
  if (!fromPage.pageSizeOptions) {
    merged.pageSizeOptions = Array.from(new Set([pageSize, 20, 50, MAX_PAGE_SIZE]))
      .sort((a, b) => a - b)
      .map(String)
  }
  return merged
})

const isEmpty = computed(() => !props.loading && props.dataSource.length === 0)

const errorText = computed(() => String(props.error ?? ''))

/** 权限与登录问题不能念「稍后重试」：那不是等一等就会好的事 */
const errorNext = computed(() => {
  if (/没有权限|权限不足|无权/.test(errorText.value)) return '需要更高权限：请联系管理员开通后再回来'
  if (/登录状态已失效|重新登录/.test(errorText.value)) return '请重新登录后再试'
  return undefined
})

/**
 * 上一次读成功的行。只记非空那一档：成功读到空也算「新状态」，由 loading 回落那一下清掉。
 * 页面在 catch 里把 rows 清空是常态，这里兜住「抖动一次就把整块数据撤走」。
 */
const staleRows = shallowRef<readonly unknown[]>([])
watch(
  () => props.dataSource,
  (rows) => {
    if (rows.length > 0) staleRows.value = rows
  },
  { immediate: true }
)
watch(
  () => props.loading,
  (loading) => {
    if (!loading && !props.error) staleRows.value = props.dataSource
  }
)

const displayRows = computed(() => {
  if (!props.error) return props.dataSource
  if (props.dataSource.length > 0) return props.dataSource
  return props.keepStaleOnError ? staleRows.value : []
})

/** 有行可看时只挂提示条，不再整表撤成错误块 */
const showErrorBlock = computed(() => !!props.error && displayRows.value.length === 0)

function onRetry() {
  void props.retry?.()
}

</script>

<template>
  <StateBlock v-if="showErrorBlock" state="error" :detail="errorText" :next="errorNext">
    <slot name="errorExtra">
      <a-button v-if="retry" type="primary" :loading="loading" @click="onRetry">重试</a-button>
    </slot>
  </StateBlock>
  <!-- 页面自己带了「这一种空是哪一种」那一句（N-05：后端原文，界面不改写）时，这一块固定话术
       不能再盖在上面——「调整筛选条件，或新建一条记录」对「这一家读不到」那一形是谎报。
       没带这一句的屏一行没变。 -->
  <StateBlock v-else-if="!error && isEmpty && !$slots.emptyText" state="empty" :next="emptyLine" />
  <template v-else>
    <!-- 有旧数据就留表 + 顶部提示：一次抖动不该把用户已经看到的内容撤走 -->
    <a-alert
      v-if="error"
      type="warning"
      show-icon
      class="admin-data-table__stale"
      :message="`这次没刷新成功：${errorText}。下面是上一次读到的数据。`"
    />
    <a-table :data-source="displayRows" :loading="loading" :row-key="rowKey" :pagination="mergedPagination" :scroll="mergedScroll" v-bind="$attrs">
      <template v-for="(_, name) in $slots" #[name]="slotData"><slot :name="name" v-bind="slotData ?? {}" /></template>
    </a-table>
  </template>
</template>

<style scoped lang="less">
/* 分页尺寸上限由 mergedPagination 保证（100）；样式交给 antd 与主题 */
.admin-data-table__stale {
  margin-bottom: var(--admin-space-2, 16px);
}
</style>
