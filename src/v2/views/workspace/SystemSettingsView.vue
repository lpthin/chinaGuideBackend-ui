<template>
  <div class="system-settings">
    <a-card :bordered="false">
      <template #title>
        <h3>系统设置</h3>
      </template>

      <a-tabs v-model:activeKey="activeTab" type="card">
        <!-- 站点设置 -->
        <a-tab-pane key="site" tab="站点设置">
          <a-form
            ref="siteFormRef"
            :model="siteForm"
            :rules="siteRules"
            :label-col="{ span: 4 }"
            :wrapper-col="{ span: 16 }"
            label-align="left"
          >
            <a-form-item label="站点名称" name="siteName">
              <a-input v-model:value="siteForm.siteName" placeholder="请输入站点名称" />
            </a-form-item>
            <a-form-item label="站点描述" name="siteDescription">
              <a-textarea
                v-model:value="siteForm.siteDescription"
                placeholder="请输入站点描述"
                :auto-size="{ minRows: 3, maxRows: 5 }"
              />
            </a-form-item>
            <a-form-item label="站点Logo" name="logo">
              <a-upload
                v-model:file-list="logoFileList"
                :before-upload="beforeUploadLogo"
                list-type="picture-card"
                :max-count="1"
                accept="image/*"
              >
                <div>
                  <plus-outlined />
                  <div style="margin-top: 8px">上传Logo</div>
                </div>
              </a-upload>
            </a-form-item>
            <a-form-item label="联系邮箱" name="contactEmail">
              <a-input v-model:value="siteForm.contactEmail" placeholder="请输入联系邮箱" />
            </a-form-item>
            <a-form-item label="联系电话" name="contactPhone">
              <a-input v-model:value="siteForm.contactPhone" placeholder="请输入联系电话" />
            </a-form-item>
            <a-form-item label="备案号" name="icp">
              <a-input v-model:value="siteForm.icp" placeholder="请输入ICP备案号" />
            </a-form-item>
            <a-form-item label="版权信息" name="copyright">
              <a-input v-model:value="siteForm.copyright" placeholder="请输入版权信息" />
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4, span: 16 }">
              <a-space>
                <a-button type="primary" :loading="saving" @click="saveSiteSettings">
                  保存设置
                </a-button>
                <a-button @click="resetSiteForm">重置</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <!-- AI配置 -->
        <a-tab-pane key="ai" tab="AI配置">
          <a-form
            ref="aiFormRef"
            :model="aiForm"
            :label-col="{ span: 4 }"
            :wrapper-col="{ span: 16 }"
            label-align="left"
          >
            <a-form-item label="默认模型">
              <a-select v-model:value="aiForm.defaultModel" placeholder="请选择默认模型">
                <a-select-option value="gpt-4">GPT-4</a-select-option>
                <a-select-option value="gpt-3.5-turbo">GPT-3.5 Turbo</a-select-option>
                <a-select-option value="claude-3-opus">Claude 3 Opus</a-select-option>
                <a-select-option value="claude-3-sonnet">Claude 3 Sonnet</a-select-option>
                <a-select-option value="qwen-max">通义千问 Max</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="API Key">
              <a-input-password
                v-model:value="aiForm.apiKey"
                placeholder="请输入API密钥"
                visibility-toggle
              />
            </a-form-item>
            <a-form-item label="API Base URL">
              <a-input v-model:value="aiForm.apiBaseUrl" placeholder="请输入API基础地址" />
            </a-form-item>
            <a-form-item label="默认温度">
              <a-slider
                v-model:value="aiForm.temperature"
                :min="0"
                :max="2"
                :step="0.1"
                :marks="{ 0: '0', 1: '1', 2: '2' }"
              />
              <span class="slider-value">{{ aiForm.temperature }}</span>
            </a-form-item>
            <a-form-item label="最大Token数">
              <a-input-number
                v-model:value="aiForm.maxTokens"
                :min="100"
                :max="128000"
                :step="100"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item label="启用流式输出">
              <a-switch v-model:checked="aiForm.streamEnabled" />
            </a-form-item>
            <a-form-item label="系统提示词">
              <a-textarea
                v-model:value="aiForm.systemPrompt"
                placeholder="请输入系统提示词"
                :auto-size="{ minRows: 4, maxRows: 8 }"
              />
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4, span: 16 }">
              <a-space>
                <a-button type="primary" :loading="saving" @click="saveAiSettings">
                  保存设置
                </a-button>
                <a-button @click="testAiConnection">测试连接</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <!-- 工作流配置 -->
        <a-tab-pane key="workflow" tab="工作流配置">
          <a-form
            ref="workflowFormRef"
            :model="workflowForm"
            :label-col="{ span: 4 }"
            :wrapper-col="{ span: 16 }"
            label-align="left"
          >
            <a-divider orientation="left">关键词采集</a-divider>
            <a-form-item label="采集周期">
              <a-select v-model:value="workflowForm.keywordCrawlInterval">
                <a-select-option value="daily">每天</a-select-option>
                <a-select-option value="weekly">每周</a-select-option>
                <a-select-option value="monthly">每月</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="每次采集数量">
              <a-input-number
                v-model:value="workflowForm.keywordCrawlLimit"
                :min="10"
                :max="1000"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item label="自动采集">
              <a-switch v-model:checked="workflowForm.autoCrawlEnabled" />
            </a-form-item>

            <a-divider orientation="left">聚类分析</a-divider>
            <a-form-item label="聚类阈值">
              <a-slider
                v-model:value="workflowForm.clusterThreshold"
                :min="0.1"
                :max="1"
                :step="0.05"
                :marks="{ 0.1: '0.1', 0.5: '0.5', 1: '1' }"
              />
              <span class="slider-value">{{ workflowForm.clusterThreshold }}</span>
            </a-form-item>
            <a-form-item label="最小聚类大小">
              <a-input-number
                v-model:value="workflowForm.minClusterSize"
                :min="2"
                :max="100"
                style="width: 100%"
              />
            </a-form-item>

            <a-divider orientation="left">内容生成</a-divider>
            <a-form-item label="自动生成">
              <a-switch v-model:checked="workflowForm.autoGenerateEnabled" />
            </a-form-item>
            <a-form-item label="每日生成上限">
              <a-input-number
                v-model:value="workflowForm.dailyGenerateLimit"
                :min="1"
                :max="100"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item label="自动审核">
              <a-switch v-model:checked="workflowForm.autoReviewEnabled" />
            </a-form-item>

            <a-divider orientation="left">发布配置</a-divider>
            <a-form-item label="自动发布">
              <a-switch v-model:checked="workflowForm.autoPublishEnabled" />
            </a-form-item>
            <a-form-item label="发布时间">
              <a-time-picker
                v-model:value="workflowForm.publishTime"
                format="HH:mm"
                style="width: 100%"
              />
            </a-form-item>

            <a-form-item :wrapper-col="{ offset: 4, span: 16 }">
              <a-space>
                <a-button type="primary" :loading="saving" @click="saveWorkflowSettings">
                  保存设置
                </a-button>
                <a-button @click="resetWorkflowForm">重置</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <!-- 系统参数 -->
        <a-tab-pane key="system" tab="系统参数">
          <a-table
            :columns="systemParamColumns"
            :data-source="systemParams"
            :pagination="false"
            row-key="key"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'value'">
                <a-input
                  v-if="record.type === 'string'"
                  v-model:value="record.value"
                  placeholder="请输入值"
                />
                <a-input-number
                  v-if="record.type === 'number'"
                  v-model:value="record.value"
                  style="width: 100%"
                />
                <a-switch v-if="record.type === 'boolean'" v-model:checked="record.value" />
                <a-select
                  v-if="record.type === 'select'"
                  v-model:value="record.value"
                  style="width: 100%"
                >
                  <a-select-option
                    v-for="option in record.options"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </a-select-option>
                </a-select>
              </template>
              <template v-if="column.key === 'actions'">
                <a-button type="link" size="small" @click="saveSystemParam(record)">
                  保存
                </a-button>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import type { UploadProps } from 'ant-design-vue'

const activeTab = ref('site')
const saving = ref(false)

// 站点设置
const siteFormRef = ref()
const siteForm = reactive({
  siteName: 'AI Content Platform',
  siteDescription: '一站式AI内容生成平台，提供关键词采集、聚类分析、文章生成、自动发布等功能',
  logo: '',
  contactEmail: 'contact@example.com',
  contactPhone: '400-123-4567',
  icp: '京ICP备12345678号-1',
  copyright: '© 2024 AI Content Platform. All rights reserved.'
})

const logoFileList = ref<UploadProps['fileList']>([])

const siteRules = {
  siteName: [{ required: true, message: '请输入站点名称', trigger: 'blur' }],
  contactEmail: [
    { type: 'email' as const, message: '请输入有效的邮箱地址', trigger: 'blur' }
  ]
}

// AI配置
const aiFormRef = ref()
const aiForm = reactive({
  defaultModel: 'gpt-4',
  apiKey: '',
  apiBaseUrl: 'https://api.openai.com/v1',
  temperature: 0.7,
  maxTokens: 4096,
  streamEnabled: true,
  systemPrompt: '你是一个专业的内容创作助手，擅长撰写高质量的文章和内容。'
})

// 工作流配置
const workflowFormRef = ref()
const workflowForm = reactive({
  keywordCrawlInterval: 'daily',
  keywordCrawlLimit: 100,
  autoCrawlEnabled: true,
  clusterThreshold: 0.7,
  minClusterSize: 5,
  autoGenerateEnabled: false,
  dailyGenerateLimit: 10,
  autoReviewEnabled: true,
  autoPublishEnabled: false,
  publishTime: ref()
})

// 系统参数
const systemParams = ref([
  {
    key: 'max_upload_size',
    name: '最大上传大小',
    value: 10,
    type: 'number',
    unit: 'MB',
    description: '允许上传的最大文件大小'
  },
  {
    key: 'session_timeout',
    name: '会话超时时间',
    value: 30,
    type: 'number',
    unit: '分钟',
    description: '用户无操作后自动退出登录时间'
  },
  {
    key: 'enable_registration',
    name: '开放注册',
    value: true,
    type: 'boolean',
    description: '是否允许新用户注册'
  },
  {
    key: 'maintenance_mode',
    name: '维护模式',
    value: false,
    type: 'boolean',
    description: '开启后只有管理员可访问'
  },
  {
    key: 'log_level',
    name: '日志级别',
    value: 'info',
    type: 'select',
    options: [
      { label: '调试', value: 'debug' },
      { label: '信息', value: 'info' },
      { label: '警告', value: 'warn' },
      { label: '错误', value: 'error' }
    ],
    description: '系统日志记录级别'
  }
])

const systemParamColumns = [
  { title: '参数名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '参数值', key: 'value', width: 300 },
  { title: '单位', dataIndex: 'unit', key: 'unit', width: 100 },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 100 }
]

// Logo上传
const beforeUploadLogo: UploadProps['beforeUpload'] = (file) => {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    message.error('只能上传图片文件')
    return false
  }
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isLt2M) {
    message.error('图片大小不能超过 2MB')
    return false
  }
  return false // 不上传到服务器，前端处理
}

// 保存站点设置
const saveSiteSettings = async () => {
  try {
    await siteFormRef.value?.validate()
    saving.value = true
    // 模拟API调用
    setTimeout(() => {
      message.success('站点设置保存成功')
      saving.value = false
    }, 1000)
  } catch {
    message.error('表单验证失败')
  }
}

const resetSiteForm = () => {
  siteFormRef.value?.resetFields()
}

// 保存AI设置
const saveAiSettings = async () => {
  saving.value = true
  setTimeout(() => {
    message.success('AI配置保存成功')
    saving.value = false
  }, 1000)
}

const testAiConnection = async () => {
  message.info('正在测试AI连接...')
  setTimeout(() => {
    message.success('AI连接测试成功！')
  }, 1500)
}

// 保存工作流设置
const saveWorkflowSettings = async () => {
  saving.value = true
  setTimeout(() => {
    message.success('工作流配置保存成功')
    saving.value = false
  }, 1000)
}

const resetWorkflowForm = () => {
  workflowFormRef.value?.resetFields()
}

// 保存系统参数
const saveSystemParam = (record: any) => {
  message.success(`参数 ${record.name} 已保存`)
}
</script>

<style scoped lang="less">
.system-settings {
  padding: 24px;

  h3 {
    margin: 0 0 20px;
    font-size: 18px;
    font-weight: 600;
  }

  .slider-value {
    margin-left: 16px;
    color: #1890ff;
    font-weight: 500;
  }
}

:deep(.ant-tabs-content-holder) {
  padding-top: 24px;
}
</style>