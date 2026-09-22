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
      <template #extra>
        <a-space>
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
          <a-button type="primary" @click="showCreateModal">
            <template #icon><PlusOutlined /></template>
            新建租户
          </a-button>
        </a-space>
      </template>

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
      <a-form :model="formData" :rules="formRules" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="租户名称" name="name">
              <a-input v-model:value="formData.name" placeholder="请输入租户名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="租户代码" name="code">
              <a-input v-model:value="formData.code" placeholder="请输入租户代码" :disabled="isEdit" />
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
import { ref, reactive, onMounted, h } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import type { TableProps } from 'ant-design-vue'
import http, { describeHttpError } from '@/api/http'
import { formatDateTime } from '@/utils/format'

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
const searchText = ref('')
const statusFilter = ref('all')
const modalVisible = ref(false)
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
  { title: '操作', key: 'action', width: 180, fixed: 'right' }
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
  code: [{ required: true, message: '请输入租户代码' }],
  contactEmail: [{ required: true, message: '请输入联系邮箱' }],
  adminPassword: [{ required: true, message: '请设置管理员初始密码，至少 6 位' }],
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
