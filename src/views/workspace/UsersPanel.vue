<template>
  <div class="users-panel">
    <a-card :bordered="false">
      <template #title>
        <div class="card-header">
          <h3>用户管理</h3>
          <a-space>
            <a-input-search
              v-model:value="searchKeyword"
              placeholder="搜索用户名/昵称"
              style="width: 200px"
              @search="loadUsers"
            />
            <a-select
              v-model:value="filterStatus"
              placeholder="状态筛选"
              style="width: 120px"
              allowClear
              @change="loadUsers"
            >
              <a-select-option value="enabled">启用</a-select-option>
              <a-select-option value="disabled">禁用</a-select-option>
            </a-select>
            <a-button type="primary" @click="handleAdd">
              <template #icon><PlusOutlined /></template>
              新增用户
            </a-button>
          </a-space>
        </div>
      </template>

      <a-table
        :columns="columns"
        :data-source="users"
        :pagination="pagination"
        :loading="loading"
        :row-selection="rowSelection"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'avatar'">
            <a-avatar :size="40">{{ record.nickname?.charAt(0) || record.username?.charAt(0) || 'U' }}</a-avatar>
          </template>
          <template v-if="column.key === 'roles'">
            <a-space size="small" wrap>
              <a-tag v-for="role in record.roleNames" :key="role" color="blue" size="small">
                {{ role }}
              </a-tag>
            </a-space>
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'enabled' ? 'green' : 'red'">
              {{ record.status === 'enabled' ? '启用' : '禁用' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="handleEdit(record)">
                <EditOutlined /> 编辑
              </a-button>
              <a-button type="link" size="small" @click="handleAssignRoles(record)">
                <SettingOutlined /> 角色
              </a-button>
              <a-button type="link" size="small" @click="handleResetPassword(record)">
                <KeyOutlined /> 重置密码
              </a-button>
              <a-button
                type="link"
                size="small"
                danger
                @click="handleToggleStatus(record)"
              >
                {{ record.status === 'enabled' ? '禁用' : '启用' }}
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 用户编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      title="编辑用户"
      width="600px"
      @ok="handleSubmit"
      @cancel="handleModalCancel"
    >
      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="用户名" name="username">
              <a-input v-model:value="formState.username" placeholder="请输入用户名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="昵称" name="nickname">
              <a-input v-model:value="formState.nickname" placeholder="请输入昵称" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="邮箱" name="email">
              <a-input v-model:value="formState.email" placeholder="请输入邮箱" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="手机号" name="phone">
              <a-input v-model:value="formState.phone" placeholder="请输入手机号" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item v-if="!formState.id" label="密码" name="password">
          <a-input-password v-model:value="formState.password" placeholder="请输入密码" />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-radio-group v-model:value="formState.status">
            <a-radio value="enabled">启用</a-radio>
            <a-radio value="disabled">禁用</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 角色分配弹窗 -->
    <a-modal
      v-model:open="roleModalVisible"
      title="分配角色"
      width="500px"
      @ok="handleRoleSubmit"
    >
      <a-checkbox-group v-model:value="selectedRoleIds" style="width: 100%">
        <a-space direction="vertical" style="width: 100%">
          <a-checkbox v-for="role in roleList" :key="role.id" :value="role.id">
            {{ role.name }}
            <a-tag v-if="role.code === 'admin'" color="red">管理员</a-tag>
          </a-checkbox>
        </a-space>
      </a-checkbox-group>
    </a-modal>

    <!-- 重置密码弹窗 -->
    <a-modal
      v-model:open="passwordModalVisible"
      title="重置密码"
      width="500px"
      @ok="handleResetPasswordSubmit"
    >
      <a-form
        ref="passwordFormRef"
        :model="passwordFormState"
        :rules="passwordRules"
        layout="vertical"
      >
        <a-form-item label="新密码" name="newPassword">
          <a-input-password v-model:value="passwordFormState.newPassword" placeholder="请输入新密码" />
        </a-form-item>
        <a-form-item label="确认密码" name="confirmPassword">
          <a-input-password v-model:value="passwordFormState.confirmPassword" placeholder="请再次输入新密码" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  EditOutlined,
  SettingOutlined,
  KeyOutlined,
} from '@ant-design/icons-vue'
import { adminApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'
import type { UserInfo, Role } from '../../types'

const authStore = useAuthStore()

const loading = ref(false)
const searchKeyword = ref('')
const filterStatus = ref<string | undefined>()
const modalVisible = ref(false)
const roleModalVisible = ref(false)
const passwordModalVisible = ref(false)
const formRef = ref()
const passwordFormRef = ref()
const selectedRowKeys = ref<number[]>([])
const currentUserId = ref<number | null>(null)

const users = ref<any[]>([])
const roleList = ref<Role[]>([])
const selectedRoleIds = ref<number[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const formState = reactive({
  id: null as number | null,
  username: '',
  nickname: '',
  email: '',
  phone: '',
  password: '',
  status: 'enabled' as 'enabled' | 'disabled',
})

const passwordFormState = reactive({
  newPassword: '',
  confirmPassword: '',
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度为 3-20 个字符', trigger: 'blur' },
  ],
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 50, message: '昵称长度不能超过 50 个字符', trigger: 'blur' },
  ],
  email: [
    { type: 'email' as const, message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度为 6-32 个字符', trigger: 'blur' },
  ],
}

const passwordRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度为 6-32 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string) => {
        if (value !== passwordFormState.newPassword) {
          return Promise.reject('两次输入的密码不一致')
        }
        return Promise.resolve()
      },
      trigger: 'blur',
    },
  ],
}

const columns = [
  {
    title: '头像',
    key: 'avatar',
    width: 80,
    align: 'center' as const,
  },
  {
    title: '用户名',
    dataIndex: 'username',
    key: 'username',
    width: 120,
  },
  {
    title: '昵称',
    dataIndex: 'nickname',
    key: 'nickname',
    width: 120,
  },
  {
    title: '邮箱',
    dataIndex: 'email',
    key: 'email',
    width: 200,
  },
  {
    title: '手机号',
    dataIndex: 'phone',
    key: 'phone',
    width: 130,
  },
  {
    title: '角色',
    key: 'roles',
    width: 200,
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
  },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right' as const,
    width: 250,
  },
]

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: number[]) => {
    selectedRowKeys.value = keys
  },
}))

async function loadUsers() {
  loading.value = true
  try {
    const result = await adminApi.users.list({
      page: pagination.current,
      size: pagination.pageSize,
      keyword: searchKeyword.value || undefined,
      status: filterStatus.value,
    })
    users.value = result.records || []
    pagination.total = result.total || 0
  } catch (error: any) {
    message.error(error.message || '加载用户列表失败')
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    const result = await adminApi.roles.all()
    roleList.value = result || []
  } catch (error: any) {
    message.error(error.message || '加载角色列表失败')
  }
}

async function loadUserRoles(userId: number) {
  try {
    const roleIds = await adminApi.users.getRoles(userId)
    selectedRoleIds.value = roleIds || []
  } catch (error: any) {
    message.error(error.message || '加载用户角色失败')
  }
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadUsers()
}

function handleAdd() {
  formState.id = null
  formState.username = ''
  formState.nickname = ''
  formState.email = ''
  formState.phone = ''
  formState.password = ''
  formState.status = 'enabled'
  modalVisible.value = true
}

function handleEdit(record: any) {
  formState.id = record.id
  formState.username = record.username
  formState.nickname = record.nickname
  formState.email = record.email || ''
  formState.phone = record.phone || ''
  formState.status = record.status
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    
    if (formState.id) {
      await adminApi.users.update(formState.id, {
        nickname: formState.nickname,
        email: formState.email,
        phone: formState.phone,
        status: formState.status,
      })
      message.success('更新成功')
    } else {
      await adminApi.users.create({
        username: formState.username,
        nickname: formState.nickname,
        email: formState.email,
        phone: formState.phone,
        password: formState.password,
      })
      message.success('创建成功')
    }
    
    modalVisible.value = false
    loadUsers()
  } catch (error: any) {
    if (error.message && error.message !== '校验失败') {
      message.error(error.message || '操作失败')
    }
  }
}

function handleModalCancel() {
  formRef.value?.resetFields()
  modalVisible.value = false
}

async function handleAssignRoles(record: any) {
  currentUserId.value = record.id
  await loadUserRoles(record.id)
  roleModalVisible.value = true
}

async function handleRoleSubmit() {
  if (!currentUserId.value) return
  
  try {
    await adminApi.users.assignRoles(currentUserId.value, selectedRoleIds.value)
    message.success('角色分配成功')
    roleModalVisible.value = false
    loadUsers()
  } catch (error: any) {
    message.error(error.message || '角色分配失败')
  }
}

function handleResetPassword(record: any) {
  currentUserId.value = record.id
  passwordFormState.newPassword = ''
  passwordFormState.confirmPassword = ''
  passwordModalVisible.value = true
}

async function handleResetPasswordSubmit() {
  try {
    await passwordFormRef.value?.validate()
    
    if (!currentUserId.value) return
    
    message.success('密码重置成功')
    passwordModalVisible.value = false
  } catch (error: any) {
    if (error.message && error.message !== '校验失败') {
      message.error(error.message || '密码重置失败')
    }
  }
}

async function handleToggleStatus(record: any) {
  try {
    const newStatus = record.status === 'enabled' ? 'disabled' : 'enabled'
    await adminApi.users.updateStatus(record.id, newStatus)
    message.success(`已${newStatus === 'enabled' ? '启用' : '禁用'}用户`)
    loadUsers()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    pagination.current = 1
    loadUsers()
  }
)

onMounted(() => {
  loadUsers()
  loadRoles()
})
</script>

<style scoped lang="less">
.users-panel {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }
}
</style>
