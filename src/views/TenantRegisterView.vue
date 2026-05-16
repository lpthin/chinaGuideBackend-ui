<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { registerTenantApi, getPlansApi } from '@/api/tenants'
import type { Plan } from '@/types/api'

const router = useRouter()
const loading = ref(false)
const plans = ref<Plan[]>([])
const plansLoading = ref(true)

const form = reactive({
  code: '',
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const validateCode = (rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请输入租户代码'))
  } else if (!/^[a-z0-9-]+$/.test(value)) {
    callback(new Error('租户代码只能包含小写字母、数字和连字符'))
  } else if (value.length < 3 || value.length > 32) {
    callback(new Error('租户代码长度应在3-32个字符之间'))
  } else {
    callback()
  }
}

const validatePassword = (rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请输入密码'))
  } else if (value.length < 8) {
    callback(new Error('密码长度至少为8位'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请再次输入密码'))
  } else if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  code: [{ validator: validateCode, trigger: 'blur' }],
  name: [{ required: true, message: '请输入租户名称', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  password: [{ validator: validatePassword, trigger: 'blur' }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }]
}

const loadPlans = async () => {
  try {
    plans.value = await getPlansApi()
  } catch (error) {
    console.error('Failed to load plans:', error)
  } finally {
    plansLoading.value = false
  }
}

loadPlans()

const submit = async () => {
  loading.value = true
  try {
    await registerTenantApi({
      code: form.code,
      name: form.name,
      email: form.email,
      password: form.password
    })
    ElMessage.success('注册成功！请登录')
    router.push({ name: 'tenant-login', query: { code: form.code } })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '注册失败')
  } finally {
    loading.value = false
  }
}

const goToLogin = () => {
  router.push({ name: 'tenant-login' })
}
</script>

<template>
  <div class="tenant-register-page">
    <el-card class="register-card" shadow="lg">
      <div class="register-header">
        <h1>注册租户</h1>
        <p>创建您的 GeoCMS SaaS 账户</p>
      </div>
      
      <el-form
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="submit"
      >
        <el-form-item label="租户代码" prop="code">
          <el-input
            v-model="form.code"
            placeholder="例如：my-company"
            size="large"
            clearable
          />
          <div class="form-tip">租户代码将作为您的专属标识符，请谨慎选择</div>
        </el-form-item>
        
        <el-form-item label="租户名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入租户名称"
            size="large"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="联系邮箱" prop="email">
          <el-input
            v-model="form.email"
            type="email"
            placeholder="请输入邮箱地址"
            size="large"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="管理员密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码（至少8位）"
            size="large"
            show-password
          />
        </el-form-item>
        
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            size="large"
            show-password
            @keyup.enter="submit"
          />
        </el-form-item>
        
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          class="register-button"
          @click="submit"
        >
          注册
        </el-button>
      </el-form>
      
      <div class="register-footer">
        <el-divider>或</el-divider>
        <el-button text @click="goToLogin">
          已有账户？立即登录
        </el-button>
      </div>
    </el-card>
    
    <el-card v-if="!plansLoading && plans.length > 0" class="plans-info-card" shadow="lg">
      <template #header>
        <div class="plans-info-header">
          <span>套餐概览</span>
        </div>
      </template>
      <div class="plans-info-grid">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="plan-info-item"
        >
          <div class="plan-info-name">{{ plan.name }}</div>
          <div class="plan-info-price">
            <span v-if="plan.price && plan.price > 0">¥{{ plan.price }}</span>
            <span v-else class="plan-info-price--free">免费</span>
          </div>
          <ul class="plan-info-features">
            <li>文章: {{ plan.articleLimit || '无限制' }}</li>
            <li>关键词: {{ plan.keywordLimit || '无限制' }}</li>
            <li>媒体: {{ plan.mediaLimit || '无限制' }}</li>
            <li>API: {{ plan.apiCallLimit || '无限制' }}</li>
          </ul>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.tenant-register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%);
  padding: 20px;
  gap: 24px;
  flex-wrap: wrap;
}

.register-card {
  width: 440px;
  border: none;
}

.register-header {
  text-align: center;
  margin-bottom: 24px;
}

.register-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.register-header p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.register-button {
  width: 100%;
  margin-top: 8px;
}

.register-footer {
  margin-top: 16px;
  text-align: center;
}

.plans-info-card {
  width: 600px;
  border: none;
}

.plans-info-header {
  font-weight: 600;
  color: #303133;
}

.plans-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.plan-info-item {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  text-align: center;
}

.plan-info-name {
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.plan-info-price {
  font-size: 24px;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 12px;
}

.plan-info-price--free {
  color: #67c23a;
}

.plan-info-features {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 12px;
  color: #606266;
}

.plan-info-features li {
  margin: 4px 0;
}

@media (max-width: 768px) {
  .tenant-register-page {
    flex-direction: column;
  }
  
  .register-card,
  .plans-info-card {
    width: 100%;
    max-width: 440px;
  }
}
</style>
