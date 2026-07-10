<template>
  <div class="article-template-page">
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-card class="stat-card" hoverable>
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #eb2f96 100%)">
              <FileTextOutlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ totalTemplates }}</div>
              <div class="stat-title">模板总数</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card" hoverable>
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
              <EditOutlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ totalGenerated }}</div>
              <div class="stat-title">生成文章数</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card" hoverable>
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
              <FileDoneOutlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ todayGenerated }}</div>
              <div class="stat-title">今日生成</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card" hoverable>
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
              <ClockCircleOutlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ avgWordCount }}</div>
              <div class="stat-title">平均字数</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-card :bordered="false">
      <template #title>
        <div class="card-header">
          <span>软文模板管理</span>
        </div>
      </template>
      <template #extra>
        <a-space>
          <a-select
            v-model:value="filterCategory"
            style="width: 140px"
            placeholder="按分类筛选"
            allowClear
          >
            <a-select-option
              v-for="cat in categoryList"
              :key="cat.value"
              :value="cat.value"
            >
              {{ cat.label }}
            </a-select-option>
          </a-select>
          <a-input-search
            v-model:value="searchKeyword"
            placeholder="搜索模板名称"
            style="width: 240px"
            enter-button
            @search="loadTemplates"
          />
          <a-button type="primary" @click="openModal()">
            <template #icon><PlusOutlined /></template>
            新建模板
          </a-button>
        </a-space>
      </template>

      <a-table
        :columns="columns"
        :data-source="templateList"
        :loading="loading"
        :pagination="pagination"
        :row-key="(record: any) => record.id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'category'">
            <a-tag :color="getCategoryColor(record.category)">
              {{ getCategoryLabel(record.category) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'useCount'">
            <span class="use-count">{{ record.useCount }}</span>
          </template>
          <template v-if="column.key === 'isActive'">
            <a-switch
              v-model:checked="record.isActive"
              :disabled="record.isSystem"
              @change="toggleStatus(record.id)"
            />
          </template>
          <template v-if="column.key === 'isSystem'">
            <span v-if="record.isSystem" class="system-badge">系统</span>
            <span v-else class="custom-badge">自定义</span>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="generateArticle(record)">
                <template #icon><ThunderboltOutlined /></template>
                生成
              </a-button>
              <a-button type="link" size="small" @click="openModal(record)">
                <template #icon><EditOutlined /></template>
                编辑
              </a-button>
              <a-button type="link" size="small" @click="copyTemplate(record.id)">
                <template #icon><CopyOutlined /></template>
                复制
              </a-button>
              <a-popconfirm
                title="确定要删除这个模板吗？"
                @confirm="deleteTemplate(record.id)"
              >
                <a-button type="link" size="small" danger :disabled="record.isSystem">
                  <template #icon><DeleteOutlined /></template>
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="editingTemplate ? '编辑模板' : '新建模板'"
      :width="800"
      :confirm-loading="modalLoading"
      @ok="handleSubmit"
      @cancel="modalVisible = false"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="模板名称" name="name">
              <a-input v-model:value="formData.name" placeholder="请输入模板名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="模板分类" name="category">
              <a-select v-model:value="formData.category" placeholder="请选择分类">
                <a-select-option
                  v-for="cat in categoryList"
                  :key="cat.value"
                  :value="cat.value"
                >
                  {{ cat.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="模板描述" name="description">
          <a-textarea
            v-model:value="formData.description"
            placeholder="请输入模板描述"
            :rows="2"
          />
        </a-form-item>

        <a-form-item label="使用模型" name="modelConfigId">
          <a-select v-model:value="formData.modelConfigId" placeholder="请选择生成模型">
            <a-select-option
              v-for="model in modelList"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="模板内容" name="content">
          <div class="editor-toolbar">
            <a-button size="small" @click="insertVariable">
              <template #icon><FunctionOutlined /></template>
              插入变量
            </a-button>
            <span class="editor-hint">使用 &#123;&#123;变量名&#125;&#125; 格式定义变量</span>
          </div>
          <a-textarea
            v-model:value="formData.content"
            placeholder="请输入模板内容，使用 &#123;&#123;变量名&#125;&#125; 插入动态内容"
            :rows="8"
            class="template-editor"
          />
        </a-form-item>

        <a-divider>变量配置</a-divider>

        <a-table
          :columns="variableColumns"
          :data-source="formData.variables"
          :pagination="false"
          size="small"
          row-key="key"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'key'">
              <a-input
                v-model:value="record.key"
                size="small"
                placeholder="变量名"
              />
            </template>
            <template v-if="column.key === 'label'">
              <a-input
                v-model:value="record.label"
                size="small"
                placeholder="显示名称"
              />
            </template>
            <template v-if="column.key === 'type'">
              <a-select v-model:value="record.type" size="small" style="width: 100%">
                <a-select-option value="text">文本</a-select-option>
                <a-select-option value="textarea">多行文本</a-select-option>
                <a-select-option value="select">下拉选择</a-select-option>
                <a-select-option value="number">数字</a-select-option>
                <a-select-option value="date">日期</a-select-option>
              </a-select>
            </template>
            <template v-if="column.key === 'required'">
              <a-switch v-model:checked="record.required" size="small" />
            </template>
            <template v-if="column.key === 'defaultValue'">
              <a-input
                v-model:value="record.defaultValue"
                size="small"
                placeholder="默认值"
              />
            </template>
            <template v-if="column.key === 'action'">
              <a-button
                type="text"
                size="small"
                danger
                @click="removeVariable(index)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </template>
          </template>
        </a-table>

        <a-button type="dashed" style="width: 100%; margin-top: 12px" @click="addVariable">
          <template #icon><PlusOutlined /></template>
          添加变量
        </a-button>

        <a-form-item style="margin-top: 16px; margin-bottom: 0">
          <a-switch v-model:checked="formData.isActive" />
          <span style="margin-left: 8px">启用模板</span>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="generateModalVisible"
      title="生成文章"
      :width="700"
      :footer="null"
      @cancel="generateModalVisible = false"
    >
      <a-form
        ref="generateFormRef"
        :model="generateFormData"
        :rules="generateFormRules"
        layout="vertical"
      >
        <a-form-item
          v-for="variable in selectedTemplate?.variables"
          :key="variable.key"
          :label="variable.label"
          :name="variable.key"
        >
          <a-input
            v-if="variable.type === 'text'"
            v-model:value="generateFormData[variable.key]"
            :placeholder="variable.placeholder || `请输入${variable.label}`"
          />
          <a-textarea
            v-else-if="variable.type === 'textarea'"
            v-model:value="generateFormData[variable.key]"
            :placeholder="variable.placeholder || `请输入${variable.label}`"
            :rows="4"
          />
          <a-select
            v-else-if="variable.type === 'select'"
            v-model:value="generateFormData[variable.key]"
            :placeholder="variable.placeholder || `请选择${variable.label}`"
          >
            <a-select-option
              v-for="opt in variable.options"
              :key="opt"
              :value="opt"
            >
              {{ opt }}
            </a-select-option>
          </a-select>
          <a-input-number
            v-else-if="variable.type === 'number'"
            v-model:value="generateFormData[variable.key]"
            style="width: 100%"
            :placeholder="variable.placeholder || `请输入${variable.label}`"
          />
          <a-date-picker
            v-else-if="variable.type === 'date'"
            v-model:value="generateFormData[variable.key]"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            :loading="generating"
            @click="handleGenerate"
            style="width: 100%"
          >
            <template #icon><ThunderboltOutlined /></template>
            开始生成
          </a-button>
        </a-form-item>
      </a-form>

      <div v-if="generatedContent" class="generated-result">
        <a-divider>生成结果</a-divider>
        <div class="result-stats">
          <a-tag color="blue">字数: {{ generateResult.wordCount }}</a-tag>
          <a-tag color="green">Token: {{ generateResult.tokensUsed }}</a-tag>
          <a-tag color="purple">费用: ¥{{ generateResult.cost.toFixed(4) }}</a-tag>
          <a-tag color="orange">耗时: {{ generateResult.duration }}ms</a-tag>
        </div>
        <div class="result-content">{{ generatedContent }}</div>
        <div class="result-actions">
          <a-space>
            <a-button @click="copyContent">
              <template #icon><CopyOutlined /></template>
              复制内容
            </a-button>
            <a-button type="primary" @click="downloadContent">
              <template #icon><DownloadOutlined /></template>
              下载文本
            </a-button>
          </a-space>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import {
  FileTextOutlined,
  EditOutlined,
  FileDoneOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  DeleteOutlined,
  CodeOutlined,
  DownloadOutlined,
  FunctionOutlined,
} from '@ant-design/icons-vue'
import { articleTemplateApi, modelConfigApi, aiGenerateApi } from '../../api/ai-model'
import type {
  ArticleTemplate,
  ArticleTemplateForm,
  ArticleTemplateVariable,
  ArticleTemplateCategory,
} from '../../types/ai-model'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const getTenantId = () => authStore.selectedTenantId || authStore.tenantId || 1

const loading = ref(false)
const modalVisible = ref(false)
const modalLoading = ref(false)
const generateModalVisible = ref(false)
const generating = ref(false)

const totalTemplates = ref(12)
const totalGenerated = ref(1568)
const todayGenerated = ref(42)
const avgWordCount = ref(856)

const searchKeyword = ref('')
const filterCategory = ref<ArticleTemplateCategory | undefined>()

const templateList = ref<ArticleTemplate[]>([
  {
    id: 1,
    tenantId: getTenantId(),
    name: '产品推广文案',
    category: 'marketing' as ArticleTemplateCategory,
    description: '用于新产品发布的营销推广文案模板',
    content: '今天为大家介绍我们的新产品{{productName}}，这是一款针对{{targetAudience}}的{{productType}}。',
    variables: [
      { key: 'productName', label: '产品名称', type: 'text', required: true },
      { key: 'targetAudience', label: '目标受众', type: 'text', required: true },
      { key: 'productType', label: '产品类型', type: 'text', required: true },
    ],
    isSystem: true,
    isActive: true,
    useCount: 356,
    createdAt: '2024-01-15 10:00:00',
    updatedAt: '2024-01-15 10:00:00',
  },
  {
    id: 2,
    tenantId: getTenantId(),
    name: '新闻资讯模板',
    category: 'news' as ArticleTemplateCategory,
    description: '企业新闻和资讯发布的标准模板',
    content: '{{date}}，我们很高兴地宣布{{newsSubject}}。此次{{newsType}}将为{{stakeholder}}带来{{benefit}}。',
    variables: [
      { key: 'date', label: '发布日期', type: 'date', required: true },
      { key: 'newsSubject', label: '新闻主题', type: 'textarea', required: true },
      { key: 'newsType', label: '新闻类型', type: 'select', required: true, options: ['合作', '发布', '融资', '获奖'] },
      { key: 'stakeholder', label: '受众群体', type: 'text', required: true },
      { key: 'benefit', label: '带来价值', type: 'textarea', required: true },
    ],
    isSystem: true,
    isActive: true,
    useCount: 243,
    createdAt: '2024-01-15 10:00:00',
    updatedAt: '2024-01-15 10:00:00',
  },
  {
    id: 3,
    tenantId: getTenantId(),
    name: '品牌故事模板',
    category: 'brand' as ArticleTemplateCategory,
    description: '讲述品牌发展历程和理念的模板',
    content: '{{brandName}}成立于{{foundingYear}}年，一直致力于{{mission}}。',
    variables: [
      { key: 'brandName', label: '品牌名称', type: 'text', required: true },
      { key: 'foundingYear', label: '创立年份', type: 'number', required: true },
      { key: 'mission', label: '品牌使命', type: 'textarea', required: true },
    ],
    isSystem: false,
    isActive: true,
    useCount: 89,
    createdAt: '2024-02-20 14:30:00',
    updatedAt: '2024-02-20 14:30:00',
  },
])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 3,
})

const categoryList = [
  { value: 'marketing', label: '营销推广' },
  { value: 'news', label: '新闻资讯' },
  { value: 'product', label: '产品介绍' },
  { value: 'brand', label: '品牌宣传' },
  { value: 'case_study', label: '案例分析' },
  { value: 'industry', label: '行业分析' },
  { value: 'announcement', label: '公告通知' },
  { value: 'custom', label: '自定义' },
]

const modelList = ref([
  { id: 1, name: '通义千问 - 默认' },
  { id: 2, name: 'GPT-4 - 高级版' },
  { id: 3, name: '文心一言 - 标准' },
])

const getCategoryColor = (category: string) => {
  const colorMap: Record<string, string> = {
    marketing: 'purple',
    news: 'blue',
    product: 'cyan',
    brand: 'gold',
    case_study: 'green',
    industry: 'orange',
    announcement: 'red',
    custom: 'default',
  }
  return colorMap[category] || 'default'
}

const getCategoryLabel = (category: string) => {
  const found = categoryList.find(c => c.value === category)
  return found ? found.label : category
}

const columns = [
  { title: '模板名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '分类', key: 'category', width: 120 },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '使用次数', key: 'useCount', width: 100 },
  { title: '类型', key: 'isSystem', width: 80 },
  { title: '状态', key: 'isActive', width: 80 },
  { title: '操作', key: 'action', width: 240, fixed: 'right' as const },
]

const variableColumns = [
  { title: '变量名', key: 'key', width: 120 },
  { title: '显示名称', key: 'label', width: 120 },
  { title: '类型', key: 'type', width: 100 },
  { title: '必填', key: 'required', width: 70, align: 'center' as const },
  { title: '默认值', key: 'defaultValue', width: 120 },
  { title: '操作', key: 'action', width: 60 },
]

const formRef = ref<FormInstance>()
const editingTemplate = ref<ArticleTemplate | null>(null)

const formData = reactive<ArticleTemplateForm>({
  name: '',
  category: 'marketing' as ArticleTemplateCategory,
  description: '',
  content: '',
  variables: [],
  modelConfigId: undefined,
  isActive: true,
})

const formRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  content: [{ required: true, message: '请输入模板内容', trigger: 'blur' }],
}

const openModal = (record?: ArticleTemplate) => {
  editingTemplate.value = record || null
  if (record) {
    formData.name = record.name
    formData.category = record.category
    formData.description = record.description || ''
    formData.content = record.content
    formData.variables = [...record.variables]
    formData.modelConfigId = record.modelConfigId
    formData.isActive = record.isActive
  } else {
    formData.name = ''
    formData.category = 'marketing' as ArticleTemplateCategory
    formData.description = ''
    formData.content = ''
    formData.variables = []
    formData.modelConfigId = undefined
    formData.isActive = true
  }
  modalVisible.value = true
}

const addVariable = () => {
  formData.variables.push({
    key: '',
    label: '',
    type: 'text',
    required: true,
    defaultValue: '',
  })
}

const removeVariable = (index: number) => {
  formData.variables.splice(index, 1)
}

const insertVariable = () => {
  const selectedVar = formData.variables[0]
  if (selectedVar && selectedVar.key) {
    formData.content += `{{${selectedVar.key}}}`
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    modalLoading.value = true
    message.success(editingTemplate.value ? '更新成功' : '创建成功')
    modalVisible.value = false
  } catch (error) {
    console.error('Validation failed:', error)
  } finally {
    modalLoading.value = false
  }
}

const toggleStatus = async (id: number) => {
  message.success('状态已更新')
}

const copyTemplate = async (id: number) => {
  message.success('模板已复制')
}

const deleteTemplate = async (id: number) => {
  message.success('删除成功')
}

// TODO: 接入真实的模板列表 API
const loadTemplates = () => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 500)
}

const handleTableChange = (pag: any) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadTemplates()
}

const generateFormRef = ref<FormInstance>()
const selectedTemplate = ref<ArticleTemplate | null>(null)
const generateFormData = reactive<Record<string, any>>({})
const generatedContent = ref('')
const generateResult = reactive({
  wordCount: 0,
  tokensUsed: 0,
  cost: 0,
  duration: 0,
})

const generateFormRules = computed(() => {
  const rules: Record<string, any> = {}
  selectedTemplate.value?.variables.forEach(v => {
    if (v.required) {
      rules[v.key] = [{ required: true, message: `请输入${v.label}`, trigger: 'blur' }]
    }
  })
  return rules
})

const generateArticle = (record: ArticleTemplate) => {
  selectedTemplate.value = record
  generateFormData.value = {}
  generatedContent.value = ''
  record.variables.forEach(v => {
    generateFormData[v.key] = v.defaultValue || ''
  })
  generateModalVisible.value = true
}

const handleGenerate = async () => {
  try {
    await generateFormRef.value?.validate()
    generating.value = true

    let prompt = selectedTemplate.value?.content || ''
    const variables: Record<string, string> = {}
    Object.entries(generateFormData).forEach(([key, value]) => {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value || ''))
      variables[key] = String(value || '')
    })

    const result = await aiGenerateApi.generateArticle({
      prompt,
      templateId: selectedTemplate.value?.id,
      tenantId: getTenantId(),
    })

    generatedContent.value = result.content
    generateResult.wordCount = result.wordCount
    generateResult.tokensUsed = result.tokensUsed
    generateResult.cost = result.cost
    generateResult.duration = result.duration
    message.success('生成成功')
  } catch (error: any) {
    console.error('Generate failed:', error)
    message.error(error?.message || '生成失败，请重试')
  } finally {
    generating.value = false
  }
}

const copyContent = () => {
  navigator.clipboard.writeText(generatedContent.value)
  message.success('已复制到剪贴板')
}

const downloadContent = () => {
  const blob = new Blob([generatedContent.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `generated-article-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
  message.success('下载成功')
}

onMounted(async () => {
  try {
    const models = await modelConfigApi.list({ tenantId: getTenantId(), isActive: true })
  } catch (error) {
    console.error('Failed to load models:', error)
  }
})
</script>

<style scoped lang="less">
.article-template-page {
  padding: 20px;
}

.card-header {
  font-size: 16px;
  font-weight: 500;
}

.stat-card {
  .stat-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
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
    font-size: 22px;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.2;
  }

  .stat-title {
    font-size: 13px;
    color: #6b7280;
    margin-top: 4px;
  }
}

.use-count {
  font-weight: 600;
  color: #1890ff;
}

.system-badge {
  color: #52c41a;
  font-size: 12px;
}

.custom-badge {
  color: #722ed1;
  font-size: 12px;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;

  .editor-hint {
    font-size: 12px;
    color: #9ca3af;
  }
}

.template-editor {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.generated-result {
  .result-stats {
    margin-bottom: 16px;
  }

  .result-content {
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
    line-height: 1.8;
    white-space: pre-wrap;
    max-height: 400px;
    overflow-y: auto;
  }

  .result-actions {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>