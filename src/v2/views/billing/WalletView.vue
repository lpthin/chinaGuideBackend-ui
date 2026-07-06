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
                <div class="stat-value">¥{{ formatAmount(walletInfo.balance) }}</div>
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
                <div class="stat-value">¥{{ formatAmount(walletInfo.totalRecharge) }}</div>
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
                <div class="stat-value">¥{{ formatAmount(walletInfo.creditLimit) }}</div>
                <div class="stat-title">可用额度</div>
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
                <div class="stat-value">¥{{ formatAmount(walletInfo.frozenBalance) }}</div>
                <div class="stat-title">冻结金额</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 操作按钮 -->
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-space>
          <a-button type="primary" size="large" @click="showRechargeModal">
            <template #icon><DollarOutlined /></template>
            充值
          </a-button>
          <a-button size="large" :loading="exportLoading" @click="handleExport">
            <template #icon><ExportOutlined /></template>
            导出明细
          </a-button>
        </a-space>
      </a-card>

      <!-- 消费明细列表 -->
      <a-card title="消费明细" :bordered="false">
        <template #extra>
          <a-space>
            <a-select
              v-model:value="queryParams.type"
              style="width: 120px"
              placeholder="类型"
              allowClear
              @change="loadTransactionList"
            >
              <a-select-option value="recharge">充值</a-select-option>
              <a-select-option value="charge">消费</a-select-option>
              <a-select-option value="refund">退款</a-select-option>
            </a-select>
            <a-range-picker
              v-model:value="dateRange"
              style="width: 240px"
              @change="handleDateChange"
            />
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索描述"
              style="width: 200px"
              enter-button
              @search="loadTransactionList"
            />
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="transactionListData"
          :pagination="paginationConfig"
          :loading="tableLoading"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              <a-tag :color="getTypeColor(record.type)">
                {{ getTypeName(record.type) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'amount'">
              <span :class="record.type === 'recharge' || record.type === 'refund' ? 'amount-in' : 'amount-out'">
                {{ record.type === 'recharge' || record.type === 'refund' ? '+' : '-' }}¥{{ formatAmount(record.amount) }}
              </span>
            </template>
            <template v-if="column.key === 'balanceAfter'">
              <span class="balance-text">¥{{ formatAmount(record.balanceAfter) }}</span>
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
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
            :formatter="value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
            :parser="value => value.replace(/\¥\s?|(,*)/g, '')"
            style="width: 100%"
            placeholder="请输入充值金额"
            size="large"
          />
        </a-form-item>
        <a-form-item label="支付方式" required>
          <a-radio-group v-model:value="rechargeForm.paymentMethod">
            <a-radio value="alipay">
              <span>支付宝</span>
            </a-radio>
            <a-radio value="wechat">
              <span>微信支付</span>
            </a-radio>
            <a-radio value="bank_transfer">
              <span>银行转账</span>
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
import { ref, reactive, onMounted, watch } from 'vue'
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
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const rechargeModalVisible = ref(false)
const dateRange = ref<[string, string] | undefined>()

const walletInfo = reactive({
  balance: 0,
  totalRecharge: 0,
  creditLimit: 0,
  frozenBalance: 0,
})

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

const rechargeForm = reactive({
  amount: 100,
  paymentMethod: 'alipay',
  remark: '',
})

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(date: string): string {
  if (!date) return '-'
  return date
}

function getTypeName(type: string): string {
  const map: Record<string, string> = {
    recharge: '充值',
    charge: '消费',
    refund: '退款',
    transfer: '转账',
    withdraw: '提现',
  }
  return map[type] || type
}

function getTypeColor(type: string): string {
  const map: Record<string, string> = {
    recharge: 'green',
    charge: 'red',
    refund: 'blue',
    transfer: 'orange',
    withdraw: 'purple',
  }
  return map[type] || 'default'
}

function handleDateChange(dates: [string, string] | undefined) {
  if (dates && dates[0] && dates[1]) {
    queryParams.startDate = dates[0]
    queryParams.endDate = dates[1]
  } else {
    queryParams.startDate = undefined
    queryParams.endDate = undefined
  }
  loadTransactionList()
}

async function loadWalletInfo() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  loading.value = true
  try {
    const res = await walletApi.getInfo(tenantId)
    if (res) {
      walletInfo.balance = res.balance || 0
      walletInfo.totalRecharge = res.totalRecharge || 0
      walletInfo.creditLimit = res.creditLimit || 0
      walletInfo.frozenBalance = res.frozenBalance || 0
    }
  } catch (error) {
    message.error('加载钱包信息失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadTransactionList() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  tableLoading.value = true
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
  } catch (error) {
    console.error('Failed to load transactions:', error)
    message.error('加载交易记录失败')
    transactionListData.value = []
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
  rechargeForm.paymentMethod = 'alipay'
  rechargeForm.remark = ''
  rechargeModalVisible.value = true
}

const rechargeLoading = ref(false)

async function handleConfirmRecharge() {
  if (!rechargeForm.amount || rechargeForm.amount <= 0) {
    message.error('请输入正确的充值金额')
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
    message.error('充值失败')
    console.error(error)
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
    const url = window.URL.createObjectURL(new Blob([res as any]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `交易记录_${new Date().toISOString().slice(0, 10)}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch (error) {
    message.error('导出失败')
    console.error(error)
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
