<template>
  <div class="review-panel-page">
    <a-spin :spinning="loading">
      <!-- 顶部数据概览区：全部取自 reviewApi.getReviewStats -->
      <a-row :gutter="16" class="stats-row">
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <ClockCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.pendingCount }}</div>
                <div class="stat-title">待审核文章数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.approvedCount }}</div>
                <div class="stat-title">已通过文章数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)">
                <CloseCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.rejectedCount }}</div>
                <div class="stat-title">已驳回文章数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <DashboardOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.passRate }}%</div>
                <div class="stat-title">审核通过率</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 审核队列管理区 -->
      <a-card class="queue-card" :bordered="false">
        <div class="queue-header">
          <div class="queue-title">
            <AuditOutlined class="title-icon" />
            <span>审核队列管理</span>
          </div>
          <div class="queue-actions">
            <a-space>
              <a-tooltip title="优先级说明">
                <a-button type="text" @click="showPriorityGuide = true">
                  <template #icon><InfoCircleOutlined /></template>
                  优先级说明
                </a-button>
              </a-tooltip>
              <a-button type="primary" :loading="batchLoading" :disabled="!selectedRows.length" @click="batchPass">
                <template #icon><CheckOutlined /></template>
                批量通过 ({{ selectedRows.length }})
              </a-button>
              <a-button type="primary" danger :disabled="!selectedRows.length" @click="() => selectedRows.length && (showBatchRejectModal = true)">
                <template #icon><CloseOutlined /></template>
                批量驳回
              </a-button>
            </a-space>
          </div>
        </div>

        <!-- 快速筛选 -->
        <div class="quick-filters">
          <a-space size="middle">
            <span class="filter-label">快速筛选：</span>
            <a-tag
              v-for="opt in statusFilterOptions"
              :key="opt.value"
              :color="opt.color"
              :class="['filter-tag', { active: statusFilter === opt.value }]"
              @click="statusFilter = opt.value"
            >
              {{ opt.label }}
            </a-tag>
          </a-space>
          <a-input-search 
            v-model:value="searchKeyword" 
            placeholder="搜索文章标题或审核人" 
            style="width: 280px" 
            enter-button 
            size="middle"
          />
        </div>
      </a-card>

      <!-- 文章审核工作区 -->
      <a-row :gutter="16" class="workspace-row">
        <!-- 左侧：文章列表 -->
        <a-col :xs="24" :lg="8" :xl="7">
          <a-card class="list-panel" :bordered="false">
            <template #title>
              <div class="panel-title">
                <UnorderedListOutlined />
                <span>文章列表</span>
                <span class="list-count">{{ filteredArticles.length }}</span>
              </div>
            </template>
            <div class="article-list">
              <div 
                v-for="article in filteredArticles" 
                :key="article.id"
                :class="['article-card-item', { active: currentArticle?.id === article.id }]"
                @click="selectArticle(article)"
              >
                <div class="card-item-header">
                  <a-checkbox 
            :checked="selectedRows.some(r => r.id === article.id)"
            @click.stop="toggleSelect(article)"
          />
                  <a-tag :color="getPriorityColor(article.priority)" size="small">P{{ article.priority }}</a-tag>
                  <a-tag :color="articleStatusMeta(article.status).color" size="small">{{ articleStatusMeta(article.status).label }}</a-tag>
                </div>
                <div class="card-item-title">{{ article.title }}</div>
                <div class="card-item-meta">
                  <span><UserOutlined /> {{ article.reviewer || '未分配' }}</span>
                  <span><FileTextOutlined /> {{ article.wordCount }}字</span>
                </div>
                <div class="card-item-footer">
                  <span class="submit-time">
                    <ClockCircleOutlined /> {{ formatTime(article.createdAt) }}
                  </span>
                  <div class="mini-scores">
                    <a-tooltip :title="`原创度: ${article.originalScore}%`">
                      <span class="mini-score" :style="{ color: getScoreColor(article.originalScore) }">
                        <CopyOutlined /> {{ article.originalScore }}%
                      </span>
                    </a-tooltip>
                    <a-tooltip :title="`质量分: ${article.qualityScore}分`">
                      <span class="mini-score" :style="{ color: getScoreColor(article.qualityScore) }">
                        <StarOutlined /> {{ article.qualityScore }}
                      </span>
                    </a-tooltip>
                  </div>
                </div>
              </div>
              <a-empty v-if="!filteredArticles.length" description="暂无待审核文章" class="empty-list" />
            </div>
          </a-card>
        </a-col>

        <!-- 右侧：详情与操作 -->
        <a-col :xs="24" :lg="16" :xl="17">
          <div v-if="currentArticle" class="detail-panel">
            <!-- 文章详情头部 -->
            <a-card class="detail-header-card" :bordered="false">
              <div class="detail-header">
                <div class="detail-title-section">
                  <h2 class="detail-title">{{ currentArticle.title }}</h2>
                  <div class="detail-meta">
                    <a-tag :color="getPriorityColor(currentArticle.priority)">
                      <FlagOutlined /> 优先级 P{{ currentArticle.priority }}
                    </a-tag>
                    <a-tag :color="articleStatusMeta(currentArticle.status).color">
                      {{ articleStatusMeta(currentArticle.status).label }}
                    </a-tag>
                    <span class="meta-text"><UserOutlined /> {{ currentArticle.reviewer || '未分配' }}</span>
                    <span class="meta-text"><CalendarOutlined /> {{ formatTime(currentArticle.createdAt) }}</span>
                    <span class="meta-text"><FileTextOutlined /> {{ currentArticle.wordCount }}字</span>
                  </div>
                </div>
                <div class="detail-actions">
                  <a-button @click="editArticle(currentArticle)">
                    <template #icon><EditOutlined /></template>
                    编辑文章
                  </a-button>
                </div>
              </div>
            </a-card>

            <!-- AI预审建议 -->
            <a-card class="ai-suggestion-card" :bordered="false">
              <template #title>
                <div class="card-title-small">
                  <RobotOutlined class="title-icon" />
                  <span>AI 预审建议</span>
                </div>
              </template>
              <a-row :gutter="16">
                <a-col :xs="12" :md="8">
                  <div class="score-card">
                    <div class="score-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                      <CopyOutlined />
                    </div>
                    <div class="score-info">
                      <div class="score-label">原创度</div>
                      <div class="score-num" :style="{ color: getScoreColor(currentArticle.originalScore) }">
                        {{ currentArticle.originalScore }}%
                      </div>
                    </div>
                  </div>
                </a-col>
                <a-col :xs="12" :md="8">
                  <div class="score-card">
                    <div class="score-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                      <StarOutlined />
                    </div>
                    <div class="score-info">
                      <div class="score-label">质量评分</div>
                      <div class="score-num" :style="{ color: getScoreColor(currentArticle.qualityScore) }">
                        {{ currentArticle.qualityScore }}分
                      </div>
                    </div>
                  </div>
                </a-col>
                <a-col :xs="12" :md="8">
                  <div class="score-card">
                    <div class="score-icon" :style="currentArticle.compliance ? 'background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)' : 'background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)'">
                      <SafetyOutlined />
                    </div>
                    <div class="score-info">
                      <div class="score-label">合规检查</div>
                      <div class="score-num" :style="{ color: currentArticle.compliance ? '#52c41a' : '#ff4d4f' }">
                        {{ currentArticle.compliance ? '通过' : '风险' }}
                      </div>
                    </div>
                  </div>
                </a-col>
              </a-row>

              <!-- 敏感词检测 -->
              <div class="sensitive-section">
                <div class="section-subtitle">
                  <AlertOutlined /> 敏感词检测
                </div>
                <div v-if="!currentArticle.sensitiveWords?.length" class="sensitive-safe">
                  <CheckCircleOutlined /> 未检测到敏感词
                </div>
                <div v-else class="sensitive-words">
                  <a-tag v-for="(w, i) in currentArticle.sensitiveWords" :key="i" color="error" class="sensitive-tag">
                    {{ w.word }}
                    <span class="count">({{ w.count }}处)</span>
                  </a-tag>
                </div>
              </div>

              <!-- 原创度评分进度条 -->
              <div class="progress-section">
                <div class="section-subtitle">
                  <CopyOutlined /> 原创度评分
                </div>
                <div class="score-progress-item">
                  <div class="score-progress-label">
                    <span>原创度</span>
                    <span class="score-progress-value" :style="{ color: getScoreColor(currentArticle.originalScore) }">{{ currentArticle.originalScore }}%</span>
                  </div>
                  <a-progress :percent="currentArticle.originalScore" :show-info="false" :stroke-color="getScoreColor(currentArticle.originalScore)" size="small" />
                </div>
                <div class="score-progress-item">
                  <div class="score-progress-label">
                    <span>质量分</span>
                    <span class="score-progress-value" :style="{ color: getScoreColor(currentArticle.qualityScore) }">{{ currentArticle.qualityScore }}分</span>
                  </div>
                  <a-progress :percent="currentArticle.qualityScore" show-info="false" :stroke-color="getScoreColor(currentArticle.qualityScore)" size="small" />
                </div>
                <div class="score-progress-item">
                  <div class="score-progress-label">
                    <span>合规性</span>
                    <span class="score-progress-value" :style="{ color: currentArticle.compliance ? '#52c41a' : '#ff4d4f' }">{{ currentArticle.compliance ? '合规' : '风险' }}</span>
                  </div>
                  <a-progress :percent="currentArticle.compliance ? 100 : 30" show-info="false" :stroke-color="currentArticle.compliance ? '#52c41a' : '#ff4d4f'" size="small" />
                </div>
              </div>

              <!-- 优化建议 -->
              <div v-if="currentArticle.aiSuggestions?.length" class="suggestions-section">
                <div class="section-subtitle">
                  <BulbOutlined /> 优化建议
                </div>
                <ul class="suggestion-list">
                  <li v-for="(s, i) in currentArticle.aiSuggestions" :key="i">{{ s }}</li>
                </ul>
              </div>
            </a-card>

            <!-- 文章内容预览 -->
            <a-card class="content-card" :bordered="false">
              <template #title>
                <div class="card-title-small">
                  <ReadOutlined class="title-icon" />
                  <span>文章内容预览</span>
                </div>
              </template>
              <div class="article-preview" v-html="highlightContent(currentArticle.content)"></div>
            </a-card>

            <!-- 审核操作区 -->
            <a-card class="action-card" :bordered="false">
              <div class="action-content">
                <div class="opinion-section">
                  <div class="section-subtitle">
                    <MessageOutlined /> 审核意见
                  </div>
                  <div class="opinion-templates">
                    <span class="template-label">快速插入：</span>
                    <a-space wrap>
                      <a-tag 
                        v-for="(tpl, i) in opinionTemplates" 
                        :key="i" 
                        class="template-tag"
                        @click="insertOpinion(tpl)"
                      >
                        {{ tpl }}
                      </a-tag>
                    </a-space>
                  </div>
                  <a-textarea 
                    v-model:value="reviewOpinion" 
                    :rows="3" 
                    placeholder="请输入审核意见..." 
                    class="opinion-input"
                  />
                </div>
                <div class="action-buttons">
                  <a-button type="primary" size="large" class="pass-btn" @click="passArticle">
                    <template #icon><CheckCircleOutlined /></template>
                    通过审核
                  </a-button>
                  <a-button type="primary" danger size="large" class="reject-btn" @click="showRejectModal = true">
                    <template #icon><CloseCircleOutlined /></template>
                    驳回
                  </a-button>
                </div>
              </div>
            </a-card>
          </div>
          <a-empty v-else description="请选择一篇文章进行审核" class="empty-detail" />
        </a-col>
      </a-row>

      <!-- 审核统计区（折叠面板） -->
      <a-collapse v-model:activeKey="statsPanelKey" class="stats-collapse">
        <a-collapse-panel key="1">
          <template #header>
            <span class="collapse-header">
              <BarChartOutlined />
              审核统计分析
            </span>
          </template>
          <a-row :gutter="16">
            <a-col :xs="24" :lg="12">
              <a-card title="驳回原因分布" :bordered="false" size="small">
                <div class="chart-body">
                  <div ref="rejectChartRef" class="chart-container"></div>
                  <div v-if="!rejectData.length" class="chart-empty-hint">暂无驳回数据</div>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </a-collapse-panel>
      </a-collapse>

      <!-- 驳回弹窗 -->
      <a-modal v-model:open="showRejectModal" title="驳回原因" @ok="rejectArticle">
        <a-form layout="vertical">
          <a-form-item label="预设原因">
            <a-select v-model:value="rejectReason" placeholder="选择预设原因" style="width: 100%">
              <a-select-option value="quality">文章质量不达标</a-select-option>
              <a-select-option value="sensitive">包含敏感内容</a-select-option>
              <a-select-option value="structure">结构逻辑混乱</a-select-option>
              <a-select-option value="relevance">主题相关性不足</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="具体说明">
            <a-textarea v-model:value="rejectDetail" placeholder="请输入具体说明" :rows="4" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 批量驳回弹窗 -->
      <a-modal v-model:open="showBatchRejectModal" title="批量驳回" :confirm-loading="batchLoading" @ok="batchReject">
        <a-alert message="提示" :description="`将批量驳回 ${selectedRows.length} 篇文章`" type="info" style="margin-bottom: 16px" />
        <a-form layout="vertical">
          <a-form-item label="驳回原因">
            <a-select v-model:value="batchRejectReason" placeholder="选择原因" style="width: 100%">
              <a-select-option value="quality">文章质量不达标</a-select-option>
              <a-select-option value="sensitive">包含敏感内容</a-select-option>
            </a-select>
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 优先级说明弹窗 -->
      <a-modal v-model:open="showPriorityGuide" title="优先级说明" :footer="null" width="500px">
        <div class="priority-guide">
          <div class="priority-item">
            <a-tag color="red">P0</a-tag>
            <span>紧急 - 需立即审核，2小时内完成</span>
          </div>
          <div class="priority-item">
            <a-tag color="orange">P1</a-tag>
            <span>高优 - 当日完成审核</span>
          </div>
          <div class="priority-item">
            <a-tag color="blue">P2</a-tag>
            <span>普通 - 2个工作日内完成</span>
          </div>
          <div class="priority-item">
            <a-tag color="green">P3</a-tag>
            <span>低优 - 3个工作日内完成</span>
          </div>
        </div>
      </a-modal>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import * as echarts from 'echarts'
import { useRouter } from 'vue-router'
import {
  ClockCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  BarChartOutlined,
  AuditOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  UserOutlined,
  CopyOutlined,
  StarOutlined,
  FlagOutlined,
  RobotOutlined,
  SafetyOutlined,
  AlertOutlined,
  BulbOutlined,
  ReadOutlined,
  MessageOutlined,
  CloseCircleOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue'
import { reviewApi } from '../../api'
import { useAuthStore } from '../../stores/auth'
import { articleStatusMeta } from '../../utils/contentStatus'

const authStore = useAuthStore()
const router = useRouter()
const loading = ref(false)
const batchLoading = ref(false)
const showRejectModal = ref(false)
const showBatchRejectModal = ref(false)
const showPriorityGuide = ref(false)
const statusFilter = ref('all')
const searchKeyword = ref('')
const reviewOpinion = ref('')
const statsPanelKey = ref<string | string[]>(['1'])

const rejectChartRef = ref<HTMLElement>()
let rejectChart: echarts.ECharts | null = null

const rejectData = ref<{ name: string; value: number }[]>([])

const opinionTemplates = [
  '内容质量优秀，审核通过',
  '格式规范，信息准确',
  '需补充更多案例数据',
  '建议优化文章结构',
  '语言表达需更加严谨',
]

/** 快速筛选项：状态取值与文案都来自 contentStatus，避免手写映射漂移 */
const statusFilterOptions = computed(() =>
  (['all', 'pending_review', 'approved', 'rejected'] as const).map(value =>
    value === 'all' ? { value, label: '全部', color: undefined as string | undefined } : { value, ...articleStatusMeta(value) }
  )
)

const stats = reactive({
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  passRate: 0,
})

const articles = ref<any[]>([])
const currentArticle = ref<any>(null)
const selectedRows = ref<any[]>([])

const rejectReason = ref('')
const rejectDetail = ref('')
const batchRejectReason = ref('')

const filteredArticles = computed(() => {
  let result = articles.value
  if (statusFilter.value !== 'all') {
    result = result.filter(a => a.status === statusFilter.value)
  }
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(a =>
      (a.title || '').toLowerCase().includes(keyword) ||
      (a.reviewer || '').toLowerCase().includes(keyword)
    )
  }
  return result
})

function getPriorityColor(priority?: number) {
  const p = priority || 0
  if (p >= 80) return 'red'
  if (p >= 60) return 'orange'
  if (p >= 40) return 'blue'
  return 'green'
}

function getScoreColor(score?: number) {
  const s = score || 0
  if (s >= 80) return '#52c41a'
  if (s >= 60) return '#faad14'
  return '#ff4d4f'
}

function formatTime(time?: string) {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

function selectArticle(article: any) {
  currentArticle.value = article
  reviewOpinion.value = ''
}

function toggleSelect(article: any) {
  const index = selectedRows.value.findIndex(r => r.id === article.id)
  if (index > -1) {
    selectedRows.value.splice(index, 1)
  } else {
    selectedRows.value.push(article)
  }
}

function highlightContent(content: string) {
  if (!currentArticle.value?.sensitiveWords) return content
  let result = content
  currentArticle.value.sensitiveWords.forEach((w: any) => {
    const regex = new RegExp(w.word, 'g')
    result = result.replace(regex, `<span class="highlight">${w.word}</span>`)
  })
  return result
}

function insertOpinion(text: string) {
  reviewOpinion.value = reviewOpinion.value ? `${reviewOpinion.value}\n${text}` : text
}

function editArticle(record: any) {
  if (!record) return
  router.push({ name: 'workspace-article-edit', params: { id: record.articleId ?? record.id } })
}

async function loadReviewStats() {
  try {
    const res = await reviewApi.getReviewStats(authStore.selectedTenantId ?? undefined) as any
    if (res) {
      if (res.rejectDistribution) {
        rejectData.value = res.rejectDistribution
        updateRejectChartData()
      }
      if (typeof res.pendingCount === 'number') {
        stats.pendingCount = res.pendingCount
      }
      if (typeof res.approvedCount === 'number') {
        stats.approvedCount = res.approvedCount
      }
      if (typeof res.rejectedCount === 'number') {
        stats.rejectedCount = res.rejectedCount
      }
      if (typeof res.approvedCount === 'number' && typeof res.rejectedCount === 'number') {
        const total = res.approvedCount + res.rejectedCount
        stats.passRate = total > 0 ? Math.round((res.approvedCount / total) * 100) : 0
      }
    }
  } catch (error) {
    message.error('审核统计数据加载失败')
    console.error(error)
  }
}

async function loadData() {
  loading.value = true
  try {
    const articlesRes = await reviewApi.pendingList({ tenantId: authStore.selectedTenantId ?? undefined }) as any
    const records = articlesRes?.records || articlesRes || []
    articles.value = records
    await loadReviewStats()
  } catch (error) {
    message.error('数据加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

/** 审核接口的路径参数是文章 ID：pendingList 返回 ReviewItem，articleId 优先于审核记录自身的 id */
function articleIdOf(row: any) {
  return row?.articleId ?? row?.id
}

async function passArticle() {
  if (!currentArticle.value) return
  try {
    await reviewApi.approve(
      articleIdOf(currentArticle.value),
      reviewOpinion.value,
      authStore.selectedTenantId ?? undefined
    )
    message.success('审核通过')
    await loadData()
    currentArticle.value = null
  } catch (error) {
    message.error('操作失败')
    console.error(error)
  }
}

async function rejectArticle() {
  if (!currentArticle.value) return
  try {
    await reviewApi.reject(
      articleIdOf(currentArticle.value),
      rejectDetail.value || rejectReason.value,
      authStore.selectedTenantId ?? undefined
    )
    message.success('已驳回')
    showRejectModal.value = false
    await loadData()
    currentArticle.value = null
  } catch (error) {
    message.error('操作失败')
    console.error(error)
  }
}

/** 批量：逐条调用审核接口，如实汇报成功/失败条数（全部失败时不报成功） */
async function batchReview(mode: 'approve' | 'reject', comment: string, label: string) {
  const rows = selectedRows.value.slice()
  if (!rows.length) return { succeeded: 0, failed: 0 }
  batchLoading.value = true
  let succeeded = 0
  let failed = 0
  for (const row of rows) {
    try {
      if (mode === 'approve') {
        await reviewApi.approve(articleIdOf(row), comment, authStore.selectedTenantId ?? undefined)
      } else {
        await reviewApi.reject(articleIdOf(row), comment, authStore.selectedTenantId ?? undefined)
      }
      succeeded++
    } catch (error) {
      failed++
      console.error(error)
    }
  }
  batchLoading.value = false
  if (succeeded && failed) {
    message.success(`已${label} ${succeeded} 篇，失败 ${failed} 篇`)
  } else if (succeeded) {
    message.success(`已${label} ${succeeded} 篇文章`)
  } else {
    message.error(`批量${label}失败，${failed} 篇均未生效`)
  }
  if (succeeded) {
    selectedRows.value = []
    await loadData()
  }
  return { succeeded, failed }
}

async function batchPass() {
  await batchReview('approve', reviewOpinion.value || '批量通过', '通过')
}

async function batchReject() {
  const { succeeded } = await batchReview('reject', batchRejectReason.value, '驳回')
  if (succeeded) showBatchRejectModal.value = false
}

const initRejectChart = () => {
  if (!rejectChartRef.value) return
  // 复用已有实例，避免重复 init 导致图表叠加
  rejectChart = echarts.getInstanceByDom(rejectChartRef.value) || echarts.init(rejectChartRef.value)
  updateRejectChartData()
}

const updateRejectChartData = () => {
  if (!rejectChart) return
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: {
        fontSize: 10
      }
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
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
            fontSize: 12,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: rejectData.value.map((item, index) => ({
          ...item,
          itemStyle: {
            color: ['#ff4d4f', '#fa8c16', '#faad14', '#fadb14', '#a0d911', '#36cfc9'][index % 6]
          }
        }))
      }
    ]
  }
  
  rejectChart.setOption(option)
}

const handleResize = () => {
  rejectChart?.resize()
}

const initCharts = () => {
  nextTick(() => {
    setTimeout(() => {
      // 容器有宽度才初始化，避免折叠面板未展开时渲染成 0 尺寸
      if (rejectChartRef.value && rejectChartRef.value.clientWidth > 0) initRejectChart()
    }, 300)
  })
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
  // 延迟初始化图表，确保DOM已渲染
  setTimeout(() => {
    if (statsPanelKey.value && (statsPanelKey.value === '1' || (Array.isArray(statsPanelKey.value) && statsPanelKey.value.includes('1')))) {
      initCharts()
    }
  }, 500)
})

watch(statsPanelKey, (val) => {
  if (val && (val === '1' || (Array.isArray(val) && val.includes('1')))) {
    initCharts()
  }
})

watch(() => authStore.selectedTenantId, () => {
  loadData()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  rejectChart?.dispose()
})
</script>

<style scoped lang="less">
.review-panel-page {
  width: 100%;
  padding: 8px 0;
}

.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 12px;

  :deep(.ant-card-body) {
    padding: 20px;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 6px;
  font-weight: 400;
}

.queue-card {
  margin-bottom: 16px;
  border-radius: 12px;

  :deep(.ant-card-body) {
    padding: 20px 24px;
  }
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.queue-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;

  .title-icon {
    font-size: 20px;
    color: #1890ff;
  }
}

.quick-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.filter-label {
  font-size: 13px;
  color: #8c8c8c;
}

.filter-tag {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    opacity: 0.8;
  }

  &.active {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transform: scale(1.05);
  }
}

.workspace-row {
  margin-bottom: 16px;
}

.list-panel {
  border-radius: 12px;
  height: calc(100vh - 340px);
  min-height: 500px;
  display: flex;
  flex-direction: column;

  :deep(.ant-card-head) {
    padding: 0 16px;
    min-height: 48px;
  }

  :deep(.ant-card-body) {
    padding: 12px;
    flex: 1;
    overflow-y: auto;
  }
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;

  :deep(.anticon) {
    color: #1890ff;
  }

  .list-count {
    margin-left: auto;
    background: #e6f7ff;
    color: #1890ff;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
  }
}

.article-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.article-card-item {
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #91d5ff;
    background: #f0f9ff;
  }

  &.active {
    border-color: #1890ff;
    background: #e6f7ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
  }
}

.card-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.card-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  line-height: 1.4;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-item-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;

  :deep(.anticon) {
    margin-right: 4px;
  }
}

.card-item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #f5f5f5;
}

.submit-time {
  font-size: 11px;
  color: #bfbfbf;

  :deep(.anticon) {
    margin-right: 4px;
  }
}

.mini-scores {
  display: flex;
  gap: 8px;
}

.mini-score {
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 3px;

  :deep(.anticon) {
    font-size: 11px;
  }
}

.empty-list {
  padding: 40px 0;
}

.detail-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-header-card,
.ai-suggestion-card,
.content-card,
.action-card {
  border-radius: 12px;

  :deep(.ant-card-head) {
    padding: 0 20px;
    min-height: 48px;
    border-bottom: 1px solid #f0f0f0;
  }

  :deep(.ant-card-body) {
    padding: 20px;
  }
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.detail-title-section {
  flex: 1;
  min-width: 0;
}

.detail-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
}

.meta-text {
  font-size: 13px;
  color: #8c8c8c;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-title-small {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;

  .title-icon {
    font-size: 18px;
    color: #1890ff;
  }
}

.score-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.score-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
  flex-shrink: 0;
}

.score-info {
  flex: 1;
  min-width: 0;
}

.score-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 4px;
}

.score-num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.sensitive-section,
.suggestions-section {
  margin-top: 16px;
}

.progress-section {
  margin-top: 16px;
}

.score-progress-item {
  margin-bottom: 10px;
}

.score-progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
  color: #595959;
}

.score-progress-value {
  font-weight: 600;
  font-size: 13px;
}

.suggestions-section {
  margin-top: 16px;
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #595959;
  margin-bottom: 10px;

  :deep(.anticon) {
    font-size: 14px;
  }
}

.sensitive-safe {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #52c41a;
  font-size: 13px;
  padding: 8px 12px;
  background: #f6ffed;
  border-radius: 6px;
}

.sensitive-words {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sensitive-tag {
  .count {
    margin-left: 4px;
    opacity: 0.8;
  }
}

.suggestion-list {
  margin: 0;
  padding-left: 20px;

  li {
    font-size: 13px;
    color: #595959;
    margin-bottom: 6px;
    line-height: 1.6;
  }
}

.article-preview {
  line-height: 1.8;
  color: #333;
  max-height: 500px;
  overflow-y: auto;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  font-size: 14px;

  :deep(.highlight) {
    background: #fff2f0;
    color: #ff4d4f;
    padding: 0 4px;
    border-radius: 3px;
    font-weight: 500;
  }
}

.action-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.opinion-section {
  flex: 1;
}

.opinion-templates {
  margin-bottom: 12px;

  .template-label {
    font-size: 13px;
    color: #8c8c8c;
    margin-right: 8px;
  }
}

.template-tag {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.05);
  }
}

.opinion-input {
  margin-top: 8px;
}

.action-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  padding-top: 8px;
}

.pass-btn,
.reject-btn {
  min-width: 160px;
  height: 52px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
  }
}

.pass-btn {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  border: none;

  &:hover {
    background: linear-gradient(135deg, #73d13d 0%, #52c41a 100%);
  }
}

.reject-btn {
  background: linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%);
  border: none;

  &:hover {
    background: linear-gradient(135deg, #ff7875 0%, #ff4d4f 100%);
  }
}

.empty-detail {
  padding: 120px 0;
}

.stats-collapse {
  border-radius: 12px;
  overflow: hidden;

  :deep(.ant-collapse-header) {
    padding: 16px 24px;
    font-size: 15px;
  }

  :deep(.ant-collapse-content-box) {
    padding: 20px 24px;
  }
}

.collapse-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;

  :deep(.anticon) {
    font-size: 18px;
    color: #1890ff;
  }
}

.chart-body {
  position: relative;
}

.chart-container {
  height: 220px;
  width: 100%;
}

.chart-empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #bfbfbf;
}

.priority-guide {
  .priority-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    background: #fafafa;
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }

    span {
      font-size: 14px;
      color: #595959;
    }
  }
}

@media (max-width: 992px) {
  .list-panel {
    height: auto;
    min-height: 300px;
    max-height: 500px;
  }

  .action-buttons {
    justify-content: stretch;

    .pass-btn,
    .reject-btn {
      flex: 1;
      min-width: auto;
      font-size: 14px;
      height: 48px;
    }
  }
}
</style>
