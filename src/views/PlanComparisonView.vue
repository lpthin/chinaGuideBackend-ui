<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Close, Wallet, Document, Cpu, Search, DataAnalysis } from '@element-plus/icons-vue'
import { getPlansApi, changePlanApi, createPaymentApi } from '@/api/tenants'
import type { Plan } from '@/types/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const plans = ref<Plan[]>([])
const selectedPlanId = ref<number | null>(null)

const featureLabels = [
  { key: 'articleLimit', label: '文章配额', icon: Document },
  { key: 'keywordLimit', label: '关键词配额', icon: Search },
  { key: 'mediaLimit', label: '媒体文件配额', icon: Wallet },
  { key: 'apiCallLimit', label: 'API 调用配额', icon: Cpu },
]

onMounted(async () => {
  loading.value = true
  try {
    plans.value = await getPlansApi()
    if (auth.tenant?.planId) {
      selectedPlanId.value = auth.tenant.planId
    }
  } catch (error) {
    ElMessage.error('加载套餐列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
})

const currentPlan = computed(() => {
  if (!auth.tenant?.planId) return null
  return plans.value.find(p => p.id === auth.tenant.planId)
})

function getDisplayValue(plan: Plan, key: string) {
  const value = (plan as any)[key]
  if (!value || value <= 0) return '无限制'
  return value.toLocaleString()
}

function isCurrentPlan(plan: Plan) {
  return auth.tenant?.planId === plan.id
}

function isFreePlan(plan: Plan) {
  return !plan.price || plan.price <= 0
}

async function selectPlan(plan: Plan) {
  if (isCurrentPlan(plan)) {
    ElMessage.info('您已选择该套餐')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要切换到 ${plan.name} 套餐吗？`,
      '确认操作',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: isFreePlan(plan) ? 'warning' : 'success'
      }
    )

    if (isFreePlan(plan)) {
      await changePlanApi(plan.id)
      ElMessage.success(`已成功切换到 ${plan.name} 套餐`)
      await auth.loadUser()
    } else {
      ElMessage.info('正在创建支付订单...')
      await createPaymentApi(plan.id, 'alipay')
      await new Promise(resolve => setTimeout(resolve, 1500))
      router.push({
        path: '/payment-result',
        query: {
          status: 'success',
          orderId: `ORD-${Date.now()}`,
          planId: plan.id
        }
      })
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('套餐切换失败')
      console.error(error)
    }
  }
}

function goToPlans() {
  router.push('/plans')
}
</script>

<template>
  <div class="plan-comparison-page" v-loading="loading">
    <el-page-header @back="goToPlans" title="返回套餐">
      <template #content>
        <span class="page-title">套餐对比</span>
      </template>
    </el-page-header>

    <el-card class="comparison-intro" shadow="never">
      <div class="intro-content">
        <h2>对比不同套餐，找到最适合您的</h2>
        <p>根据您的业务规模和需求，选择合适的套餐</p>
      </div>
    </el-card>

    <div class="comparison-container">
      <div class="comparison-table">
        <!-- Feature Column -->
        <div class="feature-column">
          <div class="feature-header"></div>
          <div class="feature-row">
            <span class="feature-label">套餐</span>
          </div>
          <div class="feature-row">
            <span class="feature-label">价格</span>
          </div>
          <div class="feature-divider"></div>
          <div class="feature-row">
            <span class="feature-label"><el-icon><Document /></el-icon> 文章配额</span>
          </div>
          <div class="feature-row">
            <span class="feature-label"><el-icon><Search /></el-icon> 关键词配额</span>
          </div>
          <div class="feature-row">
            <span class="feature-label"><el-icon><Wallet /></el-icon> 媒体文件配额</span>
          </div>
          <div class="feature-row">
            <span class="feature-label"><el-icon><Cpu /></el-icon> API 调用配额</span>
          </div>
          <div class="feature-divider"></div>
          <div class="feature-row"></div>
        </div>

        <!-- Plan Columns -->
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="plan-column"
          :class="{
            'plan-column-current': isCurrentPlan(plan),
            'plan-column-featured': plan.code === 'professional'
          }"
        >
          <div class="plan-header">
            <div class="plan-name-row">
              <span class="plan-name">{{ plan.name }}</span>
              <el-tag v-if="isCurrentPlan(plan)" type="success" size="small">当前</el-tag>
              <el-tag v-else-if="plan.code === 'professional'" type="primary" size="small">推荐</el-tag>
            </div>
            <div v-if="plan.description" class="plan-desc">{{ plan.description }}</div>
          </div>
          
          <div class="plan-row">
            <div class="plan-price">
              <span v-if="plan.price && plan.price > 0">
                <span class="price-symbol">¥</span>
                <span class="price-value">{{ plan.price }}</span>
                <span class="price-period">/月</span>
              </span>
              <span v-else class="price-free">免费</span>
            </div>
          </div>
          
          <div class="plan-divider"></div>
          
          <div class="plan-row">
            <div class="plan-feature">
              <el-icon v-if="!plan.articleLimit || plan.articleLimit > 0" color="#10b981"><Check /></el-icon>
              <el-icon v-else color="#f56c6c"><Close /></el-icon>
              <span>{{ getDisplayValue(plan, 'articleLimit') }}</span>
            </div>
          </div>
          <div class="plan-row">
            <div class="plan-feature">
              <el-icon v-if="!plan.keywordLimit || plan.keywordLimit > 0" color="#10b981"><Check /></el-icon>
              <el-icon v-else color="#f56c6c"><Close /></el-icon>
              <span>{{ getDisplayValue(plan, 'keywordLimit') }}</span>
            </div>
          </div>
          <div class="plan-row">
            <div class="plan-feature">
              <el-icon v-if="!plan.mediaLimit || plan.mediaLimit > 0" color="#10b981"><Check /></el-icon>
              <el-icon v-else color="#f56c6c"><Close /></el-icon>
              <span>{{ getDisplayValue(plan, 'mediaLimit') }}</span>
            </div>
          </div>
          <div class="plan-row">
            <div class="plan-feature">
              <el-icon v-if="!plan.apiCallLimit || plan.apiCallLimit > 0" color="#10b981"><Check /></el-icon>
              <el-icon v-else color="#f56c6c"><Close /></el-icon>
              <span>{{ getDisplayValue(plan, 'apiCallLimit') }}</span>
            </div>
          </div>
          
          <div class="plan-divider"></div>
          
          <div class="plan-row plan-action-row">
            <el-button
              :type="isCurrentPlan(plan) ? 'info' : (plan.code === 'professional' ? 'primary' : 'default')"
              size="large"
              class="plan-action-btn"
              @click="selectPlan(plan)"
              :disabled="isCurrentPlan(plan)"
            >
              {{ isCurrentPlan(plan) ? '当前套餐' : '选择套餐' }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plan-comparison-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 4px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.comparison-intro {
  margin: 20px 0;
  border: 0;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}

.intro-content {
  text-align: center;
}

.intro-content h2 {
  margin: 0 0 8px;
  font-size: 24px;
  color: #1e293b;
}

.intro-content p {
  margin: 0;
  color: #64748b;
  font-size: 15px;
}

.comparison-container {
  overflow-x: auto;
  padding: 10px 0;
}

.comparison-table {
  display: flex;
  gap: 14px;
  min-width: 900px;
}

.feature-column {
  flex: 0 0 160px;
  display: flex;
  flex-direction: column;
}

.plan-column {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  border: 2px solid #e2e8f0;
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  transition: all 0.2s;
}

.plan-column:hover {
  border-color: #94a3b8;
  box-shadow: 0 8px 24px rgba(15,23,42,.08);
}

.plan-column-featured {
  border-color: #409eff;
  box-shadow: 0 12px 32px rgba(64,158,255,.15);
}

.plan-column-current {
  border-color: #67c23a;
  background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%);
}

.feature-header {
  height: 100px;
  padding: 16px;
}

.plan-header {
  height: 100px;
  padding: 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.plan-column-featured .plan-header {
  background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%);
}

.plan-column-current .plan-header {
  background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%);
}

.plan-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.plan-name {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.plan-desc {
  font-size: 13px;
  color: #64748b;
}

.feature-row, .plan-row {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  min-height: 56px;
  border-bottom: 1px solid #f1f5f9;
}

.feature-row:last-child, .plan-row:last-child {
  border-bottom: 0;
}

.feature-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 6px;
}

.feature-divider, .plan-divider {
  height: 16px;
  background: #f8fafc;
}

.plan-price {
  text-align: center;
  width: 100%;
}

.price-symbol {
  font-size: 18px;
  color: #409eff;
  vertical-align: top;
}

.price-value {
  font-size: 36px;
  font-weight: 700;
  color: #409eff;
}

.price-period {
  font-size: 14px;
  color: #64748b;
}

.price-free {
  font-size: 28px;
  font-weight: 700;
  color: #67c23a;
}

.plan-feature {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  font-size: 14px;
  color: #4b5563;
}

.plan-action-row {
  padding: 18px 16px;
  justify-content: center;
}

.plan-action-btn {
  width: 100%;
}

@media (max-width: 1200px) {
  .comparison-table {
    min-width: 700px;
  }
  
  .feature-column {
    flex: 0 0 120px;
  }
  
  .price-value {
    font-size: 28px;
  }
}
</style>
