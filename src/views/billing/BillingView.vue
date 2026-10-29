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
                <div class="stat-value">{{ walletStatText(accountBalance.availableBalance) }}</div>
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
                <div class="stat-value">{{ pagination.total }}</div>
                <div class="stat-title">{{ filterActive ? '筛选命中条数' : '账单总数' }}</div>
              </div>
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
            <div class="stat-extra" v-if="consumptionStats.lastMonthAmount > 0">
              <span :class="consumptionStats.growthRate >= 0 ? 'growth-up' : 'growth-down'">
                {{ consumptionStats.growthRate >= 0 ? '+' : '' }}{{ formatDecimal(consumptionStats.growthRate, 1) }}%
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
                <!-- 这一张以前读的是「信用额度」：后端那一格写死 50000.00，库里没有这一列（M-P91 拍板 2）。
                     换成读真有的 frozen_balance，标题一并改口 -->
                <div class="stat-value">{{ walletStatText(accountBalance.frozenBalance) }}</div>
                <div class="stat-title">冻结金额</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 「这家还没有钱包」与「这一发没读到」分开念，四张卡不许用 ¥0.00 糊过去 -->
      <a-alert
        v-if="walletNotice"
        :message="walletNotice"
        type="warning"
        show-icon
        style="margin-bottom: 16px"
      />

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
                :type="pkg.isRecommended ? 'primary' : 'default'"
                block
                @click="handleRechargePackage(pkg.id)"
              >
                立即购买
              </a-button>
            </a-card>
          </a-col>
        </a-row>
      </a-card>

      <a-card title="账单管理" :bordered="false">
        <!-- 筛选原挤在卡片 #extra、和列表分两处，收进 FilterBar：字段靠左、导出靠右 -->
        <filter-bar>
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
            value-format="YYYY-MM-DD"
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
          <template #actions>
            <a-space>
              <a-button :loading="exportLoading" @click="handleExport">导出</a-button>
            </a-space>
          </template>
        </filter-bar>

        <a-table
          :scroll="{ x: 'max-content' }"
          :columns="invoiceColumns"
          :data-source="invoiceList"
          :pagination="pagination"
          :row-key="(record: any) => record.id"
          :loading="tableLoading"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'invoiceNo'">
              <a @click="viewInvoiceDetail(record)">{{ record.invoiceNo }}</a>
            </template>
            <template v-if="column.key === 'title'">
              <!-- 读口以前会把没填的抬头编成「账单」，现在原样回 null：没填就摆「—」，不替它起名 -->
              {{ record.title || '—' }}
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
              {{ paymentMethodLabel(record.paymentMethod) }}
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
            :formatter="(value: number) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="(value: string) => value.replace(/\¥\s?|(,*)/g, '')"
            style="width: 100%"
            placeholder="请输入充值金额"
          />
        </a-form-item>
        <a-form-item label="支付方式">
          <!-- 值用库里那种大写代码，中文由 paymentMethod.ts 那张词表翻；
               充值方式不再预先选中，让点的人自己点名（后端会校验） -->
          <a-radio-group v-model:value="rechargeForm.paymentMethod">
            <a-radio v-for="code in RECHARGE_METHODS" :key="code" :value="code">
              <span>{{ paymentMethodLabel(code) }}</span>
            </a-radio>
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
            :max="accountBalance.availableBalance ?? undefined"
            :formatter="(value: number) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="(value: string) => value.replace(/\¥\s?|(,*)/g, '')"
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
      @paid="loadInvoices"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  WalletOutlined,
  FileTextOutlined,
  DollarOutlined,
  BankOutlined,
} from '@ant-design/icons-vue'
import { InvoiceStatus, Currency } from '../../types/billing'
import { invoiceStatusLabel, invoiceStatusColor } from '../../utils/invoiceStatus'
import type { Invoice, RechargePackage } from '../../types/billing'
import { walletApi, packageApi, statsApi, invoiceApi, balanceApi } from '../../api/billing'
import { describeHttpError } from '../../api/http'
import { formatDate, formatDateTime, formatDecimal } from '../../utils/format'
import { paymentMethodLabel, type PaymentMethodCode } from '../../utils/paymentMethod'
import { walletIsActive } from '../../utils/walletState'
import { useAuthStore } from '../../stores/auth'
import InvoiceDetailDrawer from './InvoiceDetailDrawer.vue'
import FilterBar from '../../components/FilterBar.vue'
import { logError } from '../../utils/errorLog'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const rechargeLoading = ref(false)
const exportLoading = ref(false)
const rechargeModalVisible = ref(false)
const withdrawModalVisible = ref(false)
const detailDrawerVisible = ref(false)
const currentInvoiceId = ref<number | null>(null)
const dateRange = ref<[string, string] | undefined>()

// 卡片上那两个金额是「读回来的」，读不到就是 null，不许用 0 冒充「查过了，就是零钱」
const accountBalance = reactive({
  balance: null as number | null,
  frozenBalance: null as number | null,
  availableBalance: null as number | null,
  currency: Currency.CNY,
  totalIncome: null as number | null,
  totalExpense: null as number | null,
})

// 「这家还没有钱包」与「这一发没读到」是两件事，分开记（见 utils/walletState.ts）
const walletMissing = ref(false)
const walletReadFailed = ref('')

const consumptionStats = reactive({
  monthAmount: 0,
  lastMonthAmount: 0,
  growthRate: 0,
})

const queryParams = reactive({
  tenantId: getTenantId(),
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
  { title: '到期日', dataIndex: 'dueDate', key: 'dueDate', width: 120, customRender: ({ text }: { text?: string }) => formatDate(text) },
  { title: '支付时间', dataIndex: 'paidAt', key: 'paidAt', width: 180, customRender: ({ text }: { text?: string }) => formatDateTime(text) },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, customRender: ({ text }: { text?: string }) => formatDateTime(text) },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 },
]

// 充值这一档只开三种方式（与钱包屏那一档保持一致）；中文与大写代码都出自 paymentMethod.ts 那张词表。
// 后端接受词表里的五种，这里只摆这三种是界面选择，不是后端闸。
const RECHARGE_METHODS: PaymentMethodCode[] = ['ALIPAY', 'WECHAT', 'BANK_TRANSFER']

const rechargeForm = reactive({
  amount: 100,
  paymentMethod: '' as PaymentMethodCode | '',
})

const withdrawForm = reactive({
  amount: 100,
  accountId: undefined as string | undefined,
})

function getTenantId(): number {
  return authStore.selectedTenantId || authStore.tenantId || 1
}

function formatAmount(amount?: number | null): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '-'
  return Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getStatusName(status: InvoiceStatus): string {
  return invoiceStatusLabel(status)
}

function getStatusColor(status: InvoiceStatus): string {
  return invoiceStatusColor(status)
}

/** 第二张卡的数就是列表的总数：一有筛选它就不是「账单总数」了，标题跟着改口 */
const filterActive = computed(() =>
  Boolean(queryParams.status || queryParams.keyword || queryParams.startDate || queryParams.endDate)
)

/** 卡片上的钱：读失败说「没取到」，这家没开过钱包说「—」，都不许念成 ¥0.00 */
function walletStatText(amount: number | null): string {
  if (walletReadFailed.value) return '没取到'
  if (amount === null || amount === undefined) return '—'
  return `¥${formatAmount(amount)}`
}

/** 四张卡下面那句话：把「还没有钱包」与「这一发没读到」分开念 */
const walletNotice = computed(() => {
  if (walletReadFailed.value) return `钱包没读到：${walletReadFailed.value}`
  if (walletMissing.value) return '这家还没有钱包，充值后这里会显示余额'
  return ''
})

async function loadWalletInfo() {
  const tenantId = getTenantId()
  walletReadFailed.value = ''
  walletMissing.value = false
  try {
    const res = await walletApi.getInfo(tenantId)
    if (res) {
      // walletState 的两个字面串出自后端 BillingWalletController（utils/walletState.ts 是唯一出处）
      walletMissing.value = !walletIsActive(res)
      accountBalance.balance = res.balance ?? null
      accountBalance.frozenBalance = walletMissing.value ? null : (res.frozenAmount ?? res.frozenBalance ?? 0)
      accountBalance.availableBalance = walletMissing.value ? null : (res.availableBalance ?? 0)
      accountBalance.totalIncome = res.totalRecharge ?? res.totalIncome ?? null
      accountBalance.totalExpense = res.totalConsume ?? res.totalExpense ?? null
    }
  } catch (error: any) {
    logError('billing/billing-view', '加载钱包信息失败:', error)
    // 读失败不把上一轮的旧数字继续摆着：那一眼看上去像「余额还是这些」
    accountBalance.balance = null
    accountBalance.frozenBalance = null
    accountBalance.availableBalance = null
    accountBalance.totalIncome = null
    accountBalance.totalExpense = null
    walletMissing.value = false
    walletReadFailed.value = describeHttpError(error)
    message.error(`加载钱包信息失败：${describeHttpError(error)}`)
  }
}

async function loadPackages() {
  const tenantId = getTenantId()
  try {
    const res = await packageApi.list(tenantId)
    rechargePackages.value = res as unknown as RechargePackage[]
  } catch (error: any) {
    logError('billing/billing-view', '加载充值套餐失败:', error)
    message.error(`加载充值套餐失败：${describeHttpError(error)}`)
    rechargePackages.value = []
  }
}

async function loadStats() {
  const tenantId = getTenantId()
  try {
    const res = await statsApi.overview(tenantId)
    if (res) {
      consumptionStats.monthAmount = res.thisMonthConsume || res.monthAmount || 0
      consumptionStats.lastMonthAmount = res.lastMonthConsume || 0
      consumptionStats.growthRate = res.growthRate || 0
    }
  } catch (error: any) {
    logError('billing/billing-view', '加载消费统计失败:', error)
    message.error(`加载消费统计失败：${describeHttpError(error)}`)
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
  } catch (error: any) {
    logError('billing/billing-view', '加载账单列表失败:', error)
    message.error(`加载账单列表失败：${describeHttpError(error)}`)
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

async function handleExport() {
  const tenantId = getTenantId()
  exportLoading.value = true
  try {
    const params: any = { tenantId }
    if (queryParams.status) params.status = queryParams.status
    if (queryParams.startDate) params.startDate = queryParams.startDate
    if (queryParams.endDate) params.endDate = queryParams.endDate

    const res = await invoiceApi.export(params)
    const blob = res as unknown as Blob
    // 上一版不分形状就念「导出成功」：后端那一口要是回了 JSON（错误包），界面也会说导出好了。
    // 现在认回包形状：不是 CSV 就不念成功，是 CSV 就把导出去几行说清楚。
    if (!blob.type?.toLowerCase().includes('csv')) {
      message.error(`导出没拿到文件（后端回的是 ${blob.type || '未知类型'}）`)
      return
    }
    const text = await blob.text()
    const rows = text.split('\n').filter(line => line.trim().length > 0).length - 1
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `账单导出_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success(rows > 0 ? `已导出 ${rows} 张账单` : '按这些筛选条件一张都没导出，文件里只有表头')
  } catch (error: any) {
    logError('billing/billing-view', '导出失败:', error)
    message.error(`导出失败：${describeHttpError(error)}`)
  } finally {
    exportLoading.value = false
  }
}

function showRechargeModal() {
  rechargeForm.amount = 100
  rechargeForm.paymentMethod = ''
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
  if (!rechargeForm.paymentMethod) {
    message.error('请选择支付方式')
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
    logError('billing/billing-view', '充值失败:', error)
    message.error(`充值失败：${describeHttpError(error)}`)
  } finally {
    rechargeLoading.value = false
  }
}

async function handleConfirmWithdraw() {
  if (!withdrawForm.amount || withdrawForm.amount <= 0) {
    message.warning('请输入提现金额')
    return
  }
  if (!withdrawForm.accountId) {
    message.warning('请选择提现账户')
    return
  }
  if (accountBalance.availableBalance === null) {
    // 余额没读到就不让点：这时候说什么「不能超过可用余额」都是空口保证，后端才是真正的闸
    message.warning('可用余额还没读到，请刷新页面后再提现')
    return
  }
  if (withdrawForm.amount > accountBalance.availableBalance) {
    message.warning('提现金额不能超过可用余额')
    return
  }

  const tenantId = getTenantId()
  try {
    // 后端 /billing/balance/withdraw 只认 amount，这两个「提现账户」是界面自己摆的、提交上去没人读
    // （M-P91 收口时登记为待拍板，不在这一批偷偷改口径）
    const accountInfo = {
      accountId: withdrawForm.accountId,
      accountType: withdrawForm.accountId === '1' ? 'bank' : 'alipay',
    }
    await balanceApi.withdraw(tenantId, withdrawForm.amount, accountInfo)
    message.success('提现申请已提交，预计1-3个工作日到账')
    withdrawModalVisible.value = false
    await loadWalletInfo()
  } catch (error: any) {
    logError('billing/billing-view', '提现失败:', error)
    message.error(`提现失败：${describeHttpError(error)}`)
  }
}

function handleRechargePackage(packageId: number) {
  const pkg = rechargePackages.value.find(p => p.id === packageId)
  if (pkg) {
    rechargeForm.amount = pkg.discountAmount
    rechargeForm.paymentMethod = ''
    rechargeModalVisible.value = true
  }
}

function viewInvoiceDetail(record: Invoice) {
  currentInvoiceId.value = record.id
  detailDrawerVisible.value = true
}

async function handlePay(record: Invoice) {
  try {
    await invoiceApi.pay(record.id, { paymentMethod: 'BALANCE' })
    message.success('支付成功')
    await loadInvoices()
    await loadWalletInfo()
    await loadStats()
  } catch (error: any) {
    logError('billing/billing-view', '支付失败:', error)
    message.error(`支付失败：${describeHttpError(error)}`)
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
