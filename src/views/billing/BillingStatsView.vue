<template>
  <div class="billing-stats-page">
    <!-- 这一屏每一个数都是按客户分开记的。不写清是谁的账，读的人会把「登录账号所属那一家」的数
         当成自己正在看的那一家（改前超管没选客户时，屏上悄悄摆的就是 admin 账号名下租户 1 的账）。 -->
    <div class="scope-line" data-testid="scope-line">{{ scopeSentence }}</div>
    <div v-if="unreadableLine" class="scope-line scope-line--warn" data-testid="backend-reason">
      {{ unreadableLine }}
    </div>
    <div v-else-if="statsError" class="scope-line scope-line--warn" data-testid="backend-reason">
      本月消费那几张卡这次没取到：{{ statsError }}
    </div>

    <StateBlock
      v-if="requestedTenantId === null"
      state="not-measured"
      title="还没有选定客户"
      detail="消费是一户一本地记的，这一屏没有「全平台合计」这一格。"
      next="在页面顶部的租户切换里选一家客户，这里才摆那一家自己的数。"
    />

    <a-spin v-else :spinning="loading">
      <!-- 统计概览卡片：读不到就摆「—」，不许摆 ¥0.00 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <BarChartOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value" data-testid="card-this-month">{{ fmtMoney(cards.thisMonth) }}</div>
                <div class="stat-title">本月消费</div>
              </div>
            </div>
            <div class="stat-trend" :class="growthClass">
              <span v-if="growthArrow" :data-testid="'growth-' + growthClass">
                <ArrowUpOutlined v-if="growthArrow === 'up'" />
                <ArrowDownOutlined v-else />
                {{ growthText }}
              </span>
              <span v-else class="trend-label" data-testid="growth-line">{{ growthText }}</span>
              <span v-if="growthArrow" class="trend-label">较上月</span>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <LineChartOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value" data-testid="card-last-month">{{ fmtMoney(cards.lastMonth) }}</div>
                <div class="stat-title">上月消费</div>
              </div>
            </div>
            <div class="stat-trend">
              <span class="trend-label">账单数量: {{ fmtCount(cards.lastMonthInvoices) }}</span>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <WalletOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value" data-testid="card-daily">{{ fmtMoney(cards.averageDaily) }}</div>
                <div class="stat-title">日均消费</div>
              </div>
            </div>
            <div class="stat-trend">
              <span class="trend-label" data-testid="card-projected">{{ projectedLine }}</span>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value" data-testid="card-pending">{{ fmtCount(cards.pendingInvoices) }}</div>
                <div class="stat-title">待付账单</div>
              </div>
            </div>
            <div class="stat-trend pending">
              <span class="trend-label">待付金额: {{ fmtMoney(cards.pendingAmount) }}</span>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 消费趋势图表 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="16">
          <a-card title="消费趋势" :bordered="false">
            <template #extra>
              <a-radio-group v-model:value="trendPeriod" size="small">
                <a-radio-button value="7">近7天</a-radio-button>
                <a-radio-button value="30">近30天</a-radio-button>
                <a-radio-button value="90">近90天</a-radio-button>
              </a-radio-group>
            </template>
            <StateBlock v-if="blockState('trend')" v-bind="blockAttrs('trend')" />
            <div v-show="!blockState('trend')" ref="trendChartRef" class="chart-container"></div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card title="消费构成" :bordered="false">
            <StateBlock v-if="blockState('breakdown')" v-bind="blockAttrs('breakdown')" />
            <div v-show="!blockState('breakdown')" ref="breakdownChartRef" class="chart-container"></div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 服务用量排行 -->
      <a-row :gutter="16">
        <a-col :span="12">
          <a-card title="服务用量排行" :bordered="false">
            <StateBlock v-if="blockState('topServices')" v-bind="blockAttrs('topServices')" />
            <a-list v-show="!blockState('topServices')" :data-source="topServicesData" :split="false">
              <template #renderItem="{ item, index }">
                <a-list-item>
                  <div class="service-item">
                    <div class="service-rank" :class="`rank-${index + 1}`">{{ index + 1 }}</div>
                    <div class="service-info">
                      <div class="service-name">{{ item.name }}</div>
                      <div class="service-usage">{{ item.usage }} {{ item.unit }}</div>
                    </div>
                    <div class="service-amount">
                      <span class="amount">¥{{ formatAmount(item.amount) }}</span>
                      <div class="progress-bar">
                        <div
                          class="progress-inner"
                          :style="{ width: `${Math.min(100, Math.max(0, item.percent || 0))}%` }"
                        ></div>
                      </div>
                    </div>
                  </div>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>
        <a-col :span="12">
          <a-card title="月度消费对比" :bordered="false">
            <StateBlock v-if="blockState('compare')" v-bind="blockAttrs('compare')" />
            <div v-show="!blockState('compare')" ref="compareChartRef" class="chart-container"></div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import * as echarts from 'echarts'
import {
  BarChartOutlined,
  LineChartOutlined,
  WalletOutlined,
  FileTextOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons-vue'
import { topServicesApi, statsApi } from '../../api/billing'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'
import { PH_DASH } from '../../utils/display'
import StateBlock from '../../components/StateBlock.vue'

const authStore = useAuthStore()

const loading = ref(false)
const trendPeriod = ref('30')

const trendChartRef = ref<HTMLElement>()
const breakdownChartRef = ref<HTMLElement>()
const compareChartRef = ref<HTMLElement>()

let trendChart: echarts.ECharts | null = null
let breakdownChart: echarts.ECharts | null = null
let compareChart: echarts.ECharts | null = null

/**
 * 这一屏的数属于谁。
 *
 * 改前五个加载函数都写的是 `authStore.selectedTenantId || authStore.tenantId`，而 `tenantId`
 * 这个 getter 在没人选客户时回的是 `user.tenantId || 1`——超管打开这一屏，屏上摆的其实是
 * admin 账号名下那一家的账，界面上一个字不提。现在超管没选客户就不取数，把「还没选定客户」当面说出来。
 */
const requestedTenantId = computed<number | null>(() => {
  if (authStore.isSuperAdmin) return authStore.selectedTenantId ?? null
  return authStore.user?.tenantId ?? null
})

const scopeSentence = computed(() => {
  const id = requestedTenantId.value
  if (id === null) {
    return authStore.isSuperAdmin
      ? '当前没有选定客户，下面不摆任何一家的数。'
      : '登录信息里没有客户编号，下面不摆数。'
  }
  const code = authStore.selectedTenantCode
  const who = authStore.isSuperAdmin
    ? `当前看的是${code ? `客户「${code}」` : '选中的那一家客户'}（编号 #${id}）`
    : `当前看的是你所在客户（编号 #${id}）`
  return `${who}的账，按自然月计；这一屏没有跨客户合计。`
})

type StatsState = 'idle' | 'ok' | 'failed' | 'unreadable'

/** 四张卡的本月/上月/账单数都从 `/billing/stats` 一格一格来；读不到或没取到一律 null（界面摆「—」） */
const cards = reactive({
  thisMonth: null as number | null,
  lastMonth: null as number | null,
  growth: null as number | null,
  lastMonthInvoices: null as number | null,
  pendingInvoices: null as number | null,
  pendingAmount: null as number | null,
  averageDaily: null as number | null,
  projected: null as number | null,
  daysElapsed: 0,
})

const statsState = ref<StatsState>('idle')
const statsError = ref<string | null>(null)
const tenantUnreadable = ref(false)
/** 成因那句话只用后端那一份原文（`EmptyResultReasons`），界面不抄第二份 */
const unreadableLine = ref<string | null>(null)

type SectionKey = 'trend' | 'breakdown' | 'topServices' | 'compare'

const sectionNames: Record<SectionKey, string> = {
  trend: '消费趋势',
  breakdown: '消费构成',
  topServices: '服务用量排行',
  compare: '月度消费对比',
}

/** 哪一块是「这次没取到」，存的是失败原因原文；null 表示这一发没失败 */
const failed = reactive<Record<SectionKey, string | null>>({
  trend: null,
  breakdown: null,
  topServices: null,
  compare: null,
})

/** 「真的没有」那一档各块各有各的说法，因为四块取的期间口径不一样（趋势看区间、构成看全部流水） */
const EMPTY_LINES: Record<SectionKey, string> = {
  trend: '这个区间里没有消费记录',
  breakdown: '这家还没有按产品分开记的消费流水',
  topServices: '这家还没有按业务类型记的消费流水',
  compare: '今年和去年都没有月度消费',
}

const topServicesData = ref<any[]>([])

const trendData = ref<{ date: string; amount: number }[]>([])

const breakdownData = ref<{ productType: string; productName: string; amount: number; percentage: number | null }[]>([])

const monthlyCompareData = ref<{ months: string[]; currentYear: number[]; lastYear: number[] }>({
  months: [],
  currentYear: [],
  lastYear: [],
})

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 读不到 / 没取到 = 「—」，不是 0：¥0.00 与「这一家在这库里没有身份」以前长得一模一样 */
function fmtMoney(value: number | null): string {
  return value === null ? PH_DASH : `¥${formatAmount(value)}`
}

function fmtCount(value: number | null): string {
  return value === null ? PH_DASH : String(value)
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function errorMessage(error: unknown): string {
  return (error as Error | null)?.message || '无法连接服务器，请确认后端已启动'
}

/** 本月已过几天、这个月一共几天：日均与「照此到月底」都靠这两个数，写死 30 天会在大小月两头骗人 */
function daysInCurrentMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

const growthArrow = computed(() => {
  if (statsState.value !== 'ok' || cards.growth === null) return null
  return cards.growth >= 0 ? 'up' : 'down'
})

const growthClass = computed(() => (growthArrow.value === 'down' ? 'down' : growthArrow.value === 'up' ? 'up' : ''))

const growthText = computed(() => {
  if (growthArrow.value) return `${Math.abs(cards.growth as number).toFixed(1)}%`
  if (statsState.value === 'unreadable') return '这一家读不到，比不出涨跌'
  if (statsState.value === 'failed') return '这次没取到，比不出涨跌'
  return '上月没有消费，比不出涨跌'
})

const projectedLine = computed(() => {
  if (cards.projected === null || cards.averageDaily === null) {
    return `本月日均与到月底推算: ${PH_DASH}`
  }
  return `本月已过 ${cards.daysElapsed} 天；照这个平均到月底约 ${fmtMoney(cards.projected)}（推算，不是账单数）`
})

function rowCount(key: SectionKey): number {
  if (key === 'trend') return trendData.value.length
  if (key === 'breakdown') return breakdownData.value.length
  if (key === 'topServices') return topServicesData.value.length
  return monthlyCompareData.value.months.length
}

/**
 * 四块图/列表各摆哪一态。顺序不能反：读不到压过失败，失败压过「真的没有」——
 * 一家在库里没有身份时，后端那些相加查询照样回得出空数组，摆成「没有消费」就是谎报。
 */
function blockState(key: SectionKey): 'unreadable' | 'error' | 'empty' | null {
  if (tenantUnreadable.value) return 'unreadable'
  if (failed[key]) return 'error'
  return rowCount(key) === 0 ? 'empty' : null
}

/** StateBlock 的那三格；类型写全是为了 `v-bind` 过去时 `state` 不许丢 */
interface BlockAttrs {
  state: 'empty' | 'error' | 'not-measured'
  title?: string
  detail?: string
  next?: string
}

function blockAttrs(key: SectionKey): BlockAttrs {
  const state = blockState(key)
  if (state === 'unreadable') {
    return {
      state: 'error',
      title: '这一家读不到，不是没有消费',
      detail: `${sectionNames[key]}没有归属：上面那句是后端给的成因。`,
      next: '在页面顶部的租户切换里换一家真实存在的客户',
    }
  }
  if (state === 'error') {
    return { state: 'error', detail: failed[key] ?? undefined }
  }
  return {
    state: 'empty',
    title: EMPTY_LINES[key],
    next: '想看这家花过什么，去「消费明细」那一屏按这家筛一遍流水',
  }
}

function initTrendChart() {
  // 这一态是空态/失败/读不到时不许画图：容器此刻是 display:none，echarts 会把它记成 0 宽
  if (blockState('trend')) return
  if (!trendChartRef.value) return

  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0]
        return `${data.name}<br/>消费金额: ¥${formatAmount(data.value)}`
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendData.value.map(d => d.date),
      axisLine: {
        lineStyle: { color: '#e8e8e8' },
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: { color: '#e8e8e8' },
      },
      splitLine: {
        lineStyle: { color: '#f0f0f0' },
      },
    },
    series: [
      {
        name: '消费金额',
        type: 'line',
        smooth: true,
        data: trendData.value.map(d => d.amount),
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
          ]),
        },
        lineStyle: {
          width: 3,
          color: '#1890ff',
        },
        itemStyle: {
          color: '#1890ff',
        },
      },
    ],
  }

  trendChart.setOption(option)
}

const BREAKDOWN_COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#8c8c8c']

function initBreakdownChart() {
  if (blockState('breakdown')) return
  if (!breakdownChartRef.value) return

  if (!breakdownChart) {
    breakdownChart = echarts.init(breakdownChartRef.value)
  }

  const pieData = breakdownData.value.map((item, index) => ({
    value: item.amount,
    name: item.productName,
    itemStyle: { color: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length] },
  }))

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => `${params.name}: ¥${formatAmount(params.value)} (${params.percent}%)`,
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
            formatter: '{b}\n{d}%',
          },
        },
        labelLine: {
          show: false,
        },
        data: pieData,
      },
    ],
  }

  breakdownChart.setOption(option)
}

function initCompareChart() {
  if (blockState('compare')) return
  if (!compareChartRef.value) return

  if (!compareChart) {
    compareChart = echarts.init(compareChartRef.value)
  }

  const { months, currentYear, lastYear } = monthlyCompareData.value

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: any) => {
        let result = params[0].name + '<br/>'
        params.forEach((item: any) => {
          result += `${item.marker} ${item.seriesName}: ¥${formatAmount(item.value)}<br/>`
        })
        return result
      },
    },
    legend: {
      data: ['今年', '去年'],
      top: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: {
        lineStyle: { color: '#e8e8e8' },
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: { color: '#e8e8e8' },
      },
      splitLine: {
        lineStyle: { color: '#f0f0f0' },
      },
    },
    series: [
      {
        name: '今年',
        type: 'bar',
        data: currentYear,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#1890ff' },
            { offset: 1, color: '#36cfc9' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: '去年',
        type: 'bar',
        data: lastYear,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#d9d9d9' },
            { offset: 1, color: '#f5f5f5' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }

  compareChart.setOption(option)
}

function handleResize() {
  trendChart?.resize()
  breakdownChart?.resize()
  compareChart?.resize()
}

watch(trendPeriod, () => {
  loadTrendData()
})

watch(
  () => authStore.selectedTenantId,
  () => {
    loadAllData()
  }
)

async function loadTrendData() {
  const tenantId = requestedTenantId.value
  if (tenantId === null) return
  failed.trend = null

  try {
    const res = await statsApi.getTrend(tenantId, parseInt(trendPeriod.value, 10))
    trendData.value = Array.isArray(res) ? res : []
    initTrendChart()
  } catch (error) {
    trendData.value = []
    failed.trend = errorMessage(error)
    logError('billing/billing-stats-view', 'Failed to load trend data:', error)
    message.error('加载消费趋势数据失败')
  }
  await nextTick()
  handleResize()
}

async function loadBreakdownData() {
  const tenantId = requestedTenantId.value
  if (tenantId === null) return
  failed.breakdown = null

  try {
    const res = await statsApi.getBreakdown(tenantId)
    breakdownData.value = Array.isArray(res) ? res : []
    initBreakdownChart()
  } catch (error) {
    breakdownData.value = []
    failed.breakdown = errorMessage(error)
    logError('billing/billing-stats-view', 'Failed to load breakdown data:', error)
    message.error('加载消费构成数据失败')
  }
  await nextTick()
  handleResize()
}

async function loadMonthlyCompareData() {
  const tenantId = requestedTenantId.value
  if (tenantId === null) return
  failed.compare = null

  try {
    const res = await statsApi.getMonthlyCompare(tenantId, 6)
    monthlyCompareData.value = res ?? { months: [], currentYear: [], lastYear: [] }
    initCompareChart()
  } catch (error) {
    monthlyCompareData.value = { months: [], currentYear: [], lastYear: [] }
    failed.compare = errorMessage(error)
    logError('billing/billing-stats-view', 'Failed to load monthly compare data:', error)
    message.error('加载月度对比数据失败')
  }
  await nextTick()
  handleResize()
}

function clearCards() {
  cards.thisMonth = null
  cards.lastMonth = null
  cards.growth = null
  cards.lastMonthInvoices = null
  cards.pendingInvoices = null
  cards.pendingAmount = null
  cards.averageDaily = null
  cards.projected = null
  cards.daysElapsed = 0
  statsState.value = 'idle'
  statsError.value = null
  tenantUnreadable.value = false
  unreadableLine.value = null
}

/**
 * 统计头（四张卡的唯一出处）。
 *
 * @return 还要不要再去取下面四块图：这一家读不到时不用取——那些相加查询对一个不存在的租户
 *         照样回得出空数组，取回来摆的就是「这家没有消费」，而真相是「这家在这库里没有身份」。
 */
async function loadBillingStats(): Promise<boolean> {
  const tenantId = requestedTenantId.value
  if (tenantId === null) return false
  clearCards()

  try {
    const res = await statsApi.getStats(tenantId)
    if (!res) return true

    if (res.tenantUnreadable) {
      statsState.value = 'unreadable'
      tenantUnreadable.value = true
      unreadableLine.value = res.emptyLine ?? null
      return false
    }

    statsState.value = 'ok'
    cards.thisMonth = asNumber(res.thisMonthExpense)
    cards.lastMonth = asNumber(res.lastMonthExpense)
    cards.growth = asNumber(res.monthOverMonthGrowth)
    cards.lastMonthInvoices = asNumber(res.lastMonthInvoices)
    cards.pendingInvoices = asNumber(res.pendingInvoices)
    cards.pendingAmount = asNumber(res.pendingAmount)
    cards.daysElapsed = new Date().getDate()
    // 日均与「照此到月底」是这一屏自己按本月已过天数算的两笔推算，后端没有这两个数；
    // 摆出去就得在卡片上写清算法，以前那句「预计月底: ¥X」让人以为是账单上的数。
    if (cards.thisMonth !== null) {
      cards.averageDaily = cards.thisMonth / cards.daysElapsed
      cards.projected = cards.averageDaily * daysInCurrentMonth()
    }
    return true
  } catch (error) {
    // 统计头没取到只糊掉这四张卡；四块图各有各的口，让它们各自报自己的成败
    statsState.value = 'failed'
    statsError.value = errorMessage(error)
    logError('billing/billing-stats-view', 'Failed to load billing stats:', error)
    message.error('加载计费统计数据失败')
    return true
  }
}

async function loadTopServices() {
  const tenantId = requestedTenantId.value
  if (tenantId === null) return
  failed.topServices = null

  try {
    const res = await topServicesApi.getTopServices(tenantId)
    topServicesData.value = Array.isArray(res) ? res : []
  } catch (error) {
    topServicesData.value = []
    failed.topServices = errorMessage(error)
    logError('billing/billing-stats-view', 'Failed to load top services:', error)
    message.error('加载Top服务数据失败')
  }
}

function clearSections() {
  trendData.value = []
  breakdownData.value = []
  topServicesData.value = []
  monthlyCompareData.value = { months: [], currentYear: [], lastYear: [] }
  ;(Object.keys(failed) as SectionKey[]).forEach(key => {
    failed[key] = null
  })
}

async function loadAllData() {
  if (requestedTenantId.value === null) {
    clearCards()
    clearSections()
    return
  }

  loading.value = true
  try {
    const shouldLoadSections = await loadBillingStats()
    if (shouldLoadSections) {
      await Promise.all([
        loadTrendData(),
        loadBreakdownData(),
        loadTopServices(),
        loadMonthlyCompareData(),
      ])
    } else {
      clearSections()
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAllData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  breakdownChart?.dispose()
  compareChart?.dispose()
})
</script>

<style scoped lang="less">
.billing-stats-page {
  width: 100%;
}

.scope-line {
  margin-bottom: 12px;
  font-size: 13px;
  color: #595959;

  &--warn {
    color: #fa8c16;
  }
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.stat-trend {
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  &.up {
    color: #52c41a;
  }

  &.down {
    color: #ff4d4f;
  }

  &.pending {
    color: #fa8c16;
  }

  .trend-label {
    color: #8c8c8c;
  }
}

.chart-container {
  width: 100%;
  height: 300px;
}

.service-item {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.service-rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #fff;

  &.rank-1 {
    background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%);
  }

  &.rank-2 {
    background: linear-gradient(135deg, #8c8c8c 0%, #bfbfbf 100%);
  }

  &.rank-3 {
    background: linear-gradient(135deg, #d46b08 0%, #faad14 100%);
  }

  &.rank-4,
  &.rank-5 {
    background: #f0f0f0;
    color: #8c8c8c;
  }
}

.service-info {
  flex: 1;

  .service-name {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 4px;
  }

  .service-usage {
    font-size: 12px;
    color: #8c8c8c;
  }
}

.service-amount {
  text-align: right;
  min-width: 150px;

  .amount {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: #f0f0f0;
    border-radius: 2px;
    margin-top: 4px;
    overflow: hidden;

    .progress-inner {
      height: 100%;
      background: linear-gradient(90deg, #1890ff 0%, #36cfc9 100%);
      border-radius: 2px;
      transition: width 0.3s;
    }
  }
}
</style>
