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
            v-model:value="filterForm.actionType"
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
            v-model:value="filterForm.operator"
            placeholder="请输入操作人"
            style="width: 150px"
          />
        </a-form-item>
        <a-form-item label="时间范围">
          <a-range-picker
            v-model:value="filterForm.dateRange"
            style="width: 280px"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch">
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
          <template v-if="column.key === 'actionType'">
            <a-tag :color="getActionTypeColor(record.actionType)">
              {{ getActionTypeName(record.actionType) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'module'">
            {{ getModuleName(record.module) }}
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'success' ? 'success' : 'error'">
              {{ record.status === 'success' ? '成功' : '失败' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'ipAddress'">
            <a-typography-text copyable>{{ record.ipAddress }}</a-typography-text>
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
          <a-tag :color="getActionTypeColor(currentLog.actionType)">
            {{ getActionTypeName(currentLog.actionType) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="操作模块">
          {{ getModuleName(currentLog.module) }}
        </a-descriptions-item>
        <a-descriptions-item label="操作描述">{{ currentLog.action }}</a-descriptions-item>
        <a-descriptions-item label="操作人">{{ currentLog.operator }}</a-descriptions-item>
        <a-descriptions-item label="操作角色">{{ currentLog.role }}</a-descriptions-item>
        <a-descriptions-item label="操作状态">
          <a-tag :color="currentLog.status === 'success' ? 'success' : 'error'">
            {{ currentLog.status === 'success' ? '成功' : '失败' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="IP地址">{{ currentLog.ipAddress }}</a-descriptions-item>
        <a-descriptions-item label="地理位置">{{ currentLog.location }}</a-descriptions-item>
        <a-descriptions-item label="浏览器/设备">{{ currentLog.userAgent }}</a-descriptions-item>
        <a-descriptions-item label="操作时间">{{ currentLog.createdAt }}</a-descriptions-item>
        <a-descriptions-item label="请求方法">{{ currentLog.requestMethod }}</a-descriptions-item>
        <a-descriptions-item label="请求路径">{{ currentLog.requestUrl }}</a-descriptions-item>
        <a-descriptions-item v-if="currentLog.params" label="请求参数">
          <pre class="json-display">{{ formatJson(currentLog.params) }}</pre>
        </a-descriptions-item>
        <a-descriptions-item v-if="currentLog.result" label="返回结果">
          <pre class="json-display">{{ formatJson(currentLog.result) }}</pre>
        </a-descriptions-item>
        <a-descriptions-item v-if="currentLog.errorMessage" label="错误信息">
          <p class="error-message">{{ currentLog.errorMessage }}</p>
        </a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
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

interface LogItem {
  id: number
  actionType: string
  module: string
  action: string
  operator: string
  role: string
  status: string
  ipAddress: string
  location: string
  userAgent: string
  createdAt: string
  requestMethod: string
  requestUrl: string
  params?: string
  result?: string
  errorMessage?: string
}

const loading = ref(false)
const detailDrawerVisible = ref(false)
const currentLog = ref<LogItem | null>(null)

const filterForm = reactive({
  actionType: undefined as string | undefined,
  module: undefined as string | undefined,
  operator: '',
  dateRange: [] as any[]
})

const stats = reactive({
  todayTotal: 128,
  loginCount: 45,
  errorCount: 3,
  sensitiveCount: 12
})

const pagination = reactive<TablePaginationConfig>({
  current: 1,
  pageSize: 10,
  total: 100,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total) => `共 ${total} 条`
})

const logList = ref<LogItem[]>([
  {
    id: 1,
    actionType: 'login',
    module: 'user',
    action: '用户登录',
    operator: '张三',
    role: '管理员',
    status: 'success',
    ipAddress: '192.168.1.100',
    location: '北京市朝阳区',
    userAgent: 'Chrome 120.0 / Windows 10',
    createdAt: '2024-01-15 09:30:25',
    requestMethod: 'POST',
    requestUrl: '/api/auth/login'
  },
  {
    id: 2,
    actionType: 'create',
    module: 'article',
    action: '创建文章',
    operator: '李四',
    role: '内容编辑',
    status: 'success',
    ipAddress: '192.168.1.101',
    location: '上海市浦东新区',
    userAgent: 'Firefox 121.0 / Mac OS X',
    createdAt: '2024-01-15 10:15:33',
    requestMethod: 'POST',
    requestUrl: '/api/articles',
    params: '{"title":"AI技术发展趋势","content":"..."}'
  },
  {
    id: 3,
    actionType: 'update',
    module: 'user',
    action: '更新用户信息',
    operator: '王五',
    role: '用户',
    status: 'success',
    ipAddress: '192.168.1.102',
    location: '广州市天河区',
    userAgent: 'Safari 17.0 / iOS 17',
    createdAt: '2024-01-15 11:20:45',
    requestMethod: 'PUT',
    requestUrl: '/api/users/123'
  },
  {
    id: 4,
    actionType: 'delete',
    module: 'knowledge',
    action: '删除知识卡片',
    operator: '张三',
    role: '管理员',
    status: 'success',
    ipAddress: '192.168.1.100',
    location: '北京市朝阳区',
    userAgent: 'Chrome 120.0 / Windows 10',
    createdAt: '2024-01-15 14:30:00',
    requestMethod: 'DELETE',
    requestUrl: '/api/knowledge/cards/456'
  },
  {
    id: 5,
    actionType: 'login',
    module: 'user',
    action: '用户登录失败',
    operator: 'anonymous',
    role: '匿名',
    status: 'failed',
    ipAddress: '10.0.0.1',
    location: '未知',
    userAgent: 'Unknown',
    createdAt: '2024-01-15 15:00:12',
    requestMethod: 'POST',
    requestUrl: '/api/auth/login',
    errorMessage: '用户名或密码错误'
  },
  {
    id: 6,
    actionType: 'export',
    module: 'article',
    action: '导出文章列表',
    operator: '李四',
    role: '内容编辑',
    status: 'success',
    ipAddress: '192.168.1.101',
    location: '上海市浦东新区',
    userAgent: 'Firefox 121.0 / Mac OS X',
    createdAt: '2024-01-15 15:30:45',
    requestMethod: 'GET',
    requestUrl: '/api/articles/export'
  },
  {
    id: 7,
    actionType: 'approve',
    module: 'workflow',
    action: '审批文章发布',
    operator: '张三',
    role: '管理员',
    status: 'success',
    ipAddress: '192.168.1.100',
    location: '北京市朝阳区',
    userAgent: 'Chrome 120.0 / Windows 10',
    createdAt: '2024-01-15 16:00:00',
    requestMethod: 'POST',
    requestUrl: '/api/workflow/approve/789'
  },
  {
    id: 8,
    actionType: 'update',
    module: 'system',
    action: '修改系统设置',
    operator: '张三',
    role: '管理员',
    status: 'success',
    ipAddress: '192.168.1.100',
    location: '北京市朝阳区',
    userAgent: 'Chrome 120.0 / Windows 10',
    createdAt: '2024-01-15 16:30:22',
    requestMethod: 'PUT',
    requestUrl: '/api/system/settings'
  },
  {
    id: 9,
    actionType: 'logout',
    module: 'user',
    action: '用户登出',
    operator: '王五',
    role: '用户',
    status: 'success',
    ipAddress: '192.168.1.102',
    location: '广州市天河区',
    userAgent: 'Safari 17.0 / iOS 17',
    createdAt: '2024-01-15 17:00:00',
    requestMethod: 'POST',
    requestUrl: '/api/auth/logout'
  },
  {
    id: 10,
    actionType: 'login',
    module: 'user',
    action: '用户登录',
    operator: '李四',
    role: '内容编辑',
    status: 'success',
    ipAddress: '192.168.1.101',
    location: '上海市浦东新区',
    userAgent: 'Firefox 121.0 / Mac OS X',
    createdAt: '2024-01-15 17:30:00',
    requestMethod: 'POST',
    requestUrl: '/api/auth/login'
  }
])

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '操作类型', key: 'actionType', width: 100 },
  { title: '操作模块', key: 'module', width: 120 },
  { title: '操作描述', dataIndex: 'action', key: 'action', ellipsis: true },
  { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
  { title: '状态', key: 'status', width: 80 },
  { title: 'IP地址', key: 'ipAddress', width: 140 },
  { title: '地理位置', dataIndex: 'location', key: 'location', width: 150 },
  { title: '操作时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 100 }
]

const actionTypeMap: Record<string, { name: string; color: string }> = {
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

const getActionTypeColor = (type: string) => {
  return actionTypeMap[type]?.color || 'default'
}

const getActionTypeName = (type: string) => {
  return actionTypeMap[type]?.name || type
}

const getModuleName = (module: string) => {
  return moduleMap[module] || module
}

const formatJson = (jsonStr: string) => {
  try {
    return JSON.stringify(JSON.parse(jsonStr), null, 2)
  } catch {
    return jsonStr
  }
}

const handleSearch = () => {
  loading.value = true
  setTimeout(() => {
    message.success('搜索完成')
    loading.value = false
  }, 500)
}

const handleReset = () => {
  filterForm.actionType = undefined
  filterForm.module = undefined
  filterForm.operator = ''
  filterForm.dateRange = []
  pagination.current = 1
  handleSearch()
}

const handleExport = () => {
  message.info('正在导出日志...')
  setTimeout(() => {
    message.success('日志导出成功')
  }, 1000)
}

const handleTableChange = (pag: TablePaginationConfig) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  handleSearch()
}

const viewDetail = (record: LogItem) => {
  currentLog.value = record
  detailDrawerVisible.value = true
}
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

  .json-display {
    margin: 0;
    padding: 12px;
    background: #f5f5f5;
    border-radius: 4px;
    font-size: 12px;
    font-family: 'Monaco', 'Consolas', monospace;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .error-message {
    margin: 0;
    padding: 12px;
    background: #fff2f0;
    border: 1px solid #ffccc7;
    border-radius: 4px;
    color: #ff4d4f;
  }
}

:deep(.ant-statistic-content) {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>