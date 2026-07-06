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
            <a-select-option value="login">登录</a-select-option>
            <a-select-option value="logout">登出</a-select-option>
            <a-select-option value="create">创建</a-select-option>
            <a-select-option value="update">更新</a-select-option>
            <a-select-option value="delete">删除</a-select-option>
            <a-select-option value="export">导出</a-select-option>
            <a-select-option value="import">导入</a-select-option>
            <a-select-option value="approve">审批</a-select-option>
            <a-select-option value="reject">驳回</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="操作模块">
          <a-select
            v-model:value="filterForm.module"
            placeholder="请选择操作模块"
            style="width: 150px"
            allowClear
          >
            <a-select-option value="user">用户管理</a-select-option>
            <a-select-option value="role">角色管理</a-select-option>
            <a-select-option value="permission">权限管理</a-select-option>
            <a-select-option value="article">文章管理</a-select-option>
            <a-select-option value="knowledge">知识库</a-select-option>
            <a-select-option value="system">系统设置</a-select-option>
            <a-select-option value="billing">计费管理</a-select-option>
            <a-select-option value="workflow">工作流</a-select-option>
          </a-select>
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
            <a-button @click="handleExport">
              <template #icon><DownloadOutlined /></template>
              导出
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 统计卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-statistic
            title="今日操作总数"
            :value="stats.todayTotal"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="登录次数"
            :value="stats.loginCount"
            :value-style="{ color: '#52c41a' }"
          >
            <template #prefix><LoginOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="异常操作"
            :value="stats.errorCount"
            :value-style="{ color: '#ff4d4f' }"
          >
            <template #prefix><WarningOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="敏感操作"
            :value="stats.sensitiveCount"
            :value-style="{ color: '#faad14' }"
          >
            <template #prefix><LockOutlined /></template>
          </a-statistic>
        </a-col>
      </a-row>

      <!-- 表格 -->
      <a-table
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
          <template v-if="column.key === 'module'">
            {{ getModuleName(record.module) }}
          </template>
          <template v-if="column.key === 'ip'">
            <a-typography-text copyable>{{ record.ip }}</a-typography-text>
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
        <a-descriptions-item label="操作模块">
          {{ getModuleName(currentLog.module) }}
        </a-descriptions-item>
        <a-descriptions-item label="操作详情">{{ currentLog.detail || '-' }}</a-descriptions-item>
        <a-descriptions-item label="操作人">{{ currentLog.username }}</a-descriptions-item>
        <a-descriptions-item label="用户ID">{{ currentLog.userId }}</a-descriptions-item>
        <a-descriptions-item label="租户ID">{{ currentLog.tenantId }}</a-descriptions-item>
        <a-descriptions-item label="IP地址">{{ currentLog.ip }}</a-descriptions-item>
        <a-descriptions-item label="浏览器/设备">{{ currentLog.userAgent }}</a-descriptions-item>
        <a-descriptions-item label="操作时间">{{ currentLog.createdAt }}</a-descriptions-item>
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
  LoginOutlined,
  WarningOutlined,
  LockOutlined
} from '@ant-design/icons-vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import { adminApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'
import type { AuditLog, AuditLogStats } from '../../types/workspace'

const authStore = useAuthStore()

const loading = ref(false)
const detailDrawerVisible = ref(false)
const currentLog = ref<AuditLog | null>(null)
const logList = ref<AuditLog[]>([])

const filterForm = reactive({
  action: undefined as string | undefined,
  module: undefined as string | undefined,
  username: '',
  dateRange: [] as string[]
})

const stats = reactive<AuditLogStats>({
  total: 0,
  todayTotal: 0,
  loginCount: 0,
  errorCount: 0,
  sensitiveCount: 0
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
  { title: '操作类型', key: 'action', width: 100 },
  { title: '操作模块', key: 'module', dataIndex: 'module', width: 120 },
  { title: '操作详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
  { title: '操作人', dataIndex: 'username', key: 'username', width: 120 },
  { title: 'IP地址', key: 'ip', dataIndex: 'ip', width: 140 },
  { title: '操作时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 100 }
]

const actionMap: Record<string, { name: string; color: string }> = {
  login: { name: '登录', color: 'blue' },
  logout: { name: '登出', color: 'default' },
  create: { name: '创建', color: 'green' },
  update: { name: '更新', color: 'cyan' },
  delete: { name: '删除', color: 'red' },
  export: { name: '导出', color: 'purple' },
  import: { name: '导入', color: 'orange' },
  approve: { name: '审批', color: 'success' },
  reject: { name: '驳回', color: 'error' }
}

const moduleMap: Record<string, string> = {
  user: '用户管理',
  role: '角色管理',
  permission: '权限管理',
  article: '文章管理',
  knowledge: '知识库',
  system: '系统设置',
  billing: '计费管理',
  workflow: '工作流'
}

const getActionColor = (action: string) => {
  return actionMap[action]?.color || 'default'
}

const getActionName = (action: string) => {
  return actionMap[action]?.name || action
}

const getModuleName = (module: string) => {
  return moduleMap[module] || module
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
    if (filterForm.module) {
      params.module = filterForm.module
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
  filterForm.module = undefined
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
    if (filterForm.module) {
      params.module = filterForm.module
    }
    if (filterForm.username) {
      params.username = filterForm.username
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }

    adminApi.auditLogs.export(params)
    message.success('导出任务已开始，请稍候...')
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
