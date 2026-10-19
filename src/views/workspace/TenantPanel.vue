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
        <a-descriptions-item label="联系电话">{{ currentTenant.contactPhone }}</a-descriptions-item>
        <a-descriptions-item label="官网">{{ currentTenant.website || '-' }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatDateTime(currentTenant.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="更新时间">{{ formatDateTime(currentTenant.updatedAt) }}</a-descriptions-item>
        <a-descriptions-item label="描述" :span="2">{{ currentTenant.description || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-drawer>

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
}

const loading = ref(false)
const router = useRouter()
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
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    customRender: ({ text }: { text: string }) => formatDateTime(text)
  },
  { title: '操作', key: 'action', width: 250, fixed: 'right' }
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
 * P0 时故意没做——那一页 P1 才存在，先摆一个死链等于用一句谎换另一句谎；今天它是真页。
 * 租户号走地址的查询参数带给录入页预填，用户到那一页不用再挑一遍租户（N1：分配即建站，
 * 租户侧永远没有「申请建站」这个入口，需求只能由平台录进来）。
 */
const goIntake = (tenantId: number) => {
  router.push({ name: 'workspace-portal-brief-new', query: { tenantId: String(tenantId) } })
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
