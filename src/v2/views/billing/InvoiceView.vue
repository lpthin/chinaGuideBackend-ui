<template>
  <div class="invoice-view-page">
    <a-spin :spinning="loading">
      <!-- 发票统计 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ invoiceStats.total }}</div>
                <div class="stat-title">发票总数</div>
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
                <div class="stat-value">{{ invoiceStats.approved }}</div>
                <div class="stat-title">已开票</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <ClockCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ invoiceStats.pending }}</div>
                <div class="stat-title">处理中</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <DollarOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">¥{{ formatAmount(invoiceStats.totalAmount) }}</div>
                <div class="stat-title">开票总额</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 操作按钮 -->
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-space>
          <a-button type="primary" size="large" @click="showApplyModal">
            <template #icon><PlusOutlined /></template>
            申请开票
          </a-button>
          <a-button size="large" @click="handleExport">
            <template #icon><ExportOutlined /></template>
            导出列表
          </a-button>
        </a-space>
      </a-card>

      <!-- 发票列表 -->
      <a-card title="发票列表" :bordered="false">
        <template #extra>
          <a-input-search
            v-model:value="queryParams.keyword"
            placeholder="搜索发票抬头/税号"
            style="width: 250px"
            enter-button
            @search="loadInvoices"
          />
        </template>

        <a-table
          :columns="columns"
          :data-source="invoiceList"
          :pagination="paginationConfig"
          :loading="tableLoading"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <div class="title-cell">
                <div class="title-name">{{ record.title }}</div>
                <div class="title-type">
                  <a-tag :color="record.type === 'company' ? 'blue' : 'default'" size="small">
                    {{ record.type === 'company' ? '企业' : '个人' }}
                  </a-tag>
                </div>
              </div>
            </template>
            <template v-if="column.key === 'amount'">
              <span class="amount">¥{{ formatAmount(record.amount) }}</span>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusName(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatDate(record.createdAt) }}
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="viewInvoice(record)">
                  详情
                </a-button>
                <a-button
                  v-if="record.status === 'approved'"
                  type="link"
                  size="small"
                  @click="handleDownload(record)"
                >
                  下载
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <!-- 申请开票弹窗 -->
    <a-modal
      v-model:open="applyModalVisible"
      title="申请开票"
      width="520px"
      @ok="handleConfirmApply"
    >
      <a-form :model="applyForm" layout="vertical">
        <a-form-item label="发票类型" required>
          <a-radio-group v-model:value="applyForm.type">
            <a-radio value="company">企业发票</a-radio>
            <a-radio value="personal">个人发票</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="发票抬头" required>
          <a-input v-model:value="applyForm.title" placeholder="请输入发票抬头" />
        </a-form-item>
        <a-form-item v-if="applyForm.type === 'company'" label="税号" required>
          <a-input v-model:value="applyForm.taxNumber" placeholder="请输入税号" />
        </a-form-item>
        <a-form-item label="开票金额" required>
          <a-input-number
            v-model:value="applyForm.amount"
            :min="1"
            :max="1000000"
            :formatter="value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="value => value.replace(/\¥\s?|(,*)/g, '')"
            style="width: 100%"
            placeholder="请输入开票金额"
          />
        </a-form-item>
        <a-form-item label="接收邮箱">
          <a-input v-model:value="applyForm.email" placeholder="请输入接收发票的邮箱" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="applyForm.remark" placeholder="可选填写备注信息" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 发票详情弹窗 -->
    <a-modal
      v-model:open="detailModalVisible"
      title="发票详情"
      width="560px"
      :footer="null"
    >
      <a-descriptions :column="2" bordered v-if="currentInvoice">
        <a-descriptions-item label="发票编号" :span="2">{{ currentInvoice.invoiceNo }}</a-descriptions-item>
        <a-descriptions-item label="发票类型">
          <a-tag :color="currentInvoice.type === 'company' ? 'blue' : 'default'">
            {{ currentInvoice.type === 'company' ? '企业发票' : '个人发票' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="发票状态">
          <a-tag :color="getStatusColor(currentInvoice.status)">
            {{ getStatusName(currentInvoice.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="发票抬头" :span="2">{{ currentInvoice.title }}</a-descriptions-item>
        <a-descriptions-item v-if="currentInvoice.taxNumber" label="税号" :span="2">{{ currentInvoice.taxNumber }}</a-descriptions-item>
        <a-descriptions-item label="发票金额" :span="2">
          <span class="amount">¥{{ formatAmount(currentInvoice.amount) }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="接收邮箱" :span="2">{{ currentInvoice.email || '-' }}</a-descriptions-item>
        <a-descriptions-item label="申请时间" :span="2">{{ currentInvoice.createdAt }}</a-descriptions-item>
        <a-descriptions-item v-if="currentInvoice.remark" label="备注" :span="2">{{ currentInvoice.remark }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  PlusOutlined,
  ExportOutlined,
} from '@ant-design/icons-vue'

const loading = ref(false)
const tableLoading = ref(false)
const applyModalVisible = ref(false)
const detailModalVisible = ref(false)
const currentInvoice = ref<any>(null)

const invoiceStats = reactive({
  total: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
  totalAmount: 0,
})

const queryParams = reactive({
  keyword: '',
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
    loadInvoices()
  },
})

const columns = [
  { title: '发票抬头', key: 'title', width: 200 },
  { title: '税号', dataIndex: 'taxNumber', key: 'taxNumber', width: 180 },
  { title: '发票金额', key: 'amount', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '申请时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 120 },
]

const invoiceList = ref([
  { id: 1, invoiceNo: 'INV2024030001', type: 'company', title: '上海某某科技有限公司', taxNumber: '91310000MA1FL1234X', amount: 12800.00, status: 'approved', email: 'finance@example.com', createdAt: '2024-03-15 10:30:00', remark: '' },
  { id: 2, invoiceNo: 'INV2024030002', type: 'company', title: '北京某某信息技术有限公司', taxNumber: '91110000MA1KL5678Y', amount: 5680.50, status: 'pending', email: 'billing@example.com', createdAt: '2024-03-14 15:20:00', remark: '' },
  { id: 3, invoiceNo: 'INV2024030003', type: 'personal', title: '张三', taxNumber: '', amount: 999.00, status: 'approved', email: 'zhangsan@163.com', createdAt: '2024-03-10 09:15:00', remark: '' },
  { id: 4, invoiceNo: 'INV2024030004', type: 'company', title: '深圳某某网络有限公司', taxNumber: '91440000MA5DP1234Z', amount: 15600.00, status: 'rejected', email: '', createdAt: '2024-03-08 14:00:00', remark: '税号信息有误' },
  { id: 5, invoiceNo: 'INV2024030005', type: 'company', title: '广州某某贸易有限公司', taxNumber: '91440100MA5CMT5678A', amount: 8800.00, status: 'approved', email: 'account@example.com', createdAt: '2024-03-05 11:30:00', remark: '' },
])

function updateStats() {
  invoiceStats.total = invoiceList.value.length
  invoiceStats.approved = invoiceList.value.filter(i => i.status === 'approved').length
  invoiceStats.pending = invoiceList.value.filter(i => i.status === 'pending').length
  invoiceStats.rejected = invoiceList.value.filter(i => i.status === 'rejected').length
  invoiceStats.totalAmount = invoiceList.value.reduce((sum, i) => sum + i.amount, 0)
}

updateStats()
paginationConfig.total = invoiceList.value.length

const applyForm = reactive({
  type: 'company',
  title: '',
  taxNumber: '',
  amount: 0,
  email: '',
  remark: '',
})

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(date: string): string {
  if (!date) return '-'
  return date.substring(0, 10)
}

function getStatusName(status: string): string {
  const map: Record<string, string> = {
    pending: '处理中',
    approved: '已开票',
    rejected: '已驳回',
  }
  return map[status] || status
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'orange',
    approved: 'green',
    rejected: 'red',
  }
  return map[status] || 'default'
}

function loadInvoices() {
  tableLoading.value = true
  setTimeout(() => {
    tableLoading.value = false
  }, 500)
}

function showApplyModal() {
  applyForm.type = 'company'
  applyForm.title = ''
  applyForm.taxNumber = ''
  applyForm.amount = 0
  applyForm.email = ''
  applyForm.remark = ''
  applyModalVisible.value = true
}

function handleConfirmApply() {
  if (!applyForm.title) {
    message.error('请输入发票抬头')
    return
  }
  if (applyForm.type === 'company' && !applyForm.taxNumber) {
    message.error('请输入税号')
    return
  }
  if (!applyForm.amount || applyForm.amount <= 0) {
    message.error('请输入正确的开票金额')
    return
  }

  const newInvoice = {
    id: invoiceList.value.length + 1,
    invoiceNo: `INV202403${String(invoiceList.value.length + 1).padStart(4, '0')}`,
    type: applyForm.type,
    title: applyForm.title,
    taxNumber: applyForm.taxNumber || '',
    amount: applyForm.amount,
    status: 'pending',
    email: applyForm.email || '',
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    remark: applyForm.remark || '',
  }

  invoiceList.value.unshift(newInvoice)
  updateStats()
  paginationConfig.total = invoiceList.value.length
  applyModalVisible.value = false
  message.success('开票申请已提交')
}

function viewInvoice(invoice: any) {
  currentInvoice.value = invoice
  detailModalVisible.value = true
}

function handleDownload(invoice: any) {
  message.success(`正在下载发票 ${invoice.invoiceNo}...`)
  setTimeout(() => {
    message.success('下载成功')
  }, 1000)
}

function handleExport() {
  message.success('正在导出发票列表...')
  setTimeout(() => {
    message.success('导出成功')
  }, 1000)
}

onMounted(() => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 300)
})
</script>

<style scoped lang="less">
.invoice-view-page {
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

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-name {
  font-weight: 500;
  color: #1a1a1a;
}

.title-type {
  display: flex;
}

.amount {
  font-weight: 500;
  color: #1a1a1a;
}
</style>
