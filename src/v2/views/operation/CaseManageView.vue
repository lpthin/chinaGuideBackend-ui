<template>
  <div class="case-manage-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                < TrophyOutlined />
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
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalViews }}</div>
                <div class="stat-title">总浏览量</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #eb2f96 0%, #ff85c0 100%)">
                <StarOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalStars }}</div>
                <div class="stat-title">总收藏</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%)">
                <TagOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalIndustries }}</div>
                <div class="stat-title">行业数</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <a-space>
            <a-select
              v-model:value="queryParams.industry"
              style="width: 150px"
              placeholder="选择行业"
              allowClear
            >
              <a-select-option value="finance">金融科技</a-select-option>
              <a-select-option value="ecommerce">电子商务</a-select-option>
              <a-select-option value="education">在线教育</a-select-option>
              <a-select-option value="health">医疗健康</a-select-option>
              <a-select-option value="manufacture">智能制造</a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.status"
              style="width: 120px"
              placeholder="状态"
              allowClear
            >
              <a-select-option value="published">已发布</a-select-option>
              <a-select-option value="draft">草稿</a-select-option>
              <a-select-option value="offline">已下线</a-select-option>
            </a-select>
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索案例名称/客户名称"
              style="width: 280px"
              enter-button
            />
            <a-button type="primary" @click="showAddModal">
              <template #icon><PlusOutlined /></template>
              新建案例
            </a-button>
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="caseList"
          :pagination="paginationConfig"
          :loading="tableLoading"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="case-name">
                <img v-if="record.customerLogo" :src="record.customerLogo" class="case-logo" />
                <div class="case-logo-placeholder" v-else>{{ record.customerName?.charAt(0) }}</div>
                <div style="flex: 1; margin-left: 12px">
                  <div class="case-title">{{ record.title }}</div>
                  <div class="case-client">{{ record.customerName }}</div>
                </div>
              </div>
            </template>
            <template v-if="column.key === 'industry'">
              <a-tag color="blue">{{ getIndustryName(record.industry) }}</a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusName(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatDate(record.createdAt) }}
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="viewDetail(record)">查看</a-button>
                <a-button type="link" size="small" @click="editCase(record)">编辑</a-button>
                <a-button type="link" size="small" danger @click="handleDelete(record.id)">删除</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑案例' : '新建案例'"
      width="720px"
      @ok="handleSave"
      @cancel="modalVisible = false"
    >
      <a-form :model="editForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="客户名称" required>
              <a-input v-model:value="editForm.customerName" placeholder="请输入客户名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="所属行业">
              <a-select v-model:value="editForm.industry" placeholder="选择行业">
                <a-select-option value="finance">金融科技</a-select-option>
                <a-select-option value="ecommerce">电子商务</a-select-option>
                <a-select-option value="education">在线教育</a-select-option>
                <a-select-option value="health">医疗健康</a-select-option>
                <a-select-option value="manufacture">智能制造</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="案例标题" required>
          <a-input v-model:value="editForm.title" placeholder="请输入案例标题" />
        </a-form-item>
        <a-form-item label="案例摘要">
          <a-textarea v-model:value="editForm.summary" :rows="3" placeholder="请输入案例摘要" />
        </a-form-item>
        <a-form-item label="案例内容">
          <a-textarea v-model:value="editForm.content" :rows="6" placeholder="请输入案例详细内容" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="客户Logo">
              <a-input v-model:value="editForm.customerLogo" placeholder="请输入Logo URL" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="封面图片">
              <a-input v-model:value="editForm.coverImage" placeholder="请输入封面图URL" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="标签">
              <a-input v-model:value="editForm.tags" placeholder="多个标签用逗号分隔" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="editForm.status">
                <a-select-option value="draft">草稿</a-select-option>
                <a-select-option value="published">已发布</a-select-option>
                <a-select-option value="offline">已下线</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="排序">
          <a-input-number v-model:value="editForm.sort" :min="0" style="width: 200px" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  TrophyOutlined,
  EyeOutlined,
  StarOutlined,
  TagOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { customerCaseApi } from '../../api/operation'
import type { CustomerCase, CustomerCaseForm } from '../../types/operation'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const modalVisible = ref(false)
const isEdit = ref(false)
const currentCase = ref<CustomerCase | null>(null)

const stats = reactive({
  totalCases: 0,
  totalViews: 0,
  totalStars: 0,
  totalIndustries: 0,
})

const queryParams = reactive({
  industry: undefined as string | undefined,
  status: undefined as string | undefined,
  keyword: '',
})

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (page: number, pageSize: number) => {
    paginationConfig.current = page
    paginationConfig.pageSize = pageSize
    loadCaseList()
  },
})

const columns = [
  { title: '案例信息', key: 'name', width: 280 },
  { title: '行业', key: 'industry', width: 120 },
  { title: '服务内容', dataIndex: 'summary', key: 'summary', width: 200 },
  { title: '浏览量', dataIndex: 'viewCount', key: 'viewCount', width: 100, align: 'center' as const },
  { title: '收藏数', dataIndex: 'starCount', key: 'starCount', width: 100, align: 'center' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '发布时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 },
]

const caseList = ref<CustomerCase[]>([])

const editForm = reactive<CustomerCaseForm>({
  tenantId: 0,
  customerName: '',
  customerLogo: '',
  industry: '',
  title: '',
  summary: '',
  content: '',
  coverImage: '',
  tags: '',
  sort: 0,
  status: 'draft',
})

function getIndustryName(industry: string): string {
  const nameMap: Record<string, string> = {
    finance: '金融科技',
    ecommerce: '电子商务',
    education: '在线教育',
    health: '医疗健康',
    manufacture: '智能制造',
  }
  return nameMap[industry] || industry
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    published: 'green',
    draft: 'default',
    offline: 'red',
  }
  return colorMap[status] || 'default'
}

function getStatusName(status: string): string {
  const nameMap: Record<string, string> = {
    published: '已发布',
    draft: '草稿',
    offline: '已下线',
  }
  return nameMap[status] || status
}

function formatDate(date: string): string {
  if (!date) return '-'
  return date.substring(0, 10)
}

async function loadCaseList() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  tableLoading.value = true
  try {
    const params: any = {
      tenantId,
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
    }
    if (queryParams.industry) params.industry = queryParams.industry
    if (queryParams.status) params.status = queryParams.status
    if (queryParams.keyword) params.keyword = queryParams.keyword

    const res = await customerCaseApi.list(params)
    caseList.value = res.records || []
    paginationConfig.total = res.total || 0
    updateStats(res.records || [])
  } catch (error) {
    message.error('加载案例列表失败')
    console.error(error)
    caseList.value = []
  } finally {
    tableLoading.value = false
  }
}

function updateStats(list: CustomerCase[]) {
  stats.totalCases = list.length
  stats.totalViews = list.reduce((sum, item) => sum + (item.viewCount || 0), 0)
  stats.totalStars = 0
  const industries = new Set(list.map(item => item.industry).filter(Boolean))
  stats.totalIndustries = industries.size
}

async function loadAll() {
  loading.value = true
  try {
    await loadCaseList()
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

function showAddModal() {
  isEdit.value = false
  resetForm()
  modalVisible.value = true
}

function editCase(record: CustomerCase) {
  isEdit.value = true
  currentCase.value = record
  Object.assign(editForm, {
    id: record.id,
    tenantId: record.tenantId,
    customerName: record.customerName,
    customerLogo: record.customerLogo,
    industry: record.industry,
    title: record.title,
    summary: record.summary,
    content: record.content,
    coverImage: record.coverImage,
    tags: record.tags,
    sort: record.sort,
    status: record.status,
  })
  modalVisible.value = true
}

function viewDetail(record: CustomerCase) {
  currentCase.value = record
  editCase(record)
}

function resetForm() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  editForm.id = undefined
  editForm.tenantId = tenantId
  editForm.customerName = ''
  editForm.customerLogo = ''
  editForm.industry = ''
  editForm.title = ''
  editForm.summary = ''
  editForm.content = ''
  editForm.coverImage = ''
  editForm.tags = ''
  editForm.sort = 0
  editForm.status = 'draft'
}

async function handleSave() {
  try {
    if (isEdit.value && editForm.id) {
      await customerCaseApi.update(editForm.id, editForm)
      message.success('更新成功')
    } else {
      await customerCaseApi.create(editForm)
      message.success('创建成功')
    }
    modalVisible.value = false
    loadCaseList()
  } catch (error) {
    message.error('保存失败')
    console.error(error)
  }
}

async function handleDelete(id: number) {
  Modal.confirm({
    title: '确定要删除这个案例吗？',
    onOk: async () => {
      try {
        await customerCaseApi.delete(id)
        message.success('删除成功')
        loadCaseList()
      } catch (error) {
        message.error('删除失败')
        console.error(error)
      }
    },
  })
}

watch(
  () => authStore.selectedTenantId,
  () => {
    loadAll()
  }
)

onMounted(() => {
  loadAll()
})
</script>

<style scoped lang="less">
.case-manage-page {
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

.case-name {
  display: flex;
  align-items: center;
}

.case-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid #e8e8e8;
}

.case-logo-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.case-title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.case-client {
  font-size: 12px;
  color: #8c8c8c;
}
</style>
