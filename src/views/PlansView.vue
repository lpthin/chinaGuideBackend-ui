<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Document, User, Lock, Edit, CreditCard } from '@element-plus/icons-vue'
import { getPlansApi, changePlanApi, createPaymentApi } from '@/api/tenants'
import type { Plan } from '@/types/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const loading = ref(false)
const plans = ref<Plan[]>([])
const upgradingPlanId = ref<number | null>(null)
const currentPlanId = ref<number | null>(null)
const auth = useAuthStore()

const paymentMethods = [
  { value: 'alipay', label: '支付宝' },
  { value: 'wechatpay', label: '微信支付' }
]

const planIcons: Record<string, any> = {
  free: Document,
  basic: Edit,
  professional: Check,
  enterprise: Lock
}

const planColors: Record<string, string> = {
  free: '#94a3b8',
  basic: '#3b82f6',
  professional: '#f59e0b',
  enterprise: '#10b981'
}

const planGradients: Record<string, string> = {
  free: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
  basic: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  professional: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  enterprise: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
}

const planDescriptions: Record<string, string> = {
  free: '适合个人使用，体验基础功能',
  basic: '适合小团队，满足日常需求',
  professional: '适合成长型企业，功能丰富',
  enterprise: '适合大型企业，专属定制服务'
}

onMounted(async () => {
  loading.value = true
  try {
    plans.value = await getPlansApi()
    if (auth.tenant?.planId) {
      currentPlanId.value = auth.tenant.planId
    }
  } catch (error) {
    ElMessage.error('加载套餐列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
})

function getPlanFeatures(plan: Plan): { icon: string, text: string }[] {
  const features: { icon: string, text: string }[] = []
  if (plan.articleLimit && plan.articleLimit > 0) {
    features.push({ icon: '📝', text: `文章配额: ${plan.articleLimit} 篇` })
  } else {
    features.push({ icon: '📝', text: '文章配额: 无限制' })
  }
  if (plan.keywordLimit && plan.keywordLimit > 0) {
    features.push({ icon: '🔑', text: `关键词配额: ${plan.keywordLimit} 个` })
  } else {
    features.push({ icon: '🔑', text: '关键词配额: 无限制' })
  }
  if (plan.mediaLimit && plan.mediaLimit > 0) {
    features.push({ icon: '🖼️', text: `媒体配额: ${plan.mediaLimit} 个文件` })
  } else {
    features.push({ icon: '🖼️', text: '媒体配额: 无限制' })
  }
  if (plan.apiCallLimit && plan.apiCallLimit > 0) {
    features.push({ icon: '⚡', text: `API 调用: ${plan.apiCallLimit} 次/月` })
  } else {
    features.push({ icon: '⚡', text: 'API 调用: 无限制' })
  }
  return features
}

function isCurrentPlan(plan: Plan): boolean {
  return currentPlanId.value === plan.id
}

function getPlanIcon(planCode: string) {
  return planIcons[planCode] || Check
}

function getPlanColor(planCode: string) {
  return planColors[planCode] || '#409eff'
}

function getPlanGradient(planCode: string) {
  return planGradients[planCode] || 'linear-gradient(135deg, #409eff 0%, #66b1ff 100%)'
}

function getPlanDescription(planCode: string) {
  return planDescriptions[planCode] || ''
}

async function handleFreePlan(plan: Plan) {
  try {
    await changePlanApi(plan.id)
    ElMessage.success(`已成功切换到 ${plan.name} 套餐`)
    currentPlanId.value = plan.id
  } catch (error) {
    ElMessage.error('套餐切换失败')
    console.error(error)
  }
}

async function handlePaidPlan(plan: Plan) {
  try {
    const { value: paymentMethod } = await ElMessageBox.prompt(
      '请选择支付方式',
      `升级到 ${plan.name}`,
      {
        confirmButtonText: '确认支付',
        cancelButtonText: '取消',
        inputPlaceholder: '选择支付方式',
        inputPattern: /^(alipay|wechatpay)$/,
        inputErrorMessage: '请选择有效的支付方式',
        inputType: 'select',
        inputOptions: paymentMethods
      }
    )

    upgradingPlanId.value = plan.id

    ElMessage.info('正在创建支付订单...')
    const paymentResult = await createPaymentApi(plan.id, paymentMethod)

    ElMessage.info('正在处理支付...')
    await new Promise(resolve => setTimeout(resolve, 1500))

    router.push({
      path: '/payment-result',
      query: {
        status: 'success',
        orderId: paymentResult.orderId || 'ORD-' + Date.now(),
        planId: plan.id
      }
    })
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('支付失败，请重试')
      console.error(error)
    }
  } finally {
    upgradingPlanId.value = null
  }
}

async function selectPlan(plan: Plan) {
  if (isCurrentPlan(plan)) {
    ElMessage.info('您已选择该套餐')
    return
  }

  const action = plan.price && plan.price > 0 ? '升级到' : '降级到'

  try {
    await ElMessageBox.confirm(
      `确定要${action} ${plan.name} 套餐吗？`,
      '确认操作',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: plan.price && plan.price > 0 ? 'success' : 'warning'
      }
    )

    if (plan.price && plan.price > 0) {
      await handlePaidPlan(plan)
    } else {
      await handleFreePlan(plan)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('套餐变更失败')
      console.error(error)
    }
  }
}

function goToCompare() {
  router.push('/plans/compare')
}
</script>

<template>
  <div class="plans-page" v-loading="loading">
    <div class="page-header-wrapper">
      <div class="page-header-left">
        <div class="header-icon">
          <CreditCard class="icon" />
        </div>
        <div>
          <h2 class="page-title">套餐管理</h2>
          <p class="page-subtitle">选择适合您的方案</p>
        </div>
      </div>
      <div class="page-header-right">
        <el-button type="primary" class="compare-btn" @click="goToCompare">
          <Edit class="btn-icon" />
          套餐对比
        </el-button>
      </div>
    </div>

    <div class="plans-intro">
      <h2>选择适合您的方案</h2>
      <p>灵活的定价方案，满足不同规模的业务需求</p>
    </div>

    <div class="plans-grid">
      <div 
        v-for="plan in plans" 
        :key="plan.id" 
        class="plan-card"
        :class="{ 
          'plan-card--featured': plan.code === 'professional',
          'plan-card--current': isCurrentPlan(plan)
        }"
        :style="{ '--plan-color': getPlanColor(plan.code) }"
      >
        <div class="plan-header">
          <div class="plan-icon-wrapper" :style="{ background: getPlanGradient(plan.code) }">
            <component :is="getPlanIcon(plan.code)" class="plan-icon" />
          </div>
          <div class="plan-info">
            <div class="plan-name">{{ plan.name }}</div>
            <div class="plan-desc">{{ getPlanDescription(plan.code) }}</div>
          </div>
          <div v-if="isCurrentPlan(plan)" class="current-badge">
            <Check class="badge-icon" />
            当前套餐
          </div>
          <div v-else-if="plan.code === 'professional'" class="plan-badge">
            <Check class="badge-icon" />
            推荐
          </div>
        </div>
        
        <div class="plan-price">
          <span v-if="plan.price && plan.price > 0">
            <span class="price-symbol">¥</span>
            <span class="price-value">{{ plan.price }}</span>
            <span class="price-period">/{{ plan.billingCycle || '月' }}</span>
          </span>
          <span v-else class="price-free">
            <span class="free-text">免费</span>
            <span class="free-tag">永久使用</span>
          </span>
        </div>

        <div class="plan-divider"></div>

        <ul class="plan-features">
          <li v-for="(feature, index) in getPlanFeatures(plan)" :key="index" class="feature-item">
            <span class="feature-icon">{{ feature.icon }}</span>
            <span class="feature-text">{{ feature.text }}</span>
          </li>
        </ul>

        <el-button 
          :type="isCurrentPlan(plan) ? 'success' : 'primary'"
          size="large" 
          class="plan-button"
          :class="{ 
            'plan-button--current': isCurrentPlan(plan),
            'plan-button--featured': plan.code === 'professional'
          }"
          :style="{ background: isCurrentPlan(plan) ? undefined : getPlanGradient(plan.code) }"
          @click="selectPlan(plan)"
        >
          <span v-if="isCurrentPlan(plan)" class="btn-content">
            <Check class="btn-icon" />
            已选择
          </span>
          <span v-else class="btn-content">
            <Document class="btn-icon" />
            {{ plan.code === 'professional' ? '立即选择' : '选择此套餐' }}
          </span>
        </el-button>
      </div>
    </div>

    <div class="faq-card">
      <div class="faq-header">
        <div class="faq-icon">
          <User class="icon" />
        </div>
        <div>
          <h3 class="faq-title">常见问题</h3>
          <p class="faq-desc">了解更多关于套餐的信息</p>
        </div>
      </div>
      
      <el-collapse class="faq-collapse">
        <el-collapse-item title="可以随时升级或降级套餐吗？" name="1">
          <div class="faq-answer">
            <p>是的，您可以随时升级或降级您的套餐。升级立即生效，降级将在当前计费周期结束后生效。</p>
          </div>
        </el-collapse-item>
        <el-collapse-item title="超出配额后会发生什么？" name="2">
          <div class="faq-answer">
            <p>当您的使用量达到套餐配额的 90% 时，系统会发送提醒通知。达到 100% 后，部分功能可能会受到限制，直到您升级套餐或下一个计费周期开始。</p>
          </div>
        </el-collapse-item>
        <el-collapse-item title="支持哪些支付方式？" name="3">
          <div class="faq-answer">
            <p>我们支持支付宝、微信支付、银行卡转账等多种支付方式。企业用户还可以选择对公转账。</p>
          </div>
        </el-collapse-item>
        <el-collapse-item title="有试用期限吗？" name="4">
          <div class="faq-answer">
            <p>免费套餐可以永久使用，无需信用卡。付费套餐提供 7 天无理由退款保障。</p>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<style scoped>
.plans-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.page-header-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(139, 92, 246, 0.3);
}

.page-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon .icon {
  font-size: 28px;
  color: #ffffff;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 6px;
}

.page-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

.page-header-right {
  display: flex;
  gap: 12px;
}

.compare-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 500;
  background: #ffffff;
  color: #8b5cf6;
  border: none;
  transition: all 0.2s ease;
}

.compare-btn:hover {
  background: #f8fafc;
  transform: translateY(-2px);
}

.btn-icon {
  font-size: 14px;
}

.plans-intro {
  text-align: center;
  margin: 40px 0;
}

.plans-intro h2 {
  font-size: 32px;
  color: #1a1a2e;
  margin: 0 0 12px;
  font-weight: 700;
}

.plans-intro p {
  font-size: 16px;
  color: #64748b;
  margin: 0;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 28px;
  margin-bottom: 48px;
}

.plan-card {
  position: relative;
  background: #ffffff;
  border-radius: 20px;
  padding: 32px 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.plan-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--plan-color, #409eff);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.plan-card:hover {
  transform: translateY(-12px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
}

.plan-card:hover::before {
  opacity: 1;
}

.plan-card--featured {
  border: 2px solid var(--plan-color, #f59e0b);
  box-shadow: 0 8px 40px rgba(245, 158, 11, 0.15);
}

.plan-card--featured::before {
  opacity: 1;
  height: 6px;
  background: linear-gradient(90deg, var(--plan-color, #f59e0b), #fbbf24);
}

.plan-card--current {
  border: 2px solid #10b981;
}

.plan-card--current::before {
  opacity: 1;
  background: linear-gradient(90deg, #10b981, #34d399);
}

.plan-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.plan-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plan-icon {
  font-size: 32px;
  color: #ffffff;
}

.plan-info {
  text-align: center;
}

.plan-name {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.plan-desc {
  font-size: 14px;
  color: #64748b;
}

.current-badge,
.plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
}

.current-badge {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
}

.plan-badge {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
}

.badge-icon {
  font-size: 14px;
}

.plan-price {
  text-align: center;
  padding: 24px 0;
}

.price-symbol {
  font-size: 24px;
  color: var(--plan-color, #409eff);
  vertical-align: top;
}

.price-value {
  font-size: 56px;
  font-weight: 800;
  color: var(--plan-color, #409eff);
}

.price-period {
  font-size: 16px;
  color: #64748b;
}

.price-free {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.free-text {
  font-size: 48px;
  font-weight: 800;
  color: #64748b;
}

.free-tag {
  font-size: 12px;
  color: #94a3b8;
  padding: 4px 12px;
  background: #f1f5f9;
  border-radius: 12px;
}

.plan-divider {
  height: 2px;
  background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
  margin: 16px 0;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  color: #475569;
  font-size: 14px;
}

.feature-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.feature-text {
  flex: 1;
}

.plan-button {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 15px;
  border: none;
  transition: all 0.3s ease;
  margin-top: auto;
}

.plan-button--featured {
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.3);
}

.plan-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.15);
}

.plan-button--current {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%) !important;
  color: #ffffff;
}

.btn-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.faq-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.faq-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.faq-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.faq-icon .icon {
  font-size: 24px;
  color: #ffffff;
}

.faq-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 4px;
}

.faq-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.faq-collapse {
  --el-collapse-header-height: 56px;
}

.faq-collapse :deep(.el-collapse-item__header) {
  font-weight: 600;
  color: #1a1a2e;
  font-size: 15px;
  padding-left: 8px;
}

.faq-collapse :deep(.el-collapse-item__header:hover) {
  color: #8b5cf6;
}

.faq-answer {
  padding: 8px 8px 20px;
}

.faq-answer p {
  color: #64748b;
  line-height: 1.8;
  margin: 0;
}

@media (max-width: 1024px) {
  .plans-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .page-header-wrapper {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .page-header-left {
    flex-direction: column;
  }
  
  .page-header-right {
    width: 100%;
  }
  
  .compare-btn {
    width: 100%;
    justify-content: center;
  }
  
  .plans-intro h2 {
    font-size: 24px;
  }
  
  .plans-grid {
    grid-template-columns: 1fr;
  }
}
</style>
