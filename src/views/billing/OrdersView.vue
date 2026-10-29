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

      <!-- 订单列表 -->
      <a-card title="订单列表" :bordered="false">
        <!-- 状态筛选原占独立卡片、导出又挤在 #extra，合并进一个 FilterBar（筛选靠左、导出靠右） -->
        <filter-bar>
          <!-- 状态值与库里那一列同形（大写代码），中文由 orderStatus.ts 那张词表翻 -->
          <a-radio-group v-model:value="queryParams.status" @change="handleStatusChange">
            <a-radio-button value="">全部</a-radio-button>
            <a-radio-button v-for="code in ORDER_STATUS_ORDER" :key="code" :value="code">
              {{ orderStatusLabel(code) }}
            </a-radio-button>
          </a-radio-group>
          <a-input-search
            v-model:value="queryParams.keyword"
            placeholder="搜索订单号/流水号"
            style="width: 250px"
            enter-button
            @search="handleSearch"
          />
          <template #actions>
            <a-space>
              <a-button :loading="exportLoading" @click="handleExport">
                <template #icon><ExportOutlined /></template>
                导出
              </a-button>
            </a-space>
          </template>
        </filter-bar>

        <a-table
          :scroll="{ x: 'max-content' }"
          :columns="columns"
          :data-source="orderListData"
          :pagination="paginationConfig"
          :loading="tableLoading"
          :row-key="(record: any) => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'orderNo'">
              <a @click="showOrderDetail(record)">{{ record.orderNo }}</a>
            </template>
            <template v-if="column.key === 'amount'">
              <span class="amount">¥{{ formatAmount(record.amount) }}</span>
            </template>
            <template v-if="column.key === 'productName'">
              {{ productNameOf(record) }}
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="orderStatusColor(record.status)">
                {{ orderStatusLabel(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'paymentMethod'">
              {{ paymentMethodLabel(record.paymentMethod) }}
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="showOrderDetail(record)">
                  详情
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
          <a-tag :color="orderStatusColor(currentOrder.status)">
            {{ orderStatusLabel(currentOrder.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="商品名称" :span="2">{{ productNameOf(currentOrder) }}</a-descriptions-item>
        <a-descriptions-item label="订单金额">
          <span class="amount">¥{{ formatAmount(currentOrder.amount) }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="实付金额">
          <!-- 以前读的是 paidAmount：后端那一列叫 actualAmount，这个键根本不存在，
               于是一律折成 0，界面念「实付金额 ¥0.00」，而库里那一行实付 200。 -->
          <span class="amount">¥{{ formatAmount(Number(currentOrder.actualAmount ?? 0)) }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="交易流水号">{{ currentOrder.transactionId || '—' }}</a-descriptions-item>
        <a-descriptions-item label="支付方式">{{ paymentMethodLabel(currentOrder.paymentMethod) }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatDateTime(currentOrder.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="支付时间" :span="2">{{ formatDateTime(currentOrder.paidAt) }}</a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">{{ currentOrder.remark || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  ExportOutlined,
} from '@ant-design/icons-vue'
import { orderApi } from '../../api/billing'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'
import { describeHttpError } from '../../api/http'
import { ORDER_STATUS_ORDER, orderStatusColor, orderStatusLabel, countByStatus, foldOrderStatus } from '../../utils/orderStatus'
import { paymentMethodLabel } from '../../utils/paymentMethod'
import FilterBar from '../../components/FilterBar.vue'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const exportLoading = ref(false)
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

// 四张统计卡以前按小写比对库里的状态：库里存的是大写代码，比不中，于是这三张卡恒为 0。
// 计数与比对统一走 orderStatus.ts 那张词表，折成大写再归类。
function updateStats(records: any[] = orderListData.value) {
  orderStats.total = paginationConfig.total
  const counts = countByStatus(records)
  orderStats.pending = counts.PENDING
  orderStats.paid = counts.PAID
  orderStats.cancelled = counts.CANCELLED
  orderStats.refunded = counts.REFUNDED
}

function handleSearch() {
  paginationConfig.current = 1
  loadOrderList()
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 充值订单这张表里没有「商品」这一列（库里只有金额、支付方式、状态、流水号、备注），
 * 界面上却摆了一格「商品名称」，每一行都空着，看不出是「没有商品」还是「数据没读到」。
 * 读不到就明摆「—」。
 */
function productNameOf(order: any): string {
  return order?.productName || '—'
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
    logError('billing/orders-view', 'Failed to load orders:', error)
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
    logError('billing/orders-view', 'Failed to load order detail:', error)
    message.error('加载订单详情失败')
  }
}

async function handleExport() {
  const tenantId = authStore.selectedTenantId || authStore.tenantId
  exportLoading.value = true
  try {
    const params: any = { tenantId }
    if (queryParams.status) params.status = foldOrderStatus(queryParams.status) ?? undefined

    const res = await orderApi.export(params)
    const blob = res as unknown as Blob
    // 上一版无论后端回什么都念「导出成功」：回的是 JSON 错误壳也照样下出一个假文件。
    // 现在认载荷形状，不是 CSV 就明说没导出。
    if (!blob.type?.toLowerCase().includes('csv')) {
      message.error(`导出没拿到文件（后端回的是 ${blob.type || '未知类型'}）`)
      return
    }
    const text = await blob.text()
    const rows = text.split('\n').filter(line => line.trim().length > 0).length - 1
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `orders_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success(rows > 0 ? `已导出 ${rows} 张订单` : '按这些筛选条件一张都没导出，文件里只有表头')
  } catch (error) {
    logError('billing/orders-view', 'Failed to export orders:', error)
    message.error(`导出失败：${describeHttpError(error)}`)
  } finally {
    exportLoading.value = false
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
