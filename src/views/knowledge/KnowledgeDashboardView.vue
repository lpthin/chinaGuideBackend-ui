<template>
  <div class="knowledge-dashboard-container">
    <a-page-header title="知识库仪表板" sub-title="企业知识资产管理与数据分析">
      <template #extra>
        <a-button type="primary" :loading="loading" @click="refreshData">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </template>
    </a-page-header>

    <div class="dashboard-content">
      <a-alert
        v-if="scopeNotice"
        class="scope-alert"
        type="info"
        show-icon
        :message="scopeNotice"
      />
      <!-- 「读不到这一家」与「读失败」分开念：这两种都不能摆成一屏 0 -->
      <a-alert
        v-if="dashboardState === 'unreadable'"
        class="scope-alert"
        type="warning"
        show-icon
        :message="emptyLine"
      />
      <a-alert
        v-if="dashboardState === 'failed'"
        class="scope-alert"
        type="error"
        show-icon
        :message="`这一屏没读上来：${readError}`"
      />

      <a-row :gutter="[16, 16]" class="stats-row">
        <a-col :xs="24" :sm="12" :md="6" v-for="stat in statsCards" :key="stat.key">
          <a-card class="stat-card" hoverable :bordered="false">
            <div class="stat-icon" :style="{ background: stat.color }">
              <component :is="stat.icon" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ countText(stat.value) }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :xs="24" :md="16">
          <a-card class="chart-card">
            <template #title>增长趋势<span class="card-sub">近 7 天（含今天）</span></template>
            <div v-if="trendNotice" class="chart-empty chart-state">{{ trendNotice }}</div>
            <div v-else-if="trendData.length > 0" ref="trendChartRef" class="chart-container"></div>
            <a-empty v-else description="近 7 天里没有新增文档或卡片" class="chart-empty" />
          </a-card>
        </a-col>
        <a-col :xs="24" :md="8">
          <a-card title="分类分布" class="chart-card">
            <div v-if="pieNotice" class="chart-empty chart-state">{{ pieNotice }}</div>
            <div v-else-if="categories.length > 0" ref="categoryChartRef" class="chart-container pie-chart"></div>
            <a-empty v-else description="这一家还没有分过类的知识内容" class="chart-empty" />
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16" style="margin-top: 16px">
        <a-col :xs="24" :md="12">
          <a-card title="最近活动" class="activity-card">
            <div v-if="activityNotice" class="activity-state">{{ activityNotice }}</div>
            <a-empty v-else-if="activities.length === 0" description="这一家还没有上传过资料" />
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
                  <div class="status-value">{{ countText(parseStats.total) }}</div>
                  <div class="status-label">总文档数</div>
                </div>
              </div>
              <div class="status-item">
                <div class="status-icon success">
                  <CheckCircleOutlined />
                </div>
                <div class="status-info">
                  <div class="status-value">{{ countText(parseStats.success) }}</div>
                  <div class="status-label">已解析</div>
                </div>
              </div>
              <div class="status-item">
                <div class="status-icon vectorized">
                  <DatabaseOutlined />
                </div>
                <div class="status-info">
                  <div class="status-value">{{ countText(parseStats.vectorized) }}</div>
                  <div class="status-label">已向量化</div>
                </div>
              </div>
              <div class="status-item">
                <div class="status-icon storage">
                  <CloudServerOutlined />
                </div>
                <div class="status-info">
                  <div class="status-value">{{ countText(parseStats.chunks) }}</div>
                  <div class="status-label">知识分块</div>
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16" style="margin-top: 16px" align="stretch">
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
              <p>{{ qaHint }}</p>
            </div>
            <div class="qa-input-wrapper">
              <a-input-search
                v-model:value="currentQuestion"
                placeholder="输入您的问题..."
                enter-button="提问"
                size="large"
                @search="askQuestion"
                :loading="qaLoading"
                :disabled="qaDisabled"
              />
            </div>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch, markRaw } from 'vue'
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
import { useAuthStore } from '../../stores/auth'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'

const router = useRouter()
const auth = useAuthStore()

/**
 * 这一屏的数属于谁。超管没选定客户就是 null ⇒ 一发 `/api/knowledge/*` 都不发。
 *
 * 改前这里是 `auth.selectedTenantId || 1`：超管没选客户时悄悄去问 1 号客户，
 * 租户管理员则永远拿 1（自己的客户编号根本不参与），屏幕照样摆一屏数。
 */
const requestedTenantId = computed<number | null>(() => {
  if (auth.isSuperAdmin) return auth.selectedTenantId ?? null
  return auth.user?.tenantId ?? null
})

const scopeNotice = computed(() => {
  const id = requestedTenantId.value
  if (id === null) {
    return auth.isSuperAdmin
      ? '当前没有选定客户，这一屏不发请求、也不摆任何一家的数。请在右上角选一家客户。'
      : '登录信息里没有客户编号，这一屏不摆数。'
  }
  const code = auth.selectedTenantCode
  const who = auth.isSuperAdmin
    ? `当前看的是${code ? `客户「${code}」` : '选中的那一家客户'}（编号 #${id}）`
    : `当前看的是你所在客户（编号 #${id}）`
  return `${who}的知识库数据。`
})

type ReadState = 'idle' | 'loading' | 'ok' | 'unreadable' | 'failed'

const loading = ref(false)
const dashboardState = ref<ReadState>('idle')
const emptyLine = ref('')
const readError = ref('')

const trendState = ref<ReadState>('idle')
const trendError = ref('')
const categoryState = ref<ReadState>('idle')
const categoryError = ref('')
const activityState = ref<ReadState>('idle')
const activityError = ref('')
const activityEmptyLine = ref('')

function countText(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString()
}

const trendChartRef = ref<HTMLDivElement>()
const categoryChartRef = ref<HTMLDivElement>()
let trendChart: echarts.ECharts | null = null
let categoryChart: echarts.ECharts | null = null

// 统计数据接口返回结构（tenantUnreadable 与成因只有「读不到这一家」时才有）
interface StatsData {
  totalDocuments: number
  parsedDocuments: number
  vectorizedDocuments: number
  totalChunks: number
  totalEntities: number
  totalRelations: number
  tenantUnreadable?: boolean
  emptyReason?: string
  emptyLine?: string
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
  status?: string
  title: string
  time: string
  userName: string
}

const trendData = ref<TrendItem[]>([])
const categories = ref<CategoryItem[]>([])
const activities = ref<Activity[]>([])

const parseStats = reactive({
  total: null as number | null,
  success: null as number | null,
  vectorized: null as number | null,
  chunks: null as number | null
})

const statsCards = ref([
  { key: 'documents', label: '文档总数', value: null as number | null, color: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', icon: markRaw(FileTextOutlined) },
  { key: 'parsed', label: '已解析文档', value: null as number | null, color: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', icon: markRaw(CheckCircleOutlined) },
  { key: 'vectorized', label: '已向量化', value: null as number | null, color: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)', icon: markRaw(DatabaseOutlined) },
  { key: 'entities', label: '知识实体', value: null as number | null, color: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)', icon: markRaw(ShareAltOutlined) }
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

const resetAll = () => {
  dashboardState.value = 'idle'
  emptyLine.value = ''
  readError.value = ''
  statsCards.value.forEach(card => {
    card.value = null
  })
  parseStats.total = null
  parseStats.success = null
  parseStats.vectorized = null
  parseStats.chunks = null
  trendData.value = []
  trendState.value = 'idle'
  trendError.value = ''
  trendChart?.dispose()
  trendChart = null
  categories.value = []
  categoryState.value = 'idle'
  categoryError.value = ''
  categoryChart?.dispose()
  categoryChart = null
  activities.value = []
  activityState.value = 'idle'
  activityError.value = ''
  activityEmptyLine.value = ''
}

// 「读不到这一家」与「这一家真没有」是两件事：前者七个数全是 0，不能当真数摆出去
const loadStats = async (tenantId: number) => {
  dashboardState.value = 'loading'
  readError.value = ''
  try {
    const res: any = await knowledgeStatsApi.getStats(tenantId)
    const result: StatsData | null = res?.data ?? res ?? null
    if (!result) {
      dashboardState.value = 'failed'
      readError.value = '后端一个字没回'
      return
    }
    if (result.tenantUnreadable) {
      dashboardState.value = 'unreadable'
      emptyLine.value = result.emptyLine || '知识库仪表盘读不到这一家：这个编号不存在或已被删除。这不代表这一家「没有内容」。'
      return
    }
    dashboardState.value = 'ok'

    statsCards.value[0].value = result.totalDocuments ?? 0
    statsCards.value[1].value = result.parsedDocuments ?? 0
    statsCards.value[2].value = result.vectorizedDocuments ?? 0
    statsCards.value[3].value = result.totalEntities ?? 0

    parseStats.total = result.totalDocuments ?? 0
    parseStats.success = result.parsedDocuments ?? 0
    parseStats.vectorized = result.vectorizedDocuments ?? 0
    parseStats.chunks = result.totalChunks ?? 0
  } catch (error) {
    logError('knowledge/knowledge-dashboard-view', '加载统计数据失败:', error)
    dashboardState.value = 'failed'
    readError.value = describeHttpError(error)
  }
}

// 加载增长趋势数据
const loadTrend = async (tenantId: number) => {
  trendState.value = 'loading'
  trendError.value = ''
  try {
    const res: any = await knowledgeStatsApi.getTrend(tenantId, 7)
    const result: TrendItem[] | null = res?.data ?? res ?? null
    const list = Array.isArray(result) ? result : []
    trendData.value = list
    trendState.value = 'ok'

    if (list.length === 0) {
      trendChart?.dispose()
      trendChart = null
      return
    }

    await nextTick()
    initTrendChart()
  } catch (error) {
    logError('knowledge/knowledge-dashboard-view', '加载趋势数据失败:', error)
    trendData.value = []
    trendState.value = 'failed'
    trendError.value = describeHttpError(error)
    trendChart?.dispose()
    trendChart = null
  }
}

// 加载分类数据
const loadCategories = async (tenantId: number) => {
  categoryState.value = 'loading'
  categoryError.value = ''
  try {
    const res: any = await knowledgeCategoryApi.stats(tenantId)
    const result: KnowledgeCategoryStats[] | null = res?.data ?? res ?? null
    const list = Array.isArray(result) ? result : []
    categories.value = list.filter(item => (item.totalCount || 0) > 0).map(item => ({
      id: item.id,
      name: item.name,
      documentCount: item.documentCount,
      cardCount: item.cardCount,
      totalCount: item.totalCount
    }))
    categoryState.value = 'ok'

    if (categories.value.length === 0) {
      categoryChart?.dispose()
      categoryChart = null
      return
    }

    await nextTick()
    initCategoryChart()
  } catch (error) {
    logError('knowledge/knowledge-dashboard-view', '加载分类数据失败:', error)
    categories.value = []
    categoryState.value = 'failed'
    categoryError.value = describeHttpError(error)
    categoryChart?.dispose()
    categoryChart = null
  }
}

// 加载最近活动（从最近上传的文档获取，空时原样念后端给的成因）
const loadActivities = async (tenantId: number) => {
  activityState.value = 'loading'
  activityError.value = ''
  activityEmptyLine.value = ''
  try {
    const res: any = await knowledgeDocumentApi.list({
      tenantId,
      page: 1,
      size: 5
    } as any)
    const result = res?.data ?? res
    const records = result?.records || []
    activities.value = records.map((doc: any) => {
      const status = doc.parseStatus || doc.status || 'pending'
      return {
        id: doc.id,
        type: inferActivityType(status),
        status,
        title: `上传了文档 "${doc.title || doc.originalName || doc.fileName || '未命名文档'}"`,
        time: doc.createdAt || '',
        userName: doc.uploadedByName || '未知'
      }
    })
    if (records.length === 0) {
      activityEmptyLine.value = result?.emptyLine || ''
    }
    activityState.value = 'ok'
  } catch (error) {
    logError('knowledge/knowledge-dashboard-view', '加载活动数据失败:', error)
    activities.value = []
    activityState.value = 'failed'
    activityError.value = describeHttpError(error)
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

const trendNotice = computed(() => {
  // 没选定客户时这三段根本没发请求，不能念成「查过了、没有」
  if (requestedTenantId.value === null) return '没有选定客户，这一段还没查过。'
  if (dashboardState.value === 'unreadable') return emptyLine.value
  if (dashboardState.value === 'failed') return `这一屏没读上来：${readError.value}`
  if (trendState.value === 'failed') return `增长趋势没读上来：${trendError.value}`
  return ''
})

const pieNotice = computed(() => {
  if (requestedTenantId.value === null) return '没有选定客户，这一段还没查过。'
  if (dashboardState.value === 'unreadable') return emptyLine.value
  if (dashboardState.value === 'failed') return `这一屏没读上来：${readError.value}`
  if (categoryState.value === 'failed') return `分类分布没读上来：${categoryError.value}`
  return ''
})

const activityNotice = computed(() => {
  if (requestedTenantId.value === null) return '没有选定客户，这一段还没查过。'
  if (dashboardState.value === 'unreadable') return emptyLine.value
  if (dashboardState.value === 'failed') return `这一屏没读上来：${readError.value}`
  if (activityState.value === 'failed') return `最近活动没读上来：${activityError.value}`
  if (activityState.value === 'ok' && activities.value.length === 0) return activityEmptyLine.value
  return ''
})

const qaBlockedLine = computed(() => {
  if (requestedTenantId.value === null) return '没有选定客户，问答不发请求。'
  if (dashboardState.value === 'unreadable') return '这一家读不到，问答不发请求。'
  if (dashboardState.value === 'failed') return '知识库统计没读上来，问答先不发请求。'
  return ''
})

const qaHint = computed(() => qaBlockedLine.value || '开始提问，AI将基于知识库为您解答')
const qaDisabled = computed(() => qaLoading.value || qaBlockedLine.value !== '')

// 加载全部数据
const loadAll = async () => {
  const tenantId = requestedTenantId.value
  resetAll()
  if (tenantId === null) return

  loading.value = true
  try {
    await loadStats(tenantId)
    // 这一家读不到就别再往下问：后三口只会回空，摆出来的「没有数据」是假的
    if (dashboardState.value !== 'ok') return
    await Promise.all([
      loadTrend(tenantId),
      loadCategories(tenantId),
      loadActivities(tenantId)
    ])
  } finally {
    loading.value = false
  }
}

// 刷新数据：只有四口都读成时才说「已刷新」，否则把没读上来的名字念出来
const refreshData = async () => {
  if (requestedTenantId.value === null) {
    message.warning('先在右上角选定客户，再刷新')
    return
  }
  message.loading({ content: '正在刷新数据...', key: 'refresh' })
  await loadAll()
  if (dashboardState.value === 'unreadable') {
    message.warning({ content: '这一家读不到，屏幕上的数不能当真', key: 'refresh' })
    return
  }
  // 统计这一口整屏失败时，后三口根本没发过请求（loadAll 到这就返回了），不能说「其余部分照旧」
  if (dashboardState.value === 'failed') {
    message.warning({ content: `这一屏一个数都没读到：${readError.value}`, key: 'refresh' })
    return
  }
  const failed: string[] = []
  if (trendState.value === 'failed') failed.push('增长趋势')
  if (categoryState.value === 'failed') failed.push('分类分布')
  if (activityState.value === 'failed') failed.push('最近活动')
  if (failed.length > 0) {
    message.warning({ content: `没读上来：${failed.join('、')}。其余部分照旧`, key: 'refresh' })
    return
  }
  message.success({ content: '数据已刷新', key: 'refresh' })
}

// 根据文档状态推断活动类型（用于时间轴颜色区分）
const inferActivityType = (status: string): string => {
  switch (status) {
    case 'success':
      return 'parsed'
    case 'processing':
      return 'parsing'
    case 'failed':
      return 'failed'
    case 'pending':
      return 'pending'
    default:
      return 'upload'
  }
}

const getActivityColor = (type: string) => {
  const colors: Record<string, string> = {
    upload: 'blue',
    parse: 'green',
    vectorize: 'purple',
    create: 'orange',
    extract: 'cyan',
    parsed: 'green',
    parsing: 'blue',
    failed: 'red',
    pending: 'gray'
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
  const tenantId = requestedTenantId.value
  if (!tenantId || !currentQuestion.value.trim() || qaLoading.value) return

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

  stopStream = smartQAApi.streamQA(tenantId, question, 5, {
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
      logError('knowledge/knowledge-dashboard-view', '提问失败:', error)
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
  router.push('/workspace/knowledge/documents?action=upload')
}

const goToDocuments = () => {
  router.push('/workspace/knowledge/documents')
}

const goToGraph = () => {
  router.push('/workspace/knowledge/graph')
}

const goToCards = () => {
  router.push('/workspace/knowledge/cards')
}

const handleResize = () => {
  trendChart?.resize()
  categoryChart?.resize()
}

watch(requestedTenantId, () => {
  loadAll()
})

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

  .scope-alert {
    margin-bottom: 16px;
  }
}

.card-sub {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #8c8c8c;
}

.chart-state,
.activity-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  padding: 16px;
  color: #8c8c8c;
  text-align: center;
  line-height: 1.6;
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
    height: 200px;
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
  min-height: 420px;
  height: 100%;

  .ant-btn {
    height: 52px;
  }
}

.qa-card {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  height: 100%;

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
