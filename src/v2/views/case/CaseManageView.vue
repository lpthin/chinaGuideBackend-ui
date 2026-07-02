<template>
  <div class="case-manage-page">
    <a-spin :spinning="loading">
      <!-- 顶部统计卡片 -->
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
                <PlusCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.todayCases }}</div>
                <div class="stat-title">今日新增</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #eb2f96 0%, #ff85c0 100%)">
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
              <div class="stat-icon" style="background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%)">
                <EditOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.draftCases }}</div>
                <div class="stat-title">草稿箱</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 搜索筛选区 -->
      <a-card style="margin-bottom: 16px">
        <a-space wrap>
          <a-input-search
            v-model:value="queryParams.keyword"
            placeholder="搜索案例标题"
            style="width: 200px"
            @search="handleSearch"
          />
          <a-select
            v-model:value="queryParams.categoryId"
            placeholder="案例分类"
            style="width: 150px"
            allowClear
          >
            <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </a-select-option>
          </a-select>
          <a-select
            v-model:value="queryParams.status"
            placeholder="状态"
            style="width: 120px"
            allowClear
          >
            <a-select-option value="published">已发布</a-select-option>
            <a-select-option value="draft">草稿</a-select-option>
          </a-select>
          <a-range-picker v-model:value="queryParams.dateRange" style="width: 240px" />
          <a-button type="primary" @click="handleSearch">
            <template #icon><SearchOutlined /></template>
            搜索
          </a-button>
          <a-button @click="handleReset">重置</a-button>
          <a-button type="primary" @click="showAddModal">
            <template #icon><PlusOutlined /></template>
            新增案例
          </a-button>
        </a-space>
      </a-card>

      <!-- 案例列表 -->
      <a-card :bordered="false">
        <a-table
          :columns="columns"
          :data-source="caseList"
          :loading="tableLoading"
          :pagination="paginationConfig"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'coverImage'">
              <a-image
                v-if="record.coverImage"
                :src="record.coverImage"
                :width="80"
                :height="60"
                style="object-fit: cover; border-radius: 4px"
              />
              <span v-else class="no-cover">无封面</span>
            </template>
            <template v-if="column.key === 'title'">
              <a @click="viewDetail(record)">{{ record.title }}</a>
            </template>
            <template v-if="column.key === 'category'">
              <a-tag color="blue">{{ record.categoryName || '-' }}</a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'published' ? 'green' : 'orange'">
                {{ record.status === 'published' ? '已发布' : '草稿' }}
              </a-tag>
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
                <a-button
                  type="link"
                  size="small"
                  @click="handlePublish(record)"
                  v-if="record.status === 'draft'"
                >
                  发布
                </a-button>
                <a-popconfirm title="确定删除？" @confirm="handleDelete(record.id)">
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑案例' : '新增案例'"
      width="900px"
      :confirmLoading="saveLoading"
      @ok="handleSave"
      @cancel="handleCancel"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :label-col="{ span: 4 }"
        :rules="formRules"
      >
        <a-form-item label="案例标题" name="title">
          <a-input v-model:value="formData.title" placeholder="请输入案例标题" />
        </a-form-item>
        <a-form-item label="案例分类" name="categoryId">
          <a-select v-model:value="formData.categoryId" placeholder="选择分类">
            <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="封面图片" name="coverImage">
          <a-upload
            v-model:file-list="coverImageList"
            list-type="picture-card"
            :before-upload="beforeUpload"
            @preview="handlePreview"
          >
            <div v-if="coverImageList.length < 1">
              <PlusOutlined />
              <div class="upload-text">上传封面</div>
            </div>
          </a-upload>
        </a-form-item>
        <a-form-item label="案例摘要" name="summary">
          <a-textarea v-model:value="formData.summary" :rows="3" placeholder="请输入案例摘要" />
        </a-form-item>
        <a-form-item label="案例详情" name="content">
          <a-textarea v-model:value="formData.content" :rows="8" placeholder="支持富文本" />
        </a-form-item>
        <a-form-item label="标签" name="tags">
          <a-select mode="tags" v-model:value="formData.tagList" placeholder="输入标签" />
        </a-form-item>
        <a-form-item label="排序" name="sortOrder">
          <a-input-number v-model:value="formData.sortOrder" :min="0" style="width: 200px" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 图片预览 -->
    <a-modal v-model:open="previewVisible" :footer="null" title="图片预览">
      <img :src="previewImage" style="width: 100%" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance, UploadFile } from 'ant-design-vue'
import {
  FileTextOutlined,
  PlusCircleOutlined,
  CheckCircleOutlined,
  EditOutlined,
  SearchOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { caseApi, caseCategoryApi, caseStatsApi } from '../../api/case'
import type { Case, CaseCategory, CaseForm } from '../../types/case'
import dayjs from 'dayjs'

const loading = ref(false)
const tableLoading = ref(false)
const saveLoading = ref(false)
const modalVisible = ref(false)
const isEdit = ref(false)
const previewVisible = ref(false)
const previewImage = ref('')
const formRef = ref<FormInstance>()

const stats = reactive({
  totalCases: 0,
  todayCases: 0,
  publishedCases: 0,
  draftCases: 0,
})

const queryParams = reactive({
  keyword: '',
  categoryId: undefined as number | undefined,
  status: undefined as string | undefined,
  dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
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
    loadCases()
  },
})

const categories = ref<CaseCategory[]>([])
const caseList = ref<Case[]>([])
const coverImageList = ref<UploadFile[]>([])

const formData = reactive<CaseForm & { tagList: string[]; sortOrder: number }>({
  tenantId: 1,
  categoryId: undefined as any,
  title: '',
  summary: '',
  content: '',
  coverImage: '',
  type: 'customer_success' as any,
  priority: 'medium' as any,
  tagList: [],
  sortOrder: 0,
})

const formRules = {
  title: [{ required: true, message: '请输入案例标题', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择案例分类', trigger: 'change' }],
}

const columns = [
  { title: '封面', key: 'coverImage', width: 100 },
  { title: '案例标题', key: 'title', width: 250 },
  { title: '分类', key: 'category', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '浏览量', dataIndex: 'viewCount', key: 'viewCount', width: 100, align: 'center' as const },
  { title: '点赞数', dataIndex: 'likeCount', key: 'likeCount', width: 100, align: 'center' as const },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 180 },
]

async function loadStats() {
  try {
    const res = await caseStatsApi.getStats(1)
    stats.totalCases = res.totalCases || 0
    stats.publishedCases = res.publishedCases || 0
    stats.draftCases = res.draftCases || 0
    // 今日新增通过列表计算
    const today = dayjs().format('YYYY-MM-DD')
    stats.todayCases = caseList.value.filter(
      c => dayjs(c.createdAt).format('YYYY-MM-DD') === today
    ).length
  } catch {
    // 使用默认值
    stats.totalCases = caseList.value.length
    stats.publishedCases = caseList.value.filter(c => c.status === 'published').length
    stats.draftCases = caseList.value.filter(c => c.status === 'draft').length
  }
}

async function loadCategories() {
  try {
    const res = await caseCategoryApi.all(1)
    categories.value = res || []
  } catch {
    categories.value = []
  }
}

async function loadCases() {
  tableLoading.value = true
  try {
    const params: any = {
      tenantId: 1,
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
    }
    if (queryParams.keyword) params.keyword = queryParams.keyword
    if (queryParams.categoryId) params.categoryId = queryParams.categoryId
    if (queryParams.status) params.status = queryParams.status
    if (queryParams.dateRange) {
      params.startDate = queryParams.dateRange[0].format('YYYY-MM-DD')
      params.endDate = queryParams.dateRange[1].format('YYYY-MM-DD')
    }

    const res = await caseApi.list(params)
    caseList.value = res.records || []
    paginationConfig.total = res.total || 0
  } catch {
    caseList.value = []
  } finally {
    tableLoading.value = false
  }
}

async function loadAll() {
  loading.value = true
  await Promise.all([loadCategories(), loadCases()])
  await loadStats()
  loading.value = false
}

function handleSearch() {
  paginationConfig.current = 1
  loadCases()
}

function handleReset() {
  queryParams.keyword = ''
  queryParams.categoryId = undefined
  queryParams.status = undefined
  queryParams.dateRange = null
  paginationConfig.current = 1
  loadCases()
}

function showAddModal() {
  isEdit.value = false
  resetForm()
  modalVisible.value = true
}

function handleEdit(record: Case) {
  isEdit.value = true
  Object.assign(formData, {
    id: record.id,
    tenantId: record.tenantId,
    categoryId: record.categoryId,
    title: record.title,
    summary: record.summary,
    content: record.content,
    coverImage: record.coverImage,
    type: record.type,
    priority: record.priority,
    tagList: record.tagList || [],
    sortOrder: 0,
  })
  if (record.coverImage) {
    coverImageList.value = [
      {
        uid: '-1',
        name: 'cover.png',
        status: 'done',
        url: record.coverImage,
      },
    ]
  }
  modalVisible.value = true
}

function viewDetail(record: Case) {
  handleEdit(record)
}

async function handlePublish(record: Case) {
  try {
    await caseApi.publish(record.id)
    const item = caseList.value.find(c => c.id === record.id)
    if (item) {
      item.status = 'published'
    }
    stats.publishedCases += 1
    stats.draftCases -= 1
    message.success('发布成功')
  } catch {
    message.error('发布失败')
  }
}

async function handleDelete(id: number) {
  try {
    await caseApi.delete(id)
    const index = caseList.value.findIndex(c => c.id === id)
    if (index > -1) {
      const item = caseList.value[index]
      if (item.status === 'published') {
        stats.publishedCases -= 1
      } else {
        stats.draftCases -= 1
      }
      stats.totalCases -= 1
      caseList.value.splice(index, 1)
      paginationConfig.total -= 1
    }
    message.success('删除成功')
  } catch {
    message.error('删除失败')
  }
}

async function handleSave() {
  try {
    await formRef.value?.validate()
    saveLoading.value = true

    formData.tags = formData.tagList?.join(',') || ''

    if (isEdit.value && formData.id) {
      await caseApi.update(formData.id, formData)
      message.success('更新成功')
    } else {
      await caseApi.create(formData as CaseForm)
      message.success('创建成功')
    }

    modalVisible.value = false
    loadCases()
    loadStats()
  } catch {
    // 表单验证失败或API错误
  } finally {
    saveLoading.value = false
  }
}

function handleCancel() {
  modalVisible.value = false
  resetForm()
}

function resetForm() {
  formData.id = undefined
  formData.tenantId = 1
  formData.categoryId = undefined
  formData.title = ''
  formData.summary = ''
  formData.content = ''
  formData.coverImage = ''
  formData.type = 'customer_success' as any
  formData.priority = 'medium' as any
  formData.tagList = []
  formData.sortOrder = 0
  coverImageList.value = []
  formRef.value?.resetFields()
}

function beforeUpload(file: File) {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    message.error('只能上传图片文件')
    return false
  }
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isLt5M) {
    message.error('图片大小不能超过5MB')
    return false
  }
  // 实际项目中这里应该上传到服务器获取URL
  // 暂时用本地预览
  const url = URL.createObjectURL(file)
  coverImageList.value = [
    {
      uid: '-1',
      name: file.name,
      status: 'done',
      url,
    },
  ]
  formData.coverImage = url
  return false
}

function handlePreview(file: UploadFile) {
  previewImage.value = file.url || ''
  previewVisible.value = true
}

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

.no-cover {
  color: #8c8c8c;
  font-size: 12px;
}

.upload-text {
  margin-top: 8px;
  font-size: 12px;
}
</style>
