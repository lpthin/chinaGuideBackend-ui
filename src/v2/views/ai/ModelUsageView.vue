<template>
  <div class="model-usage-page">
    <a-spin :spinning="loading">
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-row :gutter="16" align="middle">
          <a-col :span="18">
            <a-space size="middle">
              <span class="filter-label">日期范围：</span>
              <a-range-picker
                v-model:value="dateRange"
                :ranges="dateRanges"
                style="width: 380px"
                @change="handleDateChange"
              />
              <a-space>
                <a-button
                  :type="quickDate === 'today' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('today')"
                >
                  今日
                </a-button>
                <a-button
                  :type="quickDate === 'week' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('week')"
                >
                  本周
                </a-button>
                <a-button
                  :type="quickDate === 'month' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('month')"
                >
                  本月
                </a-button>
                <a-button
                  :type="quickDate === '7d' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('7d')"
                >
                  近7天
                </a-button>
                <a-button
                  :type="quickDate === '30d' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('30d')"
                >
                  近30天
                </a-button>
              </a-space>
            </a-space>
          </a-col>
          <a-col :span="6" style="text-align: right">
            <a-space>
              <a-button @click="resetFilter">
                <template #icon><ReloadOutlined /></template>
                重置
              </a-button>
              <a-button type="primary" @click="handleSearch">
                <template #icon><SearchOutlined /></template>
                查询
              </a-button>
            </a-space>
          </a-col>
        </a-row>
      </a-card>

      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card main-stat" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #eb2f96 100%)">
                <DollarOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">¥{{ totalCost.toFixed(2) }}</div>
                <div class="stat-title">本月总费用</div>
                <div class="stat-trend up">
                  <ArrowUpOutlined /> {{ costGrowth }}% 较上月
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <BlockOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ totalTokens.toLocaleString() }}</div>
                <div class="stat-title">本月 Token 消耗</div>
                <div class="stat-trend up">
                  <ArrowUpOutlined /> {{ tokenGrowth }}% 较上月
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <ApiOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ totalCalls.toLocaleString() }}</div>
                <div class="stat-title">本月调用次数</div>
                <div class="stat-trend up">
                  <ArrowUpOutlined /> {{ callGrowth }}% 较上月
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ successRate.toFixed(1) }}%</div>
                <div class="stat-title">调用成功率</div>
                <div class="stat-trend" :class="successRateGrowth >= 0 ? 'up' : 'down'">
                  <ArrowUpOutlined v-if="successRateGrowth >= 0" />
                  <ArrowDownOutlined v-else />
                  {{ Math.abs(successRateGrowth).toFixed(1) }}% 较昨日
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="12">
          <a-card title="今日用量" :bordered="false">
            <a-row :gutter="16">
              <a-col :span="8">
                <div class="mini-stat">
                  <div class="mini-value">{{ todayStats.tokens.toLocaleString() }}</div>
                  <div class="mini-label">今日 Token</div>
                  <div class="mini-diff" :class="todayStats.tokenGrowth >= 0 ? 'up' : 'down'">
                    {{ todayStats.tokenGrowth >= 0 ? '+' : '' }}{{ todayStats.tokenGrowth.toFixed(1) }}%
                  </div>
                </div>
              </a-col>
              <a-col :span="8">
                <div class="mini-stat">
                  <div class="mini-value">{{ todayStats.calls.toLocaleString() }}</div>
                  <div class="mini-label">今日调用</div>
                  <div class="mini-diff" :class="todayStats.callGrowth >= 0 ? 'up' : 'down'">
                    {{ todayStats.callGrowth >= 0 ? '+' : '' }}{{ todayStats.callGrowth.toFixed(1) }}%
                  </div>
                </div>
              </a-col>
              <a-col :span="8">
                <div class="mini-stat">
                  <div class="mini-value">¥{{ todayStats.cost.toFixed(2) }}</div>
                  <div class="mini-label">今日费用</div>
                  <div class="mini-diff" :class="todayStats.costGrowth >= 0 ? 'up' : 'down'">
                    {{ todayStats.costGrowth >= 0 ? '+' : '' }}{{ todayStats.costGrowth.toFixed(1) }}%
                  </div>
                </div>
              </a-col>
            </a-row>
          </a-card>
        </a-col>
        <a-col :span="12">
          <a-card title="本月预算" :bordered="false">
            <div class="budget-container">
              <div class="budget-info">
                <span class="budget-label">已使用</span>
                <span class="budget-value">¥{{ budgetUsed.toFixed(2) }}</span>
                <span class="budget-label">/ ¥{{ budgetTotal }}</span>
              </div>
              <a-progress
                :percent="Math.round((budgetUsed / budgetTotal) * 100)"
                :stroke-color="getBudgetColor()"
                :show-info="false"
                style="margin-top: 12px"
              />
              <div class="budget-remaining">
                剩余 ¥{{ (budgetTotal - budgetUsed).toFixed(2) }}
                <span class="budget-days">预计可使用 {{ Math.ceil((budgetTotal - budgetUsed) / (budgetUsed / (new Date().getDate()))) }} 天</span>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="16">
          <a-card title="用量趋势" :bordered="false">
            <template #extra>
              <a-radio-group v-model:value="timeRange" button-style size="small">
                <a-radio-button value="7d">近7天</a-radio-button>
                <a-radio-button value="30d">近30天</a-radio-button>
                <a-radio-button value="90d">近90天</a-radio-button>
              </a-radio-group>
            </template>
            <div class="chart-container">
              <div class="chart-legend">
                <span class="legend-item">
                  <span class="legend-dot token-dot"></span>
                  Token 消耗
                </span>
                <span class="legend-item">
                  <span class="legend-dot cost-dot"></span>
                  费用
                </span>
              </div>
              <div class="chart-area">
                <div class="chart-bars">
                  <div
                    v-for="(item, index) in usageChartData"
                    :key="index"
                    class="bar-group"
                  >
                    <div
                      class="bar bar-token"
                      :style="{ height: `${(item.tokens / maxToken) * 100}%` }"
                    >
                      <span class="bar-tooltip">{{ item.tokens.toLocaleString() }}</span>
                    </div>
                  </div>
                </div>
                <div class="chart-labels">
                  <span v-for="(item, index) in usageChartData" :key="index" class="chart-label">
                    {{ item.date }}
                  </span>
                </div>
              </div>
            </div>
          </a-card>
        </a-col>

        <a-col :span="8">
          <a-card title="模型用量分布" :bordered="false">
            <div class="pie-chart-placeholder">
              <div class="pie-visual">
                <div class="pie-ring" :style="{ background: getPieGradient() }"></div>
                <div class="pie-center">
                  <div class="pie-total">{{ totalTokens.toLocaleString() }}</div>
                  <div class="pie-label">总 Token</div>
                </div>
              </div>
              <div class="pie-legend">
                <div
                  v-for="(model, index) in modelUsageList"
                  :key="index"
                  class="legend-row"
                >
                  <span
                    class="legend-color-block"
                    :style="{ background: modelColors[index] }"
                  ></span>
                  <span class="legend-model-name">{{ model.name }}</span>
                  <span class="legend-percent">{{ model.percent }}%</span>
                </div>
              </div>
            </div>
          </a-card>

          <a-card title="性能指标" :bordered="false" style="margin-top: 16px">
            <div class="performance-list">
              <div class="performance-item">
                <span class="perf-label">平均响应时间</span>
                <span class="perf-value">{{ avgResponseTime }}ms</span>
              </div>
              <div class="performance-item">
                <span class="perf-label">P50 响应时间</span>
                <span class="perf-value">{{ p50ResponseTime }}ms</span>
              </div>
              <div class="performance-item">
                <span class="perf-label">P90 响应时间</span>
                <span class="perf-value">{{ p90ResponseTime }}ms</span>
              </div>
              <div class="performance-item">
                <span class="perf-label">失败重试率</span>
                <span class="perf-value">{{ retryRate }}%</span>
              </div>
              <div class="performance-item">
                <span class="perf-label">限流触发率</span>
                <span class="perf-value">{{ limitRate }}%</span>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row style="margin-top: 16px">
        <a-col :span="24">
          <a-card title="调用日志" :bordered="false">
            <template #extra>
              <a-space>
                <a-select
                  v-model:value="logFilter.type"
                  style="width: 140px"
                  placeholder="按类型筛选"
                  allowClear
                >
                  <a-select-option value="chat">聊天模型</a-select-option>
                  <a-select-option value="embedding">向量模型</a-select-option>
                  <a-select-option value="image">图像模型</a-select-option>
                </a-select>
                <a-input-search
                  v-model:value="logFilter.keyword"
                  placeholder="搜索日志内容"
                  style="width: 240px"
                  enter-button
                />
                <a-button type="primary" @click="exportLogs">
                  <template #icon><DownloadOutlined /></template>
                  导出日志
                </a-button>
              </a-space>
            </template>

            <a-table
              :columns="logColumns"
              :data-source="paginatedLogs"
              :pagination="false"
              :row-key="record => record.id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'status'">
                  <a-tag :color="record.status === 'success' ? 'green' : 'red'">
                    {{ record.status === 'success' ? '成功' : '失败' }}
                  </a-tag>
                </template>
                <template v-if="column.key === 'tokens'">
                  <div class="tokens-badge">{{ record.tokens.toLocaleString() }}</div>
                </template>
                <template v-if="column.key === 'cost'">
                  <span class="cost-value">¥{{ record.cost.toFixed(4) }}</span>
                </template>
                <template v-if="column.key === 'duration'">
                  {{ record.duration }}ms
                </template>
              </template>
            </a-table>

            <div class="pagination-wrapper">
              <a-pagination
                v-model:current="logPagination.current"
                v-model:pageSize="logPagination.pageSize"
                :total="logPagination.total"
                show-size-changer
                :page-size-options="['20', '50', '100']"
                show-quick-jumper
                :show-total="(total) => `共 ${total} 条`"
              />
            </div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, h } from 'vue'
import { message } from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import {
  DollarOutlined,
  BlockOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import { aiModelApi } from '../../api/ai-model'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const quickDate = ref<string>('month')
const dateRange = ref<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')])

const dateRanges = {
  '今日': [dayjs(), dayjs()],
  '本周': [dayjs().startOf('week'), dayjs().endOf('week')],
  '本月': [dayjs().startOf('month'), dayjs().endOf('month')],
  '近7天': [dayjs().subtract(6, 'day'), dayjs()],
  '近30天': [dayjs().subtract(29, 'day'), dayjs()],
  '近90天': [dayjs().subtract(89, 'day'), dayjs()],
}

const totalCost = ref(0)
const totalTokens = ref(0)
const totalCalls = ref(0)
const successRate = ref(0)
const successRateGrowth = ref(0)
const costGrowth = ref(0)
const tokenGrowth = ref(0)
const callGrowth = ref(0)

const todayStats = reactive({
  tokens: 0,
  calls: 0,
  cost: 0,
  tokenGrowth: 0,
  callGrowth: 0,
  costGrowth: 0,
})

const budgetUsed = ref(0)
const budgetTotal = ref(0)

const timeRange = ref('7d')
const avgResponseTime = ref(0)
const p50ResponseTime = ref(0)
const p90ResponseTime = ref(0)
const retryRate = ref(0)
const limitRate = ref(0)

const modelColors = ['#722ed1', '#1890ff', '#52c41a', '#fa8c16', '#eb2f96']

const modelUsageList = ref<any[]>([])

const usageChartData = ref<any[]>([])

const maxToken = computed(() => {
  return Math.max(...usageChartData.value.map(d => d.tokens))
})

const getBudgetColor = () => {
  const percent = (budgetUsed.value / budgetTotal.value) * 100
  if (percent < 60) return '#52c41a'
  if (percent < 85) return '#fa8c16'
  return '#f5222d'
}

const getPieGradient = () => {
  if (modelUsageList.value.length === 0) {
    return '#e5e7eb'
  }
  const colors = modelColors.slice(0, modelUsageList.value.length)
  let gradient = ''
  let currentPercent = 0
  for (let i = 0; i < colors.length; i++) {
    const nextPercent = currentPercent + modelUsageList.value[i].percent
    gradient += `${colors[i]} ${currentPercent}% ${nextPercent}%,`
    currentPercent = nextPercent
  }
  if (currentPercent < 100) {
    gradient += `#e5e7eb ${currentPercent}% 100%`
  } else {
    gradient = gradient.slice(0, -1)
  }
  return `conic-gradient(${gradient})`
}

const logFilter = reactive({
  type: undefined as string | undefined,
  keyword: '',
})

const logPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
})

const logList = ref<any[]>([])

const paginatedLogs = computed(() => {
  return logList.value
})

const logColumns = [
  {
    title: '时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
  },
  {
    title: '模型',
    dataIndex: 'model',
    key: 'model',
    width: 120,
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    customRender: ({ record }: { record: any }) => {
      const typeMap: Record<string, string> = {
        chat: '聊天',
        embedding: '向量',
        image: '图像',
      }
      return typeMap[record.type] || record.type
    },
  },
  {
    title: '提示词',
    dataIndex: 'prompt',
    key: 'prompt',
    ellipsis: true,
  },
  {
    title: 'Token',
    key: 'tokens',
    width: 100,
  },
  {
    title: '费用',
    key: 'cost',
    width: 100,
  },
  {
    title: '耗时',
    key: 'duration',
    width: 80,
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
  },
]

function setQuickDate(type: string) {
  quickDate.value = type
  const now = dayjs()
  switch (type) {
    case 'today':
      dateRange.value = [now, now]
      break
    case 'week':
      dateRange.value = [now.startOf('week'), now.endOf('week')]
      break
    case 'month':
      dateRange.value = [now.startOf('month'), now.endOf('month')]
      break
    case '7d':
      dateRange.value = [now.subtract(6, 'day'), now]
      break
    case '30d':
      dateRange.value = [now.subtract(29, 'day'), now]
      break
  }
  handleSearch()
}

function handleDateChange(dates: any) {
  quickDate.value = ''
  if (dates && dates.length === 2) {
    dateRange.value = dates
  }
}

function resetFilter() {
  quickDate.value = 'month'
  dateRange.value = [dayjs().startOf('month'), dayjs().endOf('month')]
  handleSearch()
}

function handleSearch() {
  fetchData()
}

const getCommonParams = () => {
  return {
    tenantId: authStore.selectedTenantId ?? undefined,
    startDate: dateRange.value?.[0]?.format('YYYY-MM-DD'),
    endDate: dateRange.value?.[1]?.format('YYYY-MM-DD'),
  }
}

const loadStats = async () => {
  try {
    const params = getCommonParams()
    const result = await aiModelApi.getStats(params)
    totalCost.value = result.totalCost ?? 0
    totalTokens.value = result.totalTokens ?? 0
    totalCalls.value = result.totalCalls ?? 0
    successRate.value = result.successRate ?? 0
    successRateGrowth.value = result.successRateGrowth ?? 0
    costGrowth.value = result.costGrowth ?? 0
    tokenGrowth.value = result.tokenGrowth ?? 0
    callGrowth.value = result.callGrowth ?? 0
    todayStats.tokens = result.todayTokens ?? 0
    todayStats.calls = result.todayCalls ?? 0
    todayStats.cost = result.todayCost ?? 0
    todayStats.tokenGrowth = result.todayTokenGrowth ?? 0
    todayStats.callGrowth = result.todayCallGrowth ?? 0
    todayStats.costGrowth = result.todayCostGrowth ?? 0
    budgetUsed.value = result.budgetUsed ?? 0
    budgetTotal.value = result.budgetTotal ?? 0
    avgResponseTime.value = result.avgResponseTime ?? 0
    p50ResponseTime.value = result.p50ResponseTime ?? 0
    p90ResponseTime.value = result.p90ResponseTime ?? 0
    retryRate.value = result.retryRate ?? 0
    limitRate.value = result.limitRate ?? 0
  } catch (error) {
    message.error('加载统计数据失败')
    console.error('Failed to load stats:', error)
  }
}

const loadUsageByModel = async () => {
  try {
    const params = getCommonParams()
    const result = await aiModelApi.getUsageByModel(params)
    modelUsageList.value = result ?? []
  } catch (error) {
    message.error('加载模型用量数据失败')
    console.error('Failed to load usage by model:', error)
    modelUsageList.value = []
  }
}

const loadUsageTrend = async () => {
  try {
    const params = getCommonParams()
    const result = await aiModelApi.getUsageTrend(params)
    usageChartData.value = result ?? []
  } catch (error) {
    message.error('加载用量趋势数据失败')
    console.error('Failed to load usage trend:', error)
    usageChartData.value = []
  }
}

const loadLogs = async () => {
  try {
    const params = {
      ...getCommonParams(),
      page: logPagination.current,
      pageSize: logPagination.pageSize,
      type: logFilter.type,
      keyword: logFilter.keyword || undefined,
    }
    const result = await aiModelApi.getLogs(params)
    logList.value = result.records ?? []
    logPagination.total = result.total ?? 0
  } catch (error) {
    message.error('加载调用日志失败')
    console.error('Failed to load logs:', error)
    logList.value = []
    logPagination.total = 0
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadStats(),
      loadUsageByModel(),
      loadUsageTrend(),
      loadLogs(),
    ])
  } catch (error) {
    message.error('数据加载失败')
    console.error('Failed to fetch usage data:', error)
  } finally {
    loading.value = false
  }
}

const exportLogs = () => {
  message.info('正在导出日志...')
}

watch(
  () => authStore.selectedTenantId,
  () => {
    fetchData()
  },
)

onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="less">
.model-usage-page {
  padding: 20px;
}

.filter-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.stat-card {
  .stat-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #fff;
  }

  .stat-info {
    flex: 1;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.2;
  }

  .stat-title {
    font-size: 13px;
    color: #6b7280;
    margin-top: 4px;
  }

  .stat-trend {
    font-size: 12px;
    margin-top: 8px;

    &.up {
      color: #52c41a;
    }

    &.down {
      color: #f5222d;
    }
  }
}

.mini-stat {
  text-align: center;
  padding: 8px 0;

  .mini-value {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
  }

  .mini-label {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
  }

  .mini-diff {
    font-size: 11px;
    margin-top: 4px;

    &.up {
      color: #52c41a;
    }

    &.down {
      color: #f5222d;
    }
  }
}

.budget-container {
  .budget-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .budget-label {
    font-size: 13px;
    color: #6b7280;
  }

  .budget-value {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
  }

  .budget-remaining {
    font-size: 13px;
    color: #6b7280;
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .budget-days {
    color: #722ed1;
    font-weight: 500;
  }
}

.chart-container {
  height: 280px;
  padding: 16px 0;

  .chart-legend {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    padding: 0 16px;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #6b7280;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;

      &.token-dot {
        background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
      }

      &.cost-dot {
        background: linear-gradient(135deg, #722ed1 0%, #eb2f96 100%);
      }
    }
  }

  .chart-area {
    height: 200px;
    display: flex;
    flex-direction: column;
  }

  .chart-bars {
    flex: 1;
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 0 16px;
  }

  .bar-group {
    flex: 1;
    display: flex;
    justify-content: center;
    height: 100%;
    align-items: flex-end;
  }

  .bar {
    width: 100%;
    max-width: 40px;
    border-radius: 4px 4px 0 0;
    position: relative;
    transition: height 0.3s ease;

    &.bar-token {
      background: linear-gradient(180deg, #1890ff 0%, #36cfc9 100%);
    }

    .bar-tooltip {
      position: absolute;
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 10px;
      color: #6b7280;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.2s;
    }

    &:hover .bar-tooltip {
      opacity: 1;
    }
  }

  .chart-labels {
    display: flex;
    padding: 8px 16px 0;

    .chart-label {
      flex: 1;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
  }
}

.pie-chart-placeholder {
  .pie-visual {
    position: relative;
    width: 160px;
    height: 160px;
    margin: 0 auto;
  }

  .pie-ring {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    mask: radial-gradient(transparent 55%, #000 55%);
  }

  .pie-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;

    .pie-total {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    .pie-label {
      font-size: 11px;
      color: #6b7280;
    }
  }

  .pie-legend {
    margin-top: 20px;
    padding: 0 8px;

    .legend-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .legend-color-block {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }

    .legend-model-name {
      flex: 1;
      color: #374151;
    }

    .legend-percent {
      color: #722ed1;
      font-weight: 500;
    }
  }
}

.performance-list {
  .performance-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #f3f4f6;

    &:last-child {
      border-bottom: none;
    }

    .perf-label {
      font-size: 13px;
      color: #6b7280;
    }

    .perf-value {
      font-size: 15px;
      font-weight: 600;
      color: #1f2937;
    }
  }
}

.tokens-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #f0f5ff;
  color: #1890ff;
  border-radius: 4px;
  font-size: 12px;
}

.cost-value {
  color: #722ed1;
  font-weight: 500;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
