<template>
  <div class="wallet-view-page">
    <a-spin :spinning="loading">
      <!-- 顶部余额卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <WalletOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statText(walletInfo.balance) }}</div>
                <div class="stat-title">当前余额</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <ArrowUpOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statText(walletInfo.totalRecharge) }}</div>
                <div class="stat-title">总充值</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <CreditCardOutlined />
              </div>
              <div class="stat-info">
                <!-- 这一张原来读的是 creditLimit：后端那一格是写死的 50000.00，库里那一列没人读
                     （M-P90 拍板：改成读真有的 available_balance，标题一并换成「可用余额」） -->
                <div class="stat-value">{{ statText(walletInfo.availableBalance) }}</div>
                <div class="stat-title">可用余额</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statText(walletInfo.frozenBalance) }}</div>
                <div class="stat-title">冻结金额</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 「还没有钱包」与「这一发没读到」是两件事，都不许被四张 ¥0.00 的卡糊过去 -->
      <a-alert
        v-if="walletNotice"
        :message="walletNotice"
        type="warning"
        show-icon
        style="margin-bottom: 16px"
      />

      <!-- 消费明细列表 -->
      <a-card title="消费明细" :bordered="false">
        <!-- 充值/导出原占独立卡片、筛选又挤在 #extra，合并进一个 FilterBar（筛选靠左、按钮靠右） -->
        <filter-bar>
          <a-select
            v-model:value="queryParams.type"
            style="width: 120px"
            placeholder="类型"
            allowClear
            @change="handleFilterChange"
          >
            <a-select-option v-for="t in TRANSACTION_TYPES" :key="t.code" :value="t.code">
              {{ t.name }}
            </a-select-option>
          </a-select>
          <a-range-picker
            v-model:value="dateRange"
            value-format="YYYY-MM-DD"
            style="width: 240px"
            @change="handleDateChange"
          />
          <a-input-search
            v-model:value="queryParams.keyword"
            placeholder="搜索描述"
            style="width: 200px"
            enter-button
            @search="handleFilterChange"
          />
          <template #actions>
            <a-space>
              <a-button size="large" :loading="exportLoading" @click="handleExport">
                <template #icon><ExportOutlined /></template>
                导出明细
              </a-button>
              <a-button type="primary" size="large" @click="showRechargeModal">
                <template #icon><DollarOutlined /></template>
                充值
              </a-button>
            </a-space>
          </template>
        </filter-bar>

        <a-table
          :scroll="{ x: 'max-content' }"
          :columns="columns"
          :data-source="transactionListData"
          :pagination="paginationConfig"
          :loading="tableLoading"
          :row-key="(record: any) => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              <a-tag :color="typeOf(record.type).color">
                {{ typeOf(record.type).name }}
              </a-tag>
            </template>
            <template v-if="column.key === 'amount'">
              <span :class="amountClass(record)">
                {{ amountLabel(record) }}
              </span>
            </template>
            <template v-if="column.key === 'balanceAfter'">
              <span class="balance-text">¥{{ formatAmount(record.balanceAfter) }}</span>
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
          </template>
          <template #emptyText>
            <!-- 这一屏的空原本是 antd 的默认「暂无数据」：「这一档真的没消费过」「这一页翻过了头」
                 「选中的那一家读不到」「这一发读失败」四种念法长成一个样（M-P90）。
                 这里不摆「新建」入口：这一屏没有能造出流水行的人手工（写入另开一批）。 -->
            <empty-list-hint
              :loading="tableLoading"
              :read-failed="readFailed"
              :empty-line="emptyLine"
              :empty-reason="emptyReason"
            />
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <!-- 充值弹窗 -->
    <a-modal
      v-model:open="rechargeModalVisible"
      title="账户充值"
      width="480px"
      :confirm-loading="rechargeLoading"
      @ok="handleConfirmRecharge"
    >
      <a-form :model="rechargeForm" layout="vertical">
        <a-form-item label="充值金额" required>
          <a-input-number
            v-model:value="rechargeForm.amount"
            :min="1"
            :max="1000000"
            :formatter="(value: number) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="(value: string) => value.replace(/\¥\s?|(,*)/g, '')"
            style="width: 100%"
            placeholder="请输入充值金额"
            size="large"
          />
        </a-form-item>
        <a-form-item label="支付方式" required>
          <!-- 值用库里那种大写代码，中文由 paymentMethod.ts 那张词表翻；
               这一档只开三种（余额支付拿来自充余额没有意义），名字与后端词表同源 -->
          <a-radio-group v-model:value="rechargeForm.paymentMethod">
            <a-radio v-for="code in RECHARGE_METHODS" :key="code" :value="code">
              <span>{{ paymentMethodLabel(code) }}</span>
            </a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="rechargeForm.remark" placeholder="可选填写备注信息" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  WalletOutlined,
  DollarOutlined,
  ExportOutlined,
  ArrowUpOutlined,
  CreditCardOutlined,
  FileTextOutlined,
} from '@ant-design/icons-vue'
import { walletApi } from '../../api/billing'
import { describeHttpError } from '../../api/http'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'
import { walletIsActive } from '../../utils/walletState'
import { paymentMethodLabel, type PaymentMethodCode } from '../../utils/paymentMethod'
import FilterBar from '../../components/FilterBar.vue'
import EmptyListHint from '../../components/EmptyListHint.vue'
import {
  asEmptyReason,
  shouldJumpBackToFirstPage,
  JUMP_BACK_NOTICE,
  type EmptyReason,
} from '../../utils/emptyPage'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const rechargeModalVisible = ref(false)
const dateRange = ref<[string, string] | undefined>()

/**
 * 流水类型的唯一词表（M-P90）：`billing_transaction.type` 那一列存的是 RECHARGE/CONSUME/REFUND/TRANSFER
 * （见 schema 那行列注释「类型:RECHARGE-充值,CONSUME-消费,REFUND-退款,TRANSFER-转账」）。
 * 上一版界面往下发的是 recharge/charge/refund 三个小写值，库里一个大写、且消费写的是 CONSUME，
 * 所以「消费」那一档永远筛不出行；下拉选项、行里的标签、金额正负号现在都读这一份。
 */
const TRANSACTION_TYPES: readonly { code: string; name: string; color: string; inflow: boolean }[] = [
  { code: 'RECHARGE', name: '充值', color: 'green', inflow: true },
  { code: 'CONSUME', name: '消费', color: 'red', inflow: false },
  { code: 'REFUND', name: '退款', color: 'blue', inflow: true },
  { code: 'TRANSFER', name: '转账', color: 'orange', inflow: true },
]

function typeOf(code: string) {
  return (
    TRANSACTION_TYPES.find(t => t.code === code) ?? {
      code,
      name: code || '-',
      color: 'default',
      inflow: true,
    }
  )
}

function amountClass(record: any): string {
  return isOutflow(record) ? 'amount-out' : 'amount-in'
}

function amountLabel(record: any): string {
  return `${isOutflow(record) ? '-' : '+'}¥${formatAmount(Number(record.amount))}`
}

/**
 * 这一行是钱进来还是出去，认它自己的余额链（balanceBefore → balanceAfter）。
 * 改前是拿类型猜的：转账那档写死 inflow:true，于是「余额提现出账」那一行
 * 在界面上念成「+¥120.00」并染成进来那种颜色——一笔往外走的钱看着像进账。
 * 行里没带这两个数（老数据/读不到）才退回按类型猜。
 */
function isOutflow(record: any): boolean {
  const before = Number(record?.balanceBefore)
  const after = Number(record?.balanceAfter)
  if (Number.isFinite(before) && Number.isFinite(after)) return after < before
  return !typeOf(String(record?.type ?? '')).inflow
}

/** 钱包那一发读失败时四张卡都不许念 0：0 是「查过了、余额是零」的结论 */
const walletReadFailed = ref('')

/** 后端答的 walletState=NONE：这家确实还没有钱包行。这与「没读到」是两件事，念法也不同 */
const walletMissing = ref(false)

const walletInfo = reactive({
  balance: 0,
  totalRecharge: 0,
  availableBalance: 0,
  frozenBalance: 0,
})

/** 这一页为什么是空的（M-P90）：读失败 / 后端答的成因两句，各占一格 */
const readFailed = ref('')
const emptyLine = ref('')
const emptyReason = ref<EmptyReason>(null)

const queryParams = reactive({
  type: undefined as string | undefined,
  keyword: '',
  startDate: undefined as string | undefined,
  endDate: undefined as string | undefined,
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
    loadTransactionList()
  },
})

const columns = [
  { title: '交易单号', dataIndex: 'transactionNo', key: 'transactionNo', width: 200 },
  { title: '类型', key: 'type', width: 100 },
  { title: '金额', key: 'amount', width: 150 },
  { title: '余额', key: 'balanceAfter', width: 150 },
  { title: '描述', dataIndex: 'description', key: 'description', width: 200 },
  { title: '时间', key: 'createdAt', width: 180 },
]

const transactionListData = ref<any[]>([])

// 充值这一档只开三种方式；名字与大写代码都出自 paymentMethod.ts 那张词表。
// 缺省值以前写死成 alipay：客户没点、界面也照样记一笔「支付宝」，后端现已改成点名才落账（M-P91 拍板 4）。
const RECHARGE_METHODS: PaymentMethodCode[] = ['ALIPAY', 'WECHAT', 'BANK_TRANSFER']

const rechargeForm = reactive({
  amount: 100,
  paymentMethod: '' as PaymentMethodCode | '',
  remark: '',
})

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 四张卡上的钱：钱包那一发读失败就说「没取到」，不许念成 ¥0.00 */
function statText(amount: number): string {
  if (walletReadFailed.value) return '没取到'
  // 这家还没开过钱包时后端那一格回的是 null，不是零钱——摆 ¥0.00 会让人以为「查过了，就是零」
  if (walletMissing.value) return '—'
  return `¥${formatAmount(amount)}`
}

/** 四张卡下面那句话：把「还没有钱包」与「这一发没读到」分开念 */
const walletNotice = computed(() => {
  if (walletReadFailed.value) return `钱包没读到：${walletReadFailed.value}`
  if (walletMissing.value) return '这家还没有钱包，充值后这里会显示余额'
  return ''
})

/** 筛选项一变就回第一页：否则「第 9 页 + 新条件」读回来的空页会被念成「这一档没有」 */
function handleFilterChange() {
  paginationConfig.current = 1
  loadTransactionList()
}

function handleDateChange(dates: [string, string] | undefined) {
  if (dates && dates[0] && dates[1]) {
    queryParams.startDate = dates[0]
    queryParams.endDate = dates[1]
  } else {
    queryParams.startDate = undefined
    queryParams.endDate = undefined
  }
  handleFilterChange()
}

async function loadWalletInfo() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  loading.value = true
  walletReadFailed.value = ''
  walletMissing.value = false
  try {
    const res = await walletApi.getInfo(tenantId)
    if (res) {
      // walletState 的两个字面串出自后端 BillingWalletController（utils/walletState.ts 是唯一出处）
      walletMissing.value = !walletIsActive(res)
      walletInfo.balance = res.balance || 0
      walletInfo.totalRecharge = res.totalRecharge || 0
      walletInfo.availableBalance = res.availableBalance || 0
      walletInfo.frozenBalance = res.frozenBalance || 0
    }
  } catch (error) {
    // 读失败不把上一轮的旧数字继续摆着：那一眼看上去像「余额还是这些」
    logError('billing/wallet-view', error)
    walletInfo.balance = 0
    walletInfo.totalRecharge = 0
    walletInfo.availableBalance = 0
    walletInfo.frozenBalance = 0
    walletMissing.value = false
    walletReadFailed.value = describeHttpError(error)
    message.error(`加载钱包信息失败：${describeHttpError(error)}`)
  } finally {
    loading.value = false
  }
}

async function loadTransactionList() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  tableLoading.value = true
  readFailed.value = ''
  emptyLine.value = ''
  emptyReason.value = null
  try {
    const params: any = {
      tenantId,
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
    }
    if (queryParams.type) params.type = queryParams.type
    if (queryParams.keyword) params.keyword = queryParams.keyword
    if (queryParams.startDate) params.startDate = queryParams.startDate
    if (queryParams.endDate) params.endDate = queryParams.endDate

    const res = await walletApi.getTransactions(params)
    transactionListData.value = res.records || []
    paginationConfig.total = res.total || 0
    emptyLine.value = res.emptyLine || ''
    emptyReason.value = asEmptyReason(res.emptyReason)
    // 「这一页翻过了头」不是一句解释就完事：翻回第一页再读一遍，最多多发一发
    if (shouldJumpBackToFirstPage(emptyReason.value, paginationConfig.current)) {
      paginationConfig.current = 1
      await loadTransactionList()
      message.info(JUMP_BACK_NOTICE)
    }
  } catch (error) {
    logError('billing/wallet-view', 'Failed to load transactions:', error)
    // 读失败不是「一分钱都没花过」：旧行与总条数一起清掉，让这一格念出失败那一句
    transactionListData.value = []
    paginationConfig.total = 0
    readFailed.value = describeHttpError(error)
    message.error(`加载交易记录失败：${describeHttpError(error)}`)
  } finally {
    tableLoading.value = false
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    loadWalletInfo()
    loadTransactionList()
  }
)

function showRechargeModal() {
  rechargeForm.amount = 100
  rechargeForm.paymentMethod = ''
  rechargeForm.remark = ''
  rechargeModalVisible.value = true
}

const rechargeLoading = ref(false)

async function handleConfirmRecharge() {
  if (!rechargeForm.amount || rechargeForm.amount <= 0) {
    message.error('请输入正确的充值金额')
    return
  }
  if (!rechargeForm.paymentMethod) {
    message.error('请选择支付方式')
    return
  }
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  rechargeLoading.value = true
  try {
    await walletApi.recharge(tenantId, rechargeForm.amount, rechargeForm.paymentMethod)
    message.success('充值请求已提交')
    rechargeModalVisible.value = false
    await loadWalletInfo()
    await loadTransactionList()
  } catch (error) {
    message.error(`充值失败：${describeHttpError(error)}`)
    logError('billing/wallet-view', error)
  } finally {
    rechargeLoading.value = false
  }
}

const exportLoading = ref(false)

async function handleExport() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  exportLoading.value = true
  try {
    const params: any = { tenantId }
    if (queryParams.type) params.type = queryParams.type
    if (queryParams.keyword) params.keyword = queryParams.keyword
    if (queryParams.startDate) params.startDate = queryParams.startDate
    if (queryParams.endDate) params.endDate = queryParams.endDate

    const res = await walletApi.exportTransactions(params)
    const blob = res as unknown as Blob
    // 上一版后端那一口回的是 `ApiResponse.ok(new byte[0])`（一段 JSON，不是文件），界面照样念「导出成功」。
    // 现在认回包形状：不是 CSV 就不念成功，是 CSV 就把导出去了几行说清楚。
    if (!blob.type.toLowerCase().includes('csv')) {
      message.error(`导出没拿到文件（后端回的是 ${blob.type || '未知类型'}）`)
      return
    }
    const text = await blob.text()
    const rows = text.split('\n').filter(line => line.trim().length > 0).length - 1
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `交易记录_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success(rows > 0 ? `已导出 ${rows} 行明细` : '按这些筛选条件一行都没导出，文件里只有表头')
  } catch (error) {
    message.error(`导出失败：${describeHttpError(error)}`)
    logError('billing/wallet-view', error)
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  await loadWalletInfo()
  await loadTransactionList()
})
</script>

<style scoped lang="less">
.wallet-view-page {
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

.amount-in {
  color: #52c41a;
  font-weight: 500;
}

.amount-out {
  color: #ff4d4f;
  font-weight: 500;
}

.balance-text {
  color: #1a1a1a;
}
</style>
