<template>
  <div class="knowledge-dashboard-container">
    <a-page-header title="知识库仪表板" sub-title="企业知识资产管理与数据分析">
      <template #extra>
        <a-space>
          <a-range-picker v-model:value="dateRange" @change="refreshData" />
          <a-button type="primary" @click="refreshData">
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
        </a-space>
      </template>
    </a-page-header>

    <div class="dashboard-content">
      <a-row :gutter="[16, 16]" class="stats-row">
        <a-col :xs="24" :sm="12" :md="6" v-for="stat in statsCards" :key="stat.key">
          <a-card class="stat-card" hoverable :bordered="false">
            <div class="stat-icon" :style="{ background: stat.color }">
              <component :is="stat.icon" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :xs="24" :md="16">
          <a-card title="增长趋势" class="chart-card">
            <div v-if="trendData.length > 0" ref="trendChartRef" class="chart-container"></div>
            <a-empty v-else description="暂无数据" class="chart-empty" />
          </a-card>
        </a-col>
        <a-col :xs="24" :md="8">
          <a-card title="分类分布" class="chart-card">
            <div v-if="categories.length > 0" ref="categoryChartRef" class="chart-container pie-chart"></div>
            <a-empty v-else description="暂无分类数据" class="chart-empty" />
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16" style="margin-top: 16px">
        <a-col :xs="24" :md="12">
          <a-card title="最近活动" class="activity-card">
            <a-empty v-if="activities.length === 0" description="暂无活动" />
            <a-timeline v-else>
              <a-timeline-item v-for="activity in activities" :key="activity.id" :color="getActivityColor(activity.type)">
                <div class="activity-item">
                  <div class="activity-title">{{ activity.title }}</div>
                  <div class="activity-meta">
                    <span>{{ activity.userName }}</span>
                    <span>{{ formatTime(activity.time) }}</span>
                  </div>
                </div>
              </a-timeline-item>
            </a-timeline>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-card title="处理状态概览" class="status-card">
            <div class="status-grid">
              <div class="status-item">
                <div class="status-icon parsing">
                  <FileTextOutlined />
                </div>
                <div class="status-info">
                  <div class="status-value">{{ parseStats.total }}</div>
                  <div class="status-label">总文档数</div>
                </div>
              </div>
              <div class="status-item">
                <div class="status-icon success">
                  <CheckCircleOutlined />
                </div>
                <div class="status-info">
                  <div class="status-value">{{ parseStats.success }}</div>
                  <div class="status-label">已解析</div>
                </div>
              </div>
              <div class="status-item">
                <div class="status-icon vectorized">
                  <DatabaseOutlined />
                </div>
                <div class="status-info">
                  <div class="status-value">{{ parseStats.vectorized }}</div>
                  <div class="status-label">已向量化</div>
                </div>
              </div>
              <div class="status-item">
                <div class="status-icon storage">
                  <CloudServerOutlined />
                </div>
                <div class="status-info">
                  <div class="status-value">{{ parseStats.chunks }}</div>
                  <div class="status-label">知识分块</div>
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16" style="margin-top: 16px">
        <a-col :xs="24" :md="12">
          <a-card title="快捷操作" class="quick-actions-card">
            <a-space direction="vertical" style="width: 100%">
              <a-button type="primary" block size="large" @click="goToUpload">
                <template #icon><CloudUploadOutlined /></template>
                上传文档
              </a-button>
              <a-button block size="large" @click="goToDocuments">
                <template #icon><FileSearchOutlined /></template>
                资料库
              </a-button>
              <a-button block size="large" @click="goToGraph">
                <template #icon><ShareAltOutlined /></template>
                知识图谱
              </a-button>
              <a-button block size="large" @click="goToCards">
                <template #icon><FileTextOutlined /></template>
                知识卡片
              </a-button>
            </a-space>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-card title="AI智能问答" class="qa-card">
            <div class="qa-history" ref="qaHistoryRef">
              <div v-for="(item, index) in qaHistory" :key="index" class="qa-item">
                <div class="qa-question">
                  <UserOutlined class="qa-avatar" />
                  <span>{{ item.question }}</span>
                </div>
                <div class="qa-answer">
                  <RobotOutlined class="qa-avatar ai" />
                  <div class="qa-answer-content">
                    <span class="qa-answer-text">{{ item.answer }}</span>
                    <div v-if="item.references && item.references.length > 0" class="qa-references">
                      <div class="qa-references-title">
                        <FileTextOutlined /> 引用来源
                      </div>
                      <div
                        v-for="(ref, refIndex) in item.references"
                        :key="refIndex"
                        class="qa-reference-item"
                      >
                        <span class="qa-reference-index">[{{ refIndex + 1 }}]</span>
                        <span class="qa-reference-title">{{ ref.title }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="qa-empty" v-if="qaHistory.length === 0 && !qaLoading">
              <div class="empty-icon">
                <MessageOutlined />
              </div>
              <p>开始提问，AI将基于知识库为您解答</p>
            </div>
            <div class="qa-input-wrapper">
              <a-input-search
                v-model:value="currentQuestion"
                placeholder="输入您的问题..."
                enter-button="提问"
                size="large"
                @search="askQuestion"
                :loading="qaLoading"
                :disabled="qaLoading"
              />
            </div>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import * as echarts from 'echarts'
import {
  ReloadOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  CloudUploadOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  ShareAltOutlined,
  UserOutlined,
  RobotOutlined,
  MessageOutlined
} from '@ant-design/icons-vue'
import { knowledgeStatsApi, knowledgeCategoryApi, knowledgeDocumentApi, smartQAApi } from '../../api/knowledge'
import type { StreamQAReference, KnowledgeCategoryStats } from '../../api/knowledge'

const router = useRouter()

// 租户ID常量（与同模块其他页面一致）
const TENANT_ID = 1

const dateRange = ref<[Date, Date] | undefined>()
const trendChartRef = ref<HTMLDivElement>()
const categoryChartRef = ref<HTMLDivElement>()
let trendChart: echarts.ECharts | null = null
let categoryChart: echarts.ECharts | null = null

// 统计数据接口返回结构
interface StatsData {
  totalDocuments: number
  parsedDocuments: number
  vectorizedDocuments: number
  totalChunks: number
  totalEntities: number
  totalRelations: number
}

interface TrendItem {
  date: string
  documents: number
  cards: number
}

interface CategoryItem {
  id: number
  name: string
  documentCount?: number
  cardCount?: number
  totalCount?: number
}

interface Activity {
  id: number
  type: string
  title: string
  time: string
  userName: string
}

const stats = ref<StatsData | null>(null)
const trendData = ref<TrendItem[]>([])
const categories = ref<CategoryItem[]>([])
const activities = ref<Activity[]>([])

const parseStats = reactive({
  total: 0,
  success: 0,
  vectorized: 0,
  chunks: 0
})

const statsCards = ref([
  { key: 'documents', label: '文档总数', value: '0', color: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', icon: FileTextOutlined },
  { key: 'parsed', label: '已解析文档', value: '0', color: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', icon: CheckCircleOutlined },
  { key: 'vectorized', label: '已向量化', value: '0', color: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)', icon: DatabaseOutlined },
  { key: 'entities', label: '知识实体', value: '0', color: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)', icon: ShareAltOutlined }
])

const currentQuestion = ref('')
const qaLoading = ref(false)
const qaHistoryRef = ref<HTMLDivElement>()
let stopStream: (() => void) | null = null

interface QAItem {
  question: string
  answer: string
  references: StreamQAReference[]
  streaming?: boolean
}

const qaHistory = ref<QAItem[]>([])

// 加载统计数据
const loadStats = async () => {
  try {
    const res: any = await knowledgeStatsApi.getStats(TENANT_ID)
    const result: StatsData | null = res?.data ?? res ?? null
    if (!result) {
      stats.value = null
      return
    }
    stats.value = result

    statsCards.value[0].value = String(result.totalDocuments ?? 0)
    statsCards.value[1].value = String(result.parsedDocuments ?? 0)
    statsCards.value[2].value = String(result.vectorizedDocuments ?? 0)
    statsCards.value[3].value = String(result.totalEntities ?? 0)

    parseStats.total = result.totalDocuments ?? 0
    parseStats.success = result.parsedDocuments ?? 0
    parseStats.vectorized = result.vectorizedDocuments ?? 0
    parseStats.chunks = result.totalChunks ?? 0
  } catch (error) {
    console.error('加载统计数据失败:', error)
    message.error('加载统计数据失败')
    stats.value = null
  }
}

// 加载增长趋势数据
const loadTrend = async () => {
  try {
    const res: any = await knowledgeStatsApi.getTrend(TENANT_ID, 7)
    const result: TrendItem[] | null = res?.data ?? res ?? null
    const list = Array.isArray(result) ? result : []
    trendData.value = list

    if (list.length === 0) {
      trendChart?.dispose()
      trendChart = null
      return
    }

    await nextTick()
    initTrendChart()
  } catch (error) {
    console.error('加载趋势数据失败:', error)
    trendData.value = []
    trendChart?.dispose()
    trendChart = null
  }
}

// 加载分类数据
const loadCategories = async () => {
  try {
    const res: any = await knowledgeCategoryApi.stats(TENANT_ID)
    const result: KnowledgeCategoryStats[] | null = res?.data ?? res ?? null
    const list = Array.isArray(result) ? result : []
    categories.value = list.filter(item => (item.totalCount || 0) > 0).map(item => ({
      id: item.id,
      name: item.name,
      documentCount: item.documentCount,
      cardCount: item.cardCount,
      totalCount: item.totalCount
    }))

    if (categories.value.length === 0) {
      categoryChart?.dispose()
      categoryChart = null
      return
    }

    await nextTick()
    initCategoryChart()
  } catch (error) {
    console.error('加载分类数据失败:', error)
    categories.value = []
    categoryChart?.dispose()
    categoryChart = null
  }
}

// 加载最近活动（从最近上传的文档获取）
const loadActivities = async () => {
  try {
    const res: any = await knowledgeDocumentApi.list({
      tenantId: TENANT_ID,
      page: 1,
      size: 5
    } as any)
    const result = res?.data ?? res
    const records = result?.records || []
    activities.value = records.map((doc: any) => ({
      id: doc.id,
      type: 'upload',
      title: `上传了文档 "${doc.fileName || doc.originalName || '未命名文档'}"`,
      time: doc.createdAt || '',
      userName: doc.uploadedByName || '未知'
    }))
  } catch (error) {
    console.error('加载活动数据失败:', error)
    activities.value = []
  }
}

// 初始化趋势图
const initTrendChart = () => {
  if (!trendChartRef.value) return

  if (trendChart) {
    trendChart.dispose()
  }

  trendChart = echarts.init(trendChartRef.value)

  const dates = trendData.value.map(item => item.date)
  const documents = trendData.value.map(item => item.documents)
  const cards = trendData.value.map(item => item.cards)

  trendChart.setOption({
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['文档', '卡片']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '文档',
        type: 'line',
        smooth: true,
        data: documents,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
          ])
        },
        itemStyle: { color: '#1890ff' }
      },
      {
        name: '卡片',
        type: 'line',
        smooth: true,
        data: cards,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
            { offset: 1, color: 'rgba(82, 196, 26, 0.05)' }
          ])
        },
        itemStyle: { color: '#52c41a' }
      }
    ]
  })
}

// 初始化分类饼图
const initCategoryChart = () => {
  if (!categoryChartRef.value) return

  if (categoryChart) {
    categoryChart.dispose()
  }

  categoryChart = echarts.init(categoryChartRef.value)

  const data = categories.value.map(cat => ({
    value: cat.totalCount || 0,
    name: cat.name
  }))

  categoryChart.setOption({
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center'
    },
    series: [
      {
        name: '分类分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data
      }
    ]
  })
}

// 加载全部数据
const loadAll = async () => {
  await Promise.all([
    loadStats(),
    loadTrend(),
    loadCategories(),
    loadActivities()
  ])
}

// 刷新数据
const refreshData = async () => {
  message.loading({ content: '正在刷新数据...', key: 'refresh' })
  await loadAll()
  message.success({ content: '数据已刷新', key: 'refresh' })
}

const getActivityColor = (type: string) => {
  const colors: Record<string, string> = {
    upload: 'blue',
    parse: 'green',
    vectorize: 'purple',
    create: 'orange',
    extract: 'cyan'
  }
  return colors[type] || 'gray'
}

const formatTime = (time: string) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

const scrollToBottom = () => {
  nextTick(() => {
    if (qaHistoryRef.value) {
      qaHistoryRef.value.scrollTop = qaHistoryRef.value.scrollHeight
    }
  })
}

// AI 智能问答
const askQuestion = () => {
  if (!currentQuestion.value.trim() || qaLoading.value) return

  const question = currentQuestion.value.trim()
  currentQuestion.value = ''
  qaLoading.value = true

  const newItem: QAItem = {
    question,
    answer: '',
    references: [],
    streaming: true
  }
  qaHistory.value.push(newItem)
  scrollToBottom()

  const currentIndex = qaHistory.value.length - 1

  stopStream = smartQAApi.streamQA(TENANT_ID, question, 5, {
    onMessage: (content: string) => {
      if (qaHistory.value[currentIndex]) {
        qaHistory.value[currentIndex].answer += content
        scrollToBottom()
      }
    },
    onDone: (references: StreamQAReference[]) => {
      if (qaHistory.value[currentIndex]) {
        qaHistory.value[currentIndex].references = references
        qaHistory.value[currentIndex].streaming = false
      }
      qaLoading.value = false
      stopStream = null
      scrollToBottom()
    },
    onError: (error: Error) => {
      console.error('提问失败:', error)
      if (qaHistory.value[currentIndex]) {
        qaHistory.value[currentIndex].answer += '\n\n抱歉，回答过程中出现错误，请稍后重试。'
        qaHistory.value[currentIndex].streaming = false
      }
      qaLoading.value = false
      stopStream = null
      message.error('提问失败，请稍后重试')
    }
  })
}

const goToUpload = () => {
  router.push('/v2/workspace/knowledge/documents?action=upload')
}

const goToDocuments = () => {
  router.push('/v2/workspace/knowledge/documents')
}

const goToGraph = () => {
  router.push('/v2/workspace/knowledge/graph')
}

const goToCards = () => {
  router.push('/v2/workspace/knowledge/cards')
}

const handleResize = () => {
  trendChart?.resize()
  categoryChart?.resize()
}

onMounted(() => {
  loadAll()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  categoryChart?.dispose()
  if (stopStream) {
    stopStream()
    stopStream = null
  }
})
</script>

<style lang="less" scoped>
.knowledge-dashboard-container {
  .dashboard-content {
    padding: 24px;
  }
}

.stat-card {
  .ant-card-body {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 24px;
  }

  .stat-info {
    flex: 1;

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #262626;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 13px;
      color: #8c8c8c;
      margin-top: 4px;
    }
  }
}

.chart-card {
  height: 100%;

  .chart-container {
    height: 300px;
    width: 100%;

    &.pie-chart {
      height: 280px;
    }
  }

  .chart-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
  }
}

.activity-card {
  .activity-item {
    .activity-title {
      font-size: 14px;
      color: #262626;
    }

    .activity-meta {
      font-size: 12px;
      color: #8c8c8c;
      margin-top: 4px;
      display: flex;
      gap: 12px;
    }
  }
}

.status-card {
  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;

    .status-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;

      .status-icon {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #fff;

        &.parsing {
          background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
        }
        &.success {
          background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
        }
        &.vectorized {
          background: linear-gradient(135deg, #722ed1 0%, #531dab 100%);
        }
        &.storage {
          background: linear-gradient(135deg, #fa8c16 0%, #d46b08 100%);
        }
      }

      .status-info {
        .status-value {
          font-size: 20px;
          font-weight: 600;
          color: #262626;
        }
        .status-label {
          font-size: 12px;
          color: #8c8c8c;
        }
      }
    }
  }
}

.quick-actions-card {
  .ant-btn {
    height: 52px;
  }
}

.qa-card {
  display: flex;
  flex-direction: column;
  height: 420px;

  .qa-history {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 16px;
    padding-right: 8px;

    .qa-item {
      margin-bottom: 16px;

      .qa-question,
      .qa-answer {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.6;
      }

      .qa-question {
        background: #e6f7ff;
        margin-bottom: 4px;
      }

      .qa-answer {
        background: #f6ffed;

        .qa-answer-content {
          flex: 1;

          .qa-answer-text {
            white-space: pre-wrap;
            word-break: break-word;
          }

          .qa-references {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #b7eb8f;
            font-size: 12px;

            .qa-references-title {
              font-weight: 600;
              color: #389e0d;
              margin-bottom: 6px;
              display: flex;
              align-items: center;
              gap: 4px;
            }

            .qa-reference-item {
              color: #52c41a;
              margin-bottom: 4px;
              cursor: pointer;

              &:hover {
                color: #389e0d;
                text-decoration: underline;
              }

              .qa-reference-index {
                margin-right: 4px;
                color: #73d13d;
              }
            }
          }
        }
      }

      .qa-avatar {
        font-size: 16px;
        margin-top: 2px;
        color: #1890ff;
        flex-shrink: 0;

        &.ai {
          color: #52c41a;
        }
      }
    }
  }

  .qa-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #8c8c8c;

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    p {
      margin: 0;
    }
  }
}
</style>
