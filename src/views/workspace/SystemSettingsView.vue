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
                <a-button :loading="testing" @click="testAiConnection">测试连接</a-button>
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
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import type { UploadProps } from 'ant-design-vue'
import { adminApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'
import type { SiteSettings, AiSettings, WorkflowSettings } from '../../types/workspace'

const authStore = useAuthStore()

const activeTab = ref('site')
const saving = ref(false)
const testing = ref(false)
const loading = ref(false)

const siteFormRef = ref()
const aiFormRef = ref()
const workflowFormRef = ref()

const siteForm = reactive({
  siteName: '',
  siteDescription: '',
  logo: '',
  contactEmail: '',
  contactPhone: '',
  icp: '',
  copyright: ''
})

const aiForm = reactive({
  defaultModel: 'gpt-4',
  apiKey: '',
  apiBaseUrl: 'https://api.openai.com/v1',
  temperature: 0.7,
  maxTokens: 4096,
  streamEnabled: true,
  systemPrompt: ''
})

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
  publishTime: undefined as any
})

const logoFileList = ref<UploadProps['fileList']>([])

const siteRules = {
  siteName: [{ required: true, message: '请输入站点名称', trigger: 'blur' }],
  contactEmail: [
    { type: 'email' as const, message: '请输入有效的邮箱地址', trigger: 'blur' }
  ]
}

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
  return false
}

const fetchSettings = async () => {
  loading.value = true
  try {
    const result = await adminApi.settings.get(authStore.selectedTenantId || undefined) as any

    if (result.site) {
      const site = result.site as any
      siteForm.siteName = site.name || site.siteName || ''
      siteForm.siteDescription = site.description || site.siteDescription || ''
      siteForm.logo = site.logo || ''
      siteForm.contactEmail = site.contactEmail || ''
      siteForm.contactPhone = site.contactPhone || ''
      siteForm.icp = site.icp || ''
      siteForm.copyright = site.copyright || ''
    }

    if (result.ai) {
      const ai = result.ai as any
      aiForm.defaultModel = ai.defaultModel || ai.default_model || 'gpt-4'
      aiForm.apiKey = ai.apiKey || ai.api_key || ''
      aiForm.apiBaseUrl = ai.apiBaseUrl || ai.api_base_url || 'https://api.openai.com/v1'
      aiForm.temperature = Number(ai.temperature) || 0.7
      aiForm.maxTokens = Number(ai.maxTokens) || 4096
      aiForm.streamEnabled = Boolean(ai.streamEnabled) || Boolean(ai.stream_enabled) || true
      aiForm.systemPrompt = ai.systemPrompt || ai.system_prompt || ''
    }

    if (result.workflow) {
      const wf = result.workflow as any
      workflowForm.keywordCrawlInterval = wf.keywordCrawlInterval || wf.keyword_crawl_interval || 'daily'
      workflowForm.keywordCrawlLimit = Number(wf.keywordCrawlLimit) || Number(wf.keyword_crawl_limit) || 100
      workflowForm.autoCrawlEnabled = Boolean(wf.autoCrawlEnabled) || Boolean(wf.auto_crawl_enabled) || true
      workflowForm.clusterThreshold = Number(wf.clusterThreshold) || Number(wf.cluster_threshold) || 0.7
      workflowForm.minClusterSize = Number(wf.minClusterSize) || Number(wf.min_cluster_size) || 5
      workflowForm.autoGenerateEnabled = Boolean(wf.autoGenerateEnabled) || Boolean(wf.auto_generate_enabled) || false
      workflowForm.dailyGenerateLimit = Number(wf.dailyGenerateLimit) || Number(wf.daily_generate_limit) || 10
      workflowForm.autoReviewEnabled = Boolean(wf.autoReviewEnabled) || Boolean(wf.auto_review_enabled) || true
      workflowForm.autoPublishEnabled = Boolean(wf.autoPublishEnabled) || Boolean(wf.auto_publish_enabled) || false
      workflowForm.publishTime = wf.publishTime || wf.publish_time || undefined
    }
  } catch (error: any) {
    message.error(error.message || '获取系统设置失败')
  } finally {
    loading.value = false
  }
}

const saveSiteSettings = async () => {
  try {
    await siteFormRef.value?.validate()
    saving.value = true

    const siteData: SiteSettings = {
      name: siteForm.siteName,
      description: siteForm.siteDescription,
      logo: siteForm.logo,
      contactEmail: siteForm.contactEmail,
      contactPhone: siteForm.contactPhone,
      icp: siteForm.icp,
      copyright: siteForm.copyright
    }

    await adminApi.settings.update(
      { site: siteData },
      authStore.selectedTenantId || undefined
    )

    message.success('站点设置保存成功')
  } catch (error: any) {
    if (error.errorFields) {
      message.error('表单验证失败')
    } else {
      message.error(error.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

const resetSiteForm = () => {
  siteFormRef.value?.resetFields()
}

const saveAiSettings = async () => {
  try {
    saving.value = true

    const aiData: AiSettings = {
      defaultModel: aiForm.defaultModel,
      apiKey: aiForm.apiKey,
      apiBaseUrl: aiForm.apiBaseUrl,
      temperature: aiForm.temperature,
      maxTokens: aiForm.maxTokens,
      streamEnabled: aiForm.streamEnabled,
      systemPrompt: aiForm.systemPrompt
    }

    await adminApi.settings.update(
      { ai: aiData },
      authStore.selectedTenantId || undefined
    )

    message.success('AI配置保存成功')
  } catch (error: any) {
    message.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const testAiConnection = async () => {
  try {
    testing.value = true

    const aiConfig = {
      defaultModel: aiForm.defaultModel,
      apiKey: aiForm.apiKey,
      apiBaseUrl: aiForm.apiBaseUrl
    }

    const result = await adminApi.settings.testAiConnection(
      aiConfig,
      authStore.selectedTenantId || undefined
    ) as any

    if (result.success) {
      message.success(result.message || '连接测试成功')
    } else {
      message.error(result.message || '连接测试失败')
    }
  } catch (error: any) {
    message.error(error.message || '连接测试失败')
  } finally {
    testing.value = false
  }
}

const saveWorkflowSettings = async () => {
  try {
    saving.value = true

    const workflowData: WorkflowSettings = {
      keywordCrawlInterval: workflowForm.keywordCrawlInterval,
      keywordCrawlLimit: workflowForm.keywordCrawlLimit,
      autoCrawlEnabled: workflowForm.autoCrawlEnabled,
      clusterThreshold: workflowForm.clusterThreshold,
      minClusterSize: workflowForm.minClusterSize,
      autoGenerateEnabled: workflowForm.autoGenerateEnabled,
      dailyGenerateLimit: workflowForm.dailyGenerateLimit,
      autoReviewEnabled: workflowForm.autoReviewEnabled,
      autoPublishEnabled: workflowForm.autoPublishEnabled,
      publishTime: workflowForm.publishTime
    }

    await adminApi.settings.update(
      { workflow: workflowData },
      authStore.selectedTenantId || undefined
    )

    message.success('工作流配置保存成功')
  } catch (error: any) {
    message.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const resetWorkflowForm = () => {
  workflowFormRef.value?.resetFields()
}

watch(
  () => authStore.selectedTenantId,
  () => {
    fetchSettings()
  }
)

onMounted(() => {
  fetchSettings()
})
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
