<template>
  <div class="user-profile-page">
    <a-row :gutter="24">
      <!-- 左侧：基本信息卡片 -->
      <a-col :span="8">
        <a-card>
          <div class="avatar-section">
            <a-avatar :size="100" :src="profile.avatar || defaultAvatar" />
            <a-upload
              name="avatar"
              :show-upload-list="false"
              :before-upload="beforeUpload"
              @change="handleAvatarChange"
            >
              <a-button type="link">更换头像</a-button>
            </a-upload>
          </div>
          <div class="profile-info">
            <h3>{{ profile.nickname || profile.username }}</h3>
            <p>{{ profile.email || '未设置邮箱' }}</p>
            <p>{{ profile.phone || '未绑定手机号' }}</p>
            <p>租户ID: {{ profile.tenantId }}</p>
            <p>最后登录: {{ profile.lastLoginAt }}</p>
          </div>
        </a-card>
      </a-col>

      <!-- 右侧：Tab切换 -->
      <a-col :span="16">
        <a-card>
          <a-tabs v-model:activeKey="activeTab">
            <a-tab-pane key="basic" tab="基本信息">
              <a-form :model="profileForm" layout="vertical">
                <a-form-item label="昵称">
                  <a-input v-model:value="profileForm.nickname" />
                </a-form-item>
                <a-form-item label="邮箱">
                  <a-input v-model:value="profileForm.email" />
                </a-form-item>
                <a-form-item>
                  <a-button type="primary" @click="saveProfile">保存修改</a-button>
                </a-form-item>
              </a-form>
            </a-tab-pane>

            <a-tab-pane key="security" tab="安全设置">
              <a-divider orientation="left">修改密码</a-divider>
              <a-form :model="passwordForm" layout="vertical">
                <a-form-item label="当前密码">
                  <a-input-password v-model:value="passwordForm.oldPassword" />
                </a-form-item>
                <a-form-item label="新密码">
                  <a-input-password v-model:value="passwordForm.newPassword" />
                </a-form-item>
                <a-form-item label="确认新密码">
                  <a-input-password v-model:value="passwordForm.confirmPassword" />
                </a-form-item>
                <a-form-item>
                  <a-button type="primary" @click="changePassword">修改密码</a-button>
                </a-form-item>
              </a-form>

              <a-divider orientation="left">手机号绑定</a-divider>
              <a-form :model="phoneForm" layout="vertical">
                <a-form-item label="手机号">
                  <a-input v-model:value="phoneForm.phone" placeholder="请输入手机号" />
                </a-form-item>
                <a-form-item label="验证码">
                  <a-space>
                    <a-input v-model:value="phoneForm.code" placeholder="请输入验证码" style="width: 150px" />
                    <a-button @click="sendCode" :disabled="codeSending">
                      {{ codeCountdown > 0 ? codeCountdown + 's' : '获取验证码' }}
                    </a-button>
                  </a-space>
                </a-form-item>
                <a-form-item>
                  <a-button type="primary" @click="bindPhone">绑定手机号</a-button>
                </a-form-item>
              </a-form>
            </a-tab-pane>

            <a-tab-pane key="logs" tab="登录日志">
              <a-table :columns="logColumns" :data-source="loginLogs" :pagination="pagination" />
            </a-tab-pane>
          </a-tabs>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import type { UploadChangeParam } from 'ant-design-vue'
import { profileApi } from '../../api/auth'

const defaultAvatar = 'https://joeschmoe.io/api/v1/random'
const activeTab = ref('basic')

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
  { title: '登录时间', dataIndex: 'loginTime', key: 'loginTime', width: 180 },
  { title: 'IP地址', dataIndex: 'ip', key: 'ip', width: 140 },
  { title: '登录方式', dataIndex: 'method', key: 'method', width: 120 },
  { title: '设备/浏览器', dataIndex: 'userAgent', key: 'userAgent' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
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
  try {
    await profileApi.updateProfile(profileForm)
    message.success('个人信息已更新')
    await loadProfile()
  } catch (error) {
    message.error('保存失败')
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
  } catch (error) {
    message.error('密码修改失败')
  }
}

const sendCode = () => {
  if (!phoneForm.phone) {
    message.warning('请输入手机号')
    return
  }
  codeSending.value = true
  codeCountdown.value = 60
  message.success('验证码已发送')
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
  try {
    await profileApi.bindPhone({ phone: phoneForm.phone, code: phoneForm.code })
    message.success('手机号绑定成功')
    phoneForm.phone = ''
    phoneForm.code = ''
    await loadProfile()
  } catch (error) {
    message.error('手机号绑定失败')
  }
}

const loadLoginLogs = async () => {
  try {
    const data = await profileApi.getLoginLogs({ page: pagination.current, size: pagination.pageSize }) as any
    loginLogs.value = data.records || []
    pagination.total = data.total || 0
  } catch (error) {
    console.warn('获取登录日志失败:', error)
  }
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

const handleAvatarChange = (info: UploadChangeParam) => {
  if (info.file.status === 'done') {
    message.success('头像上传成功')
    if (info.file.response?.data?.url) {
      profile.avatar = info.file.response.data.url
    }
  } else if (info.file.status === 'error') {
    message.error('头像上传失败')
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

.avatar-section {
  text-align: center;
  margin-bottom: 24px;

  .ant-avatar {
    margin-bottom: 12px;
  }
}

.profile-info {
  text-align: center;

  h3 {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
  }

  p {
    margin: 0 0 8px;
    color: #595959;
    font-size: 14px;
  }
}
</style>
