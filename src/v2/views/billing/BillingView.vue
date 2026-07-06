<template>
  <div class="billing-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <WalletOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">¥{{ formatAmount(accountBalance.availableBalance) }}</div>
                <div class="stat-title">可用余额</div>
              </div>
            </div>
            <div class="stat-actions">
              <a-button type="link" size="small" @click="showRechargeModal">充值</a-button>
              <a-button type="link" size="small" @click="showWithdrawModal">提现</a-button>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ invoiceStats.total }}</div>
                <div class="stat-title">本月账单</div>
              </div>
            </div>
            <div class="stat-extra">
              <span class="pending">待付 {{ invoiceStats.pending }}</span>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <DollarOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">¥{{ formatAmount(consumptionStats.monthAmount) }}</div>
                <div class="stat-title">本月消费</div>
              </div>
            </div>
            <div class="stat-extra">
              <span :class="consumptionStats.growthRate >= 0 ? 'growth-up' : 'growth-down'">
                {{ consumptionStats.growthRate >= 0 ? '+' : '' }}{{ consumptionStats.growthRate.toFixed(1) }}%
              </span>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <BankOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">¥{{ formatAmount(accountBalance.creditLimit || 0) }}</div>
                <div class="stat-title">信用额度</div>
              </div>
            </div>
            <div class="stat-extra">
              <span class="credit-used">已用 ¥{{ formatAmount((accountBalance.creditLimit || 0) - accountBalance.availableBalance) }}</span>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card title="充值套餐" :bordered="false" style="margin-bottom: 16px">
        <a-row :gutter="16">
          <a-col :span="6" v-for="pkg in rechargePackages" :key="pkg.id">
            <a-card
              :class="['package-card', { popular: pkg.isPopular, recommended: pkg.isRecommended }]"
              hoverable
            >
              <div v-if="pkg.isPopular" class="package-badge popular">热门</div>
              <div v-if="pkg.isRecommended" class="package-badge recommended">推荐</div>
              <div class="package-name">{{ pkg.name }}</div>
              <div class="package-price">
                <span class="price-symbol">¥</span>
                <span class="price-value">{{ pkg.discountAmount }}</span>
              </div>
              <div class="package-original" v-if="pkg.originalAmount > pkg.discountAmount">
                原价 ¥{{ pkg.originalAmount }}
              </div>
              <div class="package-bonus" v-if="pkg.bonusAmount > 0">
                赠送 ¥{{ pkg.bonusAmount }}
              </div>
              <div class="package-total">
                到账 ¥{{ pkg.totalAmount }}
              </div>
              <a-button
                type="primary"
                block
                :type="pkg.isRecommended ? 'primary' : 'default'"
                @click="handleRechargePackage(pkg.id)"
              >
                立即购买
              </a-button>
            </a-card>
          </a-col>
        </a-row>
      </a-card>

      <a-card title="账单管理" :bordered="false">
        <template #extra>
          <a-space>
            <a-select
              v-model:value="queryParams.status"
              style="width: 120px"
              placeholder="状态"
              allowClear
              @change="loadInvoices"
            >
              <a-select-option :value="InvoiceStatus.PENDING">待支付</a-select-option>
              <a-select-option :value="InvoiceStatus.PAID">已支付</a-select-option>
              <a-select-option :value="InvoiceStatus.OVERDUE">已逾期</a-select-option>
              <a-select-option :value="InvoiceStatus.CANCELLED">已取消</a-select-option>
            </a-select>
            <a-range-picker
              v-model:value="dateRange"
              style="width: 240px"
              @change="handleDateChange"
            />
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索账单号"
              style="width: 200px"
              enter-button
              @search="loadInvoices"
            />
            <a-button @click="handleExport">导出</a-button>
          </a-space>
        </template>

        <a-table
          :columns="invoiceColumns"
          :data-source="invoiceList"
          :pagination="pagination"
          :row-key="record => record.id"
          :loading="tableLoading"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'invoiceNo'">
              <a @click="viewInvoiceDetail(record)">{{ record.invoiceNo }}</a>
            </template>
            <template v-if="column.key === 'amount'">
              <span class="amount">¥{{ formatAmount(record.amount) }}</span>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusName(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'paymentMethod'">
              {{ getPaymentMethodName(record.paymentMethod) }}
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="viewInvoiceDetail(record)">
                  详情
                </a-button>
                <a-button
                  v-if="record.status === InvoiceStatus.PENDING"
                  type="link"
                  size="small"
                  @click="handlePay(record)"
                >
                  支付
                </a-button>
                <a-button
                  v-if="record.status === InvoiceStatus.PAID"
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

    <a-modal
      v-model:open="rechargeModalVisible"
      title="账户充值"
      width="520px"
      :confirm-loading="rechargeLoading"
      @ok="handleConfirmRecharge"
    >
      <a-form :model="rechargeForm" layout="vertical">
        <a-form-item label="充值金额">
          <a-input-number
            v-model:value="rechargeForm.amount"
            :min="1"
            :max="100000"
            :formatter="value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="value => value.replace(/\¥\s?|(,*)/g, '')"
            style="width: 100%"
            placeholder="请输入充值金额"
          />
        </a-form-item>
        <a-form-item label="支付方式">
          <a-radio-group v-model:value="rechargeForm.paymentMethod">
            <a-radio value="alipay">支付宝</a-radio>
            <a-radio value="wechat">微信支付</a-radio>
            <a-radio value="bank_transfer">银行转账</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="withdrawModalVisible"
      title="账户提现"
      width="520px"
      @ok="handleConfirmWithdraw"
    >
      <a-form :model="withdrawForm" layout="vertical">
        <a-form-item label="提现金额">
          <a-input-number
            v-model:value="withdrawForm.amount"
            :min="1"
            :max="accountBalance.availableBalance"
            :formatter="value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="value => value.replace(/\¥\s?|(,*)/g, '')"
            style="width: 100%"
            placeholder="请输入提现金额"
          />
        </a-form-item>
        <a-form-item label="提现账户">
          <a-select v-model:value="withdrawForm.accountId" placeholder="请选择提现账户">
            <a-select-option value="1">招商银行 ****8888</a-select-option>
            <a-select-option value="2">支付宝 138****8888</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <InvoiceDetailDrawer
      v-model:open="detailDrawerVisible"
      :invoice-id="currentInvoiceId"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  WalletOutlined,
  FileTextOutlined,
  DollarOutlined,
  BankOutlined,
} from '@ant-design/icons-vue'
import { InvoiceStatus, PaymentMethod, Currency } from '../../types/billing'
import type { Invoice, RechargePackage } from '../../types/billing'
import { walletApi, packageApi, statsApi, invoiceApi } from '../../api/billing'
import { useAuthStore } from '../../stores/auth'
import InvoiceDetailDrawer from './InvoiceDetailDrawer.vue'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const rechargeLoading = ref(false)
const rechargeModalVisible = ref(false)
const withdrawModalVisible = ref(false)
const detailDrawerVisible = ref(false)
const currentInvoiceId = ref<number | null>(null)
const dateRange = ref<[string, string] | undefined>()

const accountBalance = reactive({
  balance: 0,
  frozenBalance: 0,
  availableBalance: 0,
  currency: Currency.CNY,
  creditLimit: 0,
  totalIncome: 0,
  totalExpense: 0,
})

const invoiceStats = reactive({
  total: 0,
  pending: 0,
  paid: 0,
})

const consumptionStats = reactive({
  monthAmount: 0,
  growthRate: 0,
})

const queryParams = reactive({
  tenantId: 1,
  status: undefined as InvoiceStatus | undefined,
  keyword: '',
  startDate: undefined as string | undefined,
  endDate: undefined as string | undefined,
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (page: number, pageSize: number) => {
    pagination.current = page
    pagination.pageSize = pageSize
    loadInvoices()
  },
})

const rechargePackages = ref<RechargePackage[]>([])

const invoiceList = ref<Invoice[]>([])

const invoiceColumns = [
  { title: '账单号', dataIndex: 'invoiceNo', key: 'invoiceNo', width: 180 },
  { title: '账单标题', dataIndex: 'title', key: 'title', width: 200 },
  { title: '金额', key: 'amount', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '支付方式', key: 'paymentMethod', width: 100 },
  { title: '到期日', dataIndex: 'dueDate', key: 'dueDate', width: 120 },
  { title: '支付时间', dataIndex: 'paidAt', key: 'paidAt', width: 180 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 },
]

const rechargeForm = reactive({
  amount: 100,
  paymentMethod: 'alipay',
})

const withdrawForm = reactive({
  amount: 100,
  accountId: undefined as string | undefined,
})

function getTenantId(): number {
  return authStore.selectedTenantId || authStore.tenantId || 1
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getStatusName(status: InvoiceStatus): string {
  const nameMap: Record<InvoiceStatus, string> = {
    [InvoiceStatus.DRAFT]: '草稿',
    [InvoiceStatus.PENDING]: '待支付',
    [InvoiceStatus.PAID]: '已支付',
    [InvoiceStatus.OVERDUE]: '已逾期',
    [InvoiceStatus.CANCELLED]: '已取消',
    [InvoiceStatus.REFUNDED]: '已退款',
  }
  return nameMap[status] || status
}

function getStatusColor(status: InvoiceStatus): string {
  const colorMap: Record<InvoiceStatus, string> = {
    [InvoiceStatus.DRAFT]: 'default',
    [InvoiceStatus.PENDING]: 'orange',
    [InvoiceStatus.PAID]: 'green',
    [InvoiceStatus.OVERDUE]: 'red',
    [InvoiceStatus.CANCELLED]: 'default',
    [InvoiceStatus.REFUNDED]: 'blue',
  }
  return colorMap[status] || 'default'
}

function getPaymentMethodName(method?: PaymentMethod | string): string {
  if (!method) return '-'
  const nameMap: Record<string, string> = {
    [PaymentMethod.ALIPAY]: '支付宝',
    [PaymentMethod.WECHAT]: '微信支付',
    [PaymentMethod.BANK_TRANSFER]: '银行转账',
    [PaymentMethod.CREDIT_CARD]: '信用卡',
    [PaymentMethod.BALANCE]: '余额支付',
  }
  return nameMap[method] || method
}

async function loadWalletInfo() {
  const tenantId = getTenantId()
  try {
    const res = await walletApi.getInfo(tenantId)
    if (res) {
      accountBalance.balance = res.balance || 0
      accountBalance.frozenBalance = res.frozenAmount || res.frozenBalance || 0
      accountBalance.availableBalance = res.availableBalance || 0
      accountBalance.creditLimit = res.creditLimit || 0
      accountBalance.totalIncome = res.totalRecharge || res.totalIncome || 0
      accountBalance.totalExpense = res.totalConsume || res.totalExpense || 0
    }
  } catch (error: any) {
    console.error('加载钱包信息失败:', error)
    message.error(error.message || '加载钱包信息失败')
  }
}

async function loadPackages() {
  const tenantId = getTenantId()
  try {
    const res = await packageApi.list(tenantId)
    rechargePackages.value = res as unknown as RechargePackage[]
  } catch (error: any) {
    console.error('加载充值套餐失败:', error)
    message.error(error.message || '加载充值套餐失败')
    rechargePackages.value = []
  }
}

async function loadStats() {
  const tenantId = getTenantId()
  try {
    const res = await statsApi.overview(tenantId)
    if (res) {
      consumptionStats.monthAmount = res.thisMonthConsume || res.monthAmount || 0
      consumptionStats.growthRate = res.growthRate || 0
    }
  } catch (error: any) {
    console.error('加载消费统计失败:', error)
    message.error(error.message || '加载消费统计失败')
  }
}

async function loadInvoices() {
  const tenantId = getTenantId()
  tableLoading.value = true
  try {
    const params: any = {
      tenantId,
      page: pagination.current,
      size: pagination.pageSize,
    }
    if (queryParams.status) params.status = queryParams.status
    if (queryParams.keyword) params.keyword = queryParams.keyword
    if (queryParams.startDate) params.startDate = queryParams.startDate
    if (queryParams.endDate) params.endDate = queryParams.endDate

    const res = await invoiceApi.list(params)
    invoiceList.value = res.records || []
    pagination.total = res.total || 0

    let pendingCount = 0
    let paidCount = 0
    invoiceList.value.forEach(inv => {
      if (inv.status === InvoiceStatus.PENDING) pendingCount++
      if (inv.status === InvoiceStatus.PAID) paidCount++
    })
    invoiceStats.total = invoiceList.value.length
    invoiceStats.pending = pendingCount
    invoiceStats.paid = paidCount
  } catch (error: any) {
    console.error('加载账单列表失败:', error)
    message.error(error.message || '加载账单列表失败')
    invoiceList.value = []
    pagination.total = 0
  } finally {
    tableLoading.value = false
  }
}

async function loadAllData() {
  loading.value = true
  try {
    await Promise.all([
      loadWalletInfo(),
      loadPackages(),
      loadStats(),
      loadInvoices(),
    ])
  } finally {
    loading.value = false
  }
}

function handleDateChange(dates: [string, string] | undefined) {
  if (dates && dates[0] && dates[1]) {
    queryParams.startDate = dates[0]
    queryParams.endDate = dates[1]
  } else {
    queryParams.startDate = undefined
    queryParams.endDate = undefined
  }
  loadInvoices()
}

function handleExport() {
  message.info('导出功能开发中')
}

function showRechargeModal() {
  rechargeForm.amount = 100
  rechargeForm.paymentMethod = 'alipay'
  rechargeModalVisible.value = true
}

function showWithdrawModal() {
  withdrawForm.amount = 100
  withdrawForm.accountId = undefined
  withdrawModalVisible.value = true
}

async function handleConfirmRecharge() {
  if (!rechargeForm.amount || rechargeForm.amount <= 0) {
    message.warning('请输入充值金额')
    return
  }
  const tenantId = getTenantId()
  rechargeLoading.value = true
  try {
    await walletApi.recharge(tenantId, rechargeForm.amount, rechargeForm.paymentMethod)
    message.success('充值成功')
    rechargeModalVisible.value = false
    await loadWalletInfo()
    await loadStats()
  } catch (error: any) {
    console.error('充值失败:', error)
    message.error(error.message || '充值失败')
  } finally {
    rechargeLoading.value = false
  }
}

function handleConfirmWithdraw() {
  message.info('提现功能开发中')
  withdrawModalVisible.value = false
}

function handleRechargePackage(packageId: number) {
  const pkg = rechargePackages.value.find(p => p.id === packageId)
  if (pkg) {
    rechargeForm.amount = pkg.discountAmount
    rechargeForm.paymentMethod = 'alipay'
    rechargeModalVisible.value = true
  }
}

function viewInvoiceDetail(record: Invoice) {
  currentInvoiceId.value = record.id
  detailDrawerVisible.value = true
}

async function handlePay(record: Invoice) {
  try {
    await invoiceApi.pay(record.id, { paymentMethod: 'balance' })
    message.success('支付成功')
    await loadInvoices()
    await loadWalletInfo()
    await loadStats()
  } catch (error: any) {
    console.error('支付失败:', error)
    message.error(error.message || '支付失败')
  }
}

async function handleDownload(record: Invoice) {
  try {
    const res = await invoiceApi.download(record.id)
    const url = window.URL.createObjectURL(new Blob([res as any]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `账单_${record.invoiceNo}.pdf`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('下载成功')
  } catch (error: any) {
    console.error('下载失败:', error)
    message.error(error.message || '下载失败')
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    pagination.current = 1
    loadAllData()
  }
)

onMounted(() => {
  loadAllData()
})
</script>

<style scoped lang="less">
.billing-page {
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
  margin-bottom: 12px;
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

.stat-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.stat-extra {
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.pending {
  color: #fa8c16;
}

.growth-up {
  color: #52c41a;
}

.growth-down {
  color: #ff4d4f;
}

.credit-used {
  color: #8c8c8c;
}

.package-card {
  position: relative;
  text-align: center;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  &.popular {
    border-color: #fa8c16;
  }

  &.recommended {
    border-color: #1890ff;
  }
}

.package-badge {
  position: absolute;
  top: -1px;
  right: -1px;
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 0 8px 0 8px;
  color: #fff;

  &.popular {
    background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%);
  }

  &.recommended {
    background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  }
}

.package-name {
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 12px;
}

.package-price {
  margin-bottom: 8px;

  .price-symbol {
    font-size: 16px;
    color: #ff4d4f;
  }

  .price-value {
    font-size: 32px;
    font-weight: 600;
    color: #ff4d4f;
  }
}

.package-original {
  font-size: 13px;
  color: #8c8c8c;
  text-decoration: line-through;
  margin-bottom: 4px;
}

.package-bonus {
  font-size: 13px;
  color: #52c41a;
  margin-bottom: 4px;
}

.package-total {
  font-size: 14px;
  color: #1a1a1a;
  margin-bottom: 16px;
}

.amount {
  font-weight: 500;
  color: #1a1a1a;
}
</style>
