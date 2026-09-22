<template>
  <div class="case-list-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ formatNumber(stats.total) }}</div>
                <div class="stat-title">案例总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ formatNumber(stats.published) }}</div>
                <div class="stat-title">已发布</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #eb2f96 0%, #ff85c0 100%)">
                <EditOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ formatNumber(stats.draft) }}</div>
                <div class="stat-title">草稿</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%)">
                <ClockCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ formatNumber(stats.pendingReview) }}</div>
                <div class="stat-title">待审核</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <a-space wrap>
            <a-select
              v-model:value="queryParams.categoryId"
              style="width: 150px"
              placeholder="选择分类"
              allowClear
              @change="loadCases"
            >
              <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.status"
              style="width: 120px"
              placeholder="状态"
              allowClear
              @change="loadCases"
            >
              <a-select-option :value="CaseStatus.DRAFT">草稿</a-select-option>
              <a-select-option :value="CaseStatus.PUBLISHED">已发布</a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.type"
              style="width: 140px"
              placeholder="案例类型"
              allowClear
              @change="loadCases"
            >
              <a-select-option :value="CaseType.CUSTOMER_SUCCESS">客户成功</a-select-option>
              <a-select-option :value="CaseType.TECHNICAL_IMPLEMENTATION">技术实施</a-select-option>
              <a-select-option :value="CaseType.BEST_PRACTICE">最佳实践</a-select-option>
              <a-select-option :value="CaseType.INDUSTRY_SOLUTION">行业方案</a-select-option>
              <a-select-option :value="CaseType.PRODUCT_DEMO">产品演示</a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.priority"
              style="width: 100px"
              placeholder="优先级"
              allowClear
              @change="loadCases"
            >
              <a-select-option :value="CasePriority.LOW">低</a-select-option>
              <a-select-option :value="CasePriority.MEDIUM">中</a-select-option>
              <a-select-option :value="CasePriority.HIGH">高</a-select-option>
              <a-select-option :value="CasePriority.URGENT">紧急</a-select-option>
            </a-select>
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索案例名称/客户名称"
              style="width: 280px"
              enter-button
              @search="loadCases"
            />
            <a-button type="primary" @click="handleAdd">
              <template #icon><PlusOutlined /></template>
              新建案例
            </a-button>
          </a-space>
        </template>

        <template #extra>
          <a-space>
            <a-button @click="handleBatchDelete" :disabled="selectedRowKeys.length === 0" danger>
              <template #icon><DeleteOutlined /></template>
              批量删除
            </a-button>
          </a-space>
        </template>

        <a-table
          :scroll="{ x: 'max-content' }"
          :columns="columns"
          :data-source="caseList"
          :pagination="pagination"
          :row-selection="rowSelection"
          :row-key="(record: any) => record.id"
          :loading="tableLoading"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <div class="case-title-cell">
                <img v-if="record.coverImage" :src="record.coverImage" class="case-cover" />
                <div class="case-cover-placeholder" v-else>
                  <FileTextOutlined />
                </div>
                <div class="case-info">
                  <div class="case-title">{{ record.title }}</div>
                  <div class="case-customer">{{ record.customerName || '-' }}</div>
                </div>
              </div>
            </template>
            <template v-if="column.key === 'type'">
              <a-tag :color="getTypeColor(record.type)">
                {{ getTypeName(record.type) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'priority'">
              <a-tag :color="getPriorityColor(record.priority)">
                {{ getPriorityName(record.priority) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-space direction="vertical" size="2">
                <a-tag :color="getStatusColor(record.status)">
                  {{ getStatusName(record.status) }}
                </a-tag>
                <a-tag v-if="record.reviewStatus" :color="getReviewStatusColor(record.reviewStatus)">
                  {{ getReviewStatusName(record.reviewStatus) }}
                </a-tag>
              </a-space>
            </template>
            <template v-if="column.key === 'stats'">
              <div class="stats-cell">
                <div><EyeOutlined /> {{ formatNumber(record.viewCount) }}</div>
                <div><LikeOutlined /> {{ formatNumber(record.likeCount) }}</div>
              </div>
            </template>
            <template v-if="column.key === 'updatedAt'">
              {{ formatDateTime(record.updatedAt) }}
            </template>
            <template v-if="column.key === 'tags'">
              <a-space size="small" wrap>
                <a-tag v-for="tag in record.tagList?.slice(0, 2)" :key="tag" color="blue" size="small">
                  {{ tag }}
                </a-tag>
                <a-tag v-if="record.tagList && record.tagList.length > 2" size="small">
                  +{{ record.tagList.length - 2 }}
                </a-tag>
              </a-space>
            </template>
            <template v-if="column.key === 'author'">
              <div class="author-cell">
                <a-avatar :size="24" style="background:#1890ff">
                  {{ record.authorName?.charAt(0) || 'U' }}
                </a-avatar>
                <span>{{ record.authorName }}</span>
              </div>
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-dropdown :trigger="['click']">
                  <a-button type="link" size="small">
                    操作 <DownOutlined />
                  </a-button>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item @click="handleView(record)">
                        <EyeOutlined /> 查看
                      </a-menu-item>
                      <a-menu-item @click="handleEdit(record)">
                        <EditOutlined /> 编辑
                      </a-menu-item>
                      <a-menu-item v-if="record.status === CaseStatus.PUBLISHED" @click="handleUnpublish(record)">
                        <StopOutlined /> 下架
                      </a-menu-item>
                      <a-menu-item v-if="record.status !== CaseStatus.PUBLISHED" @click="handlePublish(record)">
                        <CheckOutlined /> 发布
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item @click="handleCopy(record)">
                        <CopyOutlined /> 复制
                      </a-menu-item>
                      <a-menu-item danger @click="handleDelete(record)">
                        <DeleteOutlined /> 删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <CaseDetailDrawer
      v-model:open="drawerVisible"
      :case-id="currentCaseId"
      @success="reload"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  LikeOutlined,
  PlusOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  StopOutlined,
  CheckOutlined,
  CopyOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons-vue'
import { CaseStatus, CasePriority, CaseType } from '../../types/case'
import type { Case, CaseCategory, CaseForm } from '../../types/case'
import CaseDetailDrawer from './CaseDetailDrawer.vue'
import { caseApi, caseCategoryApi } from '../../api/case'
import { describeHttpError } from '../../api/http'
import { formatDateTime, formatNumber } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const drawerVisible = ref(false)
const currentCaseId = ref<number | null>(null)
const selectedRowKeys = ref<number[]>([])

const stats = reactive({
  total: null as number | null,
  published: null as number | null,
  draft: null as number | null,
  pendingReview: null as number | null,
})

const queryParams = reactive({
  categoryId: undefined as number | undefined,
  status: undefined as CaseStatus | undefined,
  type: undefined as CaseType | undefined,
  priority: undefined as CasePriority | undefined,
  keyword: '',
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (page: number, pageSize: number) => {
    pagination.current = page
    pagination.pageSize = pageSize
    loadCases()
  },
})

const categories = ref<CaseCategory[]>([])

const caseList = ref<Case[]>([])

const columns = [
  { title: '案例信息', key: 'title', width: 280 },
  { title: '类型', key: 'type', width: 120 },
  { title: '优先级', key: 'priority', width: 100 },
  { title: '状态', key: 'status', width: 120 },
  { title: '统计', key: 'stats', width: 120 },
  { title: '标签', key: 'tags', width: 180 },
  { title: '作者', key: 'author', width: 120 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 100 },
]

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: number[]) => {
    selectedRowKeys.value = keys
  },
}))

function getTypeName(type: CaseType): string {
  const nameMap: Record<CaseType, string> = {
    [CaseType.CUSTOMER_SUCCESS]: '客户成功',
    [CaseType.TECHNICAL_IMPLEMENTATION]: '技术实施',
    [CaseType.BEST_PRACTICE]: '最佳实践',
    [CaseType.INDUSTRY_SOLUTION]: '行业方案',
    [CaseType.PRODUCT_DEMO]: '产品演示',
  }
  return nameMap[type] || type
}

function getTypeColor(type: CaseType): string {
  const colorMap: Record<CaseType, string> = {
    [CaseType.CUSTOMER_SUCCESS]: 'blue',
    [CaseType.TECHNICAL_IMPLEMENTATION]: 'purple',
    [CaseType.BEST_PRACTICE]: 'green',
    [CaseType.INDUSTRY_SOLUTION]: 'cyan',
    [CaseType.PRODUCT_DEMO]: 'orange',
  }
  return colorMap[type] || 'default'
}

function getPriorityName(priority: CasePriority): string {
  const nameMap: Record<CasePriority, string> = {
    [CasePriority.LOW]: '低',
    [CasePriority.MEDIUM]: '中',
    [CasePriority.HIGH]: '高',
    [CasePriority.URGENT]: '紧急',
  }
  return nameMap[priority] || priority
}

function getPriorityColor(priority: CasePriority): string {
  const colorMap: Record<CasePriority, string> = {
    [CasePriority.LOW]: 'default',
    [CasePriority.MEDIUM]: 'blue',
    [CasePriority.HIGH]: 'orange',
    [CasePriority.URGENT]: 'red',
  }
  return colorMap[priority] || 'default'
}

function getStatusName(status: CaseStatus): string {
  const nameMap: Record<CaseStatus, string> = {
    [CaseStatus.DRAFT]: '草稿',
    [CaseStatus.PUBLISHED]: '已发布',
  }
  return nameMap[status] || status
}

function getStatusColor(status: CaseStatus): string {
  const colorMap: Record<CaseStatus, string> = {
    [CaseStatus.DRAFT]: 'default',
    [CaseStatus.PUBLISHED]: 'green',
  }
  return colorMap[status] || 'default'
}

// reviewStatus 由后端原样大写返回：PENDING / APPROVED / REJECTED
function getReviewStatusName(reviewStatus: string): string {
  const nameMap: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '审核通过',
    REJECTED: '审核拒绝',
  }
  return nameMap[reviewStatus] || reviewStatus
}

function getReviewStatusColor(reviewStatus: string): string {
  const colorMap: Record<string, string> = {
    PENDING: 'orange',
    APPROVED: 'green',
    REJECTED: 'red',
  }
  return colorMap[reviewStatus] || 'default'
}

async function loadStats() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  try {
    const res = await caseApi.statistics(tenantId)
    stats.total = res.total
    stats.published = res.published
    stats.draft = res.draft
    stats.pendingReview = res.pendingReview
  } catch (error) {
    console.error('Failed to load case statistics:', error)
    stats.total = null
    stats.published = null
    stats.draft = null
    stats.pendingReview = null
  }
}

async function loadCategories() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  try {
    const res = await caseCategoryApi.list({ tenantId, status: 'ACTIVE' })
    categories.value = res || []
  } catch (error) {
    console.error('Failed to load case categories:', error)
    categories.value = []
  }
}

async function loadCases() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  tableLoading.value = true
  try {
    const params: any = {
      tenantId,
      page: pagination.current,
      size: pagination.pageSize,
    }
    if (queryParams.categoryId) params.categoryId = queryParams.categoryId
    if (queryParams.status) params.status = queryParams.status
    if (queryParams.type) params.type = queryParams.type
    if (queryParams.priority) params.priority = queryParams.priority
    if (queryParams.keyword) params.keyword = queryParams.keyword

    const res = await caseApi.list(params)
    caseList.value = res.records || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('Failed to load cases:', error)
    message.error(`加载案例列表失败：${describeHttpError(error)}`)
    caseList.value = []
  } finally {
    tableLoading.value = false
  }
}

async function reload() {
  await Promise.all([loadCases(), loadStats()])
}

function handleAdd() {
  currentCaseId.value = null
  drawerVisible.value = true
}

function handleView(record: Case) {
  currentCaseId.value = record.id
  drawerVisible.value = true
}

function handleEdit(record: Case) {
  currentCaseId.value = record.id
  drawerVisible.value = true
}

async function handlePublish(record: Case) {
  try {
    await caseApi.publish(record.id)
    message.success(`已发布：${record.title}`)
    await reload()
  } catch (error) {
    message.error(`发布失败：${describeHttpError(error)}`)
  }
}

async function handleUnpublish(record: Case) {
  try {
    await caseApi.unpublish(record.id)
    message.success(`已下架：${record.title}`)
    await reload()
  } catch (error) {
    message.error(`下架失败：${describeHttpError(error)}`)
  }
}

async function handleCopy(record: Case) {
  try {
    const detail = await caseApi.get(record.id)
    const payload: CaseForm = {
      tenantId: detail.tenantId,
      siteId: detail.siteId,
      categoryId: detail.categoryId,
      title: `${detail.title}（副本）`,
      subtitle: detail.subtitle,
      summary: detail.summary,
      content: detail.content,
      customerName: detail.customerName,
      customerIndustry: detail.customerIndustry,
      customerScale: detail.customerScale,
      type: detail.type,
      priority: detail.priority,
      tags: detail.tags,
      coverImage: detail.coverImage,
      bannerImage: detail.bannerImage,
      caseDate: detail.caseDate,
      projectDuration: detail.projectDuration,
      projectBudget: detail.projectBudget,
      difficultyLevel: detail.difficultyLevel,
      sortOrder: detail.sortOrder,
      status: CaseStatus.DRAFT,
      isPublished: false,
      seoTitle: detail.seoTitle,
      seoKeywords: detail.seoKeywords,
      seoDescription: detail.seoDescription,
      seoUrl: detail.seoUrl,
      templateType: detail.templateType,
    }
    await caseApi.create(payload)
    message.success('复制成功')
    await reload()
  } catch (error) {
    message.error(`复制失败：${describeHttpError(error)}`)
  }
}

function handleDelete(record: Case) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除案例“${record.title}”吗？`,
    onOk: async () => {
      try {
        await caseApi.delete(record.id)
        message.success('删除成功')
        await reload()
      } catch (error) {
        message.error(`删除失败：${describeHttpError(error)}`)
      }
    },
  })
}

function handleBatchDelete() {
  const ids = [...selectedRowKeys.value]
  if (ids.length === 0) {
    message.warning('请选择要删除的案例')
    return
  }
  Modal.confirm({
    title: '确认批量删除',
    content: `确定要删除选中的 ${ids.length} 个案例吗？`,
    onOk: async () => {
      try {
        const res = await caseApi.batchDelete(ids)
        message.success(`已删除 ${res?.deleted ?? ids.length} 个案例`)
        selectedRowKeys.value = []
      } catch (error) {
        message.error(`批量删除失败：${describeHttpError(error)}`)
      } finally {
        await reload()
      }
    },
  })
}

watch(
  () => authStore.selectedTenantId,
  () => {
    pagination.current = 1
    loadCategories()
    reload()
  }
)

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([loadCategories(), reload()])
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="less">
.case-list-page {
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

.case-title-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.case-cover {
  width: 64px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid #e8e8e8;
}

.case-cover-placeholder {
  width: 64px;
  height: 48px;
  border-radius: 6px;
  background: linear-gradient(135deg, #f0f5ff 0%, #d6e4ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #1890ff;
}

.case-info {
  flex: 1;
  min-width: 0;
}

.case-title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-customer {
  font-size: 12px;
  color: #8c8c8c;
}

.stats-cell {
  font-size: 12px;
  color: #595959;

  div {
    margin-bottom: 2px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.author-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
</style>
