<template>
  <div class="invoice-view-page">
    <a-spin :spinning="loading">
      <!-- 开票统计 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statText(invoiceStats.total) }}</div>
                <div class="stat-title">账单总数</div>
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
                <div class="stat-value">{{ statText(invoiceStats.paid) }}</div>
                <div class="stat-title">已收款</div>
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
                <div class="stat-value">{{ statText(invoiceStats.unpaid) }}</div>
                <div class="stat-title">未收款</div>
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
                <div class="stat-value">{{ amountText(invoiceStats.totalAmount) }}</div>
                <div class="stat-title">账单总额</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 账单列表 -->
      <a-card title="账单列表" :bordered="false">
        <!-- 申请/导出原占独立卡片、搜索又挤在 #extra，三处分散，合并进一个 FilterBar（搜索靠左、按钮靠右） -->
        <filter-bar>
          <a-input-search
            v-model:value="queryParams.keyword"
            placeholder="搜索账单号/抬头/税号"
            style="width: 250px"
            enter-button
            @search="handleSearch"
          />
          <template #actions>
            <a-space>
              <a-button :loading="exportLoading" size="large" @click="handleExport">
                <template #icon><ExportOutlined /></template>
                导出列表
              </a-button>
              <a-button type="primary" size="large" @click="showApplyModal">
                <template #icon><PlusOutlined /></template>
                申请开票
              </a-button>
            </a-space>
          </template>
        </filter-bar>

        <a-table
          :scroll="{ x: 'max-content' }"
          :columns="columns"
          :data-source="invoiceListData"
          :pagination="paginationConfig"
          :loading="loading"
          :row-key="(record: any) => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <div class="title-cell">
                <!-- 抬头没填就摆「—」。以前后端读口替它编一个「账单」，界面永远看不出这家还没填 -->
                <div class="title-name">{{ record.title || PH_DASH }}</div>
                <div class="title-type">
                  <a-tag :color="invoiceTypeColor(record.invoiceType)" size="small">
                    {{ invoiceTypeLabel(record.invoiceType) }}
                  </a-tag>
                </div>
              </div>
            </template>
            <template v-if="column.key === 'taxNo'">
              {{ record.taxNo || PH_DASH }}
            </template>
            <template v-if="column.key === 'amount'">
              <span class="amount">{{ amountText(record.amount) }}</span>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="invoiceStatusColor(record.status)">
                {{ invoiceStatusLabel(record.status) }}
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
      :confirm-loading="applyLoading"
      @ok="handleConfirmApply"
    >
      <a-form :model="applyForm" layout="vertical">
        <a-form-item label="发票类型" required>
          <!-- 这一组值用的是库里那一列的代码（ENTERPRISE/PERSONAL），不再是界面自造的 company/personal -->
          <a-radio-group v-model:value="applyForm.invoiceType">
            <a-radio :value="InvoiceType.ENTERPRISE">企业发票</a-radio>
            <a-radio :value="InvoiceType.PERSONAL">个人发票</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="发票抬头" required>
          <a-input v-model:value="applyForm.title" placeholder="请输入发票抬头" />
        </a-form-item>
        <a-form-item v-if="invoiceTypeNeedsTaxNo(applyForm.invoiceType)" label="税号" required>
          <a-input v-model:value="applyForm.taxNo" placeholder="请输入税号" />
        </a-form-item>
        <a-form-item label="开票金额" required>
          <a-input-number
            v-model:value="applyForm.totalAmount"
            :min="0.01"
            :max="1000000"
            :formatter="(value: number) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="(value: string) => value.replace(/\¥\s?|(,*)/g, '')"
            style="width: 100%"
            placeholder="请输入开票金额"
          />
        </a-form-item>
        <a-form-item label="接收邮箱">
          <a-input v-model:value="applyForm.contactEmail" placeholder="请输入接收发票的邮箱" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="applyForm.remark" placeholder="可选填写备注信息" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 账单详情弹窗 -->
    <a-modal
      v-model:open="detailModalVisible"
      title="账单详情"
      width="560px"
      :footer="null"
    >
      <a-descriptions :column="2" bordered v-if="currentInvoice">
        <a-descriptions-item label="账单号" :span="2">{{ currentInvoice.invoiceNo || PH_DASH }}</a-descriptions-item>
        <a-descriptions-item label="发票类型">
          <a-tag :color="invoiceTypeColor(currentInvoice.invoiceType)">
            {{ invoiceTypeLabel(currentInvoice.invoiceType) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="账单状态">
          <a-tag :color="invoiceStatusColor(currentInvoice.status)">
            {{ invoiceStatusLabel(currentInvoice.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="发票抬头" :span="2">{{ currentInvoice.title || PH_DASH }}</a-descriptions-item>
        <a-descriptions-item label="税号" :span="2">{{ currentInvoice.taxNo || PH_DASH }}</a-descriptions-item>
        <a-descriptions-item label="账单金额" :span="2">
          <span class="amount">{{ amountText(currentInvoice.amount) }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="已收金额" :span="2">{{ amountText(currentInvoice.paidAmount) }}</a-descriptions-item>
        <a-descriptions-item label="未收金额" :span="2">{{ amountText(currentInvoice.unpaidAmount) }}</a-descriptions-item>
        <a-descriptions-item label="支付方式" :span="2">{{ paymentMethodLabel(currentInvoice.paymentMethod) }}</a-descriptions-item>
        <a-descriptions-item label="接收邮箱" :span="2">{{ currentInvoice.contactEmail || PH_DASH }}</a-descriptions-item>
        <a-descriptions-item label="开票日期" :span="2">{{ formatDate(currentInvoice.billingDate) }}</a-descriptions-item>
        <a-descriptions-item label="到期日" :span="2">{{ formatDate(currentInvoice.dueDate) }}</a-descriptions-item>
        <a-descriptions-item label="创建时间" :span="2">{{ formatDateTime(currentInvoice.createdAt) }}</a-descriptions-item>
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
import { formatDate, formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'
import { PH_DASH } from '../../utils/display'
import FilterBar from '../../components/FilterBar.vue'
import { foldInvoiceStatus, invoiceStatusLabel, invoiceStatusColor } from '../../utils/invoiceStatus'
import { InvoiceType, invoiceTypeLabel, invoiceTypeColor, invoiceTypeNeedsTaxNo } from '../../utils/invoiceType'
import { paymentMethodLabel } from '../../utils/paymentMethod'

const authStore = useAuthStore()

const loading = ref(false)
const exportLoading = ref(false)
const applyLoading = ref(false)
const applyModalVisible = ref(false)
const detailModalVisible = ref(false)
const currentInvoice = ref<any>(null)

/** null = 这一格没取到，界面上摆「—」；以前是拿本页十条求和冒充全量总额，还恒 0 地摆「已开票/已驳回」 */
const invoiceStats = reactive({
  total: null as number | null,
  paid: null as number | null,
  unpaid: null as number | null,
  totalAmount: null as number | null,
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
  { title: '税号', key: 'taxNo', width: 180 },
  { title: '账单金额', key: 'amount', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 120 },
]

const invoiceListData = ref<any[]>([])

function statText(value: number | null): string {
  return value === null ? PH_DASH : String(value)
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 钱没读到就说没读到，不许念成 ¥0.00（同一个租户真金白银的账单，被一个 undefined 报成零元） */
function amountText(amount?: number | null): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return PH_DASH
  return `¥${formatAmount(Number(amount))}`
}

/**
 * 详情那一口回的是实体自己的键（totalAmount / invoiceType / taxNo / contactEmail），
 * 列表那一口回的是投影过的键（amount / 已折过小写档的 status）。以前这一屏不管来的是哪种
 * 都直接按 amount/type/taxNumber/email 去读，四个键一个也对不上：金额格让 undefined
 * 把整张弹窗的渲染炸掉，类型每行硬念「个人」，税号恒空。这里一次折成界面自己的形状。
 */
function toViewInvoice(raw: any): any {
  if (!raw) return null
  return {
    ...raw,
    amount: raw.amount !== undefined && raw.amount !== null ? raw.amount : raw.totalAmount,
    invoiceType: raw.invoiceType ?? raw.type,
    taxNo: raw.taxNo ?? raw.taxNumber,
    contactEmail: raw.contactEmail ?? raw.email,
    status: foldInvoiceStatus(raw.status, raw.paymentStatus),
  }
}

async function loadStats() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  try {
    const res = await invoiceApi.statistics({ tenantId })
    invoiceStats.total = res.totalCount ?? null
    invoiceStats.paid = res.paidCount ?? null
    invoiceStats.unpaid = res.unpaidCount ?? null
    invoiceStats.totalAmount = res.totalAmount ?? null
  } catch (error) {
    logError('billing/invoice-view', 'Failed to load invoice statistics:', error)
    invoiceStats.total = null
    invoiceStats.paid = null
    invoiceStats.unpaid = null
    invoiceStats.totalAmount = null
  }
}

function handleSearch() {
  paginationConfig.current = 1
  loadInvoiceList()
}

const applyForm = reactive({
  invoiceType: InvoiceType.ENTERPRISE as string,
  title: '',
  taxNo: '',
  totalAmount: 0,
  contactEmail: '',
  remark: '',
})

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
    invoiceListData.value = (res.records || []).map(toViewInvoice)
    paginationConfig.total = res.total || 0
  } catch (error) {
    logError('billing/invoice-view', 'Failed to load invoices:', error)
    message.error('加载账单列表失败')
    invoiceListData.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    loadInvoiceList()
    loadStats()
  }
)

function showApplyModal() {
  applyForm.invoiceType = InvoiceType.ENTERPRISE
  applyForm.title = ''
  applyForm.taxNo = ''
  applyForm.totalAmount = 0
  applyForm.contactEmail = ''
  applyForm.remark = ''
  applyModalVisible.value = true
}

async function handleConfirmApply() {
  if (!applyForm.title) {
    message.error('请输入发票抬头')
    return
  }
  if (invoiceTypeNeedsTaxNo(applyForm.invoiceType) && !applyForm.taxNo) {
    message.error('请输入税号')
    return
  }
  if (!applyForm.totalAmount || applyForm.totalAmount <= 0) {
    message.error('请输入正确的开票金额')
    return
  }

  const tenantId = authStore.selectedTenantId || authStore.tenantId
  applyLoading.value = true
  try {
    // 这一发以前发的是 {type, taxNumber, amount, email}，后端那个写口一个键都不认，
    // 人填的金额、税号、类型、邮箱整段丢掉，库里落一条空的账单行。键名改成实体自己那四列。
    await invoiceApi.create({
      tenantId,
      title: applyForm.title,
      invoiceType: applyForm.invoiceType,
      taxNo: applyForm.taxNo || undefined,
      totalAmount: applyForm.totalAmount,
      contactEmail: applyForm.contactEmail || undefined,
      remark: applyForm.remark || undefined,
    })
    applyModalVisible.value = false
    message.success('开票申请已提交')
    paginationConfig.current = 1
    await Promise.all([loadInvoiceList(), loadStats()])
  } catch (error) {
    logError('billing/invoice-view', 'Failed to create invoice:', error)
    message.error('申请开票失败')
  } finally {
    applyLoading.value = false
  }
}

async function viewInvoice(invoice: any) {
  try {
    const res = await invoiceApi.getDetail(invoice.id)
    currentInvoice.value = toViewInvoice(res.invoice || res)
    detailModalVisible.value = true
  } catch (error) {
    logError('billing/invoice-view', 'Failed to load invoice detail:', error)
    message.error('加载账单详情失败')
  }
}

async function handleExport() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  exportLoading.value = true
  try {
    const params: any = { tenantId }
    if (queryParams.keyword) params.keyword = queryParams.keyword

    const res = await invoiceApi.export(params)
    const blob = res as unknown as Blob
    // 这一屏漏了形状判断：后端那一口要是回 JSON 错误壳，界面也照样下出一个假文件并念「导出成功」
    if (!blob.type?.toLowerCase().includes('csv')) {
      message.error(`导出没拿到文件（后端回的是 ${blob.type || '未知类型'}）`)
      return
    }
    const text = await blob.text()
    const rows = text.split('\n').filter(line => line.trim().length > 0).length - 1
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `invoices_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success(`已导出 ${rows} 条账单`)
  } catch (error) {
    logError('billing/invoice-view', 'Failed to export invoices:', error)
    message.error('导出失败')
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadInvoiceList(), loadStats()])
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
