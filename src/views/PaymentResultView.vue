<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check, Close, ShoppingCart } from '@element-plus/icons-vue'
import { getPlansApi, changePlanApi } from '@/api/tenants'
import type { Plan } from '@/types/api'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const plans = ref<Plan[]>([])

const isSuccess = computed(() => route.query.status === 'success')
const orderId = computed(() => route.query.orderId as string)
const planId = computed(() => {
  const id = route.query.planId
  return id ? parseInt(id as string) : null
})

const currentPlan = computed(() => {
  if (!planId.value) return null
  return plans.value.find(p => p.id === planId.value)
})

const loadPlans = async () => {
  try {
    plans.value = await getPlansApi()
  } catch (error) {
    console.error('Failed to load plans:', error)
  }
}

onMounted(() => {
  loadPlans()
})

const goToDashboard = () => {
  router.push('/dashboard')
}

const goToPlans = () => {
  router.push('/plans')
}

const handleUpgrade = async () => {
  if (!planId.value) {
    ElMessage.warning('套餐ID无效')
    return
  }

  loading.value = true
  try {
    await changePlanApi(planId.value)
    ElMessage.success('套餐升级成功！')
    router.push('/dashboard')
  } catch (error) {
    ElMessage.error('套餐升级失败，请重试')
    console.error(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="payment-result-page">
    <el-card class="result-card" shadow="lg">
      <div class="result-content">
        <div class="result-icon">
          <el-icon :size="80" :color="isSuccess ? '#67c23a' : '#f56c6c'">
            <Check v-if="isSuccess" />
            <Close v-else />
          </el-icon>
        </div>

        <h1 class="result-title">
          {{ isSuccess ? '支付成功！' : '支付失败' }}
        </h1>

        <p class="result-description">
          {{ isSuccess ? '您的支付已成功处理' : '支付过程中出现问题，请重试' }}
        </p>

        <div v-if="orderId" class="order-info">
          <el-tag type="info" size="large">
            订单号: {{ orderId }}
          </el-tag>
        </div>

        <div v-if="currentPlan" class="plan-info">
          <div class="plan-name">{{ currentPlan.name }}</div>
          <div class="plan-price">
            ¥{{ currentPlan.price?.toFixed(2) }}
          </div>
        </div>

        <div class="action-buttons">
          <el-button v-if="isSuccess" type="primary" size="large" @click="goToDashboard">
            前往仪表盘
          </el-button>

          <el-button v-else type="primary" size="large" :loading="loading" @click="handleUpgrade">
            立即重试
          </el-button>

          <el-button v-if="!isSuccess" size="large" @click="goToPlans">
            返回套餐
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card class="help-card" shadow="sm">
      <template #header>
        <div class="card-header">
          <span>需要帮助？</span>
        </div>
      </template>
      <div class="help-content">
        <div class="help-item">
          <el-icon><ShoppingCart /></el-icon>
          <span>查看订单详情</span>
        </div>
        <div class="help-item">
          <el-icon><Check /></el-icon>
          <span>检查支付状态</span>
        </div>
        <div class="help-item">
          <el-icon><Close /></el-icon>
          <span>联系客服</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.payment-result-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  padding: 20px;
  gap: 24px;
}

.result-card {
  width: 100%;
  max-width: 500px;
  text-align: center;
}

.result-content {
  padding: 20px 0;
}

.result-icon {
  margin-bottom: 24px;
}

.result-title {
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 600;
  color: #1f2937;
}

.result-description {
  margin: 0 0 24px;
  color: #6b7280;
  font-size: 16px;
}

.order-info {
  margin-bottom: 20px;
}

.plan-info {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 28px;
}

.plan-name {
  font-size: 20px;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 8px;
}

.plan-price {
  font-size: 32px;
  font-weight: 700;
  color: #1e40af;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-buttons .el-button {
  width: 100%;
}

.help-card {
  width: 100%;
  max-width: 500px;
}

.card-header {
  font-weight: 600;
  color: #374151;
}

.help-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.help-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.help-item:hover {
  background: #f3f4f6;
}

.help-item .el-icon {
  font-size: 24px;
  color: #6366f1;
}

.help-item span {
  font-size: 14px;
  color: #4b5563;
}

@media (max-width: 640px) {
  .help-content {
    grid-template-columns: 1fr;
  }

  .result-title {
    font-size: 24px;
  }

  .plan-price {
    font-size: 28px;
  }
}
</style>
