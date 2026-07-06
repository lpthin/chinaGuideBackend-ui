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
            :row-key="record => record.id"
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
              :show-total="(total) => `共 ${total} 条`"
            />
          </div>
        </a-card>
      </a-spin>
    </div>
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
import type { JobPost } from '../../types/portal'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)

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
  message.info('新建职位功能')
}

function editJob(id: number) {
  message.info(`编辑职位 ${id}`)
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
    const params: Record<string, any> = {
      page: pagination.page,
      size: pagination.size,
    }
    if (queryParams.jobType) {
      params.jobType = queryParams.jobType
    }
    if (queryParams.keyword) {
      params.keyword = queryParams.keyword
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
    const allResult = await jobPostApi.list({ page: 1, size: 1 })
    stats.totalJobs = allResult.total || 0
    
    const activeResult = await jobPostApi.list({ page: 1, size: 1, status: 'active' })
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
