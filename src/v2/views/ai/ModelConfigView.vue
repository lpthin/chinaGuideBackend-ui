<template>
  <div class="model-config-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <AppstoreOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalConfigs }}</div>
                <div class="stat-title">配置总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.activeConfigs }}</div>
                <div class="stat-title">已启用</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <ApiOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalProviders }}</div>
                <div class="stat-title">提供商</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #faad14 0%, #ffd591 100%)">
                <BlockOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalModels }}</div>
                <div class="stat-title">可用模型</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <a-space>
            <a-select
              v-model:value="filterProvider"
              style="width: 160px"
              placeholder="按提供商筛选"
              allowClear
            >
              <a-select-option v-for="provider in providers" :key="provider.id" :value="provider.id">
                <span class="provider-option">
                  <component :is="provider.icon" style="margin-right: 8px" />
                  {{ provider.name }}
                </span>
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="filterType"
              style="width: 140px"
              placeholder="按模型类型筛选"
              allowClear
            >
              <a-select-option value="chat">聊天模型</a-select-option>
              <a-select-option value="embedding">向量化模型</a-select-option>
              <a-select-option value="image">图像模型</a-select-option>
              <a-select-option value="audio">语音模型</a-select-option>
            </a-select>
            <a-button type="primary" @click="showAddModal = true">
              <template #icon><PlusOutlined /></template>
              添加配置
            </a-button>
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="filteredConfigs"
          :pagination="false"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'provider'">
              <a-tag :color="getProviderColor(record.provider)">
                <component :is="getProviderIcon(record.provider)" style="margin-right: 4px" />
                {{ getProviderName(record.provider) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'type'">
              <a-tag color="blue">{{ getModelTypeName(record.modelType) }}</a-tag>
            </template>
            <template v-if="column.key === 'priority'">
              <a-tag :color="getPriorityColor(record.priority)">P{{ record.priority }}</a-tag>
            </template>
            <template v-if="column.key === 'isDefault'">
              <a-badge v-if="record.isSystemDefault" status="success" text="默认" />
              <span v-else>-</span>
            </template>
            <template v-if="column.key === 'isActive'">
              <a-switch
                v-model:checked="record.isActive"
                :loading="togglingId === record.id"
                @change="toggleConfigStatus(record)"
              />
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="testConnection(record)" :loading="testingId === record.id">
                  <ThunderboltOutlined /> 测试
                </a-button>
                <a-button type="link" size="small" @click="editConfig(record)">编辑</a-button>
                <a-popconfirm
                  title="确定要删除此配置吗？"
                  @confirm="deleteConfig(record.id)"
                >
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <a-modal
      v-model:open="showAddModal"
      :title="editingConfig ? '编辑模型配置' : '添加模型配置'"
      @ok="handleSaveConfig"
      :confirm-loading="saving"
      width="700px"
    >
      <a-form layout="vertical" :model="configForm">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="配置名称" required>
              <a-input v-model:value="configForm.name" placeholder="例如：通义千问-文章生成" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="模型提供商" required>
              <a-select v-model:value="configForm.provider" style="width: 100%" placeholder="选择提供商">
                <a-select-option v-for="provider in providers" :key="provider.id" :value="provider.id">
                  <span class="provider-option">
                    <component :is="provider.icon" style="margin-right: 8px" />
                    {{ provider.name }}
                  </span>
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="模型名称" required>
              <a-input v-model:value="configForm.modelName" placeholder="例如：qwen-max、gpt-4-turbo、deepseek-chat" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="模型类型" required>
              <a-select v-model:value="configForm.modelType" style="width: 100%">
                <a-select-option value="chat">聊天模型</a-select-option>
                <a-select-option value="embedding">向量化模型</a-select-option>
                <a-select-option value="image">图像模型</a-select-option>
                <a-select-option value="audio">语音模型</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="API Key" :required="!editingConfig">
              <a-input-password v-model:value="configForm.apiKey" placeholder="输入 API Key" />
              <div v-if="editingConfig && (!editingConfig.apiKey || editingConfig.apiKey.includes('*'))" class="api-key-hint">
                <span style="color: #999; font-size: 12px">已配置，如需修改请重新输入</span>
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="API Base URL">
              <a-input v-model:value="configForm.baseUrl" placeholder="自定义 API 地址（可选）" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="API Version">
              <a-input v-model:value="configForm.apiVersion" placeholder="API 版本（可选）" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">模型参数</a-divider>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="Temperature">
              <a-slider v-model:value="configForm.temperature" :min="0" :max="2" :step="0.1" />
              <div class="param-value">{{ configForm.temperature }}</div>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Max Tokens">
              <a-input-number v-model:value="configForm.maxTokens" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Top P">
              <a-slider v-model:value="configForm.topP" :min="0" :max="1" :step="0.05" />
              <div class="param-value">{{ configForm.topP }}</div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">重试配置</a-divider>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="启用重试">
              <a-switch v-model:checked="configForm.enableRetry" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="最大重试次数">
              <a-input-number v-model:value="configForm.maxRetryTimes" :min="1" :max="10" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="重试延迟（毫秒）">
              <a-input-number v-model:value="configForm.retryDelay" :min="100" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="优先级">
              <a-select v-model:value="configForm.priority" style="width: 100%">
                <a-select-option :value="1">P1 (最高)</a-select-option>
                <a-select-option :value="2">P2 (高)</a-select-option>
                <a-select-option :value="3">P3 (普通)</a-select-option>
                <a-select-option :value="4">P4 (低)</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="启用状态">
              <a-switch v-model:checked="configForm.isActive" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ApiOutlined,
  BlockOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue'
import { modelConfigApi, usageApi } from '../../api/ai-model'
import type { ModelConfig } from '../../types/ai-model'

const loading = ref(false)
const saving = ref(false)
const testingId = ref<number | null>(null)
const togglingId = ref<number | null>(null)

const showAddModal = ref(false)
const editingConfig = ref<ModelConfig | null>(null)

const filterProvider = ref<string | null>(null)
const filterType = ref<string | null>(null)

const configs = ref<ModelConfig[]>([])
const todayUsage = reactive({
  totalTokens: 0,
  totalCost: 0,
  callCount: 0,
  successCount: 0,
})

const stats = computed(() => ({
  totalConfigs: configs.value.length,
  activeConfigs: configs.value.filter(c => c.isActive).length,
  totalProviders: new Set(configs.value.map(c => c.provider)).size,
  totalModels: new Set(configs.value.map(c => c.modelId)).size,
}))

const providers = [
  { id: 'dashscope', name: '通义千问', icon: ApiOutlined },
  { id: 'wenxin', name: '文心一言', icon: ApiOutlined },
  { id: 'zhipu', name: '智谱 AI', icon: ApiOutlined },
  { id: 'deepseek', name: 'DeepSeek', icon: ApiOutlined },
  { id: 'anthropic', name: 'Claude', icon: ApiOutlined },
  { id: 'openai', name: 'OpenAI', icon: ApiOutlined },
  { id: 'volcengine', name: '火山引擎', icon: ApiOutlined },
  { id: 'ollama', name: 'Ollama', icon: BlockOutlined },
]

const configForm = reactive({
  name: '',
  provider: '',
  modelName: '',
  modelType: 'chat',
  apiKey: '',
  baseUrl: '',
  apiVersion: '',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9,
  enableRetry: true,
  maxRetryTimes: 3,
  retryDelay: 1000,
  priority: 3,
  isActive: true,
})

const columns = [
  { title: '配置名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '提供商', key: 'provider', width: 140 },
  { title: '模型', dataIndex: 'modelName', key: 'modelName', width: 140 },
  { title: '优先级', key: 'priority', width: 100, align: 'center' as const },
  { title: '默认配置', key: 'isDefault', width: 100, align: 'center' as const },
  { title: '状态', key: 'isActive', width: 100, align: 'center' as const },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 },
]

const filteredConfigs = computed(() => {
  let result = configs.value
  if (filterProvider.value) {
    result = result.filter(c => c.provider === filterProvider.value)
  }
  if (filterType.value) {
    result = result.filter(c => c.modelType === filterType.value)
  }
  return result
})

function getProviderIcon(provider: string) {
  const map: Record<string, any> = {
    dashscope: ApiOutlined,
    wenxin: ApiOutlined,
    zhipu: ApiOutlined,
    deepseek: ApiOutlined,
    anthropic: ApiOutlined,
    openai: ApiOutlined,
    volcengine: ApiOutlined,
    ollama: BlockOutlined,
  }
  return map[provider] || ApiOutlined
}

function getProviderColor(provider: string) {
  const map: Record<string, string> = {
    dashscope: 'blue',
    wenxin: 'green',
    zhipu: 'purple',
    deepseek: 'geekblue',
    anthropic: 'orange',
    openai: 'cyan',
    volcengine: 'red',
    ollama: 'default',
  }
  return map[provider] || 'default'
}

function getProviderName(provider: string) {
  const map: Record<string, string> = {
    dashscope: '通义千问',
    wenxin: '文心一言',
    zhipu: '智谱 AI',
    deepseek: 'DeepSeek',
    anthropic: 'Claude',
    openai: 'OpenAI',
    ollama: 'Ollama',
  }
  return map[provider] || provider
}

function getModelTypeName(type: string) {
  const map: Record<string, string> = {
    chat: '聊天模型',
    embedding: '向量化模型',
    image: '图像模型',
    audio: '语音模型',
  }
  return map[type] || type
}

function getPriorityColor(priority: number) {
  const map: Record<number, string> = {
    1: 'red',
    2: 'orange',
    3: 'blue',
    4: 'default',
  }
  return map[priority] || 'default'
}

function editConfig(config: ModelConfig) {
  editingConfig.value = config
  Object.assign(configForm, {
    name: config.name,
    provider: config.provider,
    modelName: config.modelName || '',
    modelType: config.modelType || 'chat',
    apiKey: '',
    baseUrl: config.apiEndpoint || config.baseUrl || '',
    apiVersion: (config as any).apiVersion || '',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 2000,
    topP: config.topP ?? 0.9,
    enableRetry: (config as any).enableRetry ?? true,
    maxRetryTimes: (config as any).maxRetryTimes ?? 3,
    retryDelay: (config as any).retryDelay ?? 1000,
    priority: (config as any).sortOrder ?? config.priority ?? 3,
    isActive: config.isActive,
  })
  showAddModal.value = true
}

async function toggleConfigStatus(config: ModelConfig) {
  togglingId.value = config.id
  try {
    await modelConfigApi.toggleStatus(config.id)
    message.success('状态切换成功')
  } catch (error) {
    console.error(error)
    config.isActive = !config.isActive
    message.error('状态切换失败')
  } finally {
    togglingId.value = null
  }
}

async function testConnection(config: ModelConfig) {
  testingId.value = config.id
  try {
    const result: any = await modelConfigApi.test(config.id)
    if (result.success) {
      message.success(`连接成功！延迟：${result.responseTime ?? result.latency}ms`)
    } else {
      message.error(`连接失败：${result.message}`)
    }
  } catch (error) {
    console.error(error)
    message.error('连接测试失败')
  } finally {
    testingId.value = null
  }
}

async function deleteConfig(id: number) {
  try {
    await modelConfigApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    console.error(error)
    message.error('删除失败')
  }
}

function formToPayload() {
  const payload: Record<string, any> = {
    name: configForm.name,
    provider: configForm.provider,
    modelName: configForm.modelName,
    modelType: configForm.modelType,
    apiEndpoint: configForm.baseUrl,
    temperature: configForm.temperature,
    maxTokens: configForm.maxTokens,
    topP: configForm.topP,
    sortOrder: configForm.priority,
    isActive: configForm.isActive,
  }
  if (configForm.apiKey) {
    payload.apiKey = configForm.apiKey
  }
  return payload
}

async function handleSaveConfig() {
  if (!configForm.name || !configForm.provider || !configForm.modelName) {
    message.error('请填写必填字段')
    return
  }
  if (!editingConfig.value && !configForm.apiKey) {
    message.error('请填写 API Key')
    return
  }

  saving.value = true
  try {
    const payload = formToPayload()
    if (editingConfig.value) {
      await modelConfigApi.update(editingConfig.value.id, payload as any)
      message.success('更新成功')
    } else {
      await modelConfigApi.create(1, payload as any)
      message.success('创建成功')
    }
    showAddModal.value = false
    await loadData()
  } catch (error) {
    console.error(error)
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const result = await modelConfigApi.list({ tenantId: 1 })
    const list = result.records || (Array.isArray(result) ? result : [])
    configs.value = list.map((item: any) => ({
      ...item,
      priority: item.sortOrder ?? item.priority ?? 3,
      baseUrl: item.apiEndpoint || item.baseUrl || '',
    }))
  } catch (error) {
    console.error(error)
    // Mock data
    configs.value = [
      {
        id: 1,
        modelId: 101,
        name: '通义千问-文章生成',
        tenantId: 1,
        provider: 'dashscope',
        modelName: 'qwen-max',
        modelType: 'chat',
        isSystemDefault: true,
        apiKey: 'sk-xxx',
        isActive: true,
        priority: 1,
        temperature: 0.7,
        maxTokens: 2000,
        topP: 0.9,
        enableRetry: true,
        maxRetryTimes: 3,
        retryDelay: 1000,
        createdAt: '2024-03-15 10:00:00',
        updatedAt: '2024-03-15 10:00:00',
      } as any,
      {
        id: 2,
        modelId: 201,
        name: '通义千问-向量化',
        tenantId: 1,
        provider: 'dashscope',
        modelName: 'text-embedding-v2',
        modelType: 'embedding',
        isSystemDefault: true,
        apiKey: 'sk-xxx',
        isActive: true,
        priority: 1,
        temperature: 0.7,
        maxTokens: 2000,
        topP: 0.9,
        enableRetry: true,
        maxRetryTimes: 3,
        retryDelay: 1000,
        createdAt: '2024-03-15 10:30:00',
        updatedAt: '2024-03-15 10:30:00',
      } as any,
      {
        id: 3,
        modelId: 301,
        name: 'OpenAI-GPT4',
        tenantId: 1,
        provider: 'openai',
        modelName: 'gpt-4-turbo',
        modelType: 'chat',
        isSystemDefault: false,
        apiKey: 'sk-xxx',
        isActive: false,
        priority: 2,
        temperature: 0.7,
        maxTokens: 4096,
        topP: 0.9,
        enableRetry: true,
        maxRetryTimes: 5,
        retryDelay: 1000,
        createdAt: '2024-03-14 09:00:00',
        updatedAt: '2024-03-14 09:00:00',
      } as any,
    ]
  } finally {
    loading.value = false
  }
}

async function loadTodayUsage() {
  try {
    const result = await usageApi.today(1)
    Object.assign(todayUsage, result)
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  loadData()
  loadTodayUsage()
})
</script>

<style scoped lang="less">
.model-config-page {
  width: 100%;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.provider-option {
  display: flex;
  align-items: center;
}

.param-value {
  text-align: center;
  color: #1890ff;
  font-weight: 500;
  font-size: 14px;
  margin-top: 4px;
}
</style>
