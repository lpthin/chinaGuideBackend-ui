<template>
  <div class="user-profile-page">
    <a-row :gutter="24">
      <!-- 左侧：用户卡片 -->
      <a-col :span="8">
        <a-card class="user-card">
          <div class="avatar-section">
            <a-avatar
              :size="120"
              :src="avatarUrl"
              :icon="!avatarUrl ? h(UserOutlined) : undefined"
              class="user-avatar"
            />
            <a-upload
              :show-upload-list="false"
              :before-upload="beforeUpload"
              :custom-request="customUpload"
            >
              <a-button type="link" size="small" class="change-avatar-btn">
                <CameraOutlined />
                更换头像
              </a-button>
            </a-upload>
          </div>

          <div class="user-name">{{ profile.nickname || profile.username }}</div>
          <div class="user-role">{{ profile.username }}</div>

          <a-divider />

          <div class="info-list">
            <div class="info-item">
              <MailOutlined class="info-icon" />
              <span class="info-label">邮箱</span>
              <span class="info-value">{{ profile.email || '未设置' }}</span>
            </div>
            <div class="info-item">
              <PhoneOutlined class="info-icon" />
              <span class="info-label">手机</span>
              <span class="info-value">{{ profile.phone || '未绑定' }}</span>
            </div>
            <div class="info-item">
              <TeamOutlined class="info-icon" />
              <span class="info-label">租户ID</span>
              <span class="info-value">{{ profile.tenantId }}</span>
            </div>
            <div class="info-item">
              <ClockCircleOutlined class="info-icon" />
              <span class="info-label">最后登录</span>
              <span class="info-value">{{ formatDateTime(profile.lastLoginAt) }}</span>
            </div>
          </div>
        </a-card>
      </a-col>

      <!-- 右侧：Tab切换 -->
      <a-col :span="16">
        <a-card class="content-card">
          <a-tabs v-model:activeKey="activeTab">
            <!-- 基本信息 -->
            <a-tab-pane key="basic">
              <template #tab>
                <span><IdcardOutlined /> 基本信息</span>
              </template>
              <div class="tab-content">
                <a-form :model="profileForm" layout="vertical" class="profile-form">
                  <a-form-item label="昵称">
                    <a-input v-model:value="profileForm.nickname" placeholder="请输入昵称" allow-clear>
                      <template #prefix><UserOutlined /></template>
                    </a-input>
                  </a-form-item>
                  <a-form-item label="邮箱">
                    <a-input v-model:value="profileForm.email" placeholder="请输入邮箱" allow-clear>
                      <template #prefix><MailOutlined /></template>
                    </a-input>
                  </a-form-item>
                  <a-form-item>
                    <a-button type="primary" @click="saveProfile" :loading="saving">
                      <SaveOutlined />
                      保存修改
                    </a-button>
                  </a-form-item>
                </a-form>
              </div>
            </a-tab-pane>

            <!-- 安全设置 -->
            <a-tab-pane key="security">
              <template #tab>
                <span><SafetyOutlined /> 安全设置</span>
              </template>
              <div class="tab-content">
                <!-- 修改密码 -->
                <div class="section-block">
                  <div class="section-title">
                    <LockOutlined />
                    修改密码
                  </div>
                  <a-form :model="passwordForm" layout="vertical" class="security-form">
                    <a-form-item label="当前密码">
                      <a-input-password v-model:value="passwordForm.oldPassword" placeholder="请输入当前密码" />
                    </a-form-item>
                    <a-form-item label="新密码">
                      <a-input-password v-model:value="passwordForm.newPassword" placeholder="请输入新密码" />
                    </a-form-item>
                    <a-form-item label="确认新密码">
                      <a-input-password v-model:value="passwordForm.confirmPassword" placeholder="请再次输入新密码" />
                    </a-form-item>
                    <a-form-item>
                      <a-button type="primary" @click="changePassword" :loading="changingPassword">
                        修改密码
                      </a-button>
                    </a-form-item>
                  </a-form>
                </div>

                <a-divider />

                <!-- 手机号绑定 -->
                <div class="section-block">
                  <div class="section-title">
                    <MobileOutlined />
                    手机号绑定
                  </div>
                  <a-form :model="phoneForm" layout="vertical" class="security-form">
                    <a-form-item label="手机号">
                      <a-input v-model:value="phoneForm.phone" placeholder="请输入手机号" allow-clear />
                    </a-form-item>
                    <a-form-item label="验证码">
                      <a-space>
                        <a-input v-model:value="phoneForm.code" placeholder="请输入验证码" style="width: 200px" />
                        <a-button @click="sendCode" :disabled="codeSending" :loading="codeSending">
                          {{ codeCountdown > 0 ? codeCountdown + 's' : '获取验证码' }}
                        </a-button>
                      </a-space>
                    </a-form-item>
                    <a-form-item>
                      <a-button type="primary" @click="bindPhone" :loading="bindingPhone">
                        绑定手机号
                      </a-button>
                    </a-form-item>
                  </a-form>
                </div>
              </div>
            </a-tab-pane>

            <!-- 登录日志 -->
            <a-tab-pane key="logs">
              <template #tab>
                <span><HistoryOutlined /> 登录日志</span>
              </template>
              <div class="tab-content">
                <a-table
                  :columns="logColumns"
                  :data-source="loginLogs"
                  :pagination="pagination"
                  :loading="logsLoading"
                  size="middle"
                />
              </div>
            </a-tab-pane>
          </a-tabs>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, h } from 'vue'
import { message } from 'ant-design-vue'
import type { UploadRequestOption } from 'ant-design-vue'
import { profileApi } from '../../api/auth'
import { useAuthStore } from '../../stores/auth'
import {
  UserOutlined,
  CameraOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  IdcardOutlined,
  SafetyOutlined,
  LockOutlined,
  MobileOutlined,
  HistoryOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'

const auth = useAuthStore()

const activeTab = ref('basic')
const saving = ref(false)
const changingPassword = ref(false)
const bindingPhone = ref(false)
const logsLoading = ref(false)

const profile = reactive({
  id: 0,
  username: '',
  nickname: '',
  email: '',
  phone: '',
  avatar: '',
  tenantId: 0,
  lastLoginAt: '',
})

const avatarUrl = computed(() => {
  const av = profile.avatar
  if (!av || av === 'null' || av === 'undefined') return ''
  if (av.startsWith('http')) return av
  // 相对路径，拼接为完整URL
  return av
})

const profileForm = reactive({
  nickname: '',
  email: '',
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const phoneForm = reactive({
  phone: '',
  code: '',
})

const codeSending = ref(false)
const codeCountdown = ref(0)

const loginLogs = ref<any[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const logColumns = [
  { title: '登录时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: 'IP地址', dataIndex: 'loginIp', key: 'loginIp', width: 140 },
  { title: '登录方式', dataIndex: 'loginType', key: 'loginType', width: 120 },
  { title: '设备/浏览器', dataIndex: 'userAgent', key: 'userAgent', ellipsis: true },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    customRender: ({ text }: { text: string }) => {
      const isSuccess = text === 'success' || text === 'SUCCESS'
      return h('span', {
        style: {
          color: isSuccess ? '#52c41a' : '#ff4d4f',
          fontWeight: 500,
        }
      }, isSuccess ? '成功' : '失败')
    }
  },
]

const loadProfile = async () => {
  try {
    const data = await profileApi.getProfile() as any
    Object.assign(profile, data)
    profileForm.nickname = data.nickname || ''
    profileForm.email = data.email || ''
  } catch (error) {
    console.warn('获取个人信息失败:', error)
  }
}

const saveProfile = async () => {
  saving.value = true
  try {
    await profileApi.updateProfile(profileForm)
    message.success('个人信息已更新')
    await loadProfile()
    // 同步更新全局用户信息
    auth.updateUserInfo({
      nickname: profileForm.nickname,
      email: profileForm.email,
    })
  } catch (error: any) {
    message.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const changePassword = async () => {
  if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    message.warning('请填写完整密码信息')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.warning('两次输入的新密码不一致')
    return
  }
  changingPassword.value = true
  try {
    await profileApi.changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword,
    })
    message.success('密码修改成功')
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error: any) {
    message.error(error.message || '密码修改失败')
  } finally {
    changingPassword.value = false
  }
}

const sendCode = () => {
  if (!phoneForm.phone) {
    message.warning('请输入手机号')
    return
  }
  codeSending.value = true
  codeCountdown.value = 60
  message.success('验证码已发送（演示模式：任意验证码均可）')
  const timer = setInterval(() => {
    codeCountdown.value--
    if (codeCountdown.value <= 0) {
      clearInterval(timer)
      codeSending.value = false
    }
  }, 1000)
}

const bindPhone = async () => {
  if (!phoneForm.phone || !phoneForm.code) {
    message.warning('请填写手机号和验证码')
    return
  }
  bindingPhone.value = true
  try {
    await profileApi.bindPhone({ phone: phoneForm.phone, code: phoneForm.code })
    message.success('手机号绑定成功')
    phoneForm.phone = ''
    phoneForm.code = ''
    await loadProfile()
    // 同步更新全局用户信息
    auth.updateUserInfo({ phone: profile.phone })
  } catch (error: any) {
    message.error(error.message || '手机号绑定失败')
  } finally {
    bindingPhone.value = false
  }
}

const loadLoginLogs = async () => {
  logsLoading.value = true
  try {
    const data = await profileApi.getLoginLogs({ page: pagination.current, size: pagination.pageSize }) as any
    loginLogs.value = (data.records || []).map((log: any) => ({
      ...log,
      createTime: formatDateTime(log.createTime)
    }))
    pagination.total = data.total || 0
  } catch (error) {
    console.warn('获取登录日志失败:', error)
  } finally {
    logsLoading.value = false
  }
}

const formatDateTime = (value: string | null) => {
  if (!value || value === 'null' || value === 'undefined') return '-'
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const beforeUpload = (file: File) => {
  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png'
  if (!isJpgOrPng) {
    message.error('只支持 JPG/PNG 格式的图片')
  }
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isLt2M) {
    message.error('图片大小不能超过 2MB')
  }
  return isJpgOrPng && isLt2M
}

const customUpload = async (options: UploadRequestOption) => {
  const file = options.file as File
  try {
    const result = await profileApi.uploadAvatar(file) as any
    const avatarUrl = result?.url || result?.thumbnail
    if (!avatarUrl) {
      throw new Error('上传失败：未获取到头像地址')
    }

    // 更新用户头像
    await profileApi.updateProfile({ avatar: avatarUrl })

    profile.avatar = avatarUrl
    // 同步更新全局用户信息，右上角头像实时刷新
    auth.updateUserInfo({ avatar: avatarUrl })
    message.success('头像上传成功')
    if (typeof options.onSuccess === 'function') {
      options.onSuccess(result)
    }
  } catch (error: any) {
    message.error(error.message || '头像上传失败')
    if (typeof options.onError === 'function') {
      options.onError(error)
    }
  }
}

onMounted(() => {
  loadProfile()
  loadLoginLogs()
})
</script>

<style scoped lang="less">
.user-profile-page {
  padding: 24px;
}

.user-card {
  border-radius: 12px;

  :deep(.ant-card-body) {
    padding: 32px 24px;
  }
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.user-avatar {
  border: 3px solid #f0f0f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  }
}

.change-avatar-btn {
  margin-top: 8px;
  font-size: 13px;
}

.user-name {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.user-role {
  text-align: center;
  font-size: 14px;
  color: #8c8c8c;
  margin-bottom: 16px;
}

.info-list {
  .info-item {
    display: flex;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #f5f5f5;

    &:last-child {
      border-bottom: none;
    }
  }

  .info-icon {
    color: #1890ff;
    font-size: 16px;
    margin-right: 12px;
    width: 20px;
    text-align: center;
  }

  .info-label {
    color: #8c8c8c;
    font-size: 14px;
    width: 70px;
    flex-shrink: 0;
  }

  .info-value {
    color: #1a1a1a;
    font-size: 14px;
    flex: 1;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.content-card {
  border-radius: 12px;

  :deep(.ant-card-body) {
    padding: 0 24px 24px;
  }

  :deep(.ant-tabs-nav) {
    padding-top: 16px;
    margin-bottom: 0;
  }
}

.tab-content {
  padding-top: 24px;
}

.profile-form {
  max-width: 480px;
}

.section-block {
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;

  .anticon {
    color: #1890ff;
  }
}

.security-form {
  max-width: 480px;
}

:deep(.ant-form-item-label > label) {
  font-weight: 500;
  color: #595959;
}
</style>
