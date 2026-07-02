<template>
  <div class="tenant-panel">
    <!-- 统计卡片区域 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
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
      <a-col :span="6">
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
      <a-col :span="6">
        <a-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%)">
              <UserOutlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalUsers }}</div>
              <div class="stat-label">总用户数</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
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
            <a-select-option value="inactive">停用</a-select-option>
            <a-select-option value="expired">已过期</a-select-option>
          </a-select>
          <a-button type="primary" @click="showCreateModal">
            <template #icon><PlusOutlined /></template>
            新建租户
          </a-button>
        </a-space>
      </template>

      <a-table
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
          <template v-if="column.key === 'expiryDate'">
            <span :class="{ 'text-warning': isExpiringSoon(record.expiryDate) }">
              {{ record.expiryDate }}
            </span>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="viewDetail(record)">
                详情
              </a-button>
              <a-button type="link" size="small" @click="editTenant(record)">
                编辑
              </a-button>
              <a-button type="link" size="small" @click="manageUsers(record)">
                用户
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
        <a-descriptions-item label="创建时间">{{ currentTenant.createdAt }}</a-descriptions-item>
        <a-descriptions-item label="更新时间">{{ currentTenant.updatedAt }}</a-descriptions-item>
        <a-descriptions-item label="描述" :span="2">{{ currentTenant.description || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-drawer>

    <!-- 用户管理弹窗 -->
    <a-modal
      v-model:open="userModalVisible"
      title="租户用户管理"
      width="800px"
      :footer="null"
    >
      <template v-if="currentTenant">
        <a-card size="small" style="margin-bottom: 16px">
          <template #title>租户: {{ currentTenant.name }}</template>
          <template #extra>
            <a-button type="primary" size="small">
              <template #icon><PlusOutlined /></template>
              添加用户
            </a-button>
          </template>
          <a-table
            :columns="userColumns"
            :data-source="tenantUsers"
            :pagination="false"
            size="small"
            row-key="id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'active' ? 'success' : 'default'">
                  {{ record.status === 'active' ? '正常' : '禁用' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'action'">
                <a-space>
                  <a-button type="link" size="small">编辑</a-button>
                  <a-popconfirm title="确定要移除该用户吗？">
                    <a-button type="link" size="small" danger>移除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-card>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  UserOutlined,
  RiseOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import type { TableProps } from 'ant-design-vue'
import http from '@/v2/api/http'

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
const userModalVisible = ref(false)
const isEdit = ref(false)
const currentTenant = ref<Tenant | null>(null)
const editingId = ref<number | null>(null)

const stats = reactive({
  totalTenants: 156,
  activeTenants: 142,
  totalUsers: 892,
  newToday: 8
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
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' }
]

const userColumns = [
  { title: '用户ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
  { title: '邮箱', dataIndex: 'email', key: 'email', width: 180 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
  { title: '状态', key: 'status', width: 80 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 120 }
]

const tenantList = ref<Tenant[]>([])
const tenantUsers = ref<any[]>([])

const formData = reactive({
  name: '',
  code: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  description: '',
  status: 1,
})

const formRules = {
  name: [{ required: true, message: '请输入租户名称' }],
  code: [{ required: true, message: '请输入租户代码' }],
  contactEmail: [{ required: true, message: '请输入联系邮箱' }],
}

const getStatusColor = (status: number) => {
  const colorMap: Record<number, string> = {
    1: 'success',
    0: 'default',
    2: 'error'
  }
  return colorMap[status] || 'default'
}

const getStatusText = (status: number) => {
  const textMap: Record<number, string> = {
    1: '活跃',
    0: '停用',
    2: '已过期'
  }
  return textMap[status] || String(status)
}

const isExpiringSoon = (date: string) => {
  if (!date) return false
  const expiryDate = new Date(date)
  const now = new Date()
  const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays <= 30 && diffDays > 0
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
        inactive: 0,
        expired: 2
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
  } catch (e: any) {
    message.error(e.message || '加载失败')
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
      await http.post('/admin/tenants', {
        name: formData.name,
        code: formData.code,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        website: formData.website,
        description: formData.description,
      })
      message.success('租户创建成功')
    }
    modalVisible.value = false
    loadData()
  } catch (e: any) {
    message.error(e.message || '操作失败')
  }
}

const deleteTenant = async (id: number) => {
  try {
    await http.delete(`/admin/tenants/${id}`)
    message.success('删除成功')
    loadData()
  } catch (e: any) {
    message.error(e.message || '删除失败')
  }
}

const viewDetail = (record: Tenant) => {
  currentTenant.value = record
  detailVisible.value = true
}

const manageUsers = (record: Tenant) => {
  currentTenant.value = record
  userModalVisible.value = true
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
  
  .text-warning {
    color: #fa8c16;
    font-weight: 500;
  }
}
</style>
