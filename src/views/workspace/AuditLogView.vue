<template>
  <div class="audit-log">
    <a-card :bordered="false">
      <template #title>
        <h3>审计日志</h3>
      </template>

      <!-- 筛选区 -->
      <a-form layout="inline" :model="filterForm" class="filter-form">
        <a-form-item label="操作类型">
          <a-select
            v-model:value="filterForm.action"
            placeholder="请选择操作类型"
            style="width: 150px"
            allowClear
          >
            <a-select-option value="create">创建</a-select-option>
            <a-select-option value="update">更新</a-select-option>
            <a-select-option value="delete">删除</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="资源">
          <a-input
            v-model:value="filterForm.resource"
            placeholder="如 cases、admin/users"
            style="width: 150px"
            allowClear
          />
        </a-form-item>
        <a-form-item label="操作人">
          <a-input
            v-model:value="filterForm.username"
            placeholder="请输入操作人"
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
        <a-form-item class="toolbar-actions">
          <a-space>
            <a-button type="primary" :loading="loading" @click="handleSearch">
              <template #icon><SearchOutlined /></template>
              搜索
            </a-button>
            <a-button @click="handleReset">
              <template #icon><ReloadOutlined /></template>
              重置
            </a-button>
            <a-button @click="handleExport">
              <template #icon><DownloadOutlined /></template>
              导出
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 统计卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="8">
          <a-statistic
            title="操作总数"
            :value="stats.total"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="8">
          <a-statistic
            title="今日操作数"
            :value="stats.todayTotal"
            :value-style="{ color: '#52c41a' }"
          >
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="8">
          <a-statistic
            title="异常操作"
            :value="stats.errorCount"
            :value-style="{ color: '#ff4d4f' }"
          >
            <template #prefix><WarningOutlined /></template>
          </a-statistic>
        </a-col>
      </a-row>

      <!-- 表格 -->
      <a-table
        :scroll="{ x: 'max-content' }"
        :columns="columns"
        :data-source="logList"
        :pagination="pagination"
        :loading="loading"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <a-tag :color="getActionColor(record.action)">
              {{ getActionName(record.action) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'resource'">
            <a-tooltip :title="record.resource">
              {{ resourceMap[record.resource] || record.resource }}
            </a-tooltip>
          </template>
          <template v-if="column.key === 'ipAddress'">
            <a-typography-text copyable>{{ record.ipAddress }}</a-typography-text>
          </template>
          <template v-if="column.key === 'responseStatus'">
            <a-tag :color="String(record.responseStatus || '').startsWith('2') ? 'success' : 'error'">
              {{ record.responseStatus || '-' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-if="column.key === 'actions'">
            <a-button type="link" size="small" @click="viewDetail(record)">
              详情
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="detailDrawerVisible"
      title="日志详情"
      placement="right"
      :width="600"
    >
      <a-descriptions v-if="currentLog" :column="1" bordered>
        <a-descriptions-item label="操作类型">
          <a-tag :color="getActionColor(currentLog.action)">
            {{ getActionName(currentLog.action) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="资源">
          {{ currentLog.resource || '-' }}
          <span v-if="currentLog.resourceId">（ID: {{ currentLog.resourceId }}）</span>
        </a-descriptions-item>
        <a-descriptions-item label="请求方法">{{ currentLog.method || '-' }}</a-descriptions-item>
        <a-descriptions-item label="请求参数">{{ currentLog.requestParams || '-' }}</a-descriptions-item>
        <a-descriptions-item label="响应状态">{{ currentLog.responseStatus || '-' }}</a-descriptions-item>
        <a-descriptions-item label="耗时">
          {{ currentLog.duration === null || currentLog.duration === undefined ? '-' : currentLog.duration + ' ms' }}
        </a-descriptions-item>
        <a-descriptions-item label="错误信息">{{ currentLog.errorMessage || '-' }}</a-descriptions-item>
        <a-descriptions-item label="操作人">{{ currentLog.username }}</a-descriptions-item>
        <a-descriptions-item label="用户ID">{{ currentLog.userId }}</a-descriptions-item>
        <a-descriptions-item label="租户ID">{{ currentLog.tenantId }}</a-descriptions-item>
        <a-descriptions-item label="IP地址">{{ currentLog.ipAddress }}</a-descriptions-item>
        <a-descriptions-item label="浏览器/设备">{{ currentLog.userAgent }}</a-descriptions-item>
        <a-descriptions-item label="操作时间">{{ formatDateTime(currentLog.createdAt) }}</a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  WarningOutlined
} from '@ant-design/icons-vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import { adminApi } from '../../api/workspace'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import type { AuditLog, AuditLogStats } from '../../types/workspace'

const authStore = useAuthStore()

const loading = ref(false)
const detailDrawerVisible = ref(false)
const currentLog = ref<AuditLog | null>(null)
const logList = ref<AuditLog[]>([])

const filterForm = reactive({
  action: undefined as string | undefined,
  resource: undefined as string | undefined,
  username: '',
  dateRange: [] as string[]
})

const stats = reactive<AuditLogStats>({
  total: 0,
  todayTotal: 0,
  errorCount: 0
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
  { title: '操作', key: 'action', width: 100 },
  { title: '资源', key: 'resource', dataIndex: 'resource', width: 160 },
  { title: '请求方法', dataIndex: 'method', key: 'method', width: 100 },
  { title: '响应状态', key: 'responseStatus', dataIndex: 'responseStatus', width: 100 },
  { title: '操作人', dataIndex: 'username', key: 'username', width: 120 },
  { title: 'IP地址', key: 'ipAddress', dataIndex: 'ipAddress', width: 140 },
  { title: '操作时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 100 }
]

const actionMap: Record<string, { name: string; color: string }> = {
  create: { name: '创建', color: 'green' },
  update: { name: '更新', color: 'cyan' },
  delete: { name: '删除', color: 'red' }
}

// 资源名直接来自请求路径，只给常见的几段配上中文；未命中的原样展示路径片段
const resourceMap: Record<string, string> = {
  'admin/users': '用户管理',
  'admin/roles': '角色管理',
  'admin/permissions': '权限管理',
  'admin/tenants': '租户管理',
  'admin/sites': '站点管理',
  article: '文章管理',
  articles: '文章管理',
  cases: '案例管理',
  knowledge: '知识库',
  billing: '计费管理',
  user: '个人中心'
}

const getActionColor = (action: string) => {
  return actionMap[action]?.color || 'default'
}

const getActionName = (action: string) => {
  return actionMap[action]?.name || action
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      size: pagination.pageSize
    }

    if (authStore.selectedTenantId) {
      params.tenantId = authStore.selectedTenantId
    }

    if (filterForm.action) {
      params.action = filterForm.action
    }
    if (filterForm.resource) {
      params.resource = filterForm.resource
    }
    if (filterForm.username) {
      params.username = filterForm.username
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }

    const result = await adminApi.auditLogs.list(params) as any
    logList.value = result.records || []
    pagination.total = result.total || 0
  } catch (error: any) {
    message.error(error.message || '获取审计日志失败')
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    const result = await adminApi.auditLogs.getStats(authStore.selectedTenantId || undefined) as any
    Object.assign(stats, result)
  } catch (error: any) {
    console.error('获取统计数据失败:', error)
  }
}

const handleSearch = () => {
  pagination.current = 1
  fetchLogs()
}

const handleReset = () => {
  filterForm.action = undefined
  filterForm.resource = undefined
  filterForm.username = ''
  filterForm.dateRange = []
  pagination.current = 1
  fetchLogs()
}

const handleExport = () => {
  try {
    const params: any = {}

    if (authStore.selectedTenantId) {
      params.tenantId = authStore.selectedTenantId
    }
    if (filterForm.action) {
      params.action = filterForm.action
    }
    if (filterForm.resource) {
      params.resource = filterForm.resource
    }
    if (filterForm.username) {
      params.username = filterForm.username
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }

    adminApi.auditLogs.export(params)
    message.success('已开始下载，请留意浏览器下载列表')
  } catch (error: any) {
    message.error(error.message || '导出失败')
  }
}

const handleTableChange = (pag: TablePaginationConfig) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchLogs()
}

const viewDetail = (record: AuditLog) => {
  currentLog.value = record
  detailDrawerVisible.value = true
}

watch(
  () => authStore.selectedTenantId,
  () => {
    pagination.current = 1
    fetchLogs()
    fetchStats()
  }
)

onMounted(() => {
  fetchLogs()
  fetchStats()
})
</script>

<style scoped lang="less">
.audit-log {

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
