<template>
  <div class="job-manage-page">
    <record-list-page
      description="管理门户站点的招聘职位和简历投递"
      :loading="loading"
      :rows="jobList"
      :columns="columns"
      :read-failed="readFailed"
      :retry="loadData"
      :empty-line="emptyLine"
      :empty-reason="emptyReason"
      :count-line="countLine"
      can-create
      create-label="新建职位"
      @create="showAddModal"
    >
      <!-- 原来这里也是三张渐变统计卡（招聘职位 / 招聘中 / 已关闭），图标底各写死一支渐变。
           收成一条读数（Spec-Q §4.1）。「全站」是必要的：这一句是三份不带筛选的统计，
           下面分页那一句是**筛过之后**那一档的数，两者不同值时不能让人以为界面自相矛盾。 -->
      <!-- 这一屏的空会被读成「这家没在招人」，所以那一句只认后端回的成因（N-05）：
           读失败与「没行」也是两件事，前者交 read-failed，整张表退场。 -->
      <template #filters>
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
      </template>

      <template #actions>
        <a-space>
          <a-button type="primary" @click="showAddModal">
            <template #icon><PlusOutlined /></template>
            新建职位
          </a-button>
        </a-space>
      </template>

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

      <template #footer>
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
      </template>
    </record-list-page>

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
            <a-form-item label="最低薪资(元/月)">
              <a-input-number v-model:value="jobForm.salaryMin" :min="0" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="最高薪资(元/月)">
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
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
} from '@ant-design/icons-vue'
import { jobPostApi } from '../../api/portal'
import type { JobPost, JobPostForm, JobPostQuery } from '../../types/portal'
import { formatDateTime, formatNumber } from '../../utils/format'
import DemoFlag from '../../components/DemoFlag.vue'
import RecordListPage from '../../components/RecordListPage.vue'
import { describeHttpError } from '../../api/http'
import { JUMP_BACK_NOTICE, asEmptyReason, shouldJumpBackToFirstPage, type EmptyReason } from '../../utils/emptyPage'
import { logError } from '../../utils/errorLog'

const loading = ref(false)
// 空态的那一句只认后端（N-05）：读失败 / 后端答了成因 / 后端没答，三件事分开说
const readFailed = ref('')
const emptyLine = ref('')
const emptyReason = ref<EmptyReason>(null)
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
/** 三份统计有没有读回来：读不回来时这条念「没读回来」，留 0 在屏上等于说「这家一个职位都没有」 */
const statsFailed = ref(false)
const countLine = computed(() => {
  if (statsFailed.value || !!readFailed.value) return '全站职位的总数、在招、已关闭：这三个数没读回来，不是 0'
  return `全站职位：共 ${formatNumber(stats.totalJobs)} 个，招聘中（门户可见）${formatNumber(stats.openJobs)} 个，已关闭 ${formatNumber(stats.closedJobs)} 个`
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
    // 库里 salary_min/max 存的就是元（建表注释：salary_unit MONTHLY-月/YEARLY-年/DAILY-天），
    // 这里以前自创了个 "k"，同一个数在管理端读作 15k、在门户公开页读作 15 元
    return `${record.salaryMin}-${record.salaryMax} 元/月`
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
    logError('portal/job-manage-view', error)
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
    logError('portal/job-manage-view', error)
  }
}

async function handleDelete(id: number) {
  try {
    await jobPostApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error: any) {
    message.error(error?.message || '删除失败')
    logError('portal/job-manage-view', error)
  }
}

async function loadData() {
  loading.value = true
  readFailed.value = ''
  emptyLine.value = ''
  emptyReason.value = null
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
    emptyLine.value = result.emptyLine || ''
    emptyReason.value = asEmptyReason(result.emptyReason)
    if (shouldJumpBackToFirstPage(emptyReason.value, pagination.page)) {
      pagination.page = 1
      await loadData()
      message.info(JUMP_BACK_NOTICE)
      return
    }
    loadStats()
  } catch (error: any) {
    readFailed.value = describeHttpError(error)
    jobList.value = []
    pagination.total = 0
    logError('portal/job-manage-view', error)
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
    statsFailed.value = false
  } catch (error) {
    statsFailed.value = true
    logError('portal/job-manage-view', '加载统计数据失败:', error)
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

.salary-text {
  color: var(--admin-danger-text);
  font-weight: 500;
}
</style>
