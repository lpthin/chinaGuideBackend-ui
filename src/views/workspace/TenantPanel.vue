<template>
  <div class="tenant-panel">
    <!-- 统计卡片区域 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="8">
        <a-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
              <ApartmentOutlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalTenants }}</div>
              <div class="stat-label">租户总数</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #13c2c2 0%, #08979c 100%)">
              <CheckCircleOutlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.activeTenants }}</div>
              <div class="stat-label">活跃租户</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)">
              <RiseOutlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.newToday }}</div>
              <div class="stat-label">今日新增</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 租户列表 -->
    <a-card>
      <template #title>
        <span>租户管理</span>
      </template>

      <!-- 原来整条工具栏挤在卡片 #extra 槽里；按约定筛选靠左、动作靠右，统一走 FilterBar -->
      <filter-bar>
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索租户名称"
          style="width: 200px"
          @search="handleSearch"
        />
        <a-select
          v-model:value="statusFilter"
          style="width: 120px"
          placeholder="状态筛选"
          @change="loadData"
        >
          <a-select-option value="all">全部</a-select-option>
          <a-select-option value="active">活跃</a-select-option>
          <a-select-option value="paused">暂停</a-select-option>
          <a-select-option value="cancelled">注销</a-select-option>
        </a-select>
        <template #actions>
          <a-space>
            <a-button type="primary" @click="showCreateModal">
              <template #icon><PlusOutlined /></template>
              新建租户
            </a-button>
          </a-space>
        </template>
      </filter-bar>

      <a-table
        :scroll="{ x: 'max-content' }"
        :columns="columns"
        :data-source="tenantList"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'deliveryState'">
            <!-- 这一栏的中文只念后端那份词表（后端实体上派生的 deliveryStateLabel），界面不再抄一遍 -->
            <a-tag :color="record.deliveryState === 'delivered' ? 'green' : 'orange'">
              {{ record.deliveryStateLabel || record.deliveryState || '后端没回这一栏' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="viewDetail(record)">
                详情
              </a-button>
              <a-button type="link" size="small" @click="editTenant(record)">
                编辑
              </a-button>
              <!-- 交棒出口：带着这一家的租户号去前采录入页（租户由地址预填，不用到那边再挑） -->
              <a-button type="link" size="small" @click="goIntake(record.id)">
                去录前采
              </a-button>
              <!--
                M-P53 拍板：交付态（含退回未交付）只有超管能点。平台自己那家（id=1）后端冻着，
                这里连把手都不摆——摆一个必定被拒的按钮等于让人白打一发。
              -->
              <a-button
                v-if="authStore.isSuperAdmin && record.id !== PLATFORM_TENANT_ID"
                type="link"
                size="small"
                @click="openDeliveryModal(record)"
              >
                改交付态
              </a-button>
              <a-popconfirm
                title="确定要删除该租户吗？"
                ok-text="确定"
                cancel-text="取消"
                @confirm="deleteTenant(record.id)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新建/编辑租户弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑租户' : '新建租户'"
      width="600px"
      @ok="submitTenant"
    >
      <a-form ref="formRef" :model="formData" :rules="formRules" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="租户名称" name="name">
              <a-input v-model:value="formData.name" placeholder="请输入租户名称" @blur="suggestCodeFromName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item
              label="租户代码"
              name="code"
              extra="小写字母、数字、连字符，2~50 位；它会同时作为交付站域名的前缀，建成之后改不了"
              :validate-status="codeCheck.validateStatus"
              :help="codeCheck.help"
            >
              <a-input
                v-model:value="formData.code"
                placeholder="留空则按名称自动建议，可改"
                :disabled="isEdit"
                @blur="checkTenantCode"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="联系邮箱" name="contactEmail">
              <a-input v-model:value="formData.contactEmail" placeholder="请输入联系邮箱" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="联系电话" name="contactPhone">
              <a-input v-model:value="formData.contactPhone" placeholder="请输入联系电话" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="官网" name="website">
              <a-input v-model:value="formData.website" placeholder="请输入官网地址" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="描述" name="description">
              <a-textarea
                v-model:value="formData.description"
                :rows="3"
                placeholder="请输入租户描述"
              />
            </a-form-item>
          </a-col>
          <template v-if="!isEdit">
            <a-col :span="12">
              <a-form-item label="管理员账号" name="adminUsername" extra="留空则自动使用 租户代码_admin">
                <a-input v-model:value="formData.adminUsername" placeholder="例如 jingtian_admin" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="初始密码" name="adminPassword" extra="至少 6 位，交付后请让客户尽快修改">
                <a-input-password v-model:value="formData.adminPassword" placeholder="管理员登录密码" autocomplete="new-password" />
              </a-form-item>
            </a-col>
          </template>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 租户详情抽屉 -->
    <a-drawer
      v-model:open="detailVisible"
      title="租户详情"
      width="640px"
    >
      <a-descriptions :column="2" bordered v-if="currentTenant">
        <a-descriptions-item label="租户名称">{{ currentTenant.name }}</a-descriptions-item>
        <a-descriptions-item label="租户ID">{{ currentTenant.id }}</a-descriptions-item>
        <a-descriptions-item label="租户代码">{{ currentTenant.code }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="getStatusColor(currentTenant.status)">
            {{ getStatusText(currentTenant.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="联系邮箱">{{ currentTenant.contactEmail }}</a-descriptions-item>
        <a-descriptions-item label="交付态">
          {{ currentTenant.deliveryStateLabel || currentTenant.deliveryState || '后端没回这一栏' }}
        </a-descriptions-item>
        <a-descriptions-item label="联系电话">{{ currentTenant.contactPhone }}</a-descriptions-item>
        <a-descriptions-item label="官网">{{ currentTenant.website || '-' }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatDateTime(currentTenant.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="更新时间">{{ formatDateTime(currentTenant.updatedAt) }}</a-descriptions-item>
        <a-descriptions-item label="描述" :span="2">{{ currentTenant.description || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-drawer>

    <!--
      改交付态（M-P53 拍板「加一条只有超管能点的退回」）。
      四道闸后端才是出处，这一屏先把提交按钮按住：让人在点之前看见缺哪一格，而不是打一发吃一发红字。
      目标档位那一份名单读后端的 GET /admin/tenants/delivery-states，界面不自己列词表。
    -->
    <a-modal
      v-model:open="deliveryVisible"
      title="改这一家的交付态"
      width="640px"
      ok-text="确认改"
      :ok-button-props="{ disabled: !deliveryFormReady }"
      :confirm-loading="deliverySubmitting"
      @ok="submitDeliveryState"
    >
      <template v-if="deliveryTarget">
        <a-alert type="warning" show-icon style="margin-bottom: 12px">
          <template #message>
            交付态只回答一个问题：这一家自己发起的 AI 消耗算不算在它头上。改它还会连带改掉每日自动产出跳过谁。
          </template>
        </a-alert>

        <p style="margin-bottom: 12px">
          这一家：<b>{{ deliveryTarget.name }}</b>（#{{ deliveryTarget.id }} · {{ deliveryTarget.code }}）·
          现在是 <b>{{ deliveryTarget.deliveryStateLabel || deliveryTarget.deliveryState || '后端没回这一栏' }}</b>
        </p>

        <a-form layout="vertical">
          <a-form-item label="改到哪一档">
            <a-select
              v-model:value="deliveryForm.state"
              :options="deliveryStateOptions"
              :loading="deliveryOptionsLoading"
              placeholder="选一档"
            />
            <p v-if="deliveryStateUnchanged" style="margin: 6px 0 0; color: #8c8c8c; font-size: 12px">
              这一家本来就是这一档：提交也不会写库，后端会回一句「没改」。
            </p>
          </a-form-item>

          <a-form-item label="逐字输入这一家的租户代码">
            <a-input
              v-model:value="deliveryForm.expectedCode"
              :placeholder="`最后一道闸：把 ${deliveryTarget.code} 逐字打进来`"
            />
            <p class="delivery-modal__hint" style="margin: 6px 0 0; color: #8c8c8c; font-size: 12px">
              这一格拦的是「从一张过期的列表上点错行」：只有你打的这一串与库里那一行逐字相等，后端才动数据。
            </p>
          </a-form-item>

          <a-form-item label="为什么改（必填，这一句会落进审计）">
            <a-textarea
              v-model:value="deliveryForm.reason"
              :rows="2"
              :maxlength="500"
              show-count
              placeholder="写清是谁要求、为哪件事改；事后只有这一句能分出误点与有意"
            />
          </a-form-item>

          <a-form-item label="确认词">
            <a-input
              v-model:value="deliveryForm.confirm"
              :placeholder="`打 ${DELIVERY_STATE_CONFIRM_TOKEN}`"
            />
            <p class="delivery-modal__hint" style="margin: 6px 0 0; color: #8c8c8c; font-size: 12px">这一串要逐字打对，少一个字后端就当没收到确认。</p>
          </a-form-item>
        </a-form>
      </template>
    </a-modal>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, h, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import FilterBar from '../../components/FilterBar.vue'
import type { TableProps, FormInstance } from 'ant-design-vue'
import http, { describeHttpError } from '@/api/http'
import { formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import {
  CODE_FORMAT_PATTERN,
  describeTenantCodeCheck,
  type TenantCodeCheckState,
} from './tenantCodeCheck'
import { suggestTenantCodeFromName } from './tenantCodeSuggest'

interface Tenant {
  id: number
  name: string
  code: string
  status: number
  planId: number
  contactEmail: string
  contactPhone: string
  website: string
  description: string
  createdAt: string
  updatedAt: string
  /**
   * 交付态原码（`presale` / `delivered`）。老后端不回这一格时它是 undefined，
   * 界面那句「后端没回这一栏」就是给这种情况摆的，不替它猜一档。
   */
  deliveryState?: string | null
  /** 交付态的中文：后端实体上从唯一词表派生出来的那一句，界面不许自己再抄一份 */
  deliveryStateLabel?: string | null
}

const loading = ref(false)
const router = useRouter()
const authStore = useAuthStore()
const searchText = ref('')
const statusFilter = ref('all')
const modalVisible = ref(false)
// a-modal 默认不销毁内容：上一次打开时红掉的那一栏会跟着下一次开弹窗一起来，
// 而表单值已被换成别一家的数据，红字念的内容与格子里的值不再相干
const formRef = ref<FormInstance>()
const detailVisible = ref(false)
const isEdit = ref(false)
const currentTenant = ref<Tenant | null>(null)
const editingId = ref<number | null>(null)

/** 平台自己那家：后端把它的交付态冻住了（改它会连带改掉平台那批外呼的计费归属），界面连把手都不摆 */
const PLATFORM_TENANT_ID = 1

/**
 * 写口要求的确认词。出处是后端 `TenantDeliveryStateService.CONFIRM_TOKEN`——它是协议常量、不是中文话术，
 * 所以这里照抄一份；打错时那一发会被后端原样念回该带哪一串。
 */
const DELIVERY_STATE_CONFIRM_TOKEN = 'SET-TENANT-DELIVERY-STATE'

interface DeliveryStateReceipt {
  tenantId: number
  code: string
  fromState?: string | null
  toState?: string | null
  fromLabel?: string | null
  toLabel?: string | null
  changed: boolean
  consequences?: string[] | null
  reason?: string | null
}

const deliveryVisible = ref(false)
const deliverySubmitting = ref(false)
const deliveryOptionsLoading = ref(false)
const deliveryTarget = ref<Tenant | null>(null)
/** 下拉那一份名单读后端的 `/admin/tenants/delivery-states`，界面不自己列词表 */
const deliveryStateOptions = ref<{ value: string; label: string }[]>([])
const deliveryForm = reactive({
  state: undefined as string | undefined,
  expectedCode: '',
  reason: '',
  confirm: '',
})

const deliveryStateUnchanged = computed(
  () => !!deliveryTarget.value && deliveryForm.state === deliveryTarget.value.deliveryState,
)

const deliveryFormReady = computed(() =>
  !!deliveryTarget.value
  && !!deliveryForm.state
  // 代码这一格按「逐字相等」才放行：后端还会拿库里那一行再比一次，这里只是先把明显不对的按住
  && deliveryForm.expectedCode.trim() === deliveryTarget.value.code
  && deliveryForm.reason.trim().length > 0
  && deliveryForm.confirm === DELIVERY_STATE_CONFIRM_TOKEN,
)

const stats = reactive({
  totalTenants: 0,
  activeTenants: 0,
  newToday: 0
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`
})

const columns = [
  { title: '租户ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '租户名称', dataIndex: 'name', key: 'name', width: 150 },
  { title: '租户代码', dataIndex: 'code', key: 'code', width: 120 },
  { title: '联系邮箱', dataIndex: 'contactEmail', key: 'contactEmail', width: 180 },
  { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone', width: 130 },
  { title: '状态', key: 'status', width: 80 },
  { title: '交付态', key: 'deliveryState', width: 260 },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    customRender: ({ text }: { text: string }) => formatDateTime(text)
  },
  // 多摆一格「改交付态」（只有超管看得见），250 会把它挤到换行
  { title: '操作', key: 'action', width: 330, fixed: 'right' }
]

const tenantList = ref<Tenant[]>([])

const formData = reactive({
  name: '',
  code: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  description: '',
  status: 1,
  adminUsername: '',
  adminPassword: '',
})

interface ProvisionedTenant {
  id: number
  name: string
  code: string
  planId: number
  adminUsername: string
  contactEmail: string
}

const formRules = {
  name: [{ required: true, message: '请输入租户名称' }],
  // whitespace: true 与后端 `!code.trim()` 那把空闸同一把尺：只敲空格的代码不许在界面显成「这栏过了」
  code: [{ required: true, whitespace: true, message: '请输入租户代码' }],
  contactEmail: [{ required: true, message: '请输入联系邮箱' }],
  adminPassword: [{ required: true, message: '请设置管理员初始密码，至少 6 位' }],
}

/**
 * 代码查重那一格（M-P44 拍板①「加失焦就地查重」）。
 *
 * 说什么、不说什么全在 `tenantCodeCheck.ts` 那一份纯函数里，这里只管三件事：
 * 何时发问、把答案换成形状、以及<em>改一个字就把上一发的结论撤掉</em>——
 * 挂着「已被占用」念一个已经改过的代码，是最容易让人以为自己没打错的那种误导。
 */
const codeCheckState = ref<TenantCodeCheckState>('idle')
const codeCheckMessage = ref('')
let codeCheckSeq = 0

const codeCheck = computed(() => describeTenantCodeCheck(codeCheckState.value, codeCheckMessage.value))

watch(() => formData.code, () => {
  codeCheckSeq++
  codeCheckState.value = 'idle'
  codeCheckMessage.value = ''
})

const checkTenantCode = async () => {
  // 编辑态这一栏禁用、代码也改不动（建的时候就定死了），失焦再问一发是白打
  if (isEdit.value) return
  // 查的正是待会儿要提交的那一串字（不 trim）：判据要与后端那一发同一把尺，差一个空格就是两把尺
  const code = formData.code
  if (!code.trim()) {
    codeCheckState.value = 'idle'
    codeCheckMessage.value = ''
    return
  }
  if (!CODE_FORMAT_PATTERN.test(code)) {
    // 形状就不对的代码不必去问占用：那一发答的是「有没有被用过」，而这一串压根当不了域名
    codeCheckSeq++
    codeCheckState.value = 'invalid'
    codeCheckMessage.value = ''
    return
  }
  const seq = ++codeCheckSeq
  codeCheckState.value = 'checking'
  try {
    const reading = await http.get<{ available?: boolean; message?: string }>(
      '/admin/tenants/code-available', { params: { code } })
    if (seq !== codeCheckSeq) return
    if (typeof reading?.available !== 'boolean') {
      // 没回 available 不等于「可用」：这一档宁可念「没查到答复」，不替后端担保
      codeCheckState.value = 'unreachable'
      codeCheckMessage.value = '后端没有给出可用与否'
      return
    }
    codeCheckState.value = reading.available ? 'available' : 'taken'
    codeCheckMessage.value = reading.message ?? ''
  } catch (e) {
    if (seq !== codeCheckSeq) return
    codeCheckState.value = 'unreachable'
    codeCheckMessage.value = (e as Error)?.message ?? ''
  }
}

/**
 * 名称失焦时从名字里推一个<em>建议</em>代码（M-P45 拍板①「只加本地拼音库，不外呼」+ 拍板②「名称失焦、
 * 且代码格为空时才打」）。
 *
 * 四条纪律都在这里，一条都不在别处：
 * - 代码格里有<em>任何</em>字符就住手（比的是 `!== ''`，不是 trim 后非空）——一个空格也是人打的字，
 *   覆盖它等于替超管改了他已经写下的东西；
 * - 一次开弹窗最多打一发（`codeSuggestedOnce` 在真正动词典之前置位，推不出合格代码也不重试）；
 * - 全程本地：没有任何外呼、没有任何流水行，这一发在记账上和敲键盘同价；
 * - 填完之后照旧走查重那一发，建议值不享有「界面默认它可用」的待遇。
 */
const codeSuggestedOnce = ref(false)

const suggestCodeFromName = async () => {
  if (isEdit.value) return
  if (codeSuggestedOnce.value) return
  if (formData.code !== '') return
  if (!formData.name.trim()) return
  codeSuggestedOnce.value = true
  const suggested = await suggestTenantCodeFromName(formData.name)
  // 推不出合格代码（名字全是符号、或只剩一个字母）就留空，不往格子里填一个注定被格式闸拒掉的串
  if (!suggested) return
  formData.code = suggested
  // 改代码那条 watch 会把 seq 往前推一格并撤掉结论；不等它落地就去查，刚填的值会被自己的作废判据抹平
  await nextTick()
  await checkTenantCode()
}

const getStatusColor = (status: number) => {
  const colorMap: Record<number, string> = {
    1: 'success',
    2: 'warning',
    3: 'default'
  }
  return colorMap[status] || 'default'
}

const getStatusText = (status: number) => {
  const textMap: Record<number, string> = {
    1: '活跃',
    2: '暂停',
    3: '注销'
  }
  return textMap[status] || String(status)
}

const loadData = async () => {
  loading.value = true
  try {
    const data = await http.get<Tenant[]>('/admin/tenants')
    let filtered = data
    if (searchText.value) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchText.value.toLowerCase())
      )
    }
    if (statusFilter.value !== 'all') {
      const statusMap: Record<string, number> = {
        active: 1,
        paused: 2,
        cancelled: 3
      }
      filtered = filtered.filter(t => t.status === statusMap[statusFilter.value])
    }
    const start = (pagination.current - 1) * pagination.pageSize
    const end = start + pagination.pageSize
    tenantList.value = filtered.slice(start, end)
    pagination.total = filtered.length
    
    stats.totalTenants = data.length
    stats.activeTenants = data.filter(t => t.status === 1).length
    stats.newToday = data.filter(t => {
      const created = new Date(t.createdAt)
      const today = new Date()
      return created.toDateString() === today.toDateString()
    }).length
  } catch (e) {
    message.error(`加载租户列表失败：${describeHttpError(e)}`)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.current = 1
  loadData()
}

const handleTableChange: TableProps['onChange'] = (pag) => {
  pagination.current = pag.current || 1
  pagination.pageSize = pag.pageSize || 10
  loadData()
}

const showCreateModal = () => {
  isEdit.value = false
  codeSuggestedOnce.value = false
  Object.assign(formData, {
    name: '',
    code: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    description: '',
    status: 1,
    adminUsername: '',
    adminPassword: '',
  })
  modalVisible.value = true
  formRef.value?.clearValidate()
}

const editTenant = (record: Tenant) => {
  isEdit.value = true
  Object.assign(formData, {
    name: record.name,
    code: record.code,
    contactEmail: record.contactEmail,
    contactPhone: record.contactPhone,
    website: record.website,
    description: record.description,
    status: record.status,
  })
  editingId.value = record.id
  modalVisible.value = true
  formRef.value?.clearValidate()
}

const showProvisionResult = (created: ProvisionedTenant) => {
  Modal.success({
    title: '租户已开通',
    width: 460,
    content: h('div', {}, [
      h('p', {}, `租户：${created.name}（${created.code}）`),
      h('p', {}, '管理员登录账号：'),
      h('p', { style: 'font-weight:600;font-family:monospace' }, created.adminUsername),
      h('p', { style: 'color:#888' }, '初始密码即上面填写的密码，请交付客户后提醒其尽快修改。'),
      h('p', { style: 'color:#888' }, '租户侧没有「申请建站」这一说（分配即建站）：要给它建门户，下一步是平台录一份前采需求单。'),
      h('a', {
        style: 'font-weight:600',
        onClick: () => {
          Modal.destroyAll()
          goIntake(created.id)
        }
      }, '现在就去录这一家的前采需求单'),
    ]),
  })
}

const submitTenant = async () => {
  try {
    if (isEdit.value) {
      await http.put(`/admin/tenants/${editingId.value}`, {
        name: formData.name,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        website: formData.website,
        description: formData.description,
      })
      message.success('租户信息已更新')
    } else {
      if (!formData.adminPassword || formData.adminPassword.length < 6) {
        message.error('请设置管理员初始密码，至少 6 位')
        return
      }
      const created = await http.post<ProvisionedTenant>('/admin/tenants', {
        name: formData.name,
        code: formData.code,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        website: formData.website,
        description: formData.description,
        adminUsername: formData.adminUsername || undefined,
        adminPassword: formData.adminPassword || undefined,
      })
      showProvisionResult(created)
    }
    modalVisible.value = false
    loadData()
  } catch (e) {
    message.error(`操作失败：${describeHttpError(e)}`)
  }
}

const deleteTenant = async (id: number) => {
  try {
    await http.delete(`/admin/tenants/${id}`)
    message.success('删除成功')
    loadData()
  } catch (e) {
    message.error(`删除失败：${describeHttpError(e)}`)
  }
}

const viewDetail = (record: Tenant) => {
  currentTenant.value = record
  detailVisible.value = true
}

/**
 * 交棒出口（Spec-C §7「租户管理」那一行）：建完租户紧接着就是录前采。
 * 租户号走地址的查询参数带给向导第一步预填，用户到那一页不用再挑一遍租户（N1：分配即建站，
 * 租户侧永远没有「申请建站」这个入口，需求只能由平台录进来）。
 *
 * 落点是五步向导而不是那张独立录入页：独立页的路由留着（老收藏夹与文档链接不断），
 * 但它 `meta.hidden`、不在菜单里——从这一行跳过去等于把人送进一条没有回程的路。
 * 2026-10-26 拍板：这一颗跟着入口改，跳向导第一步。
 */
const goIntake = (tenantId: number) => {
  router.push({ name: 'workspace-portal-wizard', query: { step: 'intake', tenantId: String(tenantId) } })
}

const loadDeliveryStateOptions = async () => {
  if (deliveryStateOptions.value.length) return
  deliveryOptionsLoading.value = true
  try {
    const labels = await http.get<Record<string, string>>('/admin/tenants/delivery-states')
    deliveryStateOptions.value = Object.entries(labels || {}).map(([value, label]) => ({ value, label }))
  } catch (e) {
    // 名单读不到时下拉就是空的：这一屏宁可让人看不见可选档位，也不替他猜一档
    message.error(`交付态的名单没读到：${describeHttpError(e)}`)
  } finally {
    deliveryOptionsLoading.value = false
  }
}

const openDeliveryModal = (record: Tenant) => {
  deliveryTarget.value = record
  deliveryForm.state = undefined
  deliveryForm.expectedCode = ''
  deliveryForm.reason = ''
  deliveryForm.confirm = ''
  deliveryVisible.value = true
  loadDeliveryStateOptions()
}

const showDeliveryReceipt = (receipt: DeliveryStateReceipt) => {
  Modal.success({
    title: receipt.changed ? '交付态已改' : '这一发没写库',
    width: 560,
    content: h('div', {}, [
      h('p', {}, `这一家：${receipt.code}（#${receipt.tenantId}）`),
      h('p', { style: 'font-weight:600' },
        receipt.changed
          ? `${receipt.fromLabel || receipt.fromState || '（没回改前那一档）'} → ${receipt.toLabel || receipt.toState || '（没回改后那一档）'}`
          : `这一家本来就是「${receipt.toLabel || receipt.toState}」，所以后端一行都没写。`),
      ...(receipt.consequences || []).map(line => h('p', { style: 'color:#888' }, line)),
      h('p', { style: 'color:#888' }, `原因（这一句已落进审计）：${receipt.reason || '（后端没回原因）'}`),
    ]),
  })
}

const submitDeliveryState = async () => {
  const target = deliveryTarget.value
  if (!target) return
  deliverySubmitting.value = true
  try {
    // 这四格走查询参数：审计拦的是 query string，写成请求体的话，事后那一行只剩「谁改的」没有「改成什么、为什么」
    const receipt = await http.put<DeliveryStateReceipt>(`/admin/tenants/${target.id}/delivery-state`, null, {
      params: {
        state: deliveryForm.state,
        expectedCode: deliveryForm.expectedCode.trim(),
        reason: deliveryForm.reason.trim(),
        confirm: deliveryForm.confirm,
      },
    })
    deliveryVisible.value = false
    showDeliveryReceipt(receipt)
    loadData()
  } catch (e) {
    message.error(`改交付态失败：${describeHttpError(e)}`)
  } finally {
    deliverySubmitting.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.tenant-panel {
  .stat-card {
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
      color: #fff;
      font-size: 20px;
    }
    
    .stat-info {
      flex: 1;
      
      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: #1a1a1a;
        line-height: 1.2;
      }
      
      .stat-label {
        font-size: 12px;
        color: #8c8c8c;
        margin-top: 4px;
      }
    }
  }
}
</style>
