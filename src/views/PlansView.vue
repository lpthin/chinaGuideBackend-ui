<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { getPlansApi } from '@/api/tenants'
import type { Plan } from '@/types/api'

const loading = ref(false)
const plans = ref<Plan[]>([])

onMounted(async () => {
  loading.value = true
  try {
    plans.value = await getPlansApi()
  } catch (error) {
    ElMessage.error('加载套餐列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
})

function getPlanFeatures(plan: Plan): string[] {
  const features: string[] = []
  if (plan.articleLimit && plan.articleLimit > 0) {
    features.push(`文章配额: ${plan.articleLimit} 篇`)
  } else {
    features.push('文章配额: 无限制')
  }
  if (plan.keywordLimit && plan.keywordLimit > 0) {
    features.push(`关键词配额: ${plan.keywordLimit} 个`)
  } else {
    features.push('关键词配额: 无限制')
  }
  if (plan.mediaLimit && plan.mediaLimit > 0) {
    features.push(`媒体配额: ${plan.mediaLimit} 个文件`)
  } else {
    features.push('媒体配额: 无限制')
  }
  if (plan.apiCallLimit && plan.apiCallLimit > 0) {
    features.push(`API 调用: ${plan.apiCallLimit} 次/月`)
  } else {
    features.push('API 调用: 无限制')
  }
  return features
}

function selectPlan(plan: Plan) {
  ElMessage.info(`您已选择 ${plan.name} 套餐，请联系销售进行升级`)
}
</script>

<template>
  <div class="plans-page" v-loading="loading">
    <el-page-header @back="$router.back()" title="返回">
      <template #content>
        <span class="page-title">套餐管理</span>
      </template>
    </el-page-header>

    <div class="plans-intro">
      <h2>选择适合您的方案</h2>
      <p>灵活的定价方案，满足不同规模的业务需求</p>
    </div>

    <div class="plans-grid">
      <el-card 
        v-for="plan in plans" 
        :key="plan.id" 
        class="plan-card"
        :class="{ 'plan-card--featured': plan.code === 'professional' }"
        shadow="hover"
      >
        <template #header>
          <div class="plan-header">
            <div class="plan-name">{{ plan.name }}</div>
            <div v-if="plan.code === 'professional'" class="plan-badge">推荐</div>
          </div>
        </template>
        
        <div class="plan-price">
          <span v-if="plan.price && plan.price > 0">
            <span class="price-symbol">¥</span>
            <span class="price-value">{{ plan.price }}</span>
            <span class="price-period">/{{ plan.billingCycle || '月' }}</span>
          </span>
          <span v-else class="price-free">免费</span>
        </div>

        <div v-if="plan.description" class="plan-description">
          {{ plan.description }}
        </div>

        <el-divider />

        <ul class="plan-features">
          <li v-for="feature in getPlanFeatures(plan)" :key="feature">
            <el-icon color="#67c23a"><Check /></el-icon>
            <span>{{ feature }}</span>
          </li>
        </ul>

        <el-button 
          :type="plan.code === 'professional' ? 'primary' : 'default'"
          size="large" 
          class="plan-button"
          @click="selectPlan(plan)"
        >
          {{ plan.code === 'professional' ? '立即选择' : '选择此套餐' }}
        </el-button>
      </el-card>
    </div>

    <el-card class="faq-card">
      <template #header>
        <span>常见问题</span>
      </template>
      
      <el-collapse>
        <el-collapse-item title="可以随时升级或降级套餐吗？" name="1">
          <p>是的，您可以随时升级或降级您的套餐。升级立即生效，降级将在当前计费周期结束后生效。</p>
        </el-collapse-item>
        <el-collapse-item title="超出配额后会发生什么？" name="2">
          <p>当您的使用量达到套餐配额的 90% 时，系统会发送提醒通知。达到 100% 后，部分功能可能会受到限制，直到您升级套餐或下一个计费周期开始。</p>
        </el-collapse-item>
        <el-collapse-item title="支持哪些支付方式？" name="3">
          <p>我们支持支付宝、微信支付、银行卡转账等多种支付方式。企业用户还可以选择对公转账。</p>
        </el-collapse-item>
        <el-collapse-item title="有试用期限吗？" name="4">
          <p>免费套餐可以永久使用，无需信用卡。付费套餐提供 7 天无理由退款保障。</p>
        </el-collapse-item>
      </el-collapse>
    </el-card>
  </div>
</template>

<style scoped>
.plans-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 0;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.plans-intro {
  text-align: center;
  margin: 40px 0;
}

.plans-intro h2 {
  font-size: 28px;
  color: #303133;
  margin: 0 0 12px;
}

.plans-intro p {
  font-size: 16px;
  color: #909399;
  margin: 0;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 40px;
}

.plan-card {
  border-radius: 16px;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.plan-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
}

.plan-card--featured {
  border: 2px solid #409eff;
}

.plan-card--featured::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #409eff, #67c23a);
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plan-name {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.plan-badge {
  background: linear-gradient(135deg, #409eff, #67c23a);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.plan-price {
  text-align: center;
  padding: 20px 0;
}

.price-symbol {
  font-size: 20px;
  color: #409eff;
  vertical-align: top;
}

.price-value {
  font-size: 48px;
  font-weight: 700;
  color: #409eff;
}

.price-period {
  font-size: 14px;
  color: #909399;
}

.price-free {
  font-size: 36px;
  font-weight: 700;
  color: #67c23a;
}

.plan-description {
  text-align: center;
  color: #606266;
  font-size: 14px;
  margin-bottom: 16px;
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
  color: #606266;
}

.plan-button {
  width: 100%;
}

.faq-card {
  margin-top: 20px;
}
</style>
