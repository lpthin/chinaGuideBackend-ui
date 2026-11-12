<template>
  <div class="platform-accounts-panel">
    <PageTitle />
    <!-- 口径说明不摆在首屏（SPEC-UI-11 R-9）：首访由机器人说一句，全文在页头问号里，正文只在 copy/robot.ts 一份 -->
    <a-card :bordered="false">

      <filter-bar>
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索用户名/昵称"
          style="width: 200px"
          @search="loadAccounts"
        />
        <a-select
          v-model:value="filterStatus"
          placeholder="状态筛选"
          style="width: 120px"
          allowClear
          @change="loadAccounts"
        >
          <a-select-option value="enabled">启用</a-select-option>
          <a-select-option value="disabled">停用</a-select-option>
        </a-select>
        <template #actions>
          <a-space>
            <a-button type="primary" @click="handleAdd">
              <template #icon><PlusOutlined /></template>
              新增平台账号
            </a-button>
          </a-space>
        </template>
      </filter-bar>

      <DataTable
        :scroll="{ x: 'max-content' }"
        :columns="columns"
        :data-source="accounts"
        :pagination="pagination"
        :loading="loading"
        row-key="id"
        @change="handleTableChange"
      >
        <!-- 空态那一句只认后端（M-P70）：后端把「真的没有」与成因一起算好带回来 -->
        <template #emptyText>
          <empty-list-hint
            :loading="loading"
            :read-failed="readFailed"
            :retry="loadAccounts"
            :empty-line="emptyLine"
            :empty-reason="emptyReason"
            can-create
            create-label="新增平台账号"
            @create="handleAdd"
          />
        </template>
        <template #bodyCell="{ column, record }">
          <!-- 平台账号没有客户归属：这一格恒念「平台」，不拿裸号自己猜（FR-P4-1） -->
          <template v-if="column.key === 'tenant'">
            <a-tag color="purple">平台</a-tag>
          </template>
          <template v-if="column.key === 'roles'">
            <a-space size="small" wrap>
              <a-tag v-for="role in record.roleNames" :key="role" color="blue" size="small">
                {{ role }}
              </a-tag>
            </a-space>
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="statusMeta(record.status).color">
              {{ statusMeta(record.status).label }}
            </a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-tooltip :title="isSelf(record) ? '这是你自己的账号，请去个人中心带当前密码修改' : ''">
                <a-button
                  type="link"
                  size="small"
                  :disabled="isSelf(record)"
                  @click="handleResetPassword(record)"
                >
                  <KeyOutlined /> 重置密码
                </a-button>
              </a-tooltip>
              <a-button
                type="link"
                size="small"
                danger
                :disabled="isBootstrapAdmin(record) || isSelf(record)"
                @click="handleToggleStatus(record)"
              >
                {{ record.status === 'enabled' ? '停用' : '启用' }}
              </a-button>
            </a-space>
          </template>
        </template>
      </DataTable>
    </a-card>

    <!-- 创建平台账号弹窗：不问客户归属（身份就是平台），角色固定 SUPER_ADMIN -->
    <a-modal
      v-model:open="modalVisible"
      title="新增平台账号"
      width="520px"
      @ok="handleCreate"
      @cancel="handleModalCancel"
    >
      <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="用户名" name="username">
              <a-input v-model:value="formState.username" placeholder="登录名全站唯一，不分客户" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="昵称" name="nickname">
              <a-input v-model:value="formState.nickname" placeholder="请输入昵称" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="初始密码" name="password">
          <a-input-password v-model:value="formState.password" placeholder="6-32 个字符" />
        </a-form-item>
        <a-form-item label="角色">
          <a-tag color="blue">超级管理员</a-tag>
          <span class="role-note">第一版平台角色仅此一种；运营/客服两个码已预留，暂不开口</span>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 重置密码弹窗：与用户管理那条同一套纪律（不给自己用、不看当前密码） -->
    <a-modal
      v-model:open="pwdModalVisible"
      :title="`重置密码：${pwdForm.displayName}`"
      width="520px"
      :confirm-loading="pwdSubmitting"
      ok-text="确认重置"
      @ok="handlePwdSubmit"
      @cancel="handlePwdCancel"
    >
      <a-alert type="warning" show-icon>
        <template #message>这一步不看对方的当前密码，重置完请当面把新密码交给本人。</template>
        <template #description>
          重置不会把对方已经登录的会话踢下线——登录令牌是无状态的，对方要用新密码登录得等他这一次会话自己过期或主动退出。
        </template>
      </a-alert>
      <a-form
        ref="pwdFormRef"
        :model="pwdForm"
        :rules="pwdRules"
        layout="vertical"
        style="margin-top: 16px"
      >
        <a-form-item label="新密码" name="newPassword">
          <a-input-password
            v-model:value="pwdForm.newPassword"
            placeholder="6-32 个字符"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="确认新密码" name="confirmPassword">
          <a-input-password
            v-model:value="pwdForm.confirmPassword"
            placeholder="再输入一遍"
            autocomplete="new-password"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, KeyOutlined } from '@ant-design/icons-vue'
import FilterBar from '../../components/FilterBar.vue'
import DataTable from '../../components/DataTable.vue'
import EmptyListHint from '../../components/EmptyListHint.vue'
import { adminApi } from '../../api/workspace'
import { ROBOT_PAGE_CARDS } from '../../copy/robot'
import { useRobotNotices } from '../../composables/useRobotNotices'
import { describeHttpError } from '../../api/http'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import {
  JUMP_BACK_NOTICE,
  asEmptyReason,
  shouldJumpBackToFirstPage,
  type EmptyReason,
} from '../../utils/emptyPage'
import PageTitle from '../../components/PageTitle.vue'

const authStore = useAuthStore()
// 页首常驻说明已搬进机器人（SPEC-UI-11 R-9）：首访说一句，全文在页头问号
const robot = useRobotNotices()

const loading = ref(false)
const searchKeyword = ref('')
const filterStatus = ref<string | undefined>()
const modalVisible = ref(false)
const formRef = ref()

const accounts = ref<any[]>([])
const emptyLine = ref('')
const emptyReason = ref<EmptyReason>(null)
const readFailed = ref('')

const pwdModalVisible = ref(false)
const pwdSubmitting = ref(false)
const pwdFormRef = ref()
const pwdForm = reactive({
  id: null as number | null,
  displayName: '',
  newPassword: '',
  confirmPassword: '',
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const formState = reactive({
  username: '',
  nickname: '',
  password: '',
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度为 3-20 个字符', trigger: 'blur' },
  ],
  nickname: [
    { max: 50, message: '昵称长度不能超过 50 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度为 6-32 个字符', trigger: 'blur' },
  ],
}

const pwdRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 32, message: '新密码长度为 6-32 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再输入一遍新密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string) =>
        !value || value === pwdForm.newPassword
          ? Promise.resolve()
          : Promise.reject(new Error('两次输入的新密码不一致')),
      trigger: 'blur',
    },
  ],
}

const USER_STATUS: Record<string, { label: string; color: string }> = {
  enabled: { label: '启用', color: 'green' },
  disabled: { label: '停用', color: 'red' },
}

function statusMeta(status?: string) {
  const meta = status ? USER_STATUS[status] : undefined
  return meta || { label: status || '-', color: 'default' }
}

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 140 },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 140 },
  // 平台账号恒无客户归属：这一格不是数据列，是身份标注（FR-P4-1）
  { title: '归属', key: 'tenant', width: 100 },
  { title: '角色', key: 'roles', width: 160 },
  { title: '状态', key: 'status', width: 90 },
  { title: '最近登录', dataIndex: 'lastLoginAt', key: 'lastLoginAt', width: 170,
    customRender: ({ text }: { text: string }) => (text ? formatDateTime(text) : '从未登录') },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 220 },
]

async function loadAccounts() {
  loading.value = true
  emptyLine.value = ''
  emptyReason.value = null
  readFailed.value = ''
  try {
    const result = await adminApi.platformAccounts.list({
      page: pagination.current,
      size: pagination.pageSize,
      keyword: searchKeyword.value || undefined,
      status: filterStatus.value,
    })
    accounts.value = result.records || []
    pagination.total = result.total || 0
    emptyLine.value = (result as any)?.emptyLine || ''
    emptyReason.value = asEmptyReason((result as any)?.emptyReason)
    if (shouldJumpBackToFirstPage(emptyReason.value, pagination.current)) {
      pagination.current = 1
      await loadAccounts()
      message.info(JUMP_BACK_NOTICE)
    }
  } catch (error) {
    readFailed.value = describeHttpError(error)
  } finally {
    loading.value = false
  }
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadAccounts()
}

function handleAdd() {
  formState.username = ''
  formState.nickname = ''
  formState.password = ''
  modalVisible.value = true
}

async function handleCreate() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  try {
    await adminApi.platformAccounts.create({
      username: formState.username,
      nickname: formState.nickname,
      password: formState.password,
    })
    message.success('平台账号创建成功，交付后请引导对方改密')
    modalVisible.value = false
    loadAccounts()
  } catch (error) {
    message.error(`创建失败：${describeHttpError(error)}`)
  }
}

function handleModalCancel() {
  formRef.value?.resetFields()
  modalVisible.value = false
}

// 引导账号 admin（id=1）是平台唯一的保底入口，按钮直接置灰；自己的账号同理
function isBootstrapAdmin(record: any) {
  return record?.id === 1
}

function isSelf(record: any) {
  return record?.id != null && record.id === authStore.user?.id
}

async function handleToggleStatus(record: any) {
  try {
    const newStatus = record.status === 'enabled' ? 'disabled' : 'enabled'
    await adminApi.platformAccounts.updateStatus(record.id, newStatus)
    message.success(`已${newStatus === 'enabled' ? '启用' : '停用'}平台账号`)
    loadAccounts()
  } catch (error) {
    message.error(`操作失败：${describeHttpError(error)}`)
  }
}

function handleResetPassword(record: any) {
  pwdForm.id = record.id
  pwdForm.displayName = record.nickname || record.username
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
  pwdModalVisible.value = true
}

function handlePwdCancel() {
  pwdFormRef.value?.clearValidate()
  pwdModalVisible.value = false
}

async function handlePwdSubmit() {
  if (!pwdForm.id) return
  try {
    await pwdFormRef.value?.validate()
  } catch {
    return
  }
  pwdSubmitting.value = true
  try {
    await adminApi.platformAccounts.resetPassword(pwdForm.id, pwdForm.newPassword)
    message.success(`已重置「${pwdForm.displayName}」的密码，请当面把新密码交给本人`)
    pwdModalVisible.value = false
  } catch (error) {
    message.error(`重置密码失败：${describeHttpError(error)}`)
  } finally {
    pwdSubmitting.value = false
  }
}

onMounted(() => {
  const card = ROBOT_PAGE_CARDS['platform.accounts.intro']
  robot.announce(
    { key: 'platform.accounts.intro', category: 'scope', text: card.text, detail: card.detail, once: 'session' },
    { ready: true }
  )
  loadAccounts()
})
</script>

<style scoped>
.role-note {
  margin-left: 8px;
  color: var(--text-tertiary, #999);
  font-size: 12px;
}
</style>
