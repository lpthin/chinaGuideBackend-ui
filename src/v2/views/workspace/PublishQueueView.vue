<template>
  <div class="publish-queue-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card stat-card-processing" hoverable @click="filterByStatus('PENDING')">
            <a-statistic title="待发布" :value="stats.pending" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card stat-card-blue" hoverable @click="filterByStatus('PUBLISHING')">
            <a-statistic title="发布中" :value="stats.publishing" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card stat-card-success" hoverable @click="filterByStatus('PUBLISHED')">
            <a-statistic title="今日已发布" :value="stats.todayPublished" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card stat-card-error" hoverable @click="filterByStatus('FAILED')">
            <a-statistic title="发布失败" :value="stats.failed" />
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-row :gutter="16" align="middle">
          <a-col :span="18">
            <a-space size="middle">
              <a-select v-model:value="queryParams.status" placeholder="状态筛选" allowClear style="width: 150px" @change="handleSearch">
                <a-select-option value="PENDING">待发布</a-select-option>
                <a-select-option value="PUBLISHING">发布中</a-select-option>
                <a-select-option value="PUBLISHED">已发布</a-select-option>
                <a-select-option value="FAILED">失败</a-select-option>
                <a-select-option value="CANCELLED">已取消</a-select-option>
              </a-select>
              <a-input-search
                v-model:value="queryParams.keyword"
                placeholder="搜索文章标题"
                style="width: 280px"
                allow-clear
                @search="handleSearch"
                @clear="handleSearch"
              />
            </a-space>
          </a-col>
          <a-col :span="6" style="text-align: right">
            <a-space>
              <a-button @click="handleReset">
                <template #icon><ReloadOutlined /></template>
                重置
              </a-button>
              <a-button type="primary" @click="handleSearch">
                <template #icon><SearchOutlined /></template>
                搜索
              </a-button>
            </a-space>
          </a-col>
        </a-row>
      </a-card>

      <a-table
        :columns="columns"
        :data-source="queueList"
        :pagination="pagination"
        :loading="loading"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusName(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'priority'">
            <div class="priority-display">
              <a-rate :value="record.priority" :count="10" disabled allow-half />
              <span class="priority-value">{{ record.priority }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'platform'">
            <a-tag color="blue">{{ record.platform || '未设置' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space size="small">
              <a-tooltip v-if="record.status === 'PENDING'" title="立即发布">
                <a-button type="link" size="small" @click="handlePublishNow(record)">
                  <SendOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.status === 'PENDING'" title="调整优先级">
                <a-button type="link" size="small" @click="handleAdjustPriority(record)">
                  <ArrowUpOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.status === 'FAILED'" title="重试发布">
                <a-button type="link" size="small" @click="handleRetry(record)">
                  <ReloadOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.status === 'PENDING' || record.status === 'PUBLISHING'" title="取消发布">
                <a-button type="link" size="small" danger @click="handleCancel(record)">
                  <CloseOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看详情">
                <a-button type="link" size="small" @click="handleViewDetail(record)">
                  <EyeOutlined />
                </a-button>
              </a-tooltip>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-spin>

    <a-modal
      v-model:open="priorityModalVisible"
      title="调整优先级"
      @ok="handlePriorityOk"
      @cancel="priorityModalVisible = false"
      :confirmLoading="prioritySaving"
      :maskClosable="false"
      :destroyOnClose="true"
      width="480px"
    >
      <div v-if="currentPriorityRecord" class="priority-modal-content">
        <div class="priority-info">
          <span class="priority-label">文章标题：</span>
          <span class="priority-title">{{ currentPriorityRecord.title }}</span>
        </div>
        <a-divider />
        <div class="priority-adjust">
          <div class="priority-slider-label">
            <span>当前优先级：<strong>{{ priorityValue }}</strong></span>
            <span class="priority-hint">数值越高，优先级越高（1-10）</span>
          </div>
          <a-slider
            v-model:value="priorityValue"
            :min="1"
            :max="10"
            :step="1"
            :marks="priorityMarks"
            style="margin-top: 16px"
          />
          <div class="priority-input-row">
            <span class="priority-input-label">直接输入：</span>
            <a-input-number
              v-model:value="priorityValue"
              :min="1"
              :max="10"
              :step="1"
              style="width: 120px"
            />
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  SendOutlined,
  ArrowUpOutlined,
  ReloadOutlined,
  CloseOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { publishQueueApi } from '../../api/workspace'

const loading = ref(false)
const priorityModalVisible = ref(false)
const prioritySaving = ref(false)
const priorityValue = ref(5)
const currentPriorityRecord = ref<any>(null)

const priorityMarks = {
  1: '低',
  3: '较低',
  5: '中',
  7: '较高',
  10: '高',
}

const stats = reactive({
  pending: 0,
  publishing: 0,
  todayPublished: 0,
  failed: 0,
})

const queryParams = reactive({
  status: undefined as string | undefined,
  keyword: '',
  page: 1,
  size: 10,
})

const queueList = ref<any[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '文章标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '发布平台', key: 'platform', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '优先级', key: 'priority', width: 220 },
  { title: '计划发布时间', dataIndex: 'scheduledTime', key: 'scheduledTime', width: 180 },
  { title: '实际发布时间', dataIndex: 'publishTime', key: 'publishTime', width: 180 },
  { title: '操作', key: 'actions', width: 180, fixed: 'right' as const },
]

function getStatusColor(status?: string) {
  switch (status) {
    case 'PENDING': return 'processing'
    case 'PUBLISHING': return 'blue'
    case 'PUBLISHED': return 'success'
    case 'FAILED': return 'error'
    case 'CANCELLED': return 'default'
    default: return 'default'
  }
}

function getStatusName(status?: string) {
  switch (status) {
    case 'PENDING': return '待发布'
    case 'PUBLISHING': return '发布中'
    case 'PUBLISHED': return '已发布'
    case 'FAILED': return '失败'
    case 'CANCELLED': return '已取消'
    default: return '未知'
  }
}

async function loadStats() {
  try {
    const data = await publishQueueApi.getStats() as any
    if (data) {
      stats.pending = data.pending || 0
      stats.publishing = data.publishing || 0
      stats.todayPublished = data.todayPublished || 0
      stats.failed = data.failed || 0
    }
  } catch (error) {
    console.error(error)
  }
}

async function loadQueue() {
  loading.value = true
  try {
    const res = await publishQueueApi.list({
      status: queryParams.status,
      page: queryParams.page,
      size: queryParams.size,
    }) as any
    const records = res?.records || res?.data?.records || res || []
    queueList.value = records
    pagination.total = res?.total || res?.data?.total || records.length
  } catch (error) {
    console.error(error)
    const mockData = generateMockData()
    queueList.value = mockData
    pagination.total = mockData.length
    message.error('加载队列失败，显示示例数据')
  } finally {
    loading.value = false
  }
}

function generateMockData() {
  const statuses = ['PENDING', 'PENDING', 'PENDING', 'PUBLISHING', 'PUBLISHED', 'PUBLISHED', 'FAILED', 'CANCELLED']
  const platforms = ['WordPress', '微信公众号', '知乎', '简书', 'CSDN']
  const titles = [
    '2024年人工智能发展趋势分析报告',
    '前端开发最佳实践指南',
    '深度解读：大语言模型的工作原理',
    'React 18新特性完全指南',
    '如何构建高性能的Web应用',
    'Python数据分析入门教程',
    '微服务架构设计模式',
    'DevOps实践手册',
  ]
  return titles.map((title, index) => ({
    id: index + 1,
    title,
    status: statuses[index % statuses.length],
    priority: Math.floor(Math.random() * 10) + 1,
    platform: platforms[index % platforms.length],
    scheduledTime: `2024-06-${30 - index} ${10 + index}:00:00`,
    publishTime: statuses[index % statuses.length] === 'PUBLISHED' ? `2024-06-${30 - index} ${10 + index}:30:00` : '-',
  }))
}

function handleSearch() {
  queryParams.page = 1
  pagination.current = 1
  loadQueue()
}

function handleReset() {
  queryParams.status = undefined
  queryParams.keyword = ''
  queryParams.page = 1
  pagination.current = 1
  loadQueue()
}

function filterByStatus(status: string) {
  queryParams.status = status
  handleSearch()
}

function handleTableChange(pag: any) {
  queryParams.page = pag.current
  queryParams.size = pag.pageSize
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadQueue()
}

function handlePublishNow(record: any) {
  Modal.confirm({
    title: '确认立即发布',
    content: `确定立即发布「${record.title}」吗？发布后将无法撤回。`,
    okText: '确定发布',
    cancelText: '取消',
    okType: 'primary',
    onOk: async () => {
      try {
        await publishQueueApi.publishNow(record.id)
        message.success('已触发立即发布')
        loadQueue()
        loadStats()
      } catch (error) {
        console.error(error)
        message.error('触发发布失败')
      }
    },
  })
}

function handleAdjustPriority(record: any) {
  currentPriorityRecord.value = record
  priorityValue.value = record.priority || 5
  priorityModalVisible.value = true
}

async function handlePriorityOk() {
  if (!currentPriorityRecord.value) return
  prioritySaving.value = true
  try {
    await publishQueueApi.adjustPriority(currentPriorityRecord.value.id, priorityValue.value)
    message.success('优先级已调整')
    priorityModalVisible.value = false
    loadQueue()
  } catch (error) {
    console.error(error)
    message.error('调整优先级失败')
  } finally {
    prioritySaving.value = false
  }
}

function handleRetry(record: any) {
  Modal.confirm({
    title: '确认重试',
    content: `确定重试发布「${record.title}」吗？`,
    okText: '确定重试',
    cancelText: '取消',
    onOk: async () => {
      try {
        await publishQueueApi.publishNow(record.id)
        message.success('已重新提交发布')
        loadQueue()
        loadStats()
      } catch (error) {
        console.error(error)
        message.error('重试失败')
      }
    },
  })
}

function handleCancel(record: any) {
  Modal.confirm({
    title: '确认取消发布',
    content: `确定取消发布「${record.title}」吗？取消后可重新发布。`,
    okText: '确定取消',
    cancelText: '继续发布',
    okType: 'danger',
    onOk: async () => {
      try {
        await publishQueueApi.cancel(record.id)
        message.success('已取消发布')
        loadQueue()
        loadStats()
      } catch (error) {
        console.error(error)
        message.error('取消失败')
      }
    },
  })
}

function handleViewDetail(record: any) {
  message.info(`查看详情：${record.title}`)
}

onMounted(() => {
  loadStats()
  loadQueue()
})
</script>

<style scoped lang="less">
.publish-queue-page {
  width: 100%;
  padding: 8px 0;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.stat-card-processing {
    :deep(.ant-statistic-title) {
      color: #1890ff;
    }
    :deep(.ant-statistic-content) {
      color: #1890ff;
    }
  }

  &.stat-card-blue {
    :deep(.ant-statistic-title) {
      color: #1677ff;
    }
    :deep(.ant-statistic-content) {
      color: #1677ff;
    }
  }

  &.stat-card-success {
    :deep(.ant-statistic-title) {
      color: #52c41a;
    }
    :deep(.ant-statistic-content) {
      color: #52c41a;
    }
  }

  &.stat-card-error {
    :deep(.ant-statistic-title) {
      color: #f5222d;
    }
    :deep(.ant-statistic-content) {
      color: #f5222d;
    }
  }
}

.priority-display {
  display: flex;
  align-items: center;
  gap: 8px;

  .priority-value {
    font-size: 13px;
    color: #666;
    font-weight: 500;
  }
}

.priority-modal-content {
  .priority-info {
    display: flex;
    align-items: flex-start;
    gap: 8px;

    .priority-label {
      color: #666;
      flex-shrink: 0;
    }

    .priority-title {
      font-weight: 500;
      color: #333;
    }
  }

  .priority-adjust {
    .priority-slider-label {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .priority-hint {
        font-size: 12px;
        color: #999;
      }
    }

    .priority-input-row {
      margin-top: 20px;
      display: flex;
      align-items: center;
      gap: 12px;

      .priority-input-label {
        color: #666;
      }
    }
  }
}
</style>
