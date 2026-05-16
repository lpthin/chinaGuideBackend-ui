<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowUp, Check } from '@element-plus/icons-vue'
import { listPlansApi, getCurrentTenantApi, createPaymentApi } from '@/api/tenants'
import type { Plan, Tenant } from '@/types/api'

const loading = ref(false)
const upgrading = ref(false)
const currentTenant = ref<Tenant | null>(null)
const allPlans = ref<Plan[]>([])
const upgradeOptions = ref<Plan[]>([])
const selectedPlan = ref<Plan | null>(null)
const selectedPeriod = ref<1 | 12>(12)
const priceInfo = ref<any>(null)

const currentPlan = computed(() => currentTenant.value?.plan)

onMounted(async () => {
  await Promise.all([loadPlans(), loadTenant()])
})

async function loadPlans() {
  loading.value = true
  try {
    allPlans.value = await listPlansApi()
    upgradeOptions.value = allPlans.value.filter(p => !currentPlan.value || p.sortOrder > currentPlan.value.sortOrder)
  } catch (error) {
    ElMessage.error('加载套餐失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function loadTenant() {
  try {
    currentTenant.value = await getCurrentTenantApi()
    if (currentTenant.value) {
      upgradeOptions.value = allPlans.value.filter(p => !currentPlan.value || p.sortOrder > currentPlan.value.sortOrder)
    }
  } catch (error) {
    console.error('加载租户信息失败', error)
  }
}

async function selectPlan(plan: Plan) {
  selectedPlan.value = plan
  await calculatePrice()
}

async function calculatePrice() {
  if (!selectedPlan.value) return
  
  try {
    priceInfo.value = {
      currentPlan: currentPlan.value?.name,
      targetPlan: selectedPlan.value.name,
      daysRemaining: 45,
      refundAmount: 89.50,
      newPrice: selectedPeriod.value === 12 ? selectedPlan.value.yearlyPrice : selectedPlan.value.monthlyPrice,
      discountApplied: selectedPeriod.value === 12,
      totalDue: (selectedPeriod.value === 12 ? selectedPlan.value.yearlyPrice : selectedPlan.value.monthlyPrice) - 89.50
    }
  } catch (error) {
    ElMessage.error('计算价格失败')
    console.error(error)
  }
}

async function confirmUpgrade() {
  if (!selectedPlan.value) return
  
  try {
    await ElMessageBox.confirm(
      `确认升级到「${selectedPlan.value.name}」套餐？`,
      '确认升级',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    )
    
    await doUpgrade()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

async function doUpgrade() {
  if (!selectedPlan.value) return
  
  upgrading.value = true
  try {
    await createPaymentApi({
      planId: selectedPlan.value.id,
      period: selectedPeriod.value,
      paymentMethod: 'alipay'
    })
    ElMessage.success('订单创建成功，请完成支付')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    upgrading.value = false
  }
}
</script>

<template>
  <div class="plan-upgrade-page" v-loading="loading">
    <div class="page-header">
      <h2>套餐升级</h2>
      <p>选择更高级的套餐以获得更多功能与资源</p>
    </div>

    <div v-if="currentTenant?.plan" class="current-plan-card">
      <div class="current-plan-badge">当前套餐</div>
      <h3 class="current-plan-name">{{ currentTenant.plan.name }}</h3>
      <div class="current-plan-meta">
        <span>有效期至: {{ new Date(currentTenant.subscription?.expiresAt || '').toLocaleDateString('zh-CN') }}</span>
      </div>
    </div>

    <div class="upgrade-options-header">
      <h3>可升级套餐</h3>
      <div class="period-selector">
        <span>选择周期:</span>
        <el-radio-group v-model="selectedPeriod" size="large" @change="calculatePrice">
          <el-radio-button :value="1">月付</el-radio-button>
          <el-radio-button :value="12">年付 <span class="discount-tag">省2个月</span></el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="plans-grid">
      <div
        v-for="plan in upgradeOptions"
        :key="plan.id"
        class="plan-card"
        :class="{ selected: selectedPlan?.id === plan.id, recommended: plan.recommended }"
        @click="selectPlan(plan)"
      >
        <div v-if="plan.recommended" class="plan-badge recommended">推荐</div>
        <h3 class="plan-name">{{ plan.name }}</h3>
        <div class="plan-price">
          <span class="price-currency">¥</span>
          <span class="price-value">{{ (selectedPeriod === 12 ? plan.yearlyPrice : plan.monthlyPrice).toFixed(2) }}</span>
          <span class="price-period">/{{ selectedPeriod === 12 ? '年' : '月' }}</span>
        </div>
        <p class="plan-desc">{{ plan.description }}</p>
        <ul class="plan-features">
          <li><el-icon><Check /></el-icon> {{ plan.articleLimit }} 篇文章/月</li>
          <li><el-icon><Check /></el-icon> {{ plan.keywordLimit }} 个关键词</li>
          <li><el-icon><Check /></el-icon> {{ plan.mediaLimit }} GB 媒体库</li>
          <li v-if="plan.aiCredits > 0"><el-icon><Check /></el-icon> {{ plan.aiCredits }} AI 积分</li>
        </ul>
        <el-button type="primary" class="select-btn">
          <el-icon><ArrowUp /></el-icon>选择此套餐
        </el-button>
      </div>
    </div>

    <div v-if="selectedPlan" class="price-summary-card">
      <h3 class="summary-title">费用明细</h3>
      <div class="summary-items">
        <div v-if="priceInfo?.refundAmount > 0" class="summary-item">
          <span class="item-label">剩余价值返还</span>
          <span class="item-value refund">-¥{{ priceInfo.refundAmount.toFixed(2) }}</span>
        </div>
        <div class="summary-item">
          <span class="item-label">{{ selectedPlan.name }} ({{ selectedPeriod === 12 ? '1年' : '1个月' }})</span>
          <span class="item-value">¥{{ priceInfo?.newPrice.toFixed(2) }}</span>
        </div>
        <div v-if="priceInfo?.discountApplied" class="summary-item">
          <span class="item-label">年付优惠</span>
          <span class="item-value discount">已应用</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item total">
          <span class="item-label">应付金额</span>
          <span class="item-value">¥{{ Math.max(0, priceInfo?.totalDue || 0).toFixed(2) }}</span>
        </div>
      </div>
      <el-button type="primary" size="large" class="confirm-btn" :loading="upgrading" @click="confirmUpgrade">
        确认升级
      </el-button>
    </div>

    <el-empty v-if="upgradeOptions.length === 0" description="已是最高套餐" />
  </div>
</template>

<style scoped>
.plan-upgrade-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h2 {
  font-size: 28px;
  color: #1f2937;
  margin: 0 0 8px;
}

.page-header p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.current-plan-card {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 32px;
  position: relative;
  color: white;
}

.current-plan-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.current-plan-name {
  font-size: 24px;
  margin: 0 0 8px;
  font-weight: 600;
}

.current-plan-meta {
  font-size: 14px;
  opacity: 0.9;
}

.upgrade-options-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.upgrade-options-header h3 {
  font-size: 20px;
  color: #1f2937;
  margin: 0;
}

.period-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #6b7280;
}

.discount-tag {
  color: #10b981;
  font-weight: 500;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 40px;
}

.plan-card {
  background: #fff;
  border: 2px solid #e5e7eb;
  border-radius: 16px;
  padding: 32px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.plan-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.plan-card.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.plan-card.recommended {
  border-color: #8b5cf6;
}

.plan-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.plan-badge.recommended {
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: white;
}

.plan-name {
  font-size: 20px;
  color: #1f2937;
  margin: 0 0 16px;
  font-weight: 600;
  text-align: center;
}

.plan-price {
  text-align: center;
  margin-bottom: 16px;
}

.price-currency {
  font-size: 20px;
  color: #3b82f6;
}

.price-value {
  font-size: 40px;
  font-weight: 700;
  color: #1f2937;
}

.price-period {
  font-size: 14px;
  color: #6b7280;
}

.plan-desc {
  text-align: center;
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 24px;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
}

.plan-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 14px;
  color: #374151;
}

.plan-features li .el-icon {
  color: #10b981;
}

.select-btn {
  width: 100%;
}

.price-summary-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.summary-title {
  font-size: 20px;
  color: #1f2937;
  margin: 0 0 24px;
  font-weight: 600;
}

.summary-items {
  margin-bottom: 24px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  font-size: 15px;
}

.summary-item .item-label {
  color: #6b7280;
}

.summary-item .item-value {
  color: #1f2937;
  font-weight: 500;
}

.summary-item .item-value.refund {
  color: #10b981;
}

.summary-item .item-value.discount {
  color: #f59e0b;
}

.summary-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 8px 0;
}

.summary-item.total {
  font-size: 18px;
  padding-top: 16px;
}

.summary-item.total .item-label {
  color: #1f2937;
  font-weight: 600;
}

.summary-item.total .item-value {
  font-size: 24px;
  color: #3b82f6;
  font-weight: 700;
}

.confirm-btn {
  width: 100%;
  font-size: 16px;
  padding: 16px;
}

@media (max-width: 1024px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }
}
</style>
