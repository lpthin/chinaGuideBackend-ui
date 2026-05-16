<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Download, Wallet, Calendar, Check, Close } from '@element-plus/icons-vue'
import { getCurrentTenantApi, getTenantUsageApi, changePlanApi } from '@/api/tenants'
import type { Tenant, Plan, TenantUsage } from '@/types/api'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const auth = useAuthStore()

const loading = ref(false)
const tenant = ref<Tenant | null>(null)
const tenantUsage = ref<Record<string, TenantUsage>>({})

interface BillingRecord {
  id: string
  date: string
  type: string
  description: string
  amount: number
  status: 'paid' | 'pending' | 'failed'
}

const billingRecords = ref<BillingRecord[]>([
  {
    id: '1',
    date: '2024-01-01',
    type: 'subscription',
    description: '专业版套餐 - 2024年1月',
    amount: 299,
    status: 'paid'
  },
  {
    id: '2',
    date: '2023-12-01',
    type: 'subscription',
    description: '专业版套餐 - 2023年12月',
    amount: 299,
    status: 'paid'
  },
  {
    id: '3',
    date: '2023-11-01',
    type: 'subscription',
    description: '基础版套餐 - 2023年11月',
    amount: 99,
    status: 'paid'
  }
])

onMounted(async () => {
  loading.value = true
  try {
    const [tenantData, usageData] = await Promise.all([
      getCurrentTenantApi(),
      getTenantUsageApi()
    ])
    tenant.value = tenantData
    tenantUsage.value = usageData
  } catch (error) {
    ElMessage.error('加载账单信息失败')
    console.error(error)
  } finally {
    loading.value = false
  }
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    paid: '已支付',
    pending: '待支付',
    failed: '支付失败'
  }
  return statusMap[status] || status
}

function getStatusType(status: string): string {
  const typeMap: Record<string, string> = {
    paid: 'success',
    pending: 'warning',
    failed: 'danger'
  }
  return typeMap[status] || 'info'
}

function downloadInvoice(record: BillingRecord) {
  ElMessage.success(`正在下载发票: ${record.description}`)
}

function viewInvoice(record: BillingRecord) {
  ElMessage.info(`查看发票: ${record.description}`)
}

async function upgradePlan() {
  try {
    await ElMessageBox.confirm('确定要升级套餐吗？', '确认操作', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'success'
    })
    router.push('/plans')
  } catch {
    // 取消操作
  }
}

function getUsageValue(type: string): number {
  return tenantUsage.value[type]?.usedCount || 0
}

function getUsageLimit(plan: Plan | undefined, type: string): number {
  if (!plan) return 0
  const limitMap: Record<string, keyof Plan> = {
    articles: 'articleLimit',
    keywords: 'keywordLimit',
    media: 'mediaLimit',
    api_calls: 'apiCallLimit'
  }
  const key = limitMap[type]
  return key ? (plan[key] as number || 0) : 0
}

function getUsagePercentage(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function getUsageStatus(percentage: number): string {
  if (percentage >= 100) return 'exception'
  if (percentage >= 90) return 'warning'
  return 'success'
}

const currentPlan = computed(() => tenant.value?.plan)
</script>

<template>
  <div class="billing-page" v-loading="loading">
    <el-page-header @back="$router.back()" title="返回">
      <template #content>
        <span class="page-title">账单管理</span>
      </template>
    </el-page-header>

    <el-row :gutter="24">
      <el-col :xs="24" :md="12">
        <el-card class="billing-card">
          <template #header>
            <div class="card-header">
              <span><el-icon class="header-icon"><Wallet /></el-icon> 当前套餐</span>
            </div>
          </template>
          <div v-if="currentPlan" class="plan-info">
            <div class="plan-name">{{ currentPlan.name }}</div>
            <div class="plan-price">
              <span v-if="currentPlan.price && currentPlan.price > 0">
                ¥{{ currentPlan.price }}<span class="price-period">/月</span>
              </span>
              <span v-else class="price-free">免费</span>
            </div>
            <div v-if="currentPlan.description" class="plan-desc">{{ currentPlan.description }}</div>
            <el-button type="primary" size="large" class="upgrade-btn" @click="upgradePlan">
              升级套餐
            </el-button>
          </div>
          <el-empty v-else description="暂无套餐信息" />
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="billing-card">
          <template #header>
            <div class="card-header">
              <span><el-icon class="header-icon"><Calendar /></el-icon> 本月使用量</span>
            </div>
          </template>
          <div v-if="tenant" class="usage-summary">
            <div class="usage-item">
              <div class="usage-label">文章</div>
              <div class="usage-value">{{ getUsageValue('articles') }} / {{ getUsageLimit(currentPlan, 'articles') || '无限制' }}</div>
              <el-progress
                v-if="getUsageLimit(currentPlan, 'articles') > 0"
                :percentage="getUsagePercentage(getUsageValue('articles'), getUsageLimit(currentPlan, 'articles'))"
                :status="getUsageStatus(getUsagePercentage(getUsageValue('articles'), getUsageLimit(currentPlan, 'articles')))"
                :stroke-width="10"
              />
            </div>
            <div class="usage-item">
              <div class="usage-label">关键词</div>
              <div class="usage-value">{{ getUsageValue('keywords') }} / {{ getUsageLimit(currentPlan, 'keywords') || '无限制' }}</div>
              <el-progress
                v-if="getUsageLimit(currentPlan, 'keywords') > 0"
                :percentage="getUsagePercentage(getUsageValue('keywords'), getUsageLimit(currentPlan, 'keywords'))"
                :status="getUsageStatus(getUsagePercentage(getUsageValue('keywords'), getUsageLimit(currentPlan, 'keywords')))"
                :stroke-width="10"
              />
            </div>
            <div class="usage-item">
              <div class="usage-label">媒体文件</div>
              <div class="usage-value">{{ getUsageValue('media') }} / {{ getUsageLimit(currentPlan, 'media') || '无限制' }}</div>
              <el-progress
                v-if="getUsageLimit(currentPlan, 'media') > 0"
                :percentage="getUsagePercentage(getUsageValue('media'), getUsageLimit(currentPlan, 'media'))"
                :status="getUsageStatus(getUsagePercentage(getUsageValue('media'), getUsageLimit(currentPlan, 'media')))"
                :stroke-width="10"
              />
            </div>
          </div>
          <el-empty v-else description="暂无使用量信息" />
        </el-card>
      </el-col>
    </el-row>

    <el-card class="billing-card">
      <template #header>
        <div class="card-header">
          <span><el-icon class="header-icon"><Document /></el-icon> 账单记录</span>
        </div>
      </template>
      <el-table :data="billingRecords" style="width: 100%">
        <el-table-column prop="date" label="日期" width="180">
          <template #default="{ row }">{{ formatDate(row.date) }}</template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.type === 'subscription' ? '订阅' : row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="150">
          <template #default="{ row }">
            <span class="amount-text">¥{{ row.amount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewInvoice(row)">
              <el-icon><Document /></el-icon>查看
            </el-button>
            <el-button type="primary" link size="small" @click="downloadInvoice(row)">
              <el-icon><Download /></el-icon>下载
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="billingRecords.length === 0" description="暂无账单记录" />
    </el-card>
  </div>
</template>

<style scoped>
.billing-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 0;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.billing-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
}

.header-icon {
  color: #409eff;
}

.plan-info {
  text-align: center;
  padding: 20px 0;
}

.plan-name {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 12px;
}

.plan-price {
  font-size: 36px;
  font-weight: 700;
  color: #409eff;
  margin-bottom: 8px;
}

.price-period {
  font-size: 16px;
  font-weight: normal;
  color: #909399;
}

.price-free {
  font-size: 36px;
  font-weight: 700;
  color: #67c23a;
}

.plan-desc {
  color: #606266;
  margin-bottom: 24px;
  font-size: 14px;
}

.upgrade-btn {
  width: 100%;
}

.usage-summary {
  padding: 10px 0;
}

.usage-item {
  margin-bottom: 20px;
}

.usage-item:last-child {
  margin-bottom: 0;
}

.usage-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: #606266;
}

.usage-value {
  font-weight: 600;
  color: #303133;
}

.amount-text {
  font-weight: 600;
  color: #303133;
  font-size: 16px;
}

@media (max-width: 768px) {
  .plan-price {
    font-size: 28px;
  }
  .price-free {
    font-size: 28px;
  }
}
</style>
