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
            <a-list :data-source="topServices" :split="false">
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
                          :style="{ width: `${(item.amount / topServices[0].amount) * 100}%` }"
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
import * as echarts from 'echarts'
import {
  BarChartOutlined,
  LineChartOutlined,
  WalletOutlined,
  FileTextOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons-vue'

const loading = ref(false)
const trendPeriod = ref('30')

const trendChartRef = ref<HTMLElement>()
const breakdownChartRef = ref<HTMLElement>()
const compareChartRef = ref<HTMLElement>()

let trendChart: echarts.ECharts | null = null
let breakdownChart: echarts.ECharts | null = null
let compareChart: echarts.ECharts | null = null

const statsData = reactive({
  totalAmount: 15680.50,
  growthRate: 12.5,
  lastMonthAmount: 13930.20,
  lastMonthInvoices: 8,
  averageDailyAmount: 522.68,
  projectedMonthAmount: 16173.08,
  pendingInvoices: 2,
  pendingAmount: 2340.00,
})

const topServices = ref([
  { name: 'GPT-4 API', usage: 280, unit: '万 tokens', amount: 8400 },
  { name: '企业版订阅', usage: 1, unit: '月', amount: 3360.50 },
  { name: 'Claude 3 API', usage: 120, unit: '万 tokens', amount: 1920 },
  { name: 'CDN流量', usage: 8.5, unit: 'TB', amount: 1190 },
  { name: '对象存储', usage: 680, unit: 'GB', amount: 810 },
])

const trendData = ref<{ date: string; amount: number }[]>([])

function generateTrendData(days: number) {
  const data: { date: string; amount: number }[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
    const baseAmount = 400 + Math.random() * 300
    const weekdayFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.7 : 1
    data.push({
      date: dateStr,
      amount: Math.round(baseAmount * weekdayFactor * 100) / 100,
    })
  }
  trendData.value = data
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function initTrendChart() {
  if (!trendChartRef.value) return

  trendChart = echarts.init(trendChartRef.value)

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

function initBreakdownChart() {
  if (!breakdownChartRef.value) return

  breakdownChart = echarts.init(breakdownChartRef.value)

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)',
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
        data: [
          { value: 8400, name: 'AI模型', itemStyle: { color: '#1890ff' } },
          { value: 3360.50, name: '订阅服务', itemStyle: { color: '#52c41a' } },
          { value: 1920, name: 'CDN流量', itemStyle: { color: '#fa8c16' } },
          { value: 1190, name: '对象存储', itemStyle: { color: '#722ed1' } },
          { value: 810, name: '其他服务', itemStyle: { color: '#8c8c8c' } },
        ],
      },
    ],
  }

  breakdownChart.setOption(option)
}

function initCompareChart() {
  if (!compareChartRef.value) return

  compareChart = echarts.init(compareChartRef.value)

  const months = ['10月', '11月', '12月', '1月', '2月', '3月']
  const currentYearData = [12500, 13800, 14200, 13500, 13930.20, 15680.50]
  const lastYearData = [9800, 10500, 11200, 10800, 11500, 12100]

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
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
        data: currentYearData,
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
        data: lastYearData,
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

watch(trendPeriod, (newVal) => {
  generateTrendData(parseInt(newVal))
  initTrendChart()
})

onMounted(() => {
  loading.value = true
  setTimeout(() => {
    generateTrendData(30)
    initTrendChart()
    initBreakdownChart()
    initCompareChart()
    window.addEventListener('resize', handleResize)
    loading.value = false
  }, 500)
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
