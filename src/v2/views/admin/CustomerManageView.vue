<template>
  <div class="customer-manage-page">
    <a-spin :spinning="loading">
      <!-- 客户统计卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <TeamOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ customerStats.total }}</div>
                <div class="stat-title">客户总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ customerStats.active }}</div>
                <div class="stat-title">活跃客户</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <UserOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ customerStats.newThisMonth }}</div>
                <div class="stat-title">本月新增</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <ExclamationCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ customerStats.inactive }}</div>
                <div class="stat-title">未激活</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 筛选区域 -->
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-space>
          <a-input-search
            v-model:value="queryParams.keyword"
            placeholder="搜索公司名称/联系人/手机号"
            style="width: 280px"
            enter-button
            @search="loadCustomerList"
          />
          <a-select
            v-model:value="queryParams.status"
            style="width: 120px"
            placeholder="状态"
            allowClear
            @change="loadCustomerList"
          >
            <a-select-option value="active">活跃</a-select-option>
            <a-select-option value="inactive">未激活</a-select-option>
            <a-select-option value="disabled">已禁用</a-select-option>
          </a-select>
        </a-space>
      </a-card>

      <!-- 客户列表 -->
      <a-card title="客户列表" :bordered="false">
        <a-table
          :columns="columns"
          :data-source="customerListData"
          :pagination="paginationConfig"
          :loading="tableLoading"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'companyName'">
              <a @click="showCustomerDetail(record)">{{ record.companyName }}</a>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusName(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'registeredAt'">
              {{ formatDate(record.registeredAt) }}
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="showCustomerDetail(record)">
                  详情
                </a-button>
                <a-button type="link" size="small" @click="editCustomer(record)">
                  编辑
                </a-button>
                <a-button
                  type="link"
                  size="small"
                  @click="toggleStatus(record)"
                >
                  {{ record.status === 'active' ? '禁用' : '启用' }}
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <!-- 客户详情弹窗 -->
    <a-modal
      v-model:open="detailModalVisible"
      title="客户详情"
      width="640px"
      :footer="null"
    >
      <a-descriptions :column="2" bordered v-if="currentCustomer">
        <a-descriptions-item label="公司名称" :span="2">{{ currentCustomer.companyName }}</a-descriptions-item>
        <a-descriptions-item label="联系人">{{ currentCustomer.contactPerson }}</a-descriptions-item>
        <a-descriptions-item label="联系电话">{{ currentCustomer.phone }}</a-descriptions-item>
        <a-descriptions-item label="邮箱">{{ currentCustomer.email || '-' }}</a-descriptions-item>
        <a-descriptions-item label="客户等级">
          <a-tag :color="getLevelColor(currentCustomer.level)">
            {{ getLevelName(currentCustomer.level) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="getStatusColor(currentCustomer.status)">
            {{ getStatusName(currentCustomer.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="注册时间">{{ currentCustomer.registeredAt }}</a-descriptions-item>
        <a-descriptions-item label="最后登录">{{ currentCustomer.lastLoginAt || '-' }}</a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">{{ currentCustomer.remark || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>

    <!-- 编辑客户弹窗 -->
    <a-modal
      v-model:open="editModalVisible"
      :title="editingCustomer ? '编辑客户' : '新建客户'"
      width="520px"
      @ok="handleConfirmEdit"
    >
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="公司名称" required>
          <a-input v-model:value="editForm.companyName" placeholder="请输入公司名称" />
        </a-form-item>
        <a-form-item label="联系人" required>
          <a-input v-model:value="editForm.contactPerson" placeholder="请输入联系人姓名" />
        </a-form-item>
        <a-form-item label="联系电话" required>
          <a-input v-model:value="editForm.phone" placeholder="请输入手机号" />
        </a-form-item>
        <a-form-item label="邮箱">
          <a-input v-model:value="editForm.email" placeholder="请输入邮箱" />
        </a-form-item>
        <a-form-item label="客户等级">
          <a-select v-model:value="editForm.level" placeholder="选择客户等级">
            <a-select-option value="normal">普通客户</a-select-option>
            <a-select-option value="silver">银牌客户</a-select-option>
            <a-select-option value="gold">金牌客户</a-select-option>
            <a-select-option value="platinum">铂金客户</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="editForm.remark" placeholder="可选填写备注信息" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons-vue'
import { customerApi } from '../../api/billing'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const detailModalVisible = ref(false)
const editModalVisible = ref(false)
const currentCustomer = ref<any>(null)
const editingCustomer = ref<any>(null)

const customerStats = reactive({
  total: 0,
  active: 0,
  inactive: 0,
  newThisMonth: 0,
})

const queryParams = reactive({
  keyword: '',
  status: undefined as string | undefined,
})

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (page: number, pageSize: number) => {
    paginationConfig.current = page
    paginationConfig.pageSize = pageSize
    loadCustomerList()
  },
})

const columns = [
  { title: '公司名称', key: 'companyName', width: 200 },
  { title: '联系人', dataIndex: 'contactPerson', key: 'contactPerson', width: 120 },
  { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 140 },
  { title: '邮箱', dataIndex: 'email', key: 'email', width: 180 },
  { title: '客户等级', key: 'level', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '注册时间', key: 'registeredAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 180 },
]

const customerListData = ref<any[]>([])

function updateStats() {
  customerStats.total = customerListData.value.length
  customerStats.active = customerListData.value.filter(c => c.status === 'active').length
  customerStats.inactive = customerListData.value.filter(c => c.status === 'inactive').length
  customerStats.newThisMonth = customerListData.value.filter(c => {
    const regDate = new Date(c.registeredAt)
    const now = new Date()
    return regDate.getMonth() === now.getMonth() && regDate.getFullYear() === now.getFullYear()
  }).length
}

const editForm = reactive({
  companyName: '',
  contactPerson: '',
  phone: '',
  email: '',
  level: 'normal',
  remark: '',
})

function formatDate(date: string): string {
  if (!date) return '-'
  return date.substring(0, 10)
}

function getStatusName(status: string): string {
  const map: Record<string, string> = {
    active: '活跃',
    inactive: '未激活',
    disabled: '已禁用',
  }
  return map[status] || status
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'green',
    inactive: 'orange',
    disabled: 'red',
  }
  return map[status] || 'default'
}

function getLevelName(level: string): string {
  const map: Record<string, string> = {
    normal: '普通',
    silver: '银牌',
    gold: '金牌',
    platinum: '铂金',
  }
  return map[level] || level
}

function getLevelColor(level: string): string {
  const map: Record<string, string> = {
    normal: 'default',
    silver: 'cyan',
    gold: 'orange',
    platinum: 'purple',
  }
  return map[level] || 'default'
}

async function loadCustomerList() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  tableLoading.value = true
  try {
    const params: any = {
      tenantId,
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
    }
    if (queryParams.keyword) params.keyword = queryParams.keyword
    if (queryParams.status) params.status = queryParams.status

    const res = await customerApi.list(params)
    customerListData.value = res.records || []
    paginationConfig.total = res.total || 0
    updateStats()
  } catch (error) {
    console.error('Failed to load customers:', error)
    message.error('加载客户列表失败')
    customerListData.value = []
  } finally {
    tableLoading.value = false
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    loadCustomerList()
  }
)

function showCustomerDetail(customer: any) {
  currentCustomer.value = customer
  detailModalVisible.value = true
}

function editCustomer(customer: any) {
  editingCustomer.value = customer
  editForm.companyName = customer.companyName
  editForm.contactPerson = customer.contactPerson
  editForm.phone = customer.phone
  editForm.email = customer.email || ''
  editForm.level = customer.level
  editForm.remark = customer.remark || ''
  editModalVisible.value = true
}

async function toggleStatus(customer: any) {
  const newStatus = customer.status === 'active' ? 'disabled' : 'active'
  const action = newStatus === 'active' ? '启用' : '禁用'
  Modal.confirm({
    title: `确认${action}`,
    content: `确定要${action}客户 ${customer.companyName} 吗？`,
    onOk: async () => {
      try {
        await customerApi.toggleStatus(customer.id, newStatus)
        customer.status = newStatus
        updateStats()
        message.success(`${action}成功`)
      } catch (error) {
        console.error(`Failed to ${action} customer:`, error)
        message.error(`${action}失败`)
      }
    },
  })
}

async function handleConfirmEdit() {
  if (!editForm.companyName) {
    message.error('请输入公司名称')
    return
  }
  if (!editForm.contactPerson) {
    message.error('请输入联系人')
    return
  }
  if (!editForm.phone) {
    message.error('请输入联系电话')
    return
  }

  const tenantId = authStore.selectedTenantId || authStore.tenantId

  try {
    if (editingCustomer.value) {
      await customerApi.update(editingCustomer.value.id, {
        tenantId,
        companyName: editForm.companyName,
        contactPerson: editForm.contactPerson,
        phone: editForm.phone,
        email: editForm.email,
        level: editForm.level,
        remark: editForm.remark,
      })
      message.success('编辑成功')
    } else {
      await customerApi.create({
        tenantId,
        companyName: editForm.companyName,
        contactPerson: editForm.contactPerson,
        phone: editForm.phone,
        email: editForm.email,
        level: editForm.level,
        remark: editForm.remark,
      })
      message.success('新建成功')
    }

    editModalVisible.value = false
    loadCustomerList()
  } catch (error) {
    console.error('Failed to save customer:', error)
    message.error('保存失败')
  }
}

onMounted(() => {
  loadCustomerList()
})
</script>

<style scoped lang="less">
.customer-manage-page {
  width: 100%;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

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
  font-size: 20px;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}
</style>
