<template>
  <div class="login-container">
    <div class="login-wrapper">
      <div class="login-header">
        <div class="logo">
          <component :is="RobotOutlined" class="logo-icon" />
        </div>
        <h1 class="title">AI 门户管理系统</h1>
        <p class="subtitle">登录您的账户以继续</p>
      </div>

      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="login-form"
        @finish="handleLogin"
      >
        <a-form-item name="username">
          <a-input
            v-model:value="formState.username"
            placeholder="用户名"
            size="large"
            autocomplete="username"
          >
            <template #prefix>
              <UserOutlined />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item name="password">
          <a-input-password
            v-model:value="formState.password"
            placeholder="密码"
            size="large"
            autocomplete="current-password"
          >
            <template #prefix>
              <LockOutlined />
            </template>
          </a-input-password>
        </a-form-item>

        <a-form-item v-if="showCaptcha" name="captcha">
          <a-row :gutter="8">
            <a-col :span="16">
              <a-input
                v-model:value="formState.captcha"
                placeholder="验证码"
                size="large"
              >
                <template #prefix>
                  <SafetyOutlined />
                </template>
              </a-input>
            </a-col>
            <a-col :span="8">
              <div class="captcha-image" @click="refreshCaptcha">
                <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
                <div v-else class="captcha-placeholder">点击刷新</div>
              </div>
            </a-col>
          </a-row>
        </a-form-item>

        <a-form-item>
          <a-space class="form-options" :size="16">
            <a-checkbox v-model:checked="formState.rememberMe">记住我</a-checkbox>
            <a @click="handleForgotPassword">忘记密码？</a>
          </a-space>
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            size="large"
            block
            :loading="loading"
            class="login-button"
          >
            {{ loading ? '登录中...' : '登录' }}
          </a-button>
        </a-form-item>
      </a-form>

      <div class="login-footer">
        <p>
          还没有账户？
          <a @click="handleRegister">立即注册</a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  RobotOutlined,
  UserOutlined,
  LockOutlined,
  SafetyOutlined,
} from '@ant-design/icons-vue'
import { useAuthStore } from '../stores/auth'
import { authApi } from '../api'
import type { LoginRequest } from '../types'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref()
const loading = ref(false)
const showCaptcha = ref(false)
const captchaImage = ref('')
const captchaKey = ref('')

const formState = reactive<LoginRequest>({
  username: '',
  password: '',
  rememberMe: false,
  captcha: '',
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度为 3-20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度为 6-32 个字符', trigger: 'blur' },
  ],
  captcha: showCaptcha.value
    ? [{ required: true, message: '请输入验证码', trigger: 'blur' }]
    : [],
}

async function refreshCaptcha() {
  try {
    const response = await fetch('/api/v2/auth/captcha')
    const data = await response.json()
    captchaImage.value = data.image
    captchaKey.value = data.key
  } catch (error) {
    console.error('Failed to load captcha:', error)
  }
}

async function handleLogin() {
  try {
    loading.value = true

    // 调用真实后端登录API
    // 后端返回 { token, userId, username, nickname, tenantId, tenantCode }
    // http拦截器返回 body.data，所以这里拿到的是 { token, userId, ... }
    const resp: any = await authApi.login(formState)

    // 映射后端响应到前端 LoginResponse 格式
    const accessToken = resp?.token || resp?.accessToken || ''
    if (!accessToken) {
      throw new Error('登录失败：未获取到有效token')
    }

    const userInfo = {
      id: resp?.userId || 0,
      username: resp?.username || formState.username,
      nickname: resp?.nickname || '',
      email: '',
      phone: '',
      avatar: '',
      tenantId: resp?.tenantId || 1,
      tenantName: resp?.tenantCode || '',
      roles: ['admin'],
      permissions: ['*'],
      status: 'enabled' as const,
      createdAt: new Date().toISOString(),
    }

    // 存储到localStorage（与auth store使用的key一致）
    localStorage.setItem('v2_access_token', accessToken)
    localStorage.setItem('v2_refresh_token', '')
    localStorage.setItem('v2_user_info', JSON.stringify(userInfo))

    // 同步更新 geocms 旧版key（兼容v1代码）
    localStorage.setItem('geocms_token', accessToken)
    localStorage.setItem('geocms_user', JSON.stringify(userInfo))
    localStorage.setItem('geocms_tenant_id', String(userInfo.tenantId))
    localStorage.setItem('geocms_tenant_code', userInfo.tenantName)

    // 更新Pinia store
    authStore.accessToken = accessToken
    authStore.refreshToken = ''
    authStore.user = userInfo as any

    message.success('登录成功！')
    router.push('/v2/workspace/dashboard')
    loading.value = false
  } catch (error: any) {
    message.error(error.message || '登录失败，请重试')
    loading.value = false
  }
}

function handleForgotPassword() {
  message.info('忘记密码功能开发中')
}

function handleRegister() {
  message.info('注册功能开发中')
}

onMounted(() => {
  if (showCaptcha.value) {
    refreshCaptcha()
  }
})
</script>

<style scoped lang="less">
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-wrapper {
  width: 100%;
  max-width: 440px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 48px 40px;
}

.login-header {
  text-align: center;
  margin-bottom: 40px;

  .logo {
    margin-bottom: 16px;

    .logo-icon {
      font-size: 56px;
      color: #1890ff;
    }
  }

  .title {
    font-size: 28px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 8px 0;
  }

  .subtitle {
    font-size: 14px;
    color: #8c8c8c;
    margin: 0;
  }
}

.login-form {
  .form-options {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.login-button {
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
}

.captcha-image {
  height: 40px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover {
    border-color: #40a9ff;
  }
}

.captcha-placeholder {
  font-size: 12px;
  color: #bfbfbf;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
  font-size: 14px;
  color: #8c8c8c;

  p {
    margin: 0;
  }
}
</style>
