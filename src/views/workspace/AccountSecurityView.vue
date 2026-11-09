<template>
  <div class="account-security">
    <PageTitle />
    <a-card :bordered="false">
      <a-tabs :active-key="activeTab" @update:active-key="onTabChange">
        <a-tab-pane key="login">
          <template #tab>
            <span><SafetyOutlined /> 登录记录</span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="switch">
          <template #tab>
            <span><SwapOutlined /> 超管进客户视角</span>
          </template>
        </a-tab-pane>
      </a-tabs>

      <!--
        这一屏的客户范围只认下面这个下拉（拍板 Q-2）。右上角那个全局切换器在这里不生效：
        后端那两口把「全部客户」当一档真值发（`tenantScope=all`），要是让请求头替它收窄，
        选「全部客户」却只回一家，就是 M-P101／M-P105 那一族「没选客户仍查第一家」的形状。
      -->
      <a-alert
        type="info"
        show-icon
        message="这一屏按下面这个客户下拉筛，和右上角切换当前客户无关"
        description="「全部客户」是所有客户混着看；「归属未知」是那些没挂上任何一家的留痕（已注销或库里认不出的客户号也只能在这种档里看见）。"
        style="margin-bottom: 16px"
      />

      <filter-bar>
        <a-select
          v-model:value="filterForm.tenantOption"
          style="width: 220px"
          :loading="tenantsLoading"
        >
          <a-select-option :value="ALL_TENANTS">全部客户</a-select-option>
          <a-select-option v-for="tenant in tenantOptions" :key="tenant.id" :value="tenant.id">
            {{ tenant.name }}
          </a-select-option>
          <a-select-option :value="UNKNOWN_TENANTS">归属未知</a-select-option>
        </a-select>
        <a-range-picker
          v-model:value="filterForm.dateRange"
          style="width: 260px"
          value-format="YYYY-MM-DD"
        />
        <a-input
          v-model:value="filterForm.username"
          placeholder="账号名"
          style="width: 150px"
          allowClear
        />
        <a-select
          v-if="activeTab === 'login'"
          v-model:value="filterForm.status"
          placeholder="结果"
          style="width: 120px"
          allowClear
        >
          <a-select-option value="success">成功</a-select-option>
          <a-select-option value="failed">失败</a-select-option>
        </a-select>
        <span v-if="tenantsReadFailed" class="tenant-list-failed">
          客户名单读失败：只认「全部客户」和「归属未知」两档
          <a-button type="link" size="small" @click="fetchTenants">重试</a-button>
        </span>

        <template #actions>
          <a-space>
            <a-button type="primary" :loading="currentTable.loading" :disabled="currentTable.loading" @click="handleSearch">
              <template #icon><SearchOutlined /></template>
              查询
            </a-button>
            <a-button @click="handleReset">
              <template #icon><ReloadOutlined /></template>
              重置
            </a-button>
          </a-space>
        </template>
      </filter-bar>

      <DataTable
        v-if="activeTab === 'login'"
        :scroll="{ x: 'max-content' }"
        :columns="loginColumns"
        :data-source="loginTable.records"
        :pagination="loginPagination"
        :loading="loginTable.loading"
        row-key="id"
        @change="onLoginTableChange"
      >
        <!--
          这一格没行的那一句只认后端（M-P110 判据 5）：这一屏是按客户筛的，空表最容易读成
          「这一家没登录过」，而它同时可能是点了一个认不出来的客户号，或者是那一页翻过了头。
          这一屏两口全只读，没有新建动作，所以不给空态摆新建按钮。
        -->
        <template #emptyText>
          <empty-list-hint
            :loading="loginTable.loading"
            :read-failed="loginTable.readFailed"
            :retry="() => fetchTab('login')"
            :empty-line="loginTable.emptyLine"
            :empty-reason="loginTable.emptyReason"
          />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'success' ? 'success' : 'error'">
              {{ record.status === 'success' ? '成功' : '失败' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'failReason'">
            {{ record.failReason || '-' }}
          </template>
          <template v-if="column.key === 'createTime'">
            {{ formatDateTime(record.createTime) }}
          </template>
          <template v-if="column.key === 'userAgent'">
            <a-tooltip :title="record.userAgent">
              <span class="user-agent">{{ record.userAgent || '-' }}</span>
            </a-tooltip>
          </template>
        </template>
      </DataTable>

      <DataTable
        v-else
        :scroll="{ x: 'max-content' }"
        :columns="switchColumns"
        :data-source="switchTable.records"
        :pagination="switchPagination"
        :loading="switchTable.loading"
        row-key="id"
        @change="onSwitchTableChange"
      >
        <template #emptyText>
          <empty-list-hint
            :loading="switchTable.loading"
            :read-failed="switchTable.readFailed"
            :retry="() => fetchTab('switch')"
            :empty-line="switchTable.emptyLine"
            :empty-reason="switchTable.emptyReason"
          />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-if="column.key === 'userAgent'">
            <a-tooltip :title="record.userAgent">
              <span class="user-agent">{{ record.userAgent || '-' }}</span>
            </a-tooltip>
          </template>
        </template>
      </DataTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import {
  ReloadOutlined,
  SearchOutlined,
  SafetyOutlined,
  SwapOutlined
} from '@ant-design/icons-vue'
import { adminApi, tenantApi } from '../../api/workspace'
import { describeHttpError } from '../../api/http'
import { formatDateTime } from '../../utils/format'
import EmptyListHint from '../../components/EmptyListHint.vue'
import FilterBar from '../../components/FilterBar.vue'
import DataTable from '../../components/DataTable.vue'
import PageTitle from '../../components/PageTitle.vue'
import { useTenantReadGuard } from '../../utils/latestRead'
import {
  JUMP_BACK_NOTICE,
  asEmptyReason,
  shouldJumpBackToFirstPage,
  type EmptyReason
} from '../../utils/emptyPage'
import type {
  AccountSecurityTenantScope,
  LoginLog,
  Tenant,
  TenantSwitchLog
} from '../../types/workspace'

/**
 * 超管专用的「账号安全」（M-P110 拍板 Q-1：一个菜单项，页内两个标签）。
 *
 * 两张表都是只读留痕，界面上没有任何写动作。「超管进客户视角」那一格的话术钉死成
 * 「超级管理员进过哪一家」——库里写这一张表的只有超管一个账号，写成「所有人的切换」就是谎报。
 */

const route = useRoute()
const router = useRouter()

const VALID_TABS = ['login', 'switch'] as const
type TabKey = (typeof VALID_TABS)[number]

const tabFromQuery = (value: unknown): TabKey =>
  VALID_TABS.includes(value as TabKey) ? (value as TabKey) : 'login'
const activeTab = ref<TabKey>(tabFromQuery(route.query.tab))

/** 屏内下拉的三档（拍板 Q-2）用两个不可能撞车的号当档位值，剩下真号就是「某一家」 */
const ALL_TENANTS = -1
const UNKNOWN_TENANTS = -2

const filterForm = reactive({
  tenantOption: ALL_TENANTS as number,
  dateRange: [] as string[],
  username: '',
  status: undefined as string | undefined
})

const tenantOptions = ref<Tenant[]>([])
const tenantsLoading = ref(false)
const tenantsReadFailed = ref(false)

interface TabState {
  records: Array<LoginLog & TenantSwitchLog>
  total: number
  current: number
  pageSize: number
  loading: boolean
  emptyLine: string
  emptyReason: EmptyReason
  readFailed: string
}

const newTabState = (): TabState => ({
  records: [],
  total: 0,
  current: 1,
  pageSize: 20,
  loading: false,
  emptyLine: '',
  emptyReason: null,
  readFailed: ''
})

const loginTable = reactive<TabState>(newTabState())
const switchTable = reactive<TabState>(newTabState())

const currentTable = computed(() => (activeTab.value === 'login' ? loginTable : switchTable))

const loginPagination = computed(() => toPagination(loginTable))
const switchPagination = computed(() => toPagination(switchTable))

function toPagination(table: TabState): TablePaginationConfig {
  return {
    current: table.current,
    pageSize: table.pageSize,
    total: table.total,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条`
  }
}

const loginColumns = [
  { title: '时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: '账号', dataIndex: 'username', key: 'username', width: 140 },
  { title: '归属', dataIndex: 'tenantLabel', key: 'tenantLabel', width: 180 },
  { title: '结果', key: 'status', dataIndex: 'status', width: 90 },
  { title: '失败原因', key: 'failReason', dataIndex: 'failReason', width: 200 },
  { title: 'IP 地址', dataIndex: 'loginIp', key: 'loginIp', width: 140 },
  { title: '浏览器/设备', key: 'userAgent', dataIndex: 'userAgent', width: 240 }
]

// 库里那张表还有一列 `login_type`，现测恒为 `web`（写入口只落这一个值），念出来只会占一格
const switchColumns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '账号', dataIndex: 'username', key: 'username', width: 140 },
  { title: '出发的那一家', dataIndex: 'fromTenantLabel', key: 'fromTenantLabel', width: 200 },
  { title: '进的那一家', dataIndex: 'toTenantLabel', key: 'toTenantLabel', width: 200 },
  { title: 'IP 地址', dataIndex: 'ipAddress', key: 'ipAddress', width: 140 },
  { title: '浏览器/设备', key: 'userAgent', dataIndex: 'userAgent', width: 240 }
]

/**
 * 「只认最后一发」闸用的那一格：客户档位换成可比较的号（全部 -1、未知 -2、某一家用它的号）。
 * 切 tab 不进这里——两个 tab 各有各的通道，各自的翻页互不打断。
 */
const scopeToken = computed(() => filterForm.tenantOption)
const latestRead = useTenantReadGuard(scopeToken)

const scopeOf = (option: number): { tenantScope: AccountSecurityTenantScope; tenantId?: number } => {
  if (option === ALL_TENANTS) {
    return { tenantScope: 'all' }
  }
  if (option === UNKNOWN_TENANTS) {
    return { tenantScope: 'unknown' }
  }
  return { tenantScope: 'known', tenantId: option }
}

const tableOf = (kind: TabKey) => (kind === 'login' ? loginTable : switchTable)

/**
 * 读某一个 tab 的第一页起的那一发。
 *
 * 返回「这一发有没有真落到界面」：翻过头那一档要原地再读一发，读完由那一句决定要不要提示，
 * 中途被更新的档位作废掉的那一发不能算数——否则旧档位的「已翻回第一页」会在新档位上冒出来。
 */
const fetchTab = async (kind: TabKey): Promise<boolean> => {
  const table = tableOf(kind)
  const ticket = latestRead.begin(kind)
  table.loading = true
  table.emptyLine = ''
  table.emptyReason = null
  table.readFailed = ''
  try {
    const params: Record<string, unknown> = {
      page: table.current,
      size: table.pageSize,
      ...scopeOf(filterForm.tenantOption)
    }
    if (filterForm.username) {
      params.username = filterForm.username
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }
    if (kind === 'login' && filterForm.status) {
      params.status = filterForm.status
    }

    const result = (kind === 'login'
      ? await adminApi.accountSecurity.loginLogs(params as any)
      : await adminApi.accountSecurity.tenantSwitchLogs(params as any)) as any

    if (!latestRead.isCurrent(ticket)) {
      return false
    }
    table.records = result.records || []
    table.total = result.total || 0
    table.emptyLine = result.emptyLine || ''
    table.emptyReason = asEmptyReason(result.emptyReason)
    if (shouldJumpBackToFirstPage(table.emptyReason, table.current)) {
      table.current = 1
      const jumped = await fetchTab(kind)
      if (jumped) {
        message.info(JUMP_BACK_NOTICE)
      }
      return jumped
    }
    return true
  } catch (error: any) {
    if (!latestRead.isCurrent(ticket)) {
      return false
    }
    table.readFailed = describeHttpError(error)
    return true
  } finally {
    if (latestRead.isCurrent(ticket)) {
      table.loading = false
    }
  }
}

const fetchTenants = async () => {
  tenantsLoading.value = true
  tenantsReadFailed.value = false
  try {
    const result = await tenantApi.list() as any
    tenantOptions.value = Array.isArray(result) ? result : []
  } catch (error: any) {
    // 名单读不到时不许把「某一家的号」当成已选中的档位继续发；退回只有两档可选，界面明说
    tenantsReadFailed.value = true
    tenantOptions.value = []
    if (filterForm.tenantOption !== ALL_TENANTS && filterForm.tenantOption !== UNKNOWN_TENANTS) {
      filterForm.tenantOption = ALL_TENANTS
    }
  } finally {
    tenantsLoading.value = false
  }
}

const handleSearch = () => {
  currentTable.value.current = 1
  fetchTab(activeTab.value)
}

const handleReset = () => {
  filterForm.tenantOption = ALL_TENANTS
  filterForm.dateRange = []
  filterForm.username = ''
  filterForm.status = undefined
  currentTable.value.current = 1
  fetchTab(activeTab.value)
}

const handleTableChange = (kind: TabKey, pag: TablePaginationConfig) => {
  const table = tableOf(kind)
  table.current = pag.current ?? 1
  table.pageSize = pag.pageSize ?? table.pageSize
  fetchTab(kind)
}

// 模板里的内联箭头函数参数会被 vue-tsc 判成隐式 any，所以两个标签各挂一个具名处理器
const onLoginTableChange = (pag: TablePaginationConfig) => handleTableChange('login', pag)
const onSwitchTableChange = (pag: TablePaginationConfig) => handleTableChange('switch', pag)

const onTabChange = (key: string | number) => {
  const next = tabFromQuery(key)
  activeTab.value = next
  router.replace({ query: { ...route.query, tab: next } })
  fetchTab(next)
}

// 换客户档位：整屏的读数都不作数了，两个 tab 各回到第一页重读
watch(
  () => filterForm.tenantOption,
  () => {
    loginTable.current = 1
    switchTable.current = 1
    fetchTab(activeTab.value)
  }
)

onMounted(() => {
  fetchTenants()
  fetchTab(activeTab.value)
})
</script>

<style scoped lang="less">
.account-security {
  .user-agent {
    display: inline-block;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }

  .tenant-list-failed {
    color: rgba(0, 0, 0, 0.45);
  }
}
</style>
