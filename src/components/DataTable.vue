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
import { computed, onBeforeUnmount, ref, shallowRef, useAttrs, watch } from 'vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import StateBlock from './StateBlock.vue'
import ErrorHelpActions from './ErrorHelpActions.vue'
import { errorKindOfText, REPEAT_FAILURE_HINT } from '../utils/errorText'
import {
  recordErrorExposure,
  recordRecovery,
  recordRetryAttempt,
  recordRetryOutcome,
  type RetrySource
} from '../utils/errorMetrics'

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
     * 只允许「同一上下文里反复刷新」的只读重数据（审计、订单、账单、任务）开启；
     * 跟随客户/站点/筛选切换的名单类禁止开启，由 check-table-states 的白名单守住。
     */
    keepStaleOnError?: boolean
    /**
     * 这一份数据所处的上下文（客户 + 筛选 + 页码拼成的串）。
     * 一旦变化，上一次留下的行立刻作废——切换客户/改筛选后读失败时，
     * 屏幕上不能再出现上一家客户或上一档筛选的任何一行（M2）。
     */
    staleKey?: string | number
    /**
     * 只读列表的一次自动退避重读（U3）：仅在网络断 / 超时 / 服务异常时排一次，
     * 1.2s 后重读；成功即清零。403 / 401 重读没有意义，一律不自动重试。
     * 写入型页面不许开——由 check-table-states 的白名单守住。
     */
    autoRetryReadOnly?: boolean
  }>(),
  { dataSource: () => [], loading: false, error: null, rowKey: 'id', pagination: undefined, keepStaleOnError: false, staleKey: '', autoRetryReadOnly: false }
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

/**
 * 空态唯一判据（M1）：没在读、没失败、且真的 0 行。
 * 读失败时这一格必须让给错误块——否则「这一档没有」会把一次 500 说成业务事实。
 */
const isEmpty = computed(() => !props.loading && !props.error && props.dataSource.length === 0)

const errorText = computed(() => String(props.error ?? ''))

/**
 * 读失败度量（SPEC-UI-8 G1）：
 * - `errorStartedAt` 记「错误出现」那一下，读成功后算恢复耗时；
 * - `pendingRetrySource` 记这一发重试是手动还是自动，读口落定后配一次成败。
 */
let errorStartedAt: number | null = null
let pendingRetrySource: RetrySource | null = null
let lastErrorText = ''

/**
 * 上一次读成功的行。只记非空那一档：成功读到空也算「新状态」，由 loading 回落那一下清掉。
 * 页面在 catch 里把 rows 清空是常态，这里兜住「抖动一次就把整块数据撤走」。
 */
const staleRows = shallowRef<readonly unknown[]>([])
/** 上下文换过之后、新一发还没成功之前，上一次的行一律不许再端上来 */
const contextDirty = ref(false)

watch(
  () => props.staleKey,
  () => {
    staleRows.value = []
    contextDirty.value = true
  }
)
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
    if (!loading && !props.error) {
      staleRows.value = props.dataSource
      // 读成功才把这一档算「干净」的；失败就一直脏着，旧数据不许顶上来
      contextDirty.value = false
    }
    if (loading) return
    // 读口每落败一次记一笔（U3）：第 2 次后不再劝「再点一下」，改为劝把诊断发给管理员
    if (props.error) {
      failureStreak.value += 1
      // 同一轮错误只开一次计时：连续失败不重置起点，恢复耗时才是「卡了多久」
      if (errorStartedAt === null) errorStartedAt = Date.now()
      lastErrorText = errorText.value
      recordErrorExposure(lastErrorText, 'table', displayRows.value.length === 0)
      if (pendingRetrySource) {
        recordRetryOutcome(false, pendingRetrySource)
        pendingRetrySource = null
      }
      scheduleAutoRetry()
    } else {
      failureStreak.value = 0
      autoRetried.value = false
      if (pendingRetrySource) {
        recordRetryOutcome(true, pendingRetrySource)
        pendingRetrySource = null
      }
      if (errorStartedAt !== null) {
        recordRecovery(Date.now() - errorStartedAt, lastErrorText)
        errorStartedAt = null
      }
    }
  }
)

const displayRows = computed(() => {
  if (!props.error) return props.dataSource
  if (contextDirty.value) return []
  if (props.dataSource.length > 0) return props.dataSource
  return props.keepStaleOnError ? staleRows.value : []
})

/** 有行可看时只挂提示条，不再整表撤成错误块 */
const showErrorBlock = computed(() => !!props.error && displayRows.value.length === 0)

/**
 * 重试的本地守卫与自动退避（SPEC-UI-7 U3）。
 * 页面的 loading 不一定会同步翻转，这里先拦一遍重复点击；
 * 自动重读每轮失败最多排一次，成功才允许下一轮再排。
 */
const AUTO_RETRY_DELAY_MS = 1200
const retrying = ref(false)
const failureStreak = ref(0)
const autoRetried = ref(false)
let autoRetryTimer: ReturnType<typeof setTimeout> | null = null

function clearAutoRetry(): void {
  if (autoRetryTimer) {
    clearTimeout(autoRetryTimer)
    autoRetryTimer = null
  }
}

async function runRetry(source: RetrySource = 'manual'): Promise<void> {
  if (retrying.value || !props.retry) return
  retrying.value = true
  pendingRetrySource = source
  recordRetryAttempt(errorText.value, source)
  try {
    await props.retry()
  } finally {
    retrying.value = false
  }
}

function onRetry(): void {
  void runRetry()
}

/** 只对只读列表、只对网络 / 超时 / 服务异常排一次自动重读 */
function scheduleAutoRetry(): void {
  if (!props.autoRetryReadOnly || autoRetried.value || !props.retry) return
  const kind = errorKindOfText(props.error)
  if (kind !== 'offline' && kind !== 'timeout' && kind !== 'server') return
  autoRetried.value = true
  clearAutoRetry()
  autoRetryTimer = setTimeout(() => {
    autoRetryTimer = null
    void runRetry('auto')
  }, AUTO_RETRY_DELAY_MS)
}

onBeforeUnmount(clearAutoRetry)

</script>

<template>
  <!-- 错误态的三层文案交给 StateBlock 按 errorText 统一分流（SPEC-UI-7 U1），
       表格不再自造 errorNext——两处实现迟早会说成两种话。 -->
  <StateBlock
    v-if="showErrorBlock"
    state="error"
    :detail="errorText"
    :hint="failureStreak >= 2 ? REPEAT_FAILURE_HINT : ''"
  >
    <slot name="errorExtra">
      <a-button
        v-if="retry"
        type="primary"
        class="admin-data-table__retry"
        :loading="loading || retrying"
        :disabled="retrying"
        @click="onRetry"
      >
        重试
      </a-button>
    </slot>
  </StateBlock>
  <!-- 页面自己带了「这一种空是哪一种」那一句（N-05：后端原文，界面不改写）时，这一块固定话术
       不能再盖在上面——「调整筛选条件，或新建一条记录」对「这一家读不到」那一形是谎报。
       没带这一句的屏一行没变。 -->
  <StateBlock v-else-if="isEmpty && !$slots.emptyText" state="empty" :next="emptyLine" />
  <template v-else>
    <!-- 有旧数据就留表 + 顶部提示：一次抖动不该把用户已经看到的内容撤走 -->
    <a-alert
      v-if="error"
      type="warning"
      show-icon
      class="admin-data-table__stale"
      :message="`这次没刷新成功：${errorText}。下面是上一次读到的数据。`"
    >
      <!-- 旧数据提示是第三种错误形态（SPEC-UI-9 H3）：诊断动作与错误块、空态同一颗组件 -->
      <template #action>
        <ErrorHelpActions :text="errorText" />
      </template>
    </a-alert>
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
