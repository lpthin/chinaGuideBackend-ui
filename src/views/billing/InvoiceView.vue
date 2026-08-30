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
            @search="handleSearch"
          />
        </template>

        <a-table
          :columns="columns"
          :data-source="invoiceListData"
          :pagination="paginationConfig"
          :loading="loading"
          :row-key="(record: any) => record.id"
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
            :formatter="(value: number) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="(value: string) => value.replace(/\¥\s?|(,*)/g, '')"
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
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  PlusOutlined,
  ExportOutlined,
} from '@ant-design/icons-vue'
import { invoiceApi } from '../../api/billing'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
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
    loadInvoiceList()
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

const invoiceListData = ref<any[]>([])

function updateStats(records: any[] = invoiceListData.value) {
  invoiceStats.total = paginationConfig.total
  invoiceStats.approved = records.filter(i => i.status === 'approved').length
  invoiceStats.pending = records.filter(i => i.status === 'pending').length
  invoiceStats.rejected = records.filter(i => i.status === 'rejected').length
  invoiceStats.totalAmount = records.reduce((sum, i) => sum + i.amount, 0)
}

function handleSearch() {
  paginationConfig.current = 1
  loadInvoiceList()
}

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

async function loadInvoiceList() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  loading.value = true
  try {
    const params: any = {
      tenantId,
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
    }
    if (queryParams.keyword) params.keyword = queryParams.keyword

    const res = await invoiceApi.list(params)
    invoiceListData.value = res.records || []
    paginationConfig.total = res.total || 0
    updateStats(res.records || [])
  } catch (error) {
    console.error('Failed to load invoices:', error)
    message.error('加载发票列表失败')
    invoiceListData.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    loadInvoiceList()
  }
)

function showApplyModal() {
  applyForm.type = 'company'
  applyForm.title = ''
  applyForm.taxNumber = ''
  applyForm.amount = 0
  applyForm.email = ''
  applyForm.remark = ''
  applyModalVisible.value = true
}

async function handleConfirmApply() {
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

  const tenantId = authStore.selectedTenantId || authStore.tenantId
  loading.value = true
  try {
    await invoiceApi.create({
      tenantId,
      title: applyForm.title,
      type: applyForm.type,
      taxNumber: applyForm.taxNumber || undefined,
      amount: applyForm.amount,
      email: applyForm.email || undefined,
      remark: applyForm.remark || undefined,
    })
    applyModalVisible.value = false
    message.success('开票申请已提交')
    paginationConfig.current = 1
    loadInvoiceList()
  } catch (error) {
    console.error('Failed to create invoice:', error)
    message.error('申请开票失败')
  } finally {
    loading.value = false
  }
}

async function viewInvoice(invoice: any) {
  try {
    const res = await invoiceApi.getDetail(invoice.id)
    currentInvoice.value = res.invoice || res
    detailModalVisible.value = true
  } catch (error) {
    console.error('Failed to load invoice detail:', error)
    message.error('加载发票详情失败')
  }
}

async function handleDownload(invoice: any) {
  try {
    const res = await invoiceApi.download(invoice.id)
    const url = window.URL.createObjectURL(new Blob([res as any]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${invoice.invoiceNo || 'invoice'}.pdf`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('下载成功')
  } catch (error) {
    console.error('Failed to download invoice:', error)
    message.error('下载失败')
  }
}

async function handleExport() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  try {
    const params: any = { tenantId }
    const res = await invoiceApi.export(params)
    const url = window.URL.createObjectURL(new Blob([res as any]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `invoices_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch (error) {
    console.error('Failed to export invoices:', error)
    message.error('导出失败')
  }
}

onMounted(async () => {
  await loadInvoiceList()
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
