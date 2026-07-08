<template>
  <div class="orders-view-page">
    <a-spin :spinning="loading">
      <!-- 订单统计卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ orderStats.total }}</div>
                <div class="stat-title">全部订单</div>
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
                <div class="stat-value">{{ orderStats.pending }}</div>
                <div class="stat-title">待支付</div>
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
                <div class="stat-value">{{ orderStats.paid }}</div>
                <div class="stat-title">已支付</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <RollbackOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ orderStats.refunded }}</div>
                <div class="stat-title">已退款</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 订单状态筛选 -->
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-space>
          <a-radio-group v-model:value="queryParams.status" @change="handleStatusChange">
            <a-radio-button value="">全部</a-radio-button>
            <a-radio-button value="pending">待支付</a-radio-button>
            <a-radio-button value="paid">已支付</a-radio-button>
            <a-radio-button value="cancelled">已取消</a-radio-button>
            <a-radio-button value="refunded">已退款</a-radio-button>
          </a-radio-group>
          <a-input-search
            v-model:value="queryParams.keyword"
            placeholder="搜索订单号/商品名称"
            style="width: 250px"
            enter-button
            @search="handleSearch"
          />
        </a-space>
      </a-card>

      <!-- 订单列表 -->
      <a-card title="订单列表" :bordered="false">
        <template #extra>
          <a-button @click="handleExport">
            <template #icon><ExportOutlined /></template>
            导出
          </a-button>
        </template>

        <a-table
          :columns="columns"
          :data-source="orderListData"
          :pagination="paginationConfig"
          :loading="tableLoading"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'orderNo'">
              <a @click="showOrderDetail(record)">{{ record.orderNo }}</a>
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
            <template v-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="showOrderDetail(record)">
                  详情
                </a-button>
                <a-button
                  v-if="record.status === 'pending'"
                  type="link"
                  size="small"
                  @click="handlePay(record)"
                >
                  支付
                </a-button>
                <a-button
                  v-if="record.status === 'paid'"
                  type="link"
                  size="small"
                  @click="handleRefund(record)"
                >
                  退款
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <!-- 订单详情弹窗 -->
    <a-modal
      v-model:open="detailModalVisible"
      title="订单详情"
      width="600px"
      :footer="null"
    >
      <a-descriptions :column="2" bordered v-if="currentOrder">
        <a-descriptions-item label="订单编号">{{ currentOrder.orderNo }}</a-descriptions-item>
        <a-descriptions-item label="订单状态">
          <a-tag :color="getStatusColor(currentOrder.status)">
            {{ getStatusName(currentOrder.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="商品名称" :span="2">{{ currentOrder.productName }}</a-descriptions-item>
        <a-descriptions-item label="订单金额">
          <span class="amount">¥{{ formatAmount(currentOrder.amount) }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="实付金额">
          <span class="amount">¥{{ formatAmount(currentOrder.paidAmount || 0) }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="支付方式">{{ getPaymentMethodName(currentOrder.paymentMethod) }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ currentOrder.createdAt }}</a-descriptions-item>
        <a-descriptions-item label="支付时间" :span="2">{{ currentOrder.paidAt || '-' }}</a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">{{ currentOrder.remark || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RefundOutlined,
  ExportOutlined,
} from '@ant-design/icons-vue'
import { orderApi } from '../../api/billing'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const detailModalVisible = ref(false)
const currentOrder = ref<any>(null)

const orderStats = reactive({
  total: 0,
  pending: 0,
  paid: 0,
  cancelled: 0,
  refunded: 0,
})

const queryParams = reactive({
  status: '' as string,
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
    loadOrderList()
  },
})

const columns = [
  { title: '订单编号', key: 'orderNo', width: 180 },
  { title: '商品名称', dataIndex: 'productName', key: 'productName', width: 200 },
  { title: '订单金额', key: 'amount', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '支付方式', key: 'paymentMethod', width: 100 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 },
]

const orderListData = ref<any[]>([])

function updateStats(records: any[] = orderListData.value) {
  orderStats.total = paginationConfig.total
  orderStats.pending = records.filter(o => o.status === 'pending').length
  orderStats.paid = records.filter(o => o.status === 'paid').length
  orderStats.cancelled = records.filter(o => o.status === 'cancelled').length
  orderStats.refunded = records.filter(o => o.status === 'refunded').length
}

function handleSearch() {
  paginationConfig.current = 1
  loadOrderList()
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(date: string): string {
  if (!date) return '-'
  return date
}

function getStatusName(status: string): string {
  const map: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    cancelled: '已取消',
    refunded: '已退款',
  }
  return map[status] || status
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'orange',
    paid: 'green',
    cancelled: 'default',
    refunded: 'blue',
  }
  return map[status] || 'default'
}

function getPaymentMethodName(method: string): string {
  if (!method) return '-'
  const map: Record<string, string> = {
    alipay: '支付宝',
    wechat: '微信支付',
    bank_transfer: '银行转账',
    credit_card: '信用卡',
    balance: '余额支付',
  }
  return map[method] || method
}

function handleStatusChange() {
  paginationConfig.current = 1
  loadOrderList()
}

async function loadOrderList() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  tableLoading.value = true
  try {
    const params: any = {
      tenantId,
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
    }
    if (queryParams.status) params.status = queryParams.status
    if (queryParams.keyword) params.keyword = queryParams.keyword

    const res = await orderApi.list(params)
    orderListData.value = res.records || []
    paginationConfig.total = res.total || 0
    updateStats(res.records || [])
  } catch (error) {
    console.error('Failed to load orders:', error)
    message.error('加载订单列表失败')
    orderListData.value = []
  } finally {
    tableLoading.value = false
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    loadOrderList()
  }
)

async function showOrderDetail(order: any) {
  try {
    const res = await orderApi.get(order.id)
    currentOrder.value = res
    detailModalVisible.value = true
  } catch (error) {
    console.error('Failed to load order detail:', error)
    message.error('加载订单详情失败')
  }
}

function handlePay(order: any) {
  Modal.confirm({
    title: '确认支付',
    content: `确定要支付订单 ${order.orderNo} 吗？金额：¥${formatAmount(order.amount)}`,
    onOk: async () => {
      try {
        await orderApi.pay(order.id, 'balance')
        message.success('支付成功')
        loadOrderList()
      } catch (error) {
        console.error('Failed to pay order:', error)
        message.error('支付失败')
      }
    },
  })
}

function handleRefund(order: any) {
  Modal.confirm({
    title: '确认退款',
    content: `确定要退款订单 ${order.orderNo} 吗？金额：¥${formatAmount(order.amount)}`,
    okType: 'danger',
    onOk: async () => {
      try {
        await orderApi.refund(order.id, order.amount)
        message.success('退款成功')
        loadOrderList()
      } catch (error) {
        console.error('Failed to refund order:', error)
        message.error('退款失败')
      }
    },
  })
}

async function handleExport() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  try {
    const params: any = { tenantId }
    if (queryParams.status) params.status = queryParams.status
    const res = await orderApi.export(params)
    const url = window.URL.createObjectURL(new Blob([res as any]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `orders_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch (error) {
    console.error('Failed to export orders:', error)
    message.error('导出失败')
  }
}

onMounted(() => {
  loadOrderList()
})
</script>

<style scoped lang="less">
.orders-view-page {
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

.amount {
  font-weight: 500;
  color: #1a1a1a;
}
</style>
