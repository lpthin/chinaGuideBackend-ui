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
              <a-select-option value="vision">视觉模型</a-select-option>
              <a-select-option value="embedding">向量化模型</a-select-option>
              <a-select-option value="image">图像模型</a-select-option>
              <a-select-option value="audio">语音模型</a-select-option>
            </a-select>
            <a-button :loading="checkingAll" @click="handleCheckAllHealth">
              <template #icon><SafetyCertificateOutlined /></template>
              立即巡检
            </a-button>
            <a-button type="primary" @click="showAddModal = true">
              <template #icon><PlusOutlined /></template>
              添加配置
            </a-button>
          </a-space>
        </template>

        <a-table
          :scroll="{ x: 'max-content' }"
          :columns="columns"
          :data-source="filteredConfigs"
          :pagination="false"
          :row-key="(record: any) => record.id"
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
            <template v-if="column.key === 'apiProtocol'">
              <a-tooltip :title="protocolTooltip(record)">
                <a-tag :color="record.apiProtocol ? 'purple' : 'default'">{{ protocolText(record.apiProtocol) }}</a-tag>
              </a-tooltip>
            </template>
            <template v-if="column.key === 'priority'">
              <a-tag :color="getPriorityColor(record.priority)">P{{ record.priority }}</a-tag>
            </template>
            <template v-if="column.key === 'isDefault'">
              <a-badge v-if="record.isDefault" status="success" text="默认" />
              <a-button
                v-else
                type="link"
                size="small"
                @click="setDefaultConfig(record)"
                :loading="settingDefaultId === record.id"
              >
                设为默认
              </a-button>
            </template>
            <template v-if="column.key === 'isActive'">
              <a-switch
                v-model:checked="record.isActive"
                :loading="togglingId === record.id"
                @change="toggleConfigStatus(record)"
              />
            </template>
            <template v-if="column.key === 'healthStatus'">
              <a-tooltip :title="healthTooltip(record)">
                <a-tag :color="healthColor(record.healthStatus)">{{ healthLabel(record.healthStatus) }}</a-tag>
              </a-tooltip>
              <div v-if="record.lastHealthCheckAt" class="health-check-time">
                {{ formatDateTime(record.lastHealthCheckAt) }}
              </div>
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <!-- 图像行不给「测试」：对话式探测打不到生图端点，绿了也是假绿（后端同样会拒答）。
                     这一行的结论只由「试出一张图」给，而那一次是真花钱的，所以按两次才算数 -->
                <a-popconfirm
                  v-if="isImageRow(record)"
                  title="这会真出一张图并产生一次费用（只出 1 张，不入库）"
                  ok-text="出 1 张"
                  cancel-text="取消"
                  @confirm="probeImage(record)"
                >
                  <a-button type="link" size="small" :loading="probingId === record.id">
                    <PictureOutlined /> 试出一张图
                  </a-button>
                </a-popconfirm>
                <a-button v-else type="link" size="small" @click="testConnection(record)" :loading="testingId === record.id">
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
            <a-form-item
              label="模型类型"
              required
              extra="「视觉模型」是能看图的多模态模型（参考站截图摄取要用它）；「图像模型」是生成图片的，收不到图片"
            >
              <a-select v-model:value="configForm.modelType" style="width: 100%">
                <a-select-option value="chat">聊天模型</a-select-option>
                <a-select-option value="vision">视觉模型</a-select-option>
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
          <a-col :span="24">
            <a-form-item
              label="接口协议"
              extra="决定请求按哪种形状发出。「自动」= 按下面的接口地址判断，现有配置不用改。百炼的图像模型只认「DashScope 原生」；「Anthropic 兼容」只有对话，没有生图"
            >
              <a-select v-model:value="configForm.apiProtocol" :options="protocolOptions" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="16">
            <a-form-item label="API Base URL">
              <a-input v-model:value="configForm.baseUrl" placeholder="自定义 API 地址（可选）" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
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
          <a-col :span="8">
            <a-form-item label="设为默认">
              <a-switch v-model:checked="configForm.isDefault" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message, notification } from 'ant-design-vue'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ApiOutlined,
  BlockOutlined,
  PlusOutlined,
  PictureOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons-vue'
import { modelConfigApi, usageApi } from '../../api/ai-model'
import { describeHttpError } from '../../api/http'
import type { ModelConfig } from '../../types/ai-model'
import { useAuthStore } from '../../stores/auth'
import { formatDateTime } from '../../utils/format'

const authStore = useAuthStore()
const getTenantId = () => authStore.selectedTenantId || authStore.tenantId || 1

const loading = ref(false)
const saving = ref(false)
const testingId = ref<number | null>(null)
const probingId = ref<number | null>(null)
const checkingAll = ref(false)
const togglingId = ref<number | null>(null)
const settingDefaultId = ref<number | null>(null)

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

/**
 * 协议下拉的取值与文案，是后端 `AiProtocols.label` 的一面镜子：只有这三条，
 * 外加「留空 = 让后端按接口地址推断」。判断规则不在前端重写一份——两处各写一遍，
 * 迟早会出现「界面说自动、后端按另一种协议发出去」。
 */
const PROTOCOL_LABELS: Record<string, string> = {
  openai: 'OpenAI 兼容',
  anthropic: 'Anthropic 兼容',
  dashscope: 'DashScope 原生',
}

const protocolOptions = [
  { value: '', label: '自动（按接口地址推断）' },
  ...Object.entries(PROTOCOL_LABELS).map(([value, label]) => ({ value, label })),
]

function protocolText(protocol?: string) {
  if (!protocol) return '自动'
  return PROTOCOL_LABELS[protocol] || `未识别：${protocol}`
}

function protocolTooltip(record: ModelConfig) {
  if (!record.apiProtocol) {
    return '没有显式指定，请求发出前由后端按接口地址判断用哪种协议'
  }
  if (!PROTOCOL_LABELS[record.apiProtocol]) {
    return `这一栏存的是「${record.apiProtocol}」，不在 openai / anthropic / dashscope 里，调用会直接报错指出这一栏`
  }
  if (record.apiProtocol === 'anthropic' && isImageRow(record)) {
    return 'Anthropic 兼容协议没有图像生成接口，这一行出不了图'
  }
  return `已显式指定为「${PROTOCOL_LABELS[record.apiProtocol]}」，后端不再按地址推断`
}

/** 只有「图像模型」这一类走「试出一张图」；和后端 AiModelTypes.isImageGenerating 认的是同一个取值 */
function isImageRow(record: ModelConfig) {
  return record.modelType === 'image'
}

const configForm = reactive({
  name: '',
  provider: '',
  modelName: '',
  modelType: 'chat',
  apiKey: '',
  baseUrl: '',
  apiProtocol: '',
  apiVersion: '',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9,
  enableRetry: true,
  maxRetryTimes: 3,
  retryDelay: 1000,
  priority: 3,
  isActive: true,
  isDefault: false,
})

const columns = [
  { title: '配置名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '提供商', key: 'provider', width: 140 },
  { title: '模型', dataIndex: 'modelName', key: 'modelName', width: 140 },
  { title: '接口协议', key: 'apiProtocol', width: 130 },
  { title: '优先级', key: 'priority', width: 100, align: 'center' as const },
  { title: '默认配置', key: 'isDefault', width: 100, align: 'center' as const },
  { title: '状态', key: 'isActive', width: 100, align: 'center' as const },
  { title: '测试结果', key: 'healthStatus', width: 170 },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    customRender: ({ text }: { text: string }) => formatDateTime(text),
  },
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

function healthLabel(status?: string) {
  if (status === 'passed') return '通过'
  if (status === 'failed') return '不通过'
  return '未检测'
}

function healthColor(status?: string) {
  if (status === 'passed') return 'success'
  if (status === 'failed') return 'error'
  return 'default'
}

function healthTooltip(record: ModelConfig) {
  if (record.healthStatus === 'failed') {
    const reason = record.lastHealthError || '未知原因'
    const latency = record.lastHealthLatencyMs != null ? ` · 耗时 ${record.lastHealthLatencyMs}ms` : ''
    return `不通过：${reason}${latency} · 已通过报警管理通知管理员，系统不会自动停用该模型`
  }
  if (record.healthStatus === 'passed') {
    if (isImageRow(record)) {
      // 图像行的绿只认真实出图；V129 之前那版对话式探测写进去的绿不作数，所以这里不替它背书
      const failures = record.healthConsecutiveFailures ?? 0
      if (failures > 0) {
        return `最近 ${failures} 次真实出图都没成功（还没到报警阈值，状态暂时仍是通过）：${record.lastHealthError || '未记原因'} · 点「试出一张图」可当场再验一次`
      }
      return '通过：这条只应来自一次真实出图调用（对话式探测测不到生图，V129 起对图像行直接拒答）。怀疑这行没真出过图时，点「试出一张图」验一次'
    }
    return record.lastHealthLatencyMs != null
      ? `通过 · 最近一次探测耗时 ${record.lastHealthLatencyMs}ms`
      : '通过'
  }
  if (isImageRow(record)) {
    return '图像行不做对话式连接测试：那种探测打的是聊天端点，测不到能不能生图。要点「试出一张图」，那一次会真出一张、也真计费'
  }
  return '尚未探测 · 点击「测试」或「立即巡检」，每日 03:30 也会自动巡检'
}

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
    vision: '视觉模型',
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
    apiProtocol: config.apiProtocol || '',
    apiVersion: (config as any).apiVersion || '',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 2000,
    topP: config.topP ?? 0.9,
    enableRetry: (config as any).enableRetry ?? true,
    maxRetryTimes: (config as any).maxRetryTimes ?? 3,
    retryDelay: (config as any).retryDelay ?? 1000,
    priority: (config as any).sortOrder ?? config.priority ?? 3,
    isActive: config.isActive,
    isDefault: config.isDefault ?? false,
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

async function setDefaultConfig(config: ModelConfig) {
  settingDefaultId.value = config.id
  try {
    await modelConfigApi.setDefault(config.id)
    message.success('已设为默认模型')
    await loadData()
  } catch (error) {
    console.error(error)
    message.error('设置失败')
  } finally {
    settingDefaultId.value = null
  }
}

async function testConnection(config: ModelConfig) {
  testingId.value = config.id
  try {
    const result = await modelConfigApi.test(config.id)
    if (result.success) {
      message.success(`连接测试通过！耗时：${result.responseTime}ms`)
    } else {
      message.error(`连接测试不通过：${result.message}`)
    }
    await loadData()
  } catch (error) {
    console.error(error)
    message.error('连接测试请求失败')
  } finally {
    testingId.value = null
  }
}

/**
 * 图像行专用：真出一张图来证明这一行配置能用。
 *
 * <p>结果用 notification 而不是 message：后端那句失败里带着<b>协议名和实际请求地址</b>
 * （就是这两样，之前两次付费跑完都看不出错在哪），一行 toast 会把它截掉。</p>
 */
async function probeImage(config: ModelConfig) {
  probingId.value = config.id
  try {
    const result = await modelConfigApi.imageProbe(config.id)
    const where = `${result.protocolName} · ${result.endpoint}`
    if (result.success) {
      notification.success({
        message: `出了一张图（${result.elapsedMs}ms）`,
        description: `${where} · ${result.message}`,
        duration: 8,
      })
    } else {
      notification.error({
        message: '这一行出不了图',
        description: `${where} · ${result.message}`,
        duration: 0,
      })
    }
    await loadData()
  } catch (error) {
    console.error(error)
    // 这里不能只说「请求失败」：开关没开、类型填错这些话后端已经替我们说清楚了
    notification.error({
      message: '试出图没有执行',
      description: describeHttpError(error),
      duration: 0,
    })
  } finally {
    probingId.value = null
  }
}

async function handleCheckAllHealth() {
  checkingAll.value = true
  try {
    const result = await modelConfigApi.checkAllHealth()
    message.success(`巡检完成：通过 ${result.passed} 个，不通过 ${result.failed} 个，跳过 ${result.skipped} 个`)
    await loadData()
  } catch (error) {
    console.error(error)
    message.error('巡检请求失败')
  } finally {
    checkingAll.value = false
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
    // 留空也照样提交：编辑时把「自动」改回留空，得能把之前显式填的协议清掉
    apiProtocol: configForm.apiProtocol || '',
    temperature: configForm.temperature,
    maxTokens: configForm.maxTokens,
    topP: configForm.topP,
    sortOrder: configForm.priority,
    isActive: configForm.isActive,
    isDefault: configForm.isDefault,
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
    let savedConfig: ModelConfig
    if (editingConfig.value) {
      const result = await modelConfigApi.update(editingConfig.value.id, payload as any)
      savedConfig = result
      message.success('更新成功')
    } else {
      const result = await modelConfigApi.create(getTenantId(), payload as any)
      savedConfig = result
      message.success('创建成功')
    }
    if (configForm.isDefault && savedConfig && savedConfig.id) {
      await modelConfigApi.setDefault(savedConfig.id)
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
    const result = await modelConfigApi.list({ tenantId: getTenantId(), page: 1, size: 100 })
    const list = result?.records || []
    configs.value = list.map((item: any) => ({
      ...item,
      priority: item.sortOrder ?? item.priority ?? 3,
      baseUrl: item.apiEndpoint || item.baseUrl || '',
    }))
  } catch (error) {
    console.error('加载模型配置失败:', error)
    message.error('加载模型配置失败')
    configs.value = []
  } finally {
    loading.value = false
  }
}

async function loadTodayUsage() {
  try {
    const result = await usageApi.today(getTenantId())
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

.health-check-time {
  color: #8c8c8c;
  font-size: 12px;
  line-height: 18px;
}

.param-value {
  text-align: center;
  color: #1890ff;
  font-weight: 500;
  font-size: 14px;
  margin-top: 4px;
}
</style>
