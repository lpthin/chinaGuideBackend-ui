<template>
  <div class="job-manage-page">
    <a-page-header title="招聘管理" sub-title="管理门户网站的招聘职位和简历投递">
    </a-page-header>

    <div class="content-wrapper">
      <a-spin :spinning="loading">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                  <FileTextOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.totalJobs }}</div>
                  <div class="stat-title">招聘职位</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                  <UserOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.totalApplications }}</div>
                  <div class="stat-title">投递简历</div>
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
                  <div class="stat-value">{{ stats.activeJobs }}</div>
                  <div class="stat-title">招聘中</div>
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
                  <div class="stat-value">{{ stats.pendingReviews }}</div>
                  <div class="stat-title">待处理</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false">
          <template #title>
            <a-space>
              <a-select
                v-model:value="queryParams.jobType"
                style="width: 150px"
                placeholder="职位类型"
                allowClear
                @change="loadData"
              >
                <a-select-option value="full-time">全职</a-select-option>
                <a-select-option value="part-time">兼职</a-select-option>
                <a-select-option value="internship">实习</a-select-option>
              </a-select>
              <a-input-search
                v-model:value="queryParams.keyword"
                placeholder="搜索职位"
                style="width: 250px"
                enter-button
                @search="loadData"
              />
              <a-button type="primary" @click="showAddModal">
                <template #icon><PlusOutlined /></template>
                发布职位
              </a-button>
            </a-space>
          </template>

          <a-table
            :columns="columns"
            :data-source="jobList"
            :pagination="false"
            :row-key="(record: any) => record.id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'salary'">
                <span class="salary-text">{{ formatSalary(record) }}</span>
              </template>
              <template v-if="column.key === 'department'">
                <a-tag color="blue">{{ record.department }}</a-tag>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'active' ? 'green' : 'default'">
                  {{ record.status === 'active' ? '招聘中' : '已下架' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="viewApplications(record.id)">
                    简历
                  </a-button>
                  <a-button type="link" size="small" @click="toggleStatus(record)">
                    {{ record.status === 'active' ? '下架' : '上架' }}
                  </a-button>
                  <a-button type="link" size="small" @click="editJob(record.id)">编辑</a-button>
                  <a-popconfirm
                    title="确定要删除这个职位吗？"
                    @confirm="handleDelete(record.id)"
                  >
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>

          <div class="pagination-wrapper">
            <a-pagination
              v-model:current="pagination.page"
              v-model:page-size="pagination.size"
              :total="pagination.total"
              :show-size-changer="true"
              :show-quick-jumper="true"
              :page-size-options="['10', '20', '50']"
              @change="loadData"
              @showSizeChange="handleSizeChange"
              :show-total="(total: number) => `共 ${total} 条`"
            />
          </div>
        </a-card>
      </a-spin>
    </div>

    <a-modal v-model:open="showJobModal" :title="editingJob ? '编辑职位' : '发布职位'" width="700px" @ok="handleSaveJob" :confirm-loading="saving">
      <a-form :model="jobForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="职位名称" required>
              <a-input v-model:value="jobForm.title" placeholder="请输入职位名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="职位类型">
              <a-select v-model:value="jobForm.jobType" placeholder="选择职位类型">
                <a-select-option value="full-time">全职</a-select-option>
                <a-select-option value="part-time">兼职</a-select-option>
                <a-select-option value="internship">实习</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="最低薪资(k)">
              <a-input-number v-model:value="jobForm.minSalary" :min="0" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="最高薪资(k)">
              <a-input-number v-model:value="jobForm.maxSalary" :min="0" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="工作地点">
              <a-input v-model:value="jobForm.location" placeholder="请输入工作地点" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="部门">
              <a-input v-model:value="jobForm.department" placeholder="请输入部门" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="工作经验">
              <a-select v-model:value="jobForm.experienceRequirement">
                <a-select-option value="不限">不限</a-select-option>
                <a-select-option value="1-3年">1-3年</a-select-option>
                <a-select-option value="3-5年">3-5年</a-select-option>
                <a-select-option value="5年以上">5年以上</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="学历要求">
              <a-select v-model:value="jobForm.educationRequirement">
                <a-select-option value="不限">不限</a-select-option>
                <a-select-option value="大专">大专</a-select-option>
                <a-select-option value="本科">本科</a-select-option>
                <a-select-option value="硕士">硕士</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="职位描述">
          <a-textarea v-model:value="jobForm.description" :rows="4" placeholder="请输入职位描述" />
        </a-form-item>
        <a-form-item label="任职要求">
          <a-textarea v-model:value="jobForm.requirements" :rows="4" placeholder="请输入任职要求" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { jobPostApi } from '../../api/portal'
import type { JobPost, JobPostQuery } from '../../types/portal'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const showJobModal = ref(false)
const saving = ref(false)
const editingJob = ref<JobPost | null>(null)

const jobForm = reactive({
  title: '',
  jobType: 'full-time' as 'full-time' | 'part-time' | 'internship',
  minSalary: 0,
  maxSalary: 0,
  location: '',
  department: '',
  experienceRequirement: '不限',
  educationRequirement: '不限',
  description: '',
  requirements: '',
})

const stats = reactive({
  totalJobs: 0,
  totalApplications: 0,
  activeJobs: 0,
  pendingReviews: 0,
})

const queryParams = reactive({
  jobType: undefined as string | undefined,
  keyword: '',
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0,
})

const jobList = ref<JobPost[]>([])

const columns = [
  { title: '职位名称', dataIndex: 'title', key: 'title', width: 200 },
  { title: '薪资范围', key: 'salary', width: 150 },
  { title: '工作地点', dataIndex: 'location', key: 'location', width: 120 },
  { title: '部门', key: 'department', width: 100 },
  { title: '工作经验', dataIndex: 'experienceRequirement', key: 'experienceRequirement', width: 100 },
  { title: '学历要求', dataIndex: 'educationRequirement', key: 'educationRequirement', width: 100 },
  { title: '浏览量', dataIndex: 'viewCount', key: 'viewCount', width: 100, align: 'center' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '发布时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 280 },
]

function formatSalary(record: JobPost): string {
  if (record.minSalary && record.maxSalary) {
    return `${record.minSalary}k-${record.maxSalary}k`
  }
  return '面议'
}

function showAddModal() {
  editingJob.value = null
  jobForm.title = ''
  jobForm.jobType = 'full-time'
  jobForm.minSalary = 0
  jobForm.maxSalary = 0
  jobForm.location = ''
  jobForm.department = ''
  jobForm.experienceRequirement = '不限'
  jobForm.educationRequirement = '不限'
  jobForm.description = ''
  jobForm.requirements = ''
  showJobModal.value = true
}

async function editJob(id: number) {
  try {
    const job = await jobPostApi.get(id)
    editingJob.value = job
    jobForm.title = job.title || ''
    jobForm.jobType = (job.jobType as 'full-time' | 'part-time' | 'internship') || 'full-time'
    jobForm.minSalary = job.minSalary || 0
    jobForm.maxSalary = job.maxSalary || 0
    jobForm.location = job.location || ''
    jobForm.department = job.department || ''
    jobForm.experienceRequirement = job.experienceRequirement || '不限'
    jobForm.educationRequirement = job.educationRequirement || '不限'
    jobForm.description = job.description || ''
    jobForm.requirements = job.requirements || ''
    showJobModal.value = true
  } catch (error) {
    message.error('加载职位信息失败')
    console.error(error)
  }
}

async function handleSaveJob() {
  if (!jobForm.title.trim()) {
    message.warning('请输入职位名称')
    return
  }
  saving.value = true
  try {
    const tenantId = auth.selectedTenantId || auth.tenantId
    const data = {
      ...jobForm,
      tenantId,
      status: 'active' as const,
    }
    if (editingJob.value) {
      await jobPostApi.update(editingJob.value.id, data)
      message.success('职位更新成功')
    } else {
      await jobPostApi.create(data)
      message.success('职位发布成功')
    }
    showJobModal.value = false
    await loadData()
  } catch (error) {
    message.error('操作失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function toggleStatus(record: JobPost) {
  try {
    const newStatus = record.status === 'active' ? 'disabled' : 'active'
    await jobPostApi.update(record.id, { ...record, status: newStatus })
    record.status = newStatus
    message.success(`${newStatus === 'active' ? '上架' : '下架'}成功`)
    loadStats()
  } catch (error) {
    message.error('操作失败')
    console.error(error)
  }
}

function viewApplications(id: number) {
  message.info(`查看简历 ${id}`)
}

async function handleDelete(id: number) {
  try {
    await jobPostApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    message.error('删除失败')
    console.error(error)
  }
}

async function loadData() {
  loading.value = true
  try {
    const params: JobPostQuery = {
      tenantId: auth.selectedTenantId || auth.tenantId,
      page: pagination.page,
      size: pagination.size,
      jobType: queryParams.jobType || undefined,
      keyword: queryParams.keyword || undefined,
    }
    const result = await jobPostApi.list(params)
    jobList.value = result.records || []
    pagination.total = result.total || 0
    loadStats()
  } catch (error) {
    message.error('加载职位列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const tenantId = auth.selectedTenantId || auth.tenantId
    const allResult = await jobPostApi.list({ tenantId, page: 1, size: 1 })
    stats.totalJobs = allResult.total || 0
    
    const activeResult = await jobPostApi.list({ tenantId, page: 1, size: 1, status: 'active' })
    stats.activeJobs = activeResult.total || 0
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

function handleSizeChange(_current: number, size: number) {
  pagination.page = 1
  pagination.size = size
  loadData()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.job-manage-page {
  width: 100%;
  padding: 0;
}

.content-wrapper {
  padding: 24px;
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

.salary-text {
  color: #ff4d4f;
  font-weight: 500;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
