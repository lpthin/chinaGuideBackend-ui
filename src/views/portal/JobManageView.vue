<template>
  <div class="job-manage-page">
    <a-page-header title="招聘管理" sub-title="管理门户网站的招聘职位和简历投递">
    </a-page-header>

    <div class="content-wrapper">
      <a-spin :spinning="loading">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="8">
            <a-card class="stat-card">
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                  <FileTextOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ formatNumber(stats.totalJobs) }}</div>
                  <div class="stat-title">招聘职位</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card class="stat-card">
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                  <CheckCircleOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ formatNumber(stats.openJobs) }}</div>
                  <div class="stat-title">招聘中（门户可见）</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card class="stat-card">
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #8c8c8c 0%, #bfbfbf 100%)">
                  <ClockCircleOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ formatNumber(stats.closedJobs) }}</div>
                  <div class="stat-title">已关闭</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false">
          <template #title>
            <a-space class="toolbar-fill" wrap>
              <a-select
                v-model:value="queryParams.status"
                style="width: 140px"
                placeholder="职位状态"
                allowClear
                @change="loadData"
              >
                <a-select-option value="OPEN">招聘中</a-select-option>
                <a-select-option value="CLOSED">已关闭</a-select-option>
              </a-select>
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
                新建职位
              </a-button>
            </a-space>
          </template>

          <a-table
            :scroll="{ x: 'max-content' }"
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
              <template v-if="column.key === 'title'">
                {{ record.title }} <DemoFlag :is-demo="record.isDemo" />
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'OPEN' ? 'green' : 'default'">
                  {{ record.status === 'OPEN' ? '招聘中' : '已关闭' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'viewCount'">
                {{ formatNumber(record.viewCount) }}
              </template>
              <template v-if="column.key === 'createdAt'">
                {{ formatDateTime(record.createdAt) }}
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button v-if="record.status !== 'OPEN'" type="link" size="small" @click="toggleStatus(record)">上架</a-button>
                  <a-button v-else type="link" size="small" @click="toggleStatus(record)">下架</a-button>
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

    <a-modal v-model:open="showJobModal" :title="editingJob ? '编辑职位' : '新建职位'" width="700px" @ok="handleSaveJob" :confirm-loading="saving">
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
              <a-input-number v-model:value="jobForm.salaryMin" :min="0" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="最高薪资(k)">
              <a-input-number v-model:value="jobForm.salaryMax" :min="0" />
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
              <a-select v-model:value="jobForm.experienceReq">
                <a-select-option value="不限">不限</a-select-option>
                <a-select-option value="1-3年">1-3年</a-select-option>
                <a-select-option value="3-5年">3-5年</a-select-option>
                <a-select-option value="5年以上">5年以上</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="学历要求">
              <a-select v-model:value="jobForm.educationReq">
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
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { jobPostApi } from '../../api/portal'
import type { JobPost, JobPostForm, JobPostQuery } from '../../types/portal'
import { formatDateTime, formatNumber } from '../../utils/format'
import DemoFlag from '../../components/DemoFlag.vue'

const loading = ref(false)
const showJobModal = ref(false)
const saving = ref(false)
const editingJob = ref<JobPost | null>(null)

// 字段名与后端 portal_job 实体保持一致，之前叫 minSalary / experienceRequirement，
// 提交后被 Jackson 静默丢弃：界面提示保存成功，库里这几个字段是空的。
const jobForm = reactive<JobPostForm>({
  title: '',
  jobType: 'full-time',
  salaryMin: 0,
  salaryMax: 0,
  location: '',
  department: '',
  experienceReq: '不限',
  educationReq: '不限',
  description: '',
  requirements: '',
})

const stats = reactive({
  totalJobs: 0,
  openJobs: 0,
  closedJobs: 0,
})

const queryParams = reactive({
  status: undefined as string | undefined,
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
  { title: '工作经验', dataIndex: 'experienceReq', key: 'experienceReq', width: 100 },
  { title: '学历要求', dataIndex: 'educationReq', key: 'educationReq', width: 100 },
  { title: '浏览量', dataIndex: 'viewCount', key: 'viewCount', width: 100, align: 'center' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '发布时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 240 },
]

function formatSalary(record: JobPost): string {
  if (record.salaryMin && record.salaryMax) {
    return `${record.salaryMin}k-${record.salaryMax}k`
  }
  return '面议'
}

function resetJobForm() {
  Object.assign(jobForm, {
    title: '',
    jobType: 'full-time',
    salaryMin: 0,
    salaryMax: 0,
    location: '',
    department: '',
    experienceReq: '不限',
    educationReq: '不限',
    description: '',
    requirements: '',
  })
}

function showAddModal() {
  editingJob.value = null
  resetJobForm()
  showJobModal.value = true
}

function editJob(id: number) {
  const job = jobList.value.find((item) => item.id === id)
  if (!job) {
    message.error('职位已不在当前列表，请刷新后重试')
    return
  }
  editingJob.value = job
  Object.assign(jobForm, {
    title: job.title || '',
    jobType: job.jobType || 'full-time',
    salaryMin: job.salaryMin ?? 0,
    salaryMax: job.salaryMax ?? 0,
    location: job.location || '',
    department: job.department || '',
    experienceReq: job.experienceReq || '不限',
    educationReq: job.educationReq || '不限',
    description: job.description || '',
    requirements: job.requirements || '',
  })
  showJobModal.value = true
}

async function handleSaveJob() {
  if (!jobForm.title?.trim()) {
    message.warning('请输入职位名称')
    return
  }
  saving.value = true
  try {
    if (editingJob.value) {
      await jobPostApi.update(editingJob.value.id, { ...jobForm })
      message.success('职位已更新')
    } else {
      // 新建不带 status，后端默认 CLOSED；上架是单独动作，避免「一保存就出现在门户上」的错觉
      await jobPostApi.create({ ...jobForm })
      message.success('职位已保存，点「上架」后门户才会展示')
    }
    showJobModal.value = false
    await loadData()
  } catch (error: any) {
    message.error(error?.message || '保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function toggleStatus(record: JobPost) {
  const toOpen = record.status !== 'OPEN'
  try {
    await (toOpen ? jobPostApi.publish(record.id) : jobPostApi.close(record.id))
    record.status = toOpen ? 'OPEN' : 'CLOSED'
    message.success(toOpen ? '已上架，门户招聘页现在能看到它' : '已下架')
    loadStats()
  } catch (error: any) {
    message.error(error?.message || '操作失败')
    console.error(error)
  }
}

async function handleDelete(id: number) {
  try {
    await jobPostApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error: any) {
    message.error(error?.message || '删除失败')
    console.error(error)
  }
}

async function loadData() {
  loading.value = true
  try {
    const params: JobPostQuery = {
      page: pagination.page,
      size: pagination.size,
      status: queryParams.status || undefined,
      jobType: queryParams.jobType || undefined,
      keyword: queryParams.keyword || undefined,
    }
    const result = await jobPostApi.list(params)
    jobList.value = result.records || []
    pagination.total = result.total || 0
    loadStats()
  } catch (error: any) {
    message.error(error?.message || '加载职位列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const [all, open, closed] = await Promise.all([
      jobPostApi.list({ page: 1, size: 1 }),
      jobPostApi.list({ page: 1, size: 1, status: 'OPEN' }),
      jobPostApi.list({ page: 1, size: 1, status: 'CLOSED' }),
    ])
    stats.totalJobs = all.total || 0
    stats.openJobs = open.total || 0
    stats.closedJobs = closed.total || 0
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
