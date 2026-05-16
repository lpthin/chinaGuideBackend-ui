<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { getPlansApi } from '@/api/tenants'
import type { Plan } from '@/types/api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(false)
const plans = ref<Plan[]>([])
const plansLoading = ref(true)

const form = reactive({
  code: '',
  username: 'admin',
  password: ''
})

onMounted(async () => {
  if (route.query.expired === '1') {
    ElMessage.warning('登录已过期，请重新登录')
  }
  
  try {
    plans.value = await getPlansApi()
  } catch (error) {
    console.error('Failed to load plans:', error)
  } finally {
    plansLoading.value = false
  }
})

async function submit() {
  if (!form.code || !form.password) {
    ElMessage.warning('请输入租户代码和密码')
    return
  }
  loading.value = true
  try {
    await auth.tenantLogin(form.code, form.username, form.password)
    ElMessage.success('登录成功')
    router.push((route.query.redirect as string) || '/dashboard')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}

function goToAdminLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="tenant-login-page">
    <el-card class="login-card" shadow="lg">
      <div class="login-header">
        <h1>GeoCMS SaaS</h1>
        <p>AI 时代门户网站管理平台</p>
      </div>
      
      <el-tabs class="login-tabs">
        <el-tab-pane label="租户登录" lazy>
          <el-form label-position="top" @submit.prevent="submit">
            <el-form-item label="租户代码">
              <el-input 
                v-model="form.code" 
                placeholder="请输入租户代码，如：china-guide" 
                size="large"
                clearable
              />
            </el-form-item>
            <el-form-item label="管理员账号">
              <el-input 
                v-model="form.username" 
                placeholder="admin"
                size="large"
                clearable
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input 
                v-model="form.password" 
                placeholder="请输入密码" 
                size="large" 
                show-password 
                @keyup.enter="submit"
              />
            </el-form-item>
            <el-button 
              type="primary" 
              size="large" 
              :loading="loading" 
              class="login-button" 
              @click="submit"
            >
              登录
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      
      <div class="login-footer">
        <el-divider>或</el-divider>
        <el-button text @click="goToAdminLogin">
          平台管理员登录
        </el-button>
      </div>
    </el-card>
    
    <el-card v-if="!plansLoading && plans.length > 0" class="plans-card" shadow="lg">
      <template #header>
        <div class="plans-header">
          <span>可选套餐</span>
        </div>
      </template>
      <div class="plans-grid">
        <div 
          v-for="plan in plans" 
          :key="plan.id" 
          class="plan-item"
          :class="{ 'plan-item--featured': plan.code === 'professional' }"
        >
          <div class="plan-name">{{ plan.name }}</div>
          <div class="plan-price">
            <span v-if="plan.price && plan.price > 0">¥{{ plan.price }}</span>
            <span v-else class="plan-price--free">免费</span>
            <span v-if="plan.billingCycle" class="plan-period">/{{ plan.billingCycle }}</span>
          </div>
          <div class="plan-limits">
            <div v-if="plan.articleLimit && plan.articleLimit > 0">文章: {{ plan.articleLimit }}</div>
            <div v-if="plan.keywordLimit && plan.keywordLimit > 0">关键词: {{ plan.keywordLimit }}</div>
            <div v-if="plan.mediaLimit && plan.mediaLimit > 0">媒体: {{ plan.mediaLimit }}</div>
            <div v-if="plan.apiCallLimit && plan.apiCallLimit > 0">API调用: {{ plan.apiCallLimit }}</div>
            <div v-if="!plan.articleLimit && !plan.keywordLimit">无限制</div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.tenant-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%);
  padding: 20px;
  gap: 24px;
  flex-wrap: wrap;
}

.login-card {
  width: 440px;
  border: none;
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-header p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.login-button {
  width: 100%;
  margin-top: 8px;
}

.login-footer {
  margin-top: 16px;
  text-align: center;
}

.plans-card {
  width: 600px;
  border: none;
}

.plans-header {
  font-weight: 600;
  color: #374151;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.plan-item {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  text-align: center;
  transition: all 0.3s;
}

.plan-item:hover {
  border-color: #667eea;
  transform: translateY(-2px);
}

.plan-item--featured {
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
}

.plan-name {
  font-weight: 600;
  color: #111827;
  margin-bottom: 8px;
}

.plan-price {
  font-size: 24px;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 8px;
}

.plan-price--free {
  font-size: 20px;
}

.plan-period {
  font-size: 14px;
  font-weight: 400;
  color: #64748b;
}

.plan-limits {
  font-size: 12px;
  color: #64748b;
}

.plan-limits div {
  margin: 4px 0;
}

@media (max-width: 768px) {
  .tenant-login-page {
    flex-direction: column;
  }
  
  .login-card,
  .plans-card {
    width: 100%;
    max-width: 440px;
  }
}
</style>
