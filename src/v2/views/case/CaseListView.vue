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
                <div class="stat-value">{{ stats.totalCases }}</div>
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
                <div class="stat-value">{{ stats.publishedCases }}</div>
                <div class="stat-title">已发布</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #eb2f96 0%, #ff85c0 100%)">
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ formatNumber(stats.totalViews) }}</div>
                <div class="stat-title">总浏览量</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%)">
                <LikeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ formatNumber(stats.totalLikes) }}</div>
                <div class="stat-title">总点赞</div>
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
              <a-select-option :value="CaseStatus.REVIEWING">审核中</a-select-option>
              <a-select-option :value="CaseStatus.APPROVED">已通过</a-select-option>
              <a-select-option :value="CaseStatus.PUBLISHED">已发布</a-select-option>
              <a-select-option :value="CaseStatus.ARCHIVED">已归档</a-select-option>
              <a-select-option :value="CaseStatus.REJECTED">已拒绝</a-select-option>
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
            <a-button @click="exportData">
              <template #icon><DownloadOutlined /></template>
              导出
            </a-button>
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="caseList"
          :pagination="pagination"
          :row-selection="rowSelection"
          :row-key="record => record.id"
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
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusName(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'stats'">
              <div class="stats-cell">
                <div><EyeOutlined /> {{ record.viewCount }}</div>
                <div><LikeOutlined /> {{ record.likeCount }}</div>
              </div>
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
                      <a-menu-item v-if="record.status === CaseStatus.DRAFT" @click="handleSubmitReview(record)">
                        <UploadOutlined /> 提交审核
                      </a-menu-item>
                      <a-menu-item v-if="record.status === CaseStatus.PUBLISHED" @click="handleUnpublish(record)">
                        <StopOutlined /> 下架
                      </a-menu-item>
                      <a-menu-item v-if="record.status !== CaseStatus.PUBLISHED && record.status !== CaseStatus.ARCHIVED" @click="handlePublish(record)">
                        <CheckOutlined /> 发布
                      </a-menu-item>
                      <a-menu-item v-if="record.status !== CaseStatus.ARCHIVED" @click="handleArchive(record)">
                        <InboxOutlined /> 归档
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
      @success="loadCases"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  LikeOutlined,
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EditOutlined,
  UploadOutlined,
  StopOutlined,
  CheckOutlined,
  InboxOutlined,
  CopyOutlined,
} from '@ant-design/icons-vue'
import { CaseStatus, CasePriority, CaseType } from '../../types/case'
import type { Case, CaseCategory } from '../../types/case'
import CaseDetailDrawer from './CaseDetailDrawer.vue'
import { caseApi } from '../../api/case'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const drawerVisible = ref(false)
const currentCaseId = ref<number | null>(null)
const selectedRowKeys = ref<number[]>([])

const stats = reactive({
  totalCases: 0,
  publishedCases: 0,
  totalViews: 0,
  totalLikes: 0,
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
  { title: '状态', key: 'status', width: 100 },
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

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toString()
}

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
    [CaseStatus.REVIEWING]: '审核中',
    [CaseStatus.APPROVED]: '已通过',
    [CaseStatus.PUBLISHED]: '已发布',
    [CaseStatus.ARCHIVED]: '已归档',
    [CaseStatus.REJECTED]: '已拒绝',
  }
  return nameMap[status] || status
}

function getStatusColor(status: CaseStatus): string {
  const colorMap: Record<CaseStatus, string> = {
    [CaseStatus.DRAFT]: 'default',
    [CaseStatus.REVIEWING]: 'processing',
    [CaseStatus.APPROVED]: 'success',
    [CaseStatus.PUBLISHED]: 'green',
    [CaseStatus.ARCHIVED]: 'default',
    [CaseStatus.REJECTED]: 'red',
  }
  return colorMap[status] || 'default'
}

function updateStats(records: Case[] = caseList.value) {
  stats.totalCases = pagination.total
  stats.publishedCases = records.filter(c => c.status === CaseStatus.PUBLISHED).length
  stats.totalViews = records.reduce((sum, c) => sum + (c.viewCount || 0), 0)
  stats.totalLikes = records.reduce((sum, c) => sum + (c.likeCount || 0), 0)
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
    if (queryParams.keyword) params.keyword = queryParams.keyword

    const res = await caseApi.list(params)
    caseList.value = res.records || []
    pagination.total = res.total || 0
    updateStats(res.records || [])
  } catch (error) {
    console.error('Failed to load cases:', error)
    message.error('加载案例列表失败')
    caseList.value = []
  } finally {
    tableLoading.value = false
  }
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

function handleSubmitReview(record: Case) {
  message.success(`已提交审核：${record.title}`)
}

function handlePublish(record: Case) {
  const item = caseList.value.find(c => c.id === record.id)
  if (item) {
    item.status = CaseStatus.PUBLISHED
    stats.publishedCases += 1
    message.success(`已发布：${record.title}`)
  }
}

function handleUnpublish(record: Case) {
  const item = caseList.value.find(c => c.id === record.id)
  if (item) {
    item.status = CaseStatus.DRAFT
    stats.publishedCases -= 1
    message.success(`已下架：${record.title}`)
  }
}

function handleArchive(record: Case) {
  const item = caseList.value.find(c => c.id === record.id)
  if (item) {
    item.status = CaseStatus.ARCHIVED
    if (item.status === CaseStatus.PUBLISHED) {
      stats.publishedCases -= 1
    }
    message.success(`已归档：${record.title}`)
  }
}

function handleCopy(record: Case) {
  const newCase: Case = {
    ...record,
    id: Date.now(),
    title: `${record.title} (副本)`,
    status: CaseStatus.DRAFT,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  caseList.value.unshift(newCase)
  pagination.total += 1
  stats.totalCases += 1
  message.success('复制成功')
}

function handleDelete(record: Case) {
  const index = caseList.value.findIndex(c => c.id === record.id)
  if (index > -1) {
    const item = caseList.value[index]
    stats.totalCases -= 1
    stats.totalViews -= item.viewCount
    stats.totalLikes -= item.likeCount
    if (item.status === CaseStatus.PUBLISHED) {
      stats.publishedCases -= 1
    }
    caseList.value.splice(index, 1)
    pagination.total -= 1
    message.success('删除成功')
  }
}

function handleBatchDelete() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请选择要删除的案例')
    return
  }
  selectedRowKeys.value.forEach(id => {
    const index = caseList.value.findIndex(c => c.id === id)
    if (index > -1) {
      const item = caseList.value[index]
      stats.totalViews -= item.viewCount
      stats.totalLikes -= item.likeCount
      if (item.status === CaseStatus.PUBLISHED) {
        stats.publishedCases -= 1
      }
      caseList.value.splice(index, 1)
    }
  })
  stats.totalCases -= selectedRowKeys.value.length
  pagination.total -= selectedRowKeys.value.length
  message.success(`已删除 ${selectedRowKeys.value.length} 个案例`)
  selectedRowKeys.value = []
}

function exportData() {
  message.info('导出功能')
}

watch(
  () => authStore.selectedTenantId,
  () => {
    pagination.current = 1
    loadCases()
  }
)

onMounted(async () => {
  loading.value = true
  try {
    await loadCases()
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
