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
                <div class="stat-trend up">
                  <ArrowUpOutlined /> 0.5% 较昨日
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
                  <div class="mini-diff up">+12.5%</div>
                </div>
              </a-col>
              <a-col :span="8">
                <div class="mini-stat">
                  <div class="mini-value">{{ todayStats.calls.toLocaleString() }}</div>
                  <div class="mini-label">今日调用</div>
                  <div class="mini-diff up">+8.3%</div>
                </div>
              </a-col>
              <a-col :span="8">
                <div class="mini-stat">
                  <div class="mini-value">¥{{ todayStats.cost.toFixed(2) }}</div>
                  <div class="mini-label">今日费用</div>
                  <div class="mini-diff up">+15.2%</div>
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
import { ref, reactive, computed, onMounted, h } from 'vue'
import { message } from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import {
  DollarOutlined,
  BlockOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import { usageApi } from '../../api/ai-model'

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

const totalCost = ref(1256.78)
const totalTokens = ref(3845620)
const totalCalls = ref(15420)
const successRate = ref(99.2)
const costGrowth = ref(15.8)
const tokenGrowth = ref(12.3)
const callGrowth = ref(8.5)

const todayStats = reactive({
  tokens: 45230,
  calls: 234,
  cost: 15.23,
})

const budgetUsed = ref(1256.78)
const budgetTotal = ref(2000)

const timeRange = ref('7d')
const avgResponseTime = ref(156)
const p50ResponseTime = ref(120)
const p90ResponseTime = ref(380)
const retryRate = ref(1.2)
const limitRate = ref(0.3)

const modelColors = ['#722ed1', '#1890ff', '#52c41a', '#fa8c16', '#eb2f96']

const modelUsageList = ref([
  { name: '通义千问', tokens: 1856780, percent: 48.3 },
  { name: 'GPT-4', tokens: 987650, percent: 25.7 },
  { name: '智谱 AI', tokens: 567890, percent: 14.8 },
  { name: '文心一言', tokens: 320450, percent: 8.3 },
  { name: 'Claude', tokens: 112850, percent: 2.9 },
])

const usageChartData = ref([
  { date: '06-22', tokens: 450000, cost: 145.2 },
  { date: '06-23', tokens: 520000, cost: 168.5 },
  { date: '06-24', tokens: 480000, cost: 155.8 },
  { date: '06-25', tokens: 610000, cost: 198.2 },
  { date: '06-26', tokens: 550000, cost: 178.9 },
  { date: '06-27', tokens: 620000, cost: 201.4 },
  { date: '06-28', tokens: 595770, cost: 192.8 },
])

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
  return `conic-gradient(
    ${modelColors[0]} 0% ${modelUsageList.value[0].percent}%,
    ${modelColors[1]} ${modelUsageList.value[0].percent}% ${modelUsageList.value[0].percent + modelUsageList.value[1].percent}%,
    ${modelColors[2]} ${modelUsageList.value[0].percent + modelUsageList.value[1].percent}% ${modelUsageList.value.slice(0, 3).reduce((a, b) => a + b.percent, 0)}%,
    ${modelColors[3]} ${modelUsageList.value.slice(0, 3).reduce((a, b) => a + b.percent, 0)}% ${modelUsageList.value.slice(0, 4).reduce((a, b) => a + b.percent, 0)}%,
    ${modelColors[4]} ${modelUsageList.value.slice(0, 4).reduce((a, b) => a + b.percent, 0)}% 100%
  )`
}

const logFilter = reactive({
  type: undefined as string | undefined,
  keyword: '',
})

const logPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 156,
})

const logList = ref([
  {
    id: 1,
    model: '通义千问',
    type: 'chat',
    prompt: '你好，请介绍一下...',
    tokens: 256,
    cost: 0.008,
    status: 'success',
    duration: 156,
    createdAt: '2024-06-28 14:32:15',
  },
  {
    id: 2,
    model: 'GPT-4',
    type: 'chat',
    prompt: '分析以下数据...',
    tokens: 1024,
    cost: 0.032,
    status: 'success',
    duration: 280,
    createdAt: '2024-06-28 14:28:42',
  },
  {
    id: 3,
    model: '智谱 Embedding',
    type: 'embedding',
    prompt: '向量化处理...',
    tokens: 512,
    cost: 0.002,
    status: 'success',
    duration: 89,
    createdAt: '2024-06-28 14:25:18',
  },
  {
    id: 4,
    model: '通义千问',
    type: 'chat',
    prompt: '生成报告...',
    tokens: 2048,
    cost: 0.064,
    status: 'error',
    duration: 5000,
    createdAt: '2024-06-28 14:20:33',
  },
  {
    id: 5,
    model: '文心一言',
    type: 'chat',
    prompt: '翻译以下内容...',
    tokens: 768,
    cost: 0.015,
    status: 'success',
    duration: 198,
    createdAt: '2024-06-28 14:15:56',
  },
])

const paginatedLogs = computed(() => {
  const start = (logPagination.current - 1) * logPagination.pageSize
  const end = start + logPagination.pageSize
  return logList.value.slice(start, end)
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

const fetchData = async () => {
  loading.value = true
  try {
    const startDate = dateRange.value?.[0]?.format('YYYY-MM-DD')
    const endDate = dateRange.value?.[1]?.format('YYYY-MM-DD')
    const params: any = { startDate, endDate }
    const [overview, statistics, performance, records] = await Promise.all([
      usageApi.getOverview(),
      usageApi.getStatistics(params),
      usageApi.getPerformance(),
      usageApi.getUsageRecords({ page: 1, pageSize: 20, ...params } as any),
    ])
  } catch (error) {
    console.error('Failed to fetch usage data:', error)
  } finally {
    loading.value = false
  }
}

const exportLogs = () => {
  message.info('正在导出日志...')
}

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
