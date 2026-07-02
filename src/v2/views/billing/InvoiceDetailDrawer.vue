<template>
  <a-drawer
    :open="open"
    title="账单详情"
    placement="right"
    :width="720"
    @update:open="emit('update:open', $event)"
    @close="handleClose"
  >
    <a-spin :spinning="loading">
      <div v-if="invoice" class="invoice-detail">
        <!-- 账单头部信息 -->
        <a-descriptions title="基本信息" :column="2" bordered>
          <a-descriptions-item label="账单号">{{ invoice.invoiceNo }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="getStatusColor(invoice.status)">
              {{ getStatusName(invoice.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="账单标题">{{ invoice.title }}</a-descriptions-item>
          <a-descriptions-item label="账期">{{ invoice.billingStartDate }} ~ {{ invoice.billingEndDate }}</a-descriptions-item>
          <a-descriptions-item label="应付金额">
            <span class="amount-highlight">¥{{ formatAmount(invoice.amount) }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="实付金额">
            <span v-if="invoice.paidAmount" class="amount-paid">¥{{ formatAmount(invoice.paidAmount) }}</span>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item label="支付方式">{{ getPaymentMethodName(invoice.paymentMethod) }}</a-descriptions-item>
          <a-descriptions-item label="到期日">{{ invoice.dueDate }}</a-descriptions-item>
          <a-descriptions-item label="支付时间" :span="1">{{ invoice.paidAt || '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间" :span="1">{{ invoice.createdAt }}</a-descriptions-item>
        </a-descriptions>

        <!-- 账单明细 -->
        <a-divider orientation="left">账单明细</a-divider>
        <a-table
          :columns="itemColumns"
          :data-source="invoice.items || mockItems"
          :pagination="false"
          :row-key="record => record.id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'amount'">
              ¥{{ formatAmount(record.amount) }}
            </template>
            <template v-if="column.key === 'unitPrice'">
              ¥{{ formatAmount(record.unitPrice) }}
            </template>
          </template>
        </a-table>

        <!-- 金额汇总 -->
        <div class="amount-summary">
          <div class="summary-row">
            <span class="label">小计：</span>
            <span class="value">¥{{ formatAmount(invoice.amount) }}</span>
          </div>
          <div class="summary-row" v-if="invoice.discountAmount">
            <span class="label">折扣：</span>
            <span class="value discount">-¥{{ formatAmount(invoice.discountAmount) }}</span>
          </div>
          <div class="summary-row total">
            <span class="label">应付总额：</span>
            <span class="value">¥{{ formatAmount(invoice.amount - (invoice.discountAmount || 0)) }}</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons" v-if="invoice.status === InvoiceStatus.PENDING">
          <a-button type="primary" size="large" @click="handlePay">
            立即支付
          </a-button>
          <a-button size="large" @click="handleDownload">
            下载账单
          </a-button>
        </div>
        <div class="action-buttons" v-else-if="invoice.status === InvoiceStatus.PAID">
          <a-button type="primary" size="large" @click="handleDownload">
            下载发票
          </a-button>
          <a-button size="large" @click="handleDownload">
            下载账单
          </a-button>
        </div>
      </div>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { InvoiceStatus, PaymentMethod, Currency, ProductType } from '../../types/billing'
import type { Invoice } from '../../types/billing'

const props = defineProps<{
  open: boolean
  invoiceId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const loading = ref(false)
const invoice = ref<Invoice | null>(null)

const mockItems = [
  { id: 1, productType: ProductType.AI_MODEL, productName: 'GPT-4 API调用', description: '100万 tokens', quantity: 1, unitPrice: 1200, amount: 1200, currency: Currency.CNY },
  { id: 2, productType: ProductType.AI_MODEL, productName: 'Claude 3 API调用', description: '50万 tokens', quantity: 1, unitPrice: 800, amount: 800, currency: Currency.CNY },
  { id: 3, productType: ProductType.STORAGE, productName: '对象存储服务', description: '100GB/月', quantity: 1, unitPrice: 120, amount: 120, currency: Currency.CNY },
  { id: 4, productType: ProductType.BANDWIDTH, productName: 'CDN流量', description: '1TB流量', quantity: 1, unitPrice: 200, amount: 200, currency: Currency.CNY },
  { id: 5, productType: ProductType.SUBSCRIPTION, productName: '企业版订阅', description: '月度订阅费用', quantity: 1, unitPrice: 3360.50, amount: 3360.50, currency: Currency.CNY },
]

const itemColumns = [
  { title: '产品类型', dataIndex: 'productType', key: 'productType', width: 120 },
  { title: '产品名称', dataIndex: 'productName', key: 'productName', width: 150 },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'center' as const },
  { title: '单价', key: 'unitPrice', width: 100, align: 'right' as const },
  { title: '金额', key: 'amount', width: 120, align: 'right' as const },
]

watch(() => [props.open, props.invoiceId], ([newOpen, newInvoiceId]) => {
  if (newOpen && newInvoiceId) {
    loadInvoiceDetail(newInvoiceId)
  }
})

function loadInvoiceDetail(id: number) {
  loading.value = true
  setTimeout(() => {
    const mockInvoice: Invoice = {
      id,
      tenantId: 1,
      invoiceNo: 'INV2024030001',
      title: '3月份月度账单',
      amount: 5680.50,
      discountAmount: 0,
      currency: Currency.CNY,
      status: InvoiceStatus.PAID,
      billingCycle: 'monthly',
      billingStartDate: '2024-03-01',
      billingEndDate: '2024-03-31',
      dueDate: '2024-04-15',
      paidAt: '2024-03-15 10:30:00',
      paidAmount: 5680.50,
      paymentMethod: PaymentMethod.ALIPAY,
      paymentTransactionId: 'TXN202403151030001',
      createdAt: '2024-03-01 00:00:00',
      updatedAt: '2024-03-15 10:30:00',
      items: mockItems,
    }
    invoice.value = mockInvoice
    loading.value = false
  }, 500)
}

function handleClose() {
  emit('update:open', false)
}

function handlePay() {
  if (invoice.value) {
    message.success(`支付账单：${invoice.value.invoiceNo}`)
  }
}

function handleDownload() {
  if (invoice.value) {
    message.success(`下载账单：${invoice.value.invoiceNo}`)
  }
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

function getPaymentMethodName(method?: PaymentMethod): string {
  if (!method) return '-'
  const nameMap: Record<PaymentMethod, string> = {
    [PaymentMethod.ALIPAY]: '支付宝',
    [PaymentMethod.WECHAT]: '微信支付',
    [PaymentMethod.BANK_TRANSFER]: '银行转账',
    [PaymentMethod.CREDIT_CARD]: '信用卡',
    [PaymentMethod.BALANCE]: '余额支付',
  }
  return nameMap[method] || method
}
</script>

<style scoped lang="less">
.invoice-detail {
  padding: 8px;
}

.amount-highlight {
  font-size: 18px;
  font-weight: 600;
  color: #ff4d4f;
}

.amount-paid {
  font-size: 16px;
  font-weight: 500;
  color: #52c41a;
}

.amount-summary {
  margin-top: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;

  .summary-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .label {
      font-size: 14px;
      color: #595959;
      margin-right: 12px;
    }

    .value {
      font-size: 14px;
      color: #1a1a1a;
      font-weight: 500;
      min-width: 100px;
      text-align: right;

      &.discount {
        color: #52c41a;
      }
    }

    &.total {
      padding-top: 12px;
      border-top: 1px solid #e8e8e8;

      .label {
        font-size: 16px;
        font-weight: 500;
        color: #1a1a1a;
      }

      .value {
        font-size: 20px;
        font-weight: 600;
        color: #ff4d4f;
      }
    }
  }
}

.action-buttons {
  margin-top: 24px;
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
