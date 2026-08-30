<template>
  <div class="alert-record">
    <a-card :bordered="false">
      <template #title>
        <h3>报警记录</h3>
      </template>

      <!-- 统计卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-statistic
            title="报警总数"
            :value="stats.total"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="今日报警"
            :value="stats.todayCount"
            :value-style="{ color: '#faad14' }"
          >
            <template #prefix><ClockCircleOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="待处理"
            :value="stats.pendingCount"
            :value-style="{ color: '#ff4d4f' }"
          >
            <template #prefix><ExclamationCircleOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="处理中"
            :value="stats.processingCount"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix><SyncOutlined /></template>
          </a-statistic>
        </a-col>
      </a-row>

      <!-- 严重级别统计 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-statistic
            title="低危"
            :value="stats.lowCount"
            :value-style="{ color: '#52c41a' }"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="中危"
            :value="stats.mediumCount"
            :value-style="{ color: '#1890ff' }"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="高危"
            :value="stats.highCount"
            :value-style="{ color: '#faad14' }"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="严重"
            :value="stats.criticalCount"
            :value-style="{ color: '#ff4d4f' }"
          />
        </a-col>
      </a-row>

      <!-- 筛选区 -->
      <a-form layout="inline" :model="filterForm" class="filter-form">
        <a-form-item label="严重级别">
          <a-select
            v-model:value="filterForm.severity"
            placeholder="请选择严重级别"
            style="width: 150px"
            allowClear
          >
            <a-select-option value="low">低</a-select-option>
            <a-select-option value="medium">中</a-select-option>
            <a-select-option value="high">高</a-select-option>
            <a-select-option value="critical">严重</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select
            v-model:value="filterForm.status"
            placeholder="请选择状态"
            style="width: 150px"
            allowClear
          >
            <a-select-option value="pending">待处理</a-select-option>
            <a-select-option value="processing">处理中</a-select-option>
            <a-select-option value="resolved">已解决</a-select-option>
            <a-select-option value="ignored">已忽略</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="规则ID">
          <a-input
            v-model:value="filterForm.ruleId"
            placeholder="请输入规则ID"
            style="width: 150px"
          />
        </a-form-item>
        <a-form-item label="时间范围">
          <a-range-picker
            v-model:value="filterForm.dateRange"
            style="width: 280px"
            value-format="YYYY-MM-DD"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" :loading="loading" @click="handleSearch">
              <template #icon><SearchOutlined /></template>
              搜索
            </a-button>
            <a-button @click="handleReset">
              <template #icon><ReloadOutlined /></template>
              重置
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 表格 -->
      <a-table
        :columns="columns"
        :data-source="recordList"
        :pagination="pagination"
        :loading="loading"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'severity'">
            <a-tag :color="getSeverityColor(record.severity)">
              {{ getSeverityName(record.severity) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusName(record.status) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="viewDetail(record)">
                详情
              </a-button>
              <a-dropdown>
                <a-button type="link" size="small">
                  更新状态
                  <template #icon><DownOutlined /></template>
                </a-button>
                <template #overlay>
                  <a-menu @click="({ key }: { key: string }) => handleUpdateStatus(record, key)">
                    <a-menu-item key="pending">待处理</a-menu-item>
                    <a-menu-item key="processing">处理中</a-menu-item>
                    <a-menu-item key="resolved">已解决</a-menu-item>
                    <a-menu-item key="ignored">已忽略</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="detailDrawerVisible"
      title="报警详情"
      placement="right"
      :width="600"
    >
      <a-descriptions v-if="currentRecord" :column="1" bordered>
        <a-descriptions-item label="标题">
          {{ currentRecord.title }}
        </a-descriptions-item>
        <a-descriptions-item label="严重级别">
          <a-tag :color="getSeverityColor(currentRecord.severity)">
            {{ getSeverityName(currentRecord.severity) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="getStatusColor(currentRecord.status)">
            {{ getStatusName(currentRecord.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="规则ID">
          {{ currentRecord.ruleId }}
        </a-descriptions-item>
        <a-descriptions-item label="请求路径">
          {{ currentRecord.requestPath || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="Trace ID">
          <a-typography-text v-if="currentRecord.traceId" copyable>
            {{ currentRecord.traceId }}
          </a-typography-text>
          <span v-else>-</span>
        </a-descriptions-item>
        <a-descriptions-item label="用户ID">
          {{ currentRecord.userId || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="触发时间">
          {{ currentRecord.triggeredAt }}
        </a-descriptions-item>
        <a-descriptions-item label="解决时间">
          {{ currentRecord.resolvedAt || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="报警内容">
          <div style="white-space: pre-wrap; word-break: break-all;">
            {{ currentRecord.content }}
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="元数据" v-if="currentRecord.metadata">
          <div style="white-space: pre-wrap; word-break: break-all;">
            {{ JSON.stringify(currentRecord.metadata, null, 2) }}
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="创建时间">
          {{ currentRecord.createdAt }}
        </a-descriptions-item>
      </a-descriptions>
      <div v-if="currentRecord" style="margin-top: 24px">
        <a-space>
          <a-select
            v-model:value="updateStatusValue"
            placeholder="更新状态"
            style="width: 150px"
          >
            <a-select-option value="pending">待处理</a-select-option>
            <a-select-option value="processing">处理中</a-select-option>
            <a-select-option value="resolved">已解决</a-select-option>
            <a-select-option value="ignored">已忽略</a-select-option>
          </a-select>
          <a-button type="primary" :loading="statusUpdateLoading" @click="handleStatusUpdate">
            确认更新
          </a-button>
        </a-space>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  DownOutlined
} from '@ant-design/icons-vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import { alertApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'
import type { AlertRecord, AlertRecordStats } from '../../types/workspace'

const authStore = useAuthStore()

const loading = ref(false)
const statusUpdateLoading = ref(false)
const detailDrawerVisible = ref(false)
const currentRecord = ref<AlertRecord | null>(null)
const recordList = ref<AlertRecord[]>([])
const updateStatusValue = ref<string>('')

const filterForm = reactive({
  severity: undefined as string | undefined,
  status: undefined as string | undefined,
  ruleId: '',
  dateRange: [] as string[]
})

const stats = reactive<AlertRecordStats>({
  total: 0,
  todayCount: 0,
  pendingCount: 0,
  processingCount: 0,
  lowCount: 0,
  mediumCount: 0,
  highCount: 0,
  criticalCount: 0
})

const pagination = reactive<TablePaginationConfig>({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total) => `共 ${total} 条`
})

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '严重级别', key: 'severity', dataIndex: 'severity', width: 100 },
  { title: '状态', key: 'status', dataIndex: 'status', width: 100 },
  { title: '请求路径', dataIndex: 'requestPath', key: 'requestPath', ellipsis: true },
  { title: '触发时间', dataIndex: 'triggeredAt', key: 'triggeredAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 180 }
]

const severityMap: Record<string, { name: string; color: string }> = {
  low: { name: '低', color: 'green' },
  medium: { name: '中', color: 'blue' },
  high: { name: '高', color: 'orange' },
  critical: { name: '严重', color: 'red' }
}

const statusMap: Record<string, { name: string; color: string }> = {
  pending: { name: '待处理', color: 'red' },
  processing: { name: '处理中', color: 'blue' },
  resolved: { name: '已解决', color: 'green' },
  ignored: { name: '已忽略', color: 'default' }
}

const getSeverityName = (severity: string) => {
  return severityMap[severity]?.name || severity
}

const getSeverityColor = (severity: string) => {
  return severityMap[severity]?.color || 'default'
}

const getStatusName = (status: string) => {
  return statusMap[status]?.name || status
}

const getStatusColor = (status: string) => {
  return statusMap[status]?.color || 'default'
}

const fetchRecords = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      size: pagination.pageSize
    }

    if (authStore.selectedTenantId) {
      params.tenantId = authStore.selectedTenantId
    }

    if (filterForm.severity) {
      params.severity = filterForm.severity
    }
    if (filterForm.status) {
      params.status = filterForm.status
    }
    if (filterForm.ruleId) {
      params.ruleId = filterForm.ruleId
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }

    const result = await alertApi.records.list(params) as any
    recordList.value = result.records || []
    pagination.total = result.total || 0
  } catch (error: any) {
    message.error(error.message || '获取报警记录失败')
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    const result = await alertApi.records.getStats(authStore.selectedTenantId || undefined) as any
    Object.assign(stats, result)
  } catch (error: any) {
    console.error('获取统计数据失败:', error)
  }
}

const handleSearch = () => {
  pagination.current = 1
  fetchRecords()
}

const handleReset = () => {
  filterForm.severity = undefined
  filterForm.status = undefined
  filterForm.ruleId = ''
  filterForm.dateRange = []
  pagination.current = 1
  fetchRecords()
}

const handleTableChange = (pag: TablePaginationConfig) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchRecords()
}

const viewDetail = (record: AlertRecord) => {
  currentRecord.value = record
  updateStatusValue.value = record.status
  detailDrawerVisible.value = true
}

const handleUpdateStatus = async (record: AlertRecord, status: string) => {
  try {
    await alertApi.records.updateStatus(record.id, status)
    message.success('状态更新成功')
    record.status = status as AlertRecord['status']
    fetchStats()
  } catch (error: any) {
    message.error(error.message || '状态更新失败')
  }
}

const handleStatusUpdate = async () => {
  if (!currentRecord.value || !updateStatusValue.value) {
    message.warning('请选择状态')
    return
  }
  statusUpdateLoading.value = true
  try {
    await alertApi.records.updateStatus(currentRecord.value.id, updateStatusValue.value)
    message.success('状态更新成功')
    currentRecord.value.status = updateStatusValue.value as AlertRecord['status']
    fetchRecords()
    fetchStats()
  } catch (error: any) {
    message.error(error.message || '状态更新失败')
  } finally {
    statusUpdateLoading.value = false
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    pagination.current = 1
    fetchRecords()
    fetchStats()
  }
)

onMounted(() => {
  fetchRecords()
  fetchStats()
})
</script>

<style scoped lang="less">
.alert-record {
  padding: 24px;

  h3 {
    margin: 0 0 20px;
    font-size: 18px;
    font-weight: 600;
  }

  .filter-form {
    margin-bottom: 24px;
    padding: 16px;
    background: #fafafa;
    border-radius: 8px;
  }
}

:deep(.ant-statistic-content) {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
