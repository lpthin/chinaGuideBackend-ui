<template>
  <div class="audit-log">
    <PageTitle />
    <a-card :bordered="false">
      <!-- 筛选区 -->
      <FilterBar class="filter-form">
        <a-form-item label="客户归属">
          <a-select v-model:value="filterForm.tenantScope" style="width: 220px">
            <a-select-option value="all">按右上角所选客户（没选则全部）</a-select-option>
            <a-select-option value="unknown">只看归属未知</a-select-option>
          </a-select>
        </a-form-item>
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
        <template #actions>
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
        </template>
      </FilterBar>

      <!-- 统计卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="8">
          <a-statistic
            title="操作总数"
            :value="statsUnreadable ? '—' : stats.total"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="8">
          <a-statistic
            title="今日操作数"
            :value="statsUnreadable ? '—' : stats.todayTotal"
            :value-style="{ color: '#52c41a' }"
          >
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="8">
          <a-statistic
            title="异常操作"
            :value="statsUnreadable ? '—' : stats.errorCount"
            :value-style="{ color: '#ff4d4f' }"
          >
            <template #prefix><WarningOutlined /></template>
          </a-statistic>
        </a-col>
      </a-row>

      <!-- 三格统计与下面这张表不一定是同一个范围，界面要说在哪一格不摆数 -->
      <p v-if="statsRangeNotice" class="stats-note">
        {{ statsRangeNotice }}
        <a-button v-if="statsReadFailed" type="link" size="small" @click="fetchStats">重试</a-button>
      </p>

      <!-- 表格 -->
      <DataTable
        :scroll="{ x: 'max-content' }"
        :columns="columns"
        :data-source="logList"
        :pagination="pagination"
        :loading="loading"
        :error="readFailed"
        :retry="fetchLogs"
        :keep-stale-on-error="true"
        :stale-key="logContextKey"
        row-key="id"
        @change="handleTableChange"
      >
        <!-- 这一页没行的那一句只认后端（M-P69）：这一屏的空会被读成「这一家没人操作过」，
             所以「读不到」与「真的没有」必须由后端答，界面不改写。 -->
        <template #emptyText>
          <empty-list-hint
            :loading="loading"
            :read-failed="readFailed"
            :retry="fetchLogs"
            :empty-line="emptyLine"
            :empty-reason="emptyReason"
          />
        </template>
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
          <template v-if="column.key === 'tenantLabel'">
            {{ record.tenantLabel || '-' }}
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
      </DataTable>
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
        <a-descriptions-item label="客户归属">{{ currentLog.tenantLabel || '-' }}<span v-if="currentLog.tenantId !== null && currentLog.tenantId !== undefined">（编号 {{ currentLog.tenantId }}）</span></a-descriptions-item>
        <a-descriptions-item label="IP地址">{{ currentLog.ipAddress }}</a-descriptions-item>
        <a-descriptions-item label="浏览器/设备">{{ currentLog.userAgent }}</a-descriptions-item>
        <a-descriptions-item label="操作时间">{{ formatDateTime(currentLog.createdAt) }}</a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
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
import { describeHttpError } from '../../api/http'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import type { AuditLog, AuditLogQuery, AuditLogStats } from '../../types/workspace'
import { logError } from '../../utils/errorLog'
import EmptyListHint from '../../components/EmptyListHint.vue'
import {
  JUMP_BACK_NOTICE,
  asEmptyReason,
  shouldJumpBackToFirstPage,
  type EmptyReason
} from '../../utils/emptyPage'
import PageTitle from '../../components/PageTitle.vue'
import DataTable from '../../components/DataTable.vue'
import FilterBar from '../../components/FilterBar.vue'

const authStore = useAuthStore()

const loading = ref(false)
const detailDrawerVisible = ref(false)
const currentLog = ref<AuditLog | null>(null)
const logList = ref<AuditLog[]>([])
const emptyLine = ref('')
const emptyReason = ref<EmptyReason>(null)
const readFailed = ref('')
const statsReadFailed = ref('')

/** 「只看归属未知」那一档在后端只有一个名字：`tenantScope=unknown`。「按右上角所选客户」不发这一格。 */
const UNKNOWN_SCOPE = 'unknown'

const filterForm = reactive({
  tenantScope: 'all' as 'all' | 'unknown',
  action: undefined as string | undefined,
  resource: undefined as string | undefined,
  username: '',
  dateRange: [] as string[]
})

// 三格统计只按右上角那一家的记录算；读不到、读失败，或筛的是「归属未知」时都摆「—」，不把 0 念成结果
const statsUnreadable = computed(
  () =>
    emptyReason.value === 'NOT_VISIBLE' ||
    filterForm.tenantScope === UNKNOWN_SCOPE ||
    statsReadFailed.value !== ''
)

/** 这一口（/stats）认不了「归属未知」（拍板 Q-4 只点了列表口），所以这一档要说出为什么不摆数 */
const statsRangeNotice = computed(() => {
  if (filterForm.tenantScope === UNKNOWN_SCOPE) {
    return '上面三格只按右上角所选的那一家算，认不了「只看归属未知」这一档，所以这里不摆数；下面这张表才是筛过的。'
  }
  if (statsReadFailed.value !== '') {
    return `上面三格这一发读失败：${statsReadFailed.value}，不摆成 0。`
  }
  return ''
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

/**
 * M2：审计是「同一档里值钱的只读重数据」，刷新失败允许留上一次的行；
 * 但换客户 / 换筛选 / 翻页就是另一档了，旧行必须作废，不许端上来冒充这一档。
 */
const logContextKey = computed(() =>
  [
    authStore.selectedTenantId ?? '',
    filterForm.tenantScope,
    filterForm.action ?? '',
    filterForm.resource ?? '',
    filterForm.username,
    filterForm.dateRange.join(','),
    pagination.current ?? 1,
    pagination.pageSize ?? 10
  ].join('|')
)

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '操作', key: 'action', width: 100 },
  { title: '资源', key: 'resource', dataIndex: 'resource', width: 160 },
  { title: '请求方法', dataIndex: 'method', key: 'method', width: 100 },
  { title: '响应状态', key: 'responseStatus', dataIndex: 'responseStatus', width: 100 },
  { title: '操作人', dataIndex: 'username', key: 'username', width: 120 },
  // 这一格念的是后端算好的那四档（点名那一家／已注销／未知客户／未挂某一家），界面不拿裸号自己猜
  { title: '客户归属', dataIndex: 'tenantLabel', key: 'tenantLabel', width: 150 },
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
  'admin/tenants': '客户开通',
  'admin/sites': '站点清单',
  article: '文章列表',
  articles: '文章列表',
  cases: '内容案例',
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

/**
 * 屏幕上这一组筛选项拼成的那一份参数——列表、导出、以后的每一处都从这里取，不许两处各拼一套。
 *
 * 「只看归属未知」与右上角切换当前客户不搭界，所以那一档不带客户号：
 * 后端两个条件都拼上捞出来必然是空集，界面上就成了「明明一大批行没归属，筛一下就没了」。
 */
const buildFilterParams = (): AuditLogQuery => {
  const params: AuditLogQuery = {}
  if (filterForm.tenantScope === UNKNOWN_SCOPE) {
    params.tenantScope = UNKNOWN_SCOPE
  } else if (authStore.selectedTenantId) {
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
  return params
}

const fetchLogs = async () => {
  loading.value = true
  emptyLine.value = ''
  emptyReason.value = null
  readFailed.value = ''
  try {
    const params: AuditLogQuery & { page: number; size: number } = {
      page: pagination.current ?? 1,
      size: pagination.pageSize ?? 10,
      ...buildFilterParams()
    }

    const result = await adminApi.auditLogs.list(params) as any
    logList.value = result.records || []
    pagination.total = result.total || 0
    emptyLine.value = result.emptyLine || ''
    emptyReason.value = asEmptyReason(result.emptyReason)
    // 「这一页翻过了头」不是一句解释就完事：翻回第一页再读一遍，最多多发一发
    if (shouldJumpBackToFirstPage(emptyReason.value, pagination.current ?? 1)) {
      pagination.current = 1
      await fetchLogs()
      message.info(JUMP_BACK_NOTICE)
    }
  } catch (error: any) {
    readFailed.value = describeHttpError(error)
    message.error(`获取审计日志失败：${readFailed.value}`)
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  statsReadFailed.value = ''
  try {
    const result = await adminApi.auditLogs.getStats(authStore.selectedTenantId || undefined) as any
    Object.assign(stats, result)
  } catch (error: any) {
    // 读失败时这三格留着上一次的数（或开局那三个 0）都会被念成结果，所以记下这一发没读到
    statsReadFailed.value = describeHttpError(error)
    logError('workspace/audit-log-view', '获取统计数据失败:', error)
  }
}

const handleSearch = () => {
  pagination.current = 1
  fetchLogs()
}

const handleReset = () => {
  filterForm.tenantScope = 'all'
  filterForm.action = undefined
  filterForm.resource = undefined
  filterForm.username = ''
  filterForm.dateRange = []
  pagination.current = 1
  fetchLogs()
}

const handleExport = () => {
  try {
    // 屏幕上筛的是哪一份，导出来的就得是哪一份
    adminApi.auditLogs.export(buildFilterParams())
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

// 这一档与右上角切换客户是两条独立的腿，切到「只看归属未知」也要立刻重取，不能等人手点搜索
watch(
  () => filterForm.tenantScope,
  () => {
    pagination.current = 1
    fetchLogs()
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

  .stats-note {
    margin: -8px 0 16px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 13px;
  }
}

:deep(.ant-statistic-content) {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
