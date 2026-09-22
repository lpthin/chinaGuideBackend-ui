<template>
  <div class="alert-rule-manage">
    <a-card :bordered="false">
      <template #title>
        <h3>报警规则管理</h3>
      </template>

      <!-- 统计卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-statistic
            title="规则总数"
            :value="stats.total"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="启用数"
            :value="stats.activeCount"
            :value-style="{ color: '#52c41a' }"
          >
            <template #prefix><CheckCircleOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="高危规则"
            :value="stats.criticalCount"
            :value-style="{ color: '#ff4d4f' }"
          >
            <template #prefix><WarningOutlined /></template>
          </a-statistic>
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="中危规则"
            :value="stats.highCount"
            :value-style="{ color: '#faad14' }"
          >
            <template #prefix><ExclamationCircleOutlined /></template>
          </a-statistic>
        </a-col>
      </a-row>

      <!-- 筛选区 -->
      <a-form layout="inline" :model="filterForm" class="filter-form">
        <a-form-item label="规则名称">
          <a-input
            v-model:value="filterForm.name"
            placeholder="请输入规则名称"
            style="width: 150px"
          />
        </a-form-item>
        <a-form-item label="触发类型">
          <a-select
            v-model:value="filterForm.triggerType"
            placeholder="请选择触发类型"
            style="width: 150px"
            allowClear
          >
            <a-select-option value="api_error">API错误</a-select-option>
            <a-select-option value="exception">异常</a-select-option>
            <a-select-option value="ai_model_unreachable">AI模型不可用</a-select-option>
            <a-select-option value="ai_model_missing">AI模型未配置</a-select-option>
            <a-select-option value="custom">自定义</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="严重级别">
          <a-select
            v-model:value="filterForm.severity"
            placeholder="请选择严重级别"
            style="width: 150px"
            allowClear
          >
            <a-select-option value="low">低</a-select-option>
            <a-select-option value="medium">中</a-select-option>
            <a-select-option value="high">高</a-select-option>
            <a-select-option value="critical">严重</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select
            v-model:value="filterForm.isActive"
            placeholder="请选择状态"
            style="width: 150px"
            allowClear
          >
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="0">禁用</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item class="toolbar-actions">
          <a-space>
            <a-button type="primary" :loading="loading" @click="handleSearch">
              <template #icon><SearchOutlined /></template>
              搜索
            </a-button>
            <a-button @click="handleReset">
              <template #icon><ReloadOutlined /></template>
              重置
            </a-button>
            <a-button type="primary" @click="handleAdd">
              <template #icon><PlusOutlined /></template>
              新增规则
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 表格 -->
      <a-table
        :scroll="{ x: 'max-content' }"
        :columns="columns"
        :data-source="ruleList"
        :pagination="pagination"
        :loading="loading"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'triggerType'">
            {{ getTriggerTypeName(record.triggerType) }}
          </template>
          <template v-if="column.key === 'severity'">
            <a-tag :color="getSeverityColor(record.severity)">
              {{ getSeverityName(record.severity) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'channels'">
            <a-space wrap>
              <a-tag v-for="channel in splitList(record.channels)" :key="channel" color="blue">
                {{ getChannelName(channel) }}
              </a-tag>
            </a-space>
          </template>
          <template v-if="column.key === 'isActive'">
            <a-switch
              :checked="record.isActive === 1"
              :loading="toggleLoading[record.id]"
              @change="(checked: boolean) => handleToggleActive(record, checked)"
            />
          </template>
          <template v-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="handleEdit(record)">
                编辑
              </a-button>
              <a-popconfirm
                title="确定删除该规则吗？"
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
      :title="isEdit ? '编辑规则' : '新增规则'"
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
        <a-form-item label="规则名称" name="name">
          <a-input v-model:value="formData.name" placeholder="请输入规则名称" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="触发类型" name="triggerType">
              <a-select v-model:value="formData.triggerType" placeholder="请选择触发类型">
                <a-select-option value="api_error">API错误</a-select-option>
                <a-select-option value="exception">异常</a-select-option>
                <a-select-option value="ai_model_unreachable">AI模型不可用</a-select-option>
                <a-select-option value="ai_model_missing">AI模型未配置</a-select-option>
                <a-select-option value="custom">自定义</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="严重级别" name="severity">
              <a-select v-model:value="formData.severity" placeholder="请选择严重级别">
                <a-select-option value="low">低</a-select-option>
                <a-select-option value="medium">中</a-select-option>
                <a-select-option value="high">高</a-select-option>
                <a-select-option value="critical">严重</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="通知渠道" name="channels">
          <a-select
            v-model:value="formData.channels"
            mode="multiple"
            placeholder="请选择通知渠道"
          >
            <a-select-option value="in_app">站内信</a-select-option>
            <a-select-option value="webhook">Webhook</a-select-option>
            <a-select-option value="sms">短信</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="接收人" name="receivers">
          <a-select
            v-model:value="formData.receivers"
            mode="tags"
            placeholder="请输入接收人，按回车确认"
            :token-separators="[',']"
          />
        </a-form-item>
        <a-form-item label="触发条件" name="triggerCondition">
          <a-textarea
            v-model:value="triggerConditionStr"
            placeholder="请输入触发条件（JSON格式）"
            :rows="4"
          />
        </a-form-item>
        <a-form-item label="启用状态" name="isActive">
          <a-switch v-model:checked="formData.isActive" />
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
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import { alertApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'
import type { AlertRule, AlertRuleForm } from '../../types/workspace'
import { formatDateTime } from '../../utils/format'

const authStore = useAuthStore()

const loading = ref(false)
const submitLoading = ref(false)
const modalVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const ruleList = ref<AlertRule[]>([])
const toggleLoading = reactive<Record<number, boolean>>({})

const filterForm = reactive({
  name: '',
  triggerType: undefined as string | undefined,
  severity: undefined as string | undefined,
  isActive: undefined as number | undefined
})

const stats = reactive({
  total: 0,
  activeCount: 0,
  criticalCount: 0,
  highCount: 0
})

const pagination = reactive<TablePaginationConfig>({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total) => `共 ${total} 条`
})

const formData = reactive<AlertRuleForm>({
  name: '',
  triggerType: 'api_error',
  severity: 'medium',
  channels: [],
  receivers: [],
  triggerCondition: {},
  isActive: true
})

const triggerConditionStr = computed({
  get: () => JSON.stringify(formData.triggerCondition || {}, null, 2),
  set: (val: string) => {
    try {
      formData.triggerCondition = JSON.parse(val)
    } catch (e) {
      // 解析失败时保持原样
    }
  }
})

const formRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  triggerType: [{ required: true, message: '请选择触发类型', trigger: 'change' }],
  severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }],
  channels: [{ required: true, message: '请选择通知渠道', trigger: 'change' }]
}

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '规则名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '触发类型', key: 'triggerType', dataIndex: 'triggerType', width: 120 },
  { title: '严重级别', key: 'severity', dataIndex: 'severity', width: 100 },
  { title: '通知渠道', key: 'channels', dataIndex: 'channels', width: 200 },
  { title: '状态', key: 'isActive', dataIndex: 'isActive', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 150 }
]

const triggerTypeMap: Record<string, string> = {
  api_error: 'API错误',
  exception: '异常',
  ai_model_unreachable: 'AI模型不可用',
  ai_model_missing: 'AI模型未配置',
  custom: '自定义'
}

const severityMap: Record<string, { name: string; color: string }> = {
  low: { name: '低', color: 'green' },
  medium: { name: '中', color: 'blue' },
  high: { name: '高', color: 'orange' },
  critical: { name: '严重', color: 'red' }
}

const channelMap: Record<string, string> = {
  in_app: '站内信',
  webhook: 'Webhook',
  sms: '短信',
  email: '邮件'
}

const getTriggerTypeName = (type: string) => {
  return triggerTypeMap[type] || type
}

const getSeverityName = (severity: string) => {
  return severityMap[severity]?.name || severity
}

const getSeverityColor = (severity: string) => {
  return severityMap[severity]?.color || 'default'
}

const getChannelName = (channel: string) => {
  return channelMap[channel] || channel
}

const splitList = (value?: string | null) => {
  return (value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

const parseCondition = (value?: string | null): Record<string, any> => {
  if (!value) {
    return {}
  }
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : { value: parsed }
  } catch (e) {
    return {}
  }
}

const toRulePayload = (form: AlertRuleForm): Partial<AlertRule> => {
  return {
    name: form.name,
    triggerType: form.triggerType,
    severity: form.severity,
    channels: form.channels.join(','),
    receivers: form.receivers.join(','),
    triggerCondition: JSON.stringify(form.triggerCondition || {}),
    isActive: form.isActive ? 1 : 0
  }
}

const fetchRules = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.current,
      size: pagination.pageSize
    }

    if (authStore.selectedTenantId) {
      params.tenantId = authStore.selectedTenantId
    }

    if (filterForm.name) {
      params.name = filterForm.name
    }
    if (filterForm.triggerType) {
      params.triggerType = filterForm.triggerType
    }
    if (filterForm.severity) {
      params.severity = filterForm.severity
    }
    if (filterForm.isActive !== undefined) {
      params.isActive = filterForm.isActive
    }

    const result = await alertApi.rules.list(params) as any
    ruleList.value = result.records || []
    pagination.total = result.total || 0
    calculateStats(result.records || [])
  } catch (error: any) {
    message.error(error.message || '获取报警规则失败')
  } finally {
    loading.value = false
  }
}

const calculateStats = (records: AlertRule[]) => {
  stats.total = records.length
  stats.activeCount = records.filter(r => r.isActive === 1).length
  stats.criticalCount = records.filter(r => r.severity === 'critical').length
  stats.highCount = records.filter(r => r.severity === 'high').length
}

const handleSearch = () => {
  pagination.current = 1
  fetchRules()
}

const handleReset = () => {
  filterForm.name = ''
  filterForm.triggerType = undefined
  filterForm.severity = undefined
  filterForm.isActive = undefined
  pagination.current = 1
  fetchRules()
}

const handleTableChange = (pag: TablePaginationConfig) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchRules()
}

const handleAdd = () => {
  isEdit.value = false
  Object.assign(formData, {
    id: undefined,
    tenantId: undefined,
    name: '',
    triggerType: 'api_error',
    severity: 'medium',
    channels: [],
    receivers: [],
    triggerCondition: {},
    isActive: true
  })
  modalVisible.value = true
}

const handleEdit = (record: AlertRule) => {
  isEdit.value = true
  Object.assign(formData, {
    id: record.id,
    tenantId: record.tenantId,
    name: record.name,
    triggerType: record.triggerType,
    severity: record.severity,
    channels: splitList(record.channels),
    receivers: splitList(record.receivers),
    triggerCondition: parseCondition(record.triggerCondition),
    isActive: record.isActive === 1
  })
  modalVisible.value = true
}

const handleCancel = () => {
  modalVisible.value = false
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitLoading.value = true

    const data = toRulePayload(formData)

    if (isEdit.value && formData.id) {
      await alertApi.rules.update(formData.id, data)
      message.success('更新成功')
    } else {
      await alertApi.rules.create(data)
      message.success('创建成功')
    }

    modalVisible.value = false
    fetchRules()
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
    await alertApi.rules.delete(id)
    message.success('删除成功')
    fetchRules()
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}

const handleToggleActive = async (record: AlertRule, checked: boolean) => {
  toggleLoading[record.id] = true
  try {
    await alertApi.rules.update(record.id, { isActive: checked ? 1 : 0 })
    message.success(checked ? '已启用' : '已禁用')
    record.isActive = checked ? 1 : 0
  } catch (error: any) {
    message.error(error.message || '操作失败')
  } finally {
    toggleLoading[record.id] = false
  }
}

watch(
  () => authStore.selectedTenantId,
  () => {
    pagination.current = 1
    fetchRules()
  }
)

onMounted(() => {
  fetchRules()
})
</script>

<style scoped lang="less">
.alert-rule-manage {

  h3 {
    margin: 0 0 20px;
    font-size: 18px;
    font-weight: 600;
  }

  .filter-form {
    margin-bottom: 24px;
    padding: 16px;
    background: #fafafa;
    border-radius: 8px;
  }
}

:deep(.ant-statistic-content) {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
