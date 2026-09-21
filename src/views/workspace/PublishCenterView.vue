<template>
  <div class="publish-center-page">
    <a-row :gutter="16" class="stat-row">
      <a-col :span="4">
        <a-card class="stat-card" hoverable @click="filterQueue('pending')">
          <a-statistic title="队列待发布" :value="queueStats.pending" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card class="stat-card" hoverable @click="filterQueue('publishing')">
          <a-statistic title="发布中" :value="queueStats.publishing" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card class="stat-card" hoverable @click="filterQueue('failed')">
          <a-statistic title="发布失败" :value="queueStats.failed" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card class="stat-card">
          <a-statistic title="今日队列完成" :value="queueStats.todayPublished" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card class="stat-card" hoverable @click="filterRecords('success')">
          <a-statistic title="发布记录成功" :value="recordStats.successCount" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card class="stat-card">
          <a-statistic title="成功率" :value="recordStats.successRate" suffix="%" :precision="2" />
        </a-card>
      </a-col>
    </a-row>

    <a-card :bordered="false">
      <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
        <!-- ===================== 发布候选 ===================== -->
        <a-tab-pane key="candidates" tab="发布候选">
          <a-form layout="inline" class="toolbar">
            <a-form-item>
              <a-alert
                message="仅「审核通过」的文章可发布；定时发布写入队列后由调度器每分钟扫描执行"
                type="info"
                show-icon
              />
            </a-form-item>
            <a-form-item class="toolbar-actions">
              <a-space>
                <a-button :disabled="!selectedArticleIds.length" @click="openScheduleModal(selectedArticleIds)">
                  <template #icon><ClockCircleOutlined /></template>
                  批量定时发布{{ selectedArticleIds.length ? `(${selectedArticleIds.length})` : '' }}
                </a-button>
                <a-popconfirm
                  title="确定立即发布选中的文章吗？"
                  :disabled="!selectedArticleIds.length"
                  @confirm="batchPublishNow"
                >
                  <a-button type="primary" :disabled="!selectedArticleIds.length" :loading="submitting">
                    <template #icon><SendOutlined /></template>
                    批量立即发布
                  </a-button>
                </a-popconfirm>
              </a-space>
            </a-form-item>
          </a-form>

          <a-table
            :scroll="{ x: 'max-content' }"
            row-key="id"
            :columns="candidateColumns"
            :data-source="candidates"
            :loading="candidateLoading"
            :pagination="candidatePagination"
            :row-selection="{ selectedRowKeys: selectedArticleIds, onChange: onArticleSelect }"
            @change="handleCandidateTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'">
                <a @click="viewArticle(record.id)">{{ record.title || '(无标题)' }}</a>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="articleStatusMeta(record.status).color">
                  {{ articleStatusMeta(record.status).label }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'createdAt'">
                {{ formatTime(record.createdAt) }}
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space size="small">
                  <a-popconfirm title="立即发布该文章？" @confirm="publishNow(record)">
                    <a-button type="link" size="small">立即发布</a-button>
                  </a-popconfirm>
                  <a-button type="link" size="small" @click="openScheduleModal([record.id])">定时发布</a-button>
                  <a-button type="link" size="small" @click="viewArticle(record.id)">查看</a-button>
                </a-space>
              </template>
            </template>
            <template #emptyText>
              <a-empty description="没有审核通过的文章，请先在「审核管理」通过文章" />
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ===================== 待发布队列 ===================== -->
        <a-tab-pane key="queue" tab="待发布队列">
          <a-form layout="inline" class="toolbar">
            <a-form-item label="状态">
              <a-select
                v-model:value="queueQuery.status"
                placeholder="全部状态"
                allow-clear
                style="width: 150px"
                :options="queueStatusOptions"
                @change="loadQueue"
              />
            </a-form-item>
            <a-form-item label="标题">
              <a-input
                v-model:value="queueQuery.keyword"
                placeholder="搜索文章标题"
                allow-clear
                style="width: 220px"
                @press-enter="searchQueue"
              />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button @click="searchQueue">
                  <template #icon><SearchOutlined /></template>
                  搜索
                </a-button>
                <a-button @click="resetQueueQuery">
                  <template #icon><ReloadOutlined /></template>
                  重置
                </a-button>
              </a-space>
            </a-form-item>
            <a-form-item class="toolbar-actions">
              <a-space>
                <a-button @click="refreshAll">
                  <template #icon><SyncOutlined /></template>
                  刷新
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>

          <a-table
            :scroll="{ x: 'max-content' }"
            row-key="id"
            :columns="queueColumns"
            :data-source="queueList"
            :loading="queueLoading"
            :pagination="queuePagination"
            @change="handleQueueTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'">
                <a @click="viewArticle(record.articleId)">{{ record.title || `文章 #${record.articleId}` }}</a>
              </template>
              <template v-else-if="column.key === 'platform'">
                <a-tag v-if="record.platform" color="blue">{{ record.platform }}</a-tag>
                <span v-else class="muted">未配置站点</span>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="queueStatusMeta(record.status).color">
                  {{ queueStatusMeta(record.status).label }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'priority'">
                <div class="priority-display">
                  <a-rate :value="record.priority" :count="10" disabled allow-half />
                  <span class="priority-value">{{ record.priority ?? '-' }}</span>
                </div>
              </template>
              <template v-else-if="column.key === 'scheduledTime'">
                {{ formatTime(record.scheduledTime) }}
              </template>
              <template v-else-if="column.key === 'publishTime'">
                {{ formatTime(record.publishTime) }}
              </template>
              <template v-else-if="column.key === 'errorMessage'">
                <a-tooltip v-if="record.errorMessage" :title="record.errorMessage">
                  <span class="error-text">{{ record.errorMessage }}</span>
                </a-tooltip>
                <span v-else class="muted">-</span>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space size="small">
                  <a-popconfirm
                    v-if="isQueueRetryable(record.status)"
                    title="立即执行这条队列任务？"
                    @confirm="runQueueItem(record)"
                  >
                    <a-button type="link" size="small">立即发布</a-button>
                  </a-popconfirm>
                  <a-button
                    v-if="record.status === 'pending'"
                    type="link"
                    size="small"
                    @click="openPriorityModal(record)"
                  >
                    改优先级
                  </a-button>
                  <a-popconfirm
                    v-if="record.status === 'pending' || record.status === 'publishing'"
                    title="取消后文章回到「审核通过」，可重新发布。确定取消？"
                    @confirm="cancelQueueItem(record)"
                  >
                    <a-button type="link" size="small" danger>取消</a-button>
                  </a-popconfirm>
                  <a-popconfirm
                    v-if="isQueueDeletable(record.status)"
                    title="删除这条队列记录？"
                    @confirm="removeQueueItem(record)"
                  >
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
            <template #emptyText>
              <a-empty description="队列中暂无任务" />
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ===================== 发布记录 ===================== -->
        <a-tab-pane key="records" tab="发布记录">
          <a-form layout="inline" class="toolbar">
            <a-form-item label="结果">
              <a-select
                v-model:value="recordQuery.status"
                placeholder="全部结果"
                allow-clear
                style="width: 150px"
                :options="jobStatusOptions"
                @change="loadRecords"
              />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button @click="resetRecordQuery">
                  <template #icon><ReloadOutlined /></template>
                  重置
                </a-button>
              </a-space>
            </a-form-item>
            <a-form-item class="toolbar-actions">
              <a-space>
                <a-button @click="refreshAll">
                  <template #icon><SyncOutlined /></template>
                  刷新
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>

          <a-table
            :scroll="{ x: 'max-content' }"
            row-key="id"
            :columns="recordColumns"
            :data-source="recordList"
            :loading="recordLoading"
            :pagination="recordPagination"
            @change="handleRecordTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'">
                <a @click="viewArticle(record.articleId)">{{ record.title || `文章 #${record.articleId}` }}</a>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="jobStatusMeta(record.status).color">
                  {{ jobStatusMeta(record.status).label }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'dryRun'">
                <a-tag v-if="record.dryRun">试运行</a-tag>
                <span v-else class="muted">-</span>
              </template>
              <template v-else-if="column.key === 'outputPath'">
                <span v-if="record.outputPath" class="mono">{{ record.outputPath }}</span>
                <span v-else class="muted">-</span>
              </template>
              <template v-else-if="column.key === 'errorMessage'">
                <a-tooltip v-if="record.errorMessage" :title="record.errorMessage">
                  <span class="error-text">{{ record.errorMessage }}</span>
                </a-tooltip>
                <span v-else class="muted">-</span>
              </template>
              <template v-else-if="column.key === 'createdAt'">
                {{ formatTime(record.createdAt) }}
              </template>
              <template v-else-if="column.key === 'finishedAt'">
                {{ formatTime(record.finishedAt) }}
              </template>
            </template>
            <template #emptyText>
              <a-empty description="暂无发布记录" />
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 定时发布（单条 / 批量共用） -->
    <a-modal
      v-model:open="scheduleModalVisible"
      title="定时发布"
      :confirm-loading="submitting"
      :mask-closable="false"
      ok-text="加入队列"
      @ok="confirmSchedule"
    >
      <a-form layout="vertical">
        <a-form-item :label="`将 ${scheduleArticleIds.length} 篇文章加入队列`">
          <a-date-picker
            v-model:value="scheduleForm.scheduledTime"
            show-time
            value-format="YYYY-MM-DDTHH:mm:ss"
            format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择发布时间（须晚于当前时间）"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="优先级（1-10，数值越大越先发布）">
          <a-input-number v-model:value="scheduleForm.priority" :min="1" :max="10" style="width: 160px" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 队列优先级 -->
    <a-modal
      v-model:open="priorityModalVisible"
      title="调整优先级"
      :confirm-loading="prioritySaving"
      :mask-closable="false"
      @ok="confirmPriority"
    >
      <div v-if="currentQueueRecord" class="priority-modal">
        <div class="priority-modal-title">{{ currentQueueRecord.title }}</div>
        <a-slider v-model:value="priorityValue" :min="1" :max="10" :marks="priorityMarks" />
        <div class="priority-modal-input">
          <span>直接输入：</span>
          <a-input-number v-model:value="priorityValue" :min="1" :max="10" style="width: 120px" />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  ClockCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { articleApi, publishApi, publishQueueApi } from '../../api/workspace'
import type { PublishRecord, PublishTask } from '../../types/workspace'
import { articleStatusMeta, jobStatusMeta, queueStatusMeta } from '../../utils/contentStatus'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'candidates' | 'queue' | 'records'>('candidates')
const submitting = ref(false)

const queueStats = reactive({ pending: 0, publishing: 0, todayPublished: 0, failed: 0 })
const recordStats = reactive({ total: 0, successCount: 0, failedCount: 0, cancelledCount: 0, todayCount: 0, successRate: 0 })

// ---------------- 发布候选 ----------------
const candidateLoading = ref(false)
const candidates = ref<any[]>([])
const selectedArticleIds = ref<number[]>([])
const candidateQuery = reactive({ page: 1, size: 10 })
const candidateTotal = ref(0)

const candidateColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 90 },
  { title: '文章标题', key: 'title', ellipsis: true },
  { title: '状态', key: 'status', width: 110 },
  { title: '字数', dataIndex: 'wordCount', key: 'wordCount', width: 90 },
  { title: 'AI 模型', dataIndex: 'aiModel', key: 'aiModel', width: 160 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', width: 220, fixed: 'right' as const },
]

const candidatePagination = computed(() => ({
  current: candidateQuery.page,
  pageSize: candidateQuery.size,
  total: candidateTotal.value,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
}))

function onArticleSelect(keys: (string | number)[]) {
  selectedArticleIds.value = keys.map(Number)
}

function handleCandidateTableChange(pag: any) {
  candidateQuery.page = pag.current
  candidateQuery.size = pag.pageSize
  loadCandidates()
}

async function loadCandidates() {
  candidateLoading.value = true
  try {
    const res = await articleApi.list({
      status: 'approved',
      page: candidateQuery.page,
      size: candidateQuery.size,
      tenantId: authStore.selectedTenantId ?? undefined,
    }) as any
    candidates.value = res?.records || []
    candidateTotal.value = res?.total || 0
  } catch (error: any) {
    candidates.value = []
    candidateTotal.value = 0
    message.error(error?.message || '加载发布候选失败')
  } finally {
    candidateLoading.value = false
  }
}

async function publishNow(article: any) {
  try {
    await publishApi.publish(article.id, {}, authStore.selectedTenantId ?? undefined)
    message.success(`「${article.title || article.id}」已发布`)
    refreshAll()
  } catch (error: any) {
    message.error(error?.message || '发布失败')
  }
}

async function batchPublishNow() {
  if (!selectedArticleIds.value.length) return
  submitting.value = true
  try {
    const result = await articleApi.batchPublish(
      selectedArticleIds.value,
      undefined,
      authStore.selectedTenantId ?? undefined
    )
    reportBatchResult(result, '发布')
    selectedArticleIds.value = []
    refreshAll()
  } catch (error: any) {
    message.error(error?.message || '批量发布失败')
  } finally {
    submitting.value = false
  }
}

// ---------------- 定时发布 ----------------
const scheduleModalVisible = ref(false)
const scheduleArticleIds = ref<number[]>([])
const scheduleForm = reactive<{ scheduledTime: string | null; priority: number }>({ scheduledTime: null, priority: 5 })

function openScheduleModal(articleIds: number[]) {
  if (!articleIds.length) {
    message.warning('请先选择文章')
    return
  }
  scheduleArticleIds.value = [...articleIds]
  scheduleForm.scheduledTime = null
  scheduleForm.priority = 5
  scheduleModalVisible.value = true
}

async function confirmSchedule() {
  if (!scheduleForm.scheduledTime) {
    message.warning('请选择发布时间')
    return
  }
  submitting.value = true
  try {
    const options = { scheduledTime: scheduleForm.scheduledTime, priority: scheduleForm.priority }
    if (scheduleArticleIds.value.length === 1) {
      const result = await publishApi.publish(scheduleArticleIds.value[0], options, authStore.selectedTenantId ?? undefined)
      if (result?.queueId) {
        message.success(`已加入队列，计划 ${formatTime(result.scheduledAt)} 发布`)
      } else {
        message.success('所选时间已过期，文章已立即发布')
      }
    } else {
      const result = await articleApi.batchPublish(scheduleArticleIds.value, options, authStore.selectedTenantId ?? undefined)
      reportBatchResult(result, '入队')
    }
    scheduleModalVisible.value = false
    selectedArticleIds.value = []
    refreshAll()
  } catch (error: any) {
    message.error(error?.message || '定时发布设置失败')
  } finally {
    submitting.value = false
  }
}

function reportBatchResult(result: any, verb: string) {
  const scheduled = result?.scheduled ?? 0
  const published = result?.published ?? 0
  const failed = result?.failed ?? 0
  const firstError = result?.errors?.[0]?.message
  const summary = `成功 ${published + scheduled} 篇${failed ? `，失败 ${failed} 篇` : ''}`
  if (failed && !published && !scheduled) {
    message.error(`${summary}${firstError ? `：${firstError}` : ''}`)
  } else if (failed) {
    message.warning(`${summary}${firstError ? `，首个失败原因：${firstError}` : ''}`)
  } else {
    message.success(`${verb}完成，${summary}`)
  }
}

// ---------------- 待发布队列 ----------------
const queueLoading = ref(false)
const queueList = ref<PublishTask[]>([])
const queueQuery = reactive<{ status?: string; keyword: string; page: number; size: number }>({
  status: undefined,
  keyword: '',
  page: 1,
  size: 10,
})
const queueTotal = ref(0)

const queueStatusOptions = [
  { value: 'pending', label: '待发布' },
  { value: 'publishing', label: '发布中' },
  { value: 'success', label: '发布成功' },
  { value: 'failed', label: '发布失败' },
  { value: 'validation_failed', label: '校验未通过' },
  { value: 'cancelled', label: '已取消' },
]

const queueColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '文章标题', key: 'title', ellipsis: true },
  { title: '发布站点', key: 'platform', width: 140 },
  { title: '状态', key: 'status', width: 110 },
  { title: '优先级', key: 'priority', width: 200 },
  { title: '计划发布时间', key: 'scheduledTime', width: 180 },
  { title: '实际发布时间', key: 'publishTime', width: 180 },
  { title: '失败原因', key: 'errorMessage', width: 180 },
  { title: '操作', key: 'actions', width: 220, fixed: 'right' as const },
]

const queuePagination = computed(() => ({
  current: queueQuery.page,
  pageSize: queueQuery.size,
  total: queueTotal.value,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
}))

function isQueueRetryable(status?: string) {
  return status === 'pending' || status === 'failed' || status === 'validation_failed'
}

function isQueueDeletable(status?: string) {
  return status === 'cancelled' || status === 'validation_failed' || status === 'success'
}

function searchQueue() {
  queueQuery.page = 1
  loadQueue()
}

function resetQueueQuery() {
  queueQuery.status = undefined
  queueQuery.keyword = ''
  queueQuery.page = 1
  loadQueue()
}

function handleQueueTableChange(pag: any) {
  queueQuery.page = pag.current
  queueQuery.size = pag.pageSize
  loadQueue()
}

async function loadQueue() {
  queueLoading.value = true
  try {
    const res = await publishQueueApi.list({
      status: queueQuery.status,
      keyword: queueQuery.keyword || undefined,
      page: queueQuery.page,
      size: queueQuery.size,
      tenantId: authStore.selectedTenantId ?? undefined,
    }) as any
    queueList.value = res?.records || []
    queueTotal.value = res?.total || 0
  } catch (error: any) {
    queueList.value = []
    queueTotal.value = 0
    message.error(error?.message || '加载发布队列失败')
  } finally {
    queueLoading.value = false
  }
}

async function runQueueItem(record: PublishTask) {
  try {
    const result = await publishQueueApi.publishNow(record.id, authStore.selectedTenantId ?? undefined)
    if (result?.status === 'success') {
      message.success(`已发布，完成时间 ${formatTime(result.publishTime)}`)
    } else {
      message.error(`发布未成功（${queueStatusMeta(result?.status).label}）：${result?.errorMessage || '见队列失败原因'}`)
    }
    refreshAll()
  } catch (error: any) {
    message.error(error?.message || '触发发布失败')
  }
}

async function cancelQueueItem(record: PublishTask) {
  try {
    await publishQueueApi.cancel(record.id, authStore.selectedTenantId ?? undefined)
    message.success('已取消发布，文章回到审核通过状态')
    refreshAll()
  } catch (error: any) {
    message.error(error?.message || '取消失败')
  }
}

async function removeQueueItem(record: PublishTask) {
  try {
    await publishQueueApi.remove(record.id, authStore.selectedTenantId ?? undefined)
    message.success('队列记录已删除')
    refreshAll()
  } catch (error: any) {
    message.error(error?.message || '删除失败')
  }
}

const priorityModalVisible = ref(false)
const prioritySaving = ref(false)
const priorityValue = ref(5)
const currentQueueRecord = ref<PublishTask | null>(null)

const priorityMarks = { 1: '低', 5: '中', 10: '高' }

function openPriorityModal(record: PublishTask) {
  currentQueueRecord.value = record
  priorityValue.value = record.priority ?? 5
  priorityModalVisible.value = true
}

async function confirmPriority() {
  if (!currentQueueRecord.value) return
  prioritySaving.value = true
  try {
    await publishQueueApi.adjustPriority(currentQueueRecord.value.id, priorityValue.value, authStore.selectedTenantId ?? undefined)
    message.success('优先级已调整')
    priorityModalVisible.value = false
    loadQueue()
  } catch (error: any) {
    message.error(error?.message || '调整优先级失败')
  } finally {
    prioritySaving.value = false
  }
}

// ---------------- 发布记录 ----------------
const recordLoading = ref(false)
const recordList = ref<PublishRecord[]>([])
const recordQuery = reactive<{ status?: string; page: number; size: number }>({ status: undefined, page: 1, size: 10 })
const recordTotal = ref(0)

const jobStatusOptions = [
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
  { value: 'pending', label: '待执行' },
]

const recordColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '文章标题', key: 'title', ellipsis: true },
  { title: '结果', key: 'status', width: 100 },
  { title: '模式', key: 'dryRun', width: 90 },
  { title: '输出路径', key: 'outputPath', width: 240 },
  { title: '失败原因', key: 'errorMessage', width: 180 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '完成时间', key: 'finishedAt', width: 180 },
]

const recordPagination = computed(() => ({
  current: recordQuery.page,
  pageSize: recordQuery.size,
  total: recordTotal.value,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
}))

function resetRecordQuery() {
  recordQuery.status = undefined
  recordQuery.page = 1
  loadRecords()
}

function handleRecordTableChange(pag: any) {
  recordQuery.page = pag.current
  recordQuery.size = pag.pageSize
  loadRecords()
}

async function loadRecords() {
  recordLoading.value = true
  try {
    const res = await publishApi.records({
      status: recordQuery.status,
      page: recordQuery.page,
      size: recordQuery.size,
      tenantId: authStore.selectedTenantId ?? undefined,
    }) as any
    recordList.value = res?.records || []
    recordTotal.value = res?.total || 0
  } catch (error: any) {
    recordList.value = []
    recordTotal.value = 0
    message.error(error?.message || '加载发布记录失败')
  } finally {
    recordLoading.value = false
  }
}

// ---------------- 统计 ----------------
async function loadStats() {
  const tenantId = authStore.selectedTenantId ?? undefined
  try {
    const data = await publishQueueApi.getStats(tenantId) as any
    if (data) {
      queueStats.pending = data.pending ?? 0
      queueStats.publishing = data.publishing ?? 0
      queueStats.todayPublished = data.todayPublished ?? 0
      queueStats.failed = data.failed ?? 0
    }
  } catch (error: any) {
    message.error(error?.message || '加载队列统计失败')
  }
  try {
    const data = await publishApi.recordStats({ tenantId }) as any
    if (data) {
      recordStats.total = data.total ?? 0
      recordStats.successCount = data.successCount ?? 0
      recordStats.failedCount = data.failedCount ?? 0
      recordStats.cancelledCount = data.cancelledCount ?? 0
      recordStats.todayCount = data.todayCount ?? 0
      recordStats.successRate = data.successRate ?? 0
    }
  } catch (error: any) {
    message.error(error?.message || '加载发布记录统计失败')
  }
}

// ---------------- 公共 ----------------
function filterQueue(status: string) {
  activeTab.value = 'queue'
  queueQuery.status = status
  queueQuery.page = 1
  loadQueue()
}

function filterRecords(status: string) {
  activeTab.value = 'records'
  recordQuery.status = status
  recordQuery.page = 1
  loadRecords()
}

function handleTabChange(key: string | number) {
  selectedArticleIds.value = []
  if (key === 'candidates') loadCandidates()
  else if (key === 'queue') loadQueue()
  else loadRecords()
  loadStats()
}

function viewArticle(id: number) {
  if (!id) return
  router.push({ name: 'workspace-article-detail', params: { id } })
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

function refreshAll() {
  loadStats()
  if (activeTab.value === 'candidates') loadCandidates()
  else if (activeTab.value === 'queue') loadQueue()
  else loadRecords()
}

onMounted(() => {
  loadStats()
  loadCandidates()
  loadQueue()
  loadRecords()
})
</script>

<style scoped lang="less">
.publish-center-page {
  width: 100%;
}

.stat-row {
  margin-bottom: 16px;

  .stat-card {
    cursor: pointer;

    :deep(.ant-statistic-title) {
      font-size: 13px;
    }
  }
}

.toolbar {
  width: 100%;
  margin-bottom: 12px;
}

.priority-display {
  display: flex;
  align-items: center;
  gap: 8px;

  .priority-value {
    font-size: 13px;
    color: #666;
  }
}

.priority-modal {
  .priority-modal-title {
    margin-bottom: 8px;
    font-weight: 500;
  }

  .priority-modal-input {
    margin-top: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.error-text {
  display: inline-block;
  max-width: 160px;
  color: #f5222d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.muted {
  color: #999;
}

.mono {
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
}
</style>
