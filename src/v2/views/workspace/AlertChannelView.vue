<template>
  <div class="alert-channel">
    <a-card :bordered="false">
      <template #title>
        <h3>通知渠道配置</h3>
      </template>

      <!-- 操作栏 -->
      <div class="action-bar">
        <a-button type="primary" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          新增渠道
        </a-button>
      </div>

      <!-- 表格 -->
      <a-table
        :columns="columns"
        :data-source="channelList"
        :pagination="pagination"
        :loading="loading"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'channelType'">
            <a-tag :color="getChannelTypeColor(record.channelType)">
              {{ getChannelTypeName(record.channelType) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'isDefault'">
            <a-tag v-if="record.isDefault" color="green">默认</a-tag>
            <span v-else>-</span>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="handleEdit(record)">
                编辑
              </a-button>
              <a-button
                v-if="!record.isDefault"
                type="link"
                size="small"
                @click="handleSetDefault(record)"
              >
                设为默认
              </a-button>
              <a-popconfirm
                title="确定删除该渠道吗？"
                ok-text="确定"
                cancel-text="取消"
                @confirm="handleDelete(record.id)"
              >
                <a-button type="link" size="small" danger>
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑渠道' : '新增渠道'"
      :width="600"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      @cancel="handleCancel"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
      >
        <a-form-item label="渠道名称" name="name">
          <a-input v-model:value="formData.name" placeholder="请输入渠道名称" />
        </a-form-item>
        <a-form-item label="渠道类型" name="channelType">
          <a-select
            v-model:value="formData.channelType"
            placeholder="请选择渠道类型"
            @change="handleChannelTypeChange"
          >
            <a-select-option value="webhook">Webhook</a-select-option>
            <a-select-option value="sms">短信</a-select-option>
            <a-select-option value="email">邮件</a-select-option>
          </a-select>
        </a-form-item>

        <!-- Webhook 配置 -->
        <template v-if="formData.channelType === 'webhook'">
          <a-form-item label="Webhook URL" name="webhookUrl">
            <a-input
              v-model:value="webhookConfig.url"
              placeholder="请输入Webhook地址"
            />
          </a-form-item>
          <a-form-item label="请求方法">
            <a-select v-model:value="webhookConfig.method" style="width: 100%">
              <a-select-option value="POST">POST</a-select-option>
              <a-select-option value="GET">GET</a-select-option>
              <a-select-option value="PUT">PUT</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="请求头 (JSON)">
            <a-textarea
              v-model:value="webhookHeadersStr"
              placeholder="请输入请求头（JSON格式）"
              :rows="3"
            />
          </a-form-item>
          <a-form-item label="Secret">
            <a-input
              v-model:value="webhookConfig.secret"
              placeholder="请输入签名密钥（可选）"
            />
          </a-form-item>
        </template>

        <!-- 短信配置 -->
        <template v-if="formData.channelType === 'sms'">
          <a-form-item label="服务商" name="smsProvider">
            <a-select v-model:value="smsConfig.provider" style="width: 100%">
              <a-select-option value="aliyun">阿里云短信</a-select-option>
              <a-select-option value="tencent">腾讯云短信</a-select-option>
              <a-select-option value="custom">自定义</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="Access Key ID">
            <a-input
              v-model:value="smsConfig.accessKeyId"
              placeholder="请输入Access Key ID"
            />
          </a-form-item>
          <a-form-item label="Access Key Secret">
            <a-input-password
              v-model:value="smsConfig.accessKeySecret"
              placeholder="请输入Access Key Secret"
            />
          </a-form-item>
          <a-form-item label="短信签名">
            <a-input
              v-model:value="smsConfig.signName"
              placeholder="请输入短信签名"
            />
          </a-form-item>
          <a-form-item label="模板CODE">
            <a-input
              v-model:value="smsConfig.templateCode"
              placeholder="请输入模板CODE"
            />
          </a-form-item>
        </template>

        <!-- 邮件配置 -->
        <template v-if="formData.channelType === 'email'">
          <a-form-item label="SMTP服务器" name="smtpHost">
            <a-input
              v-model:value="emailConfig.smtpHost"
              placeholder="请输入SMTP服务器地址"
            />
          </a-form-item>
          <a-form-item label="SMTP端口">
            <a-input-number
              v-model:value="emailConfig.smtpPort"
              :min="1"
              :max="65535"
              style="width: 100%"
              placeholder="请输入SMTP端口"
            />
          </a-form-item>
          <a-form-item label="发件人邮箱">
            <a-input
              v-model:value="emailConfig.fromEmail"
              placeholder="请输入发件人邮箱"
            />
          </a-form-item>
          <a-form-item label="发件人名称">
            <a-input
              v-model:value="emailConfig.fromName"
              placeholder="请输入发件人名称"
            />
          </a-form-item>
          <a-form-item label="用户名">
            <a-input
              v-model:value="emailConfig.username"
              placeholder="请输入邮箱用户名"
            />
          </a-form-item>
          <a-form-item label="密码/授权码">
            <a-input-password
              v-model:value="emailConfig.password"
              placeholder="请输入邮箱密码或授权码"
            />
          </a-form-item>
          <a-form-item label="启用SSL">
            <a-switch v-model:checked="emailConfig.useSsl" />
          </a-form-item>
        </template>

        <a-form-item label="设为默认" name="isDefault">
          <a-switch v-model:checked="formData.isDefault" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import {
  PlusOutlined
} from '@ant-design/icons-vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import { alertApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'
import type { AlertChannelConfig } from '../../types/workspace'

const authStore = useAuthStore()

const loading = ref(false)
const submitLoading = ref(false)
const modalVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const channelList = ref<AlertChannelConfig[]>([])

const pagination = reactive<TablePaginationConfig>({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total) => `共 ${total} 条`
})

const formData = reactive<Partial<AlertChannelConfig>>({
  name: '',
  channelType: 'webhook',
  config: {},
  isDefault: false
})

const webhookConfig = reactive({
  url: '',
  method: 'POST',
  headers: {},
  secret: ''
})

const smsConfig = reactive({
  provider: 'aliyun',
  accessKeyId: '',
  accessKeySecret: '',
  signName: '',
  templateCode: ''
})

const emailConfig = reactive({
  smtpHost: '',
  smtpPort: 465,
  fromEmail: '',
  fromName: '',
  username: '',
  password: '',
  useSsl: true
})

const webhookHeadersStr = computed({
  get: () => JSON.stringify(webhookConfig.headers || {}, null, 2),
  set: (val: string) => {
    try {
      webhookConfig.headers = JSON.parse(val)
    } catch (e) {
      // 解析失败时保持原样
    }
  }
})

const formRules = {
  name: [{ required: true, message: '请输入渠道名称', trigger: 'blur' }],
  channelType: [{ required: true, message: '请选择渠道类型', trigger: 'change' }]
}

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '渠道名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '渠道类型', key: 'channelType', dataIndex: 'channelType', width: 120 },
  { title: '是否默认', key: 'isDefault', dataIndex: 'isDefault', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 220 }
]

const channelTypeMap: Record<string, { name: string; color: string }> = {
  webhook: { name: 'Webhook', color: 'blue' },
  sms: { name: '短信', color: 'green' },
  email: { name: '邮件', color: 'purple' }
}

const getChannelTypeName = (type: string) => {
  return channelTypeMap[type]?.name || type
}

const getChannelTypeColor = (type: string) => {
  return channelTypeMap[type]?.color || 'default'
}

const fetchChannels = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      size: pagination.pageSize
    }

    if (authStore.selectedTenantId) {
      params.tenantId = authStore.selectedTenantId
    }

    const result = await alertApi.channels.list(params) as any
    channelList.value = result.records || []
    pagination.total = result.total || 0
  } catch (error: any) {
    message.error(error.message || '获取通知渠道失败')
  } finally {
    loading.value = false
  }
}

const handleTableChange = (pag: TablePaginationConfig) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchChannels()
}

const handleChannelTypeChange = () => {
  // 切换类型时重置配置
  formData.config = {}
}

const handleAdd = () => {
  isEdit.value = false
  Object.assign(formData, {
    name: '',
    channelType: 'webhook',
    config: {},
    isDefault: false
  })
  Object.assign(webhookConfig, {
    url: '',
    method: 'POST',
    headers: {},
    secret: ''
  })
  Object.assign(smsConfig, {
    provider: 'aliyun',
    accessKeyId: '',
    accessKeySecret: '',
    signName: '',
    templateCode: ''
  })
  Object.assign(emailConfig, {
    smtpHost: '',
    smtpPort: 465,
    fromEmail: '',
    fromName: '',
    username: '',
    password: '',
    useSsl: true
  })
  modalVisible.value = true
}

const handleEdit = (record: AlertChannelConfig) => {
  isEdit.value = true
  Object.assign(formData, {
    ...record,
    config: { ...record.config }
  })

  if (record.channelType === 'webhook') {
    Object.assign(webhookConfig, record.config || {})
  } else if (record.channelType === 'sms') {
    Object.assign(smsConfig, record.config || {})
  } else if (record.channelType === 'email') {
    Object.assign(emailConfig, record.config || {})
  }

  modalVisible.value = true
}

const handleCancel = () => {
  modalVisible.value = false
  formRef.value?.resetFields()
}

const buildConfigData = () => {
  if (formData.channelType === 'webhook') {
    return { ...webhookConfig }
  } else if (formData.channelType === 'sms') {
    return { ...smsConfig }
  } else if (formData.channelType === 'email') {
    return { ...emailConfig }
  }
  return {}
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitLoading.value = true

    const data: Partial<AlertChannelConfig> = {
      ...formData,
      config: buildConfigData()
    }

    if (authStore.selectedTenantId) {
      data.tenantId = authStore.selectedTenantId
    }

    if (isEdit.value && formData.id) {
      await alertApi.channels.update(formData.id, data)
      message.success('更新成功')
    } else {
      await alertApi.channels.create(data)
      message.success('创建成功')
    }

    modalVisible.value = false
    fetchChannels()
  } catch (error: any) {
    if (error.errorFields) {
      return
    }
    message.error(error.message || '操作失败')
  } finally {
    submitLoading.value = false
  }
}

const handleDelete = async (id: number) => {
  try {
    await alertApi.channels.delete(id)
    message.success('删除成功')
    fetchChannels()
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}

const handleSetDefault = async (record: AlertChannelConfig) => {
  try {
    await alertApi.channels.update(record.id, { isDefault: true })
    message.success('已设为默认')
    fetchChannels()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    pagination.current = 1
    fetchChannels()
  }
)

onMounted(() => {
  fetchChannels()
})
</script>

<style scoped lang="less">
.alert-channel {
  padding: 24px;

  h3 {
    margin: 0 0 20px;
    font-size: 18px;
    font-weight: 600;
  }

  .action-bar {
    margin-bottom: 16px;
  }
}
</style>
