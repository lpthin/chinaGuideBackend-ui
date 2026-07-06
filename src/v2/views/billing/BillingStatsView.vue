<template>
  <div class="billing-stats-page">
    <a-spin :spinning="loading">
      <!-- 统计概览卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <BarChartOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">¥{{ formatAmount(statsData.totalAmount) }}</div>
                <div class="stat-title">本月消费</div>
              </div>
            </div>
            <div class="stat-trend" :class="statsData.growthRate >= 0 ? 'up' : 'down'">
              <span v-if="statsData.growthRate >= 0"><ArrowUpOutlined /> {{ statsData.growthRate.toFixed(1) }}%</span>
              <span v-else><ArrowDownOutlined /> {{ Math.abs(statsData.growthRate).toFixed(1) }}%</span>
              <span class="trend-label">较上月</span>
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
                <div class="stat-value">¥{{ formatAmount(statsData.lastMonthAmount) }}</div>
                <div class="stat-title">上月消费</div>
              </div>
            </div>
            <div class="stat-trend">
              <span class="trend-label">账单数量: {{ statsData.lastMonthInvoices }}</span>
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
                <div class="stat-value">¥{{ formatAmount(statsData.averageDailyAmount) }}</div>
                <div class="stat-title">日均消费</div>
              </div>
            </div>
            <div class="stat-trend">
              <span class="trend-label">预计月底: ¥{{ formatAmount(statsData.projectedMonthAmount) }}</span>
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
                <div class="stat-value">{{ statsData.pendingInvoices }}</div>
                <div class="stat-title">待付账单</div>
              </div>
            </div>
            <div class="stat-trend pending">
              <span class="trend-label">待付金额: ¥{{ formatAmount(statsData.pendingAmount) }}</span>
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
            <div ref="trendChartRef" class="chart-container"></div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card title="消费构成" :bordered="false">
            <div ref="breakdownChartRef" class="chart-container"></div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 服务用量排行 -->
      <a-row :gutter="16">
        <a-col :span="12">
          <a-card title="服务用量排行" :bordered="false">
            <a-list :data-source="topServicesData" :split="false">
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
                          :style="{ width: `${topServicesData[0] ? (item.amount / topServicesData[0].amount) * 100 : 0}%` }"
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
            <div ref="compareChartRef" class="chart-container"></div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
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

const authStore = useAuthStore()

const loading = ref(false)
const trendPeriod = ref('30')

const trendChartRef = ref<HTMLElement>()
const breakdownChartRef = ref<HTMLElement>()
const compareChartRef = ref<HTMLElement>()

let trendChart: echarts.ECharts | null = null
let breakdownChart: echarts.ECharts | null = null
let compareChart: echarts.ECharts | null = null

const statsData = reactive({
  totalAmount: 0,
  growthRate: 0,
  lastMonthAmount: 0,
  lastMonthInvoices: 0,
  averageDailyAmount: 0,
  projectedMonthAmount: 0,
  pendingInvoices: 0,
  pendingAmount: 0,
})

const topServicesData = ref<any[]>([])

const trendData = ref<{ date: string; amount: number }[]>([])

const breakdownData = ref<{ productType: string; productName: string; amount: number; percentage: number }[]>([])

const monthlyCompareData = ref<{ months: string[]; currentYear: number[]; lastYear: number[] }>({
  months: [],
  currentYear: [],
  lastYear: [],
})

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function initTrendChart() {
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
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  if (!tenantId) return

  try {
    const days = parseInt(trendPeriod.value)
    const res = await statsApi.getTrend(tenantId, days)
    trendData.value = res || []
    initTrendChart()
  } catch (error) {
    console.error('Failed to load trend data:', error)
    message.error('加载消费趋势数据失败')
  }
}

async function loadBreakdownData() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  if (!tenantId) return

  try {
    const res = await statsApi.getBreakdown(tenantId)
    breakdownData.value = res || []
    initBreakdownChart()
  } catch (error) {
    console.error('Failed to load breakdown data:', error)
    message.error('加载消费构成数据失败')
  }
}

async function loadMonthlyCompareData() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  if (!tenantId) return

  try {
    const res = await statsApi.getMonthlyCompare(tenantId, 6)
    if (res) {
      monthlyCompareData.value = res
    }
    initCompareChart()
  } catch (error) {
    console.error('Failed to load monthly compare data:', error)
    message.error('加载月度对比数据失败')
  }
}

async function loadBillingStats() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  if (!tenantId) return

  try {
    const statsRes = await statsApi.getStats(tenantId)

    if (statsRes) {
      statsData.totalAmount = statsRes.thisMonthExpense || 0
      statsData.growthRate = statsRes.monthOverMonthGrowth || 0
      statsData.lastMonthAmount = statsRes.lastMonthExpense || 0
      statsData.pendingAmount = 0
      statsData.averageDailyAmount = statsData.totalAmount / new Date().getDate()
      statsData.projectedMonthAmount = statsData.totalAmount * (30 / new Date().getDate())
    }
  } catch (error) {
    console.error('Failed to load billing stats:', error)
    message.error('加载计费统计数据失败')
  }
}

async function loadTopServices() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  if (!tenantId) return

  try {
    const res = await topServicesApi.getTopServices(tenantId)
    topServicesData.value = (res || []).map((item: any) => ({
      ...item,
      usage: 0,
      unit: '次',
    }))
  } catch (error) {
    console.error('Failed to load top services:', error)
    message.error('加载Top服务数据失败')
  }
}

async function loadAllData() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  if (!tenantId) return

  loading.value = true
  try {
    await Promise.all([
      loadBillingStats(),
      loadTopServices(),
      loadTrendData(),
      loadBreakdownData(),
      loadMonthlyCompareData(),
    ])
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
