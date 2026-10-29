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
          <a-descriptions-item label="账期">{{ formatDate(invoice.billingStartDate) }} ~ {{ formatDate(invoice.billingEndDate) }}</a-descriptions-item>
          <a-descriptions-item label="应付金额">
            <span class="amount-highlight">¥{{ formatAmount(invoice.amount) }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="实付金额">
            <span v-if="invoice.paidAmount" class="amount-paid">¥{{ formatAmount(invoice.paidAmount) }}</span>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item label="支付方式">{{ paymentMethodLabel(invoice.paymentMethod) }}</a-descriptions-item>
          <a-descriptions-item label="到期日">{{ formatDate(invoice.dueDate) }}</a-descriptions-item>
          <a-descriptions-item label="支付时间" :span="1">{{ invoice.paidAt ? formatDateTime(invoice.paidAt, true) : '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间" :span="1">{{ formatDateTime(invoice.createdAt, true) }}</a-descriptions-item>
        </a-descriptions>

        <!-- 账单明细 -->
        <a-divider orientation="left">账单明细</a-divider>
        <!-- 上一版这里摆的是后端编的三行（999 / 39 / 100），无论哪张账单都念这三个数。
             库里没有存明细的地方，所以没有明细就直说，不再借三行假数填这一格。 -->
        <p v-if="!(invoice.items || []).length" class="no-items-hint">
          这一张账单只记了应付总额，系统里没有逐条明细可读。
        </p>
        <a-table
          v-else
          :scroll="{ x: 'max-content' }"
          :columns="itemColumns"
          :data-source="invoice.items || []"
          :pagination="false"
          :row-key="(record: any) => record.id"
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
        <!-- 后端 /billing/invoices/{id}/download 只返回一个拼出来的文件路径、不产出任何文件，
             账单/发票下载没有真实接口，故此处只保留可用的支付动作，不再放假按钮 -->
        <div class="action-buttons" v-if="invoice.status === InvoiceStatus.PENDING">
          <a-button type="primary" size="large" :loading="paying" @click="handlePay">
            立即支付
          </a-button>
        </div>
      </div>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { InvoiceStatus, Currency, ProductType } from '../../types/billing'
import type { Invoice, InvoiceItem } from '../../types/billing'
import { paymentMethodLabel } from '../../utils/paymentMethod'
import { foldInvoiceStatus, invoiceStatusLabel, invoiceStatusColor } from '../../utils/invoiceStatus'
import { invoiceApi } from '../../api/billing'
import { describeHttpError } from '../../api/http'
import { formatDate, formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'

const props = defineProps<{
  open: boolean
  invoiceId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'paid'): void
}>()

const authStore = useAuthStore()
const loading = ref(false)
const paying = ref(false)
const invoice = ref<Invoice | null>(null)

const itemColumns = [
  { title: '产品类型', dataIndex: 'productType', key: 'productType', width: 120 },
  { title: '产品名称', dataIndex: 'productName', key: 'productName', width: 150 },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'center' as const },
  { title: '单价', key: 'unitPrice', width: 100, align: 'right' as const },
  { title: '金额', key: 'amount', width: 120, align: 'right' as const },
]

watch(() => [props.open, props.invoiceId], ([newOpen, newInvoiceId]) => {
  if (newOpen && newInvoiceId !== null && typeof newInvoiceId === 'number') {
    loadInvoiceDetail(newInvoiceId)
  }
})

// 详情口回的是 billing_invoice 那两个原始列：status（ISSUED/PAID/CANCELLED/OVERDUE）
// 与 payment_status（UNPAID/PAID/PARTIAL），都是库里的大写代码。
// 折成一档 + 中文念法的词表只有一个出处，见 utils/invoiceStatus.ts
//（以前这里、费用页、开票详情各抄一份，同一张账单三屏三种说法）

function mapProductType(type?: string): ProductType {
  if (!type) return ProductType.SUBSCRIPTION
  const typeMap: Record<string, ProductType> = {
    SERVICE: ProductType.SUBSCRIPTION,
    USAGE: ProductType.API_CALL,
    AI_MODEL: ProductType.AI_MODEL,
    STORAGE: ProductType.STORAGE,
    BANDWIDTH: ProductType.BANDWIDTH,
    SUBSCRIPTION: ProductType.SUBSCRIPTION,
  }
  return typeMap[type.toUpperCase()] || ProductType.SUBSCRIPTION
}

function adaptItems(items: any[], invoiceId: number): InvoiceItem[] {
  if (!items || !items.length) return []
  return items.map((item: any, index: number) => ({
    id: item.id ?? index + 1,
    invoiceId,
    productType: mapProductType(item.type || item.productType),
    productName: item.name || item.productName || '',
    description: item.description || '',
    quantity: item.quantity || 0,
    unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
    amount: item.amount ? Number(item.amount) : 0,
    currency: Currency.CNY,
  }))
}

function adaptInvoice(invoiceData: any, items: any[]): Invoice {
  const id = Number(invoiceData.id)
  const amount = invoiceData.totalAmount !== undefined ? Number(invoiceData.totalAmount) : Number(invoiceData.amount) || 0
  const paidAmount = invoiceData.paidAmount !== undefined ? Number(invoiceData.paidAmount) : undefined
  const status = foldInvoiceStatus(invoiceData.status, invoiceData.paymentStatus)
  const billingDate = formatDate(invoiceData.billingDate)
  const billingStartDate = invoiceData.billingStartDate ? formatDate(invoiceData.billingStartDate) : billingDate
  const billingEndDate = invoiceData.billingEndDate ? formatDate(invoiceData.billingEndDate) : billingDate

  return {
    id,
    tenantId: Number(invoiceData.tenantId) || 0,
    invoiceNo: invoiceData.invoiceNo || '',
    title: invoiceData.title || '',
    amount,
    discountAmount: invoiceData.discountAmount ? Number(invoiceData.discountAmount) : 0,
    currency: Currency.CNY,
    status,
    billingCycle: invoiceData.billingCycle as any,
    billingStartDate,
    billingEndDate,
    dueDate: formatDate(invoiceData.dueDate),
    paidAt: paidAmount ? formatDateTime(invoiceData.paidAt) : undefined,
    paidAmount,
    paymentMethod: invoiceData.paymentMethod,
    paymentTransactionId: invoiceData.paymentTransactionId,
    remark: invoiceData.remark,
    invoiceUrl: invoiceData.pdfUrl || invoiceData.invoiceUrl,
    createdAt: formatDateTime(invoiceData.createdAt),
    updatedAt: formatDateTime(invoiceData.updatedAt),
    items: adaptItems(items, id),
  }
}

async function loadInvoiceDetail(id: number) {
  loading.value = true
  try {
    const res = await invoiceApi.getDetail(id)
    invoice.value = adaptInvoice(res.invoice, res.items || [])
  } catch (error) {
    message.error('账单详情加载失败')
    logError('billing/invoice-detail-drawer', error)
    invoice.value = null
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('update:open', false)
}

/**
 * 真实调用 POST /billing/invoices/{id}/pay。
 * 后端请求体只有一个可选 paymentMethod，缺省即按余额支付（BALANCE）落库，
 * 这里不替用户编造支付方式，交给后端默认值。
 */
function handlePay() {
  const target = invoice.value
  if (!target) return
  Modal.confirm({
    title: '确认支付',
    content: `确认支付账单「${target.invoiceNo}」¥${formatAmount(target.amount - (target.discountAmount || 0))}？后端将按余额支付方式记为已支付。`,
    onOk: async () => {
      paying.value = true
      try {
        await invoiceApi.pay(target.id)
        message.success('支付成功')
        emit('paid')
        await loadInvoiceDetail(target.id)
      } catch (error) {
        message.error(`支付失败：${describeHttpError(error)}`)
      } finally {
        paying.value = false
      }
    },
  })
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getStatusName(status: InvoiceStatus): string {
  return invoiceStatusLabel(status)
}

function getStatusColor(status: InvoiceStatus): string {
  return invoiceStatusColor(status)
}
</script>

<style scoped lang="less">
.invoice-detail {
  padding: 8px;
}

.no-items-hint {
  margin: 0 0 8px;
  color: #8c8c8c;
  font-size: 13px;
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
