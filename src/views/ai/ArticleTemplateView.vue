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
              <div class="stat-value">{{ systemCount }}</div>
              <div class="stat-title">系统模板</div>
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
              <div class="stat-value">{{ customCount }}</div>
              <div class="stat-title">自定义模板</div>
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
              <div class="stat-value">{{ activeCount }}</div>
              <div class="stat-title">启用中</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-card :bordered="false">
      <template #title>
        <div class="card-header">
          <span>生成模板管理</span>
        </div>
      </template>
      <template #extra>
        <a-space>
          <a-select
            v-model:value="filterCategory"
            style="width: 140px"
            placeholder="按分类筛选"
            allowClear
            @change="handleSearch"
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
            @search="handleSearch"
          />
          <a-button type="primary" @click="openModal()">
            <template #icon><PlusOutlined /></template>
            新建模板
          </a-button>
        </a-space>
      </template>

      <a-table
        :scroll="{ x: 'max-content' }"
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
          <template v-if="column.key === 'isActive'">
            <a-switch
              v-model:checked="record.isActive"
              :disabled="record.isSystem"
              @change="toggleStatus(record)"
            />
          </template>
          <template v-if="column.key === 'isSystem'">
            <span v-if="record.isSystem" class="system-badge">系统</span>
            <span v-else class="custom-badge">自定义</span>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
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
          :scroll="{ x: 'max-content' }"
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
  CopyOutlined,
  DeleteOutlined,
  FunctionOutlined,
} from '@ant-design/icons-vue'
import { articleTemplateApi } from '../../api/ai-model'
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

const totalTemplates = ref(0)
const systemCount = ref(0)
const customCount = ref(0)
const activeCount = ref(0)

const searchKeyword = ref('')
const filterCategory = ref<ArticleTemplateCategory | string | undefined>()

function parseVariables(json?: string): ArticleTemplateVariable[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const templateList = ref<ArticleTemplate[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
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

const formData = reactive<Omit<ArticleTemplateForm, 'variables'> & { variables: ArticleTemplateVariable[] }>({
  name: '',
  category: 'marketing',
  description: '',
  content: '',
  variables: [],
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
    formData.variables = parseVariables(record.variables)
    formData.isActive = record.isActive
  } else {
    formData.name = ''
    formData.category = 'marketing'
    formData.description = ''
    formData.content = ''
    formData.variables = []
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

const buildPayload = (): ArticleTemplateForm => ({
  name: formData.name,
  category: formData.category,
  description: formData.description,
  content: formData.content,
  variables: JSON.stringify(formData.variables.filter(v => v.key)),
  isActive: formData.isActive,
})

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  modalLoading.value = true
  try {
    if (editingTemplate.value) {
      await articleTemplateApi.update(editingTemplate.value.id, buildPayload())
      message.success('更新成功')
    } else {
      await articleTemplateApi.create(getTenantId(), buildPayload())
      message.success('创建成功')
    }
    modalVisible.value = false
    await loadTemplates()
  } catch (error: any) {
    console.error('保存模板失败:', error)
    message.error(error?.message || '保存模板失败')
  } finally {
    modalLoading.value = false
  }
}

const toggleStatus = async (record: ArticleTemplate) => {
  try {
    await articleTemplateApi.toggleStatus(record.id)
    message.success('状态已更新')
    await loadStats()
  } catch (error: any) {
    record.isActive = !record.isActive
    message.error(error?.message || '状态切换失败')
  }
}

const copyTemplate = async (id: number) => {
  try {
    await articleTemplateApi.copy(id)
    message.success('模板已复制')
    await loadTemplates()
  } catch (error: any) {
    console.error('复制模板失败:', error)
    message.error(error?.message || '复制模板失败')
  }
}

const deleteTemplate = async (id: number) => {
  try {
    await articleTemplateApi.delete(id)
    message.success('删除成功')
    await loadTemplates()
  } catch (error: any) {
    console.error('删除模板失败:', error)
    message.error(error?.message || '删除模板失败')
  }
}

const loadTemplates = async () => {
  loading.value = true
  try {
    const result = await articleTemplateApi.list({
      tenantId: getTenantId(),
      page: pagination.current,
      size: pagination.pageSize,
      category: filterCategory.value,
      keyword: searchKeyword.value || undefined,
    })
    templateList.value = result.records || []
    pagination.total = result.total || 0
  } catch (error: any) {
    console.error('加载模板列表失败:', error)
    message.error(error?.message || '加载模板列表失败')
    templateList.value = []
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const result = await articleTemplateApi.list({ tenantId: getTenantId(), page: 1, size: 1000 })
    const all = result.records || []
    totalTemplates.value = result.total ?? all.length
    systemCount.value = all.filter(t => t.isSystem).length
    customCount.value = all.filter(t => !t.isSystem).length
    activeCount.value = all.filter(t => t.isActive).length
  } catch (error) {
    console.error('加载模板统计失败:', error)
  }
}

const handleSearch = () => {
  pagination.current = 1
  loadTemplates()
}

const handleTableChange = (pag: any) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadTemplates()
}

onMounted(() => {
  loadTemplates()
  loadStats()
})
</script>

<style scoped lang="less">
.article-template-page {
  width: 100%;
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