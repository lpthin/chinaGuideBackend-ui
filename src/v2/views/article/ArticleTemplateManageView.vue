<template>
  <div class="article-template-manage-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #eb2f96 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalCount }}</div>
                <div class="stat-title">总模板数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <SettingOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.systemCount }}</div>
                <div class="stat-title">系统模板</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <FireOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.hotKeywordCount }}</div>
                <div class="stat-title">热词模板</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <TrophyOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.caseCount }}</div>
                <div class="stat-title">案例模板</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <span>软文模板管理</span>
        </template>
        <template #extra>
          <a-space>
            <a-select
              v-model:value="queryParams.type"
              style="width: 140px"
              placeholder="模板类型"
              allowClear
              @change="loadTemplates"
            >
              <a-select-option
                v-for="t in typeOptions"
                :key="t.value"
                :value="t.value"
              >
                {{ t.label }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.category"
              style="width: 140px"
              placeholder="分类筛选"
              allowClear
              @change="loadTemplates"
            >
              <a-select-option
                v-for="c in categoryOptions"
                :key="c.value"
                :value="c.value"
              >
                {{ c.label }}
              </a-select-option>
            </a-select>
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索模板"
              style="width: 240px"
              enter-button
              @search="loadTemplates"
            />
            <a-radio-group v-model:value="viewMode" button-style="solid">
              <a-radio-button value="list">
                <template #icon><UnorderedListOutlined /></template>
                列表
              </a-radio-button>
              <a-radio-button value="card">
                <template #icon><AppstoreOutlined /></template>
                卡片
              </a-radio-button>
            </a-radio-group>
            <a-button type="primary" @click="openModal()">
              <template #icon><PlusOutlined /></template>
              新建模板
            </a-button>
          </a-space>
        </template>

        <div v-show="viewMode === 'list'">
          <a-table
            :columns="columns"
            :data-source="templateList"
            :pagination="paginationConfig"
            :row-key="record => record.id"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'type'">
                <a-tag :color="getTypeColor(record.type)">
                  {{ getTypeLabel(record.type) }}
                </a-tag>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'active' ? 'green' : 'default'">
                  {{ record.status === 'active' ? '启用' : '停用' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'useCount'">
                <span class="use-count">{{ record.useCount }} 次</span>
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="handleUse(record)">
                    使用
                  </a-button>
                  <a-button type="link" size="small" @click="handleClone(record)">
                    复制
                  </a-button>
                  <a-button type="link" size="small" @click="openModal(record)">
                    编辑
                  </a-button>
                  <a-button type="link" size="small" @click="viewVersions(record)">
                    版本
                  </a-button>
                  <a-popconfirm
                    title="确定要删除这个模板吗？"
                    @confirm="handleDelete(record.id)"
                  >
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>

        <div v-show="viewMode === 'card'" class="card-view">
          <a-row :gutter="16">
            <a-col :span="8" v-for="item in templateList" :key="item.id">
              <a-card class="template-card" hoverable :bordered="false">
                <div class="card-header">
                  <div class="card-title">{{ item.name }}</div>
                  <a-tag :color="getTypeColor(item.type)" class="card-type-tag">
                    {{ getTypeLabel(item.type) }}
                  </a-tag>
                </div>
                <div class="card-desc">{{ item.description }}</div>
                <div class="card-meta">
                  <span class="meta-item">
                    <span class="meta-label">版本：</span>
                    <span class="meta-value">v{{ item.version }}</span>
                  </span>
                  <span class="meta-item">
                    <span class="meta-label">使用：</span>
                    <span class="meta-value">{{ item.useCount }}次</span>
                  </span>
                </div>
                <div class="card-variables">
                  <span class="vars-label">变量：</span>
                  <a-tag
                    v-for="v in item.variables?.slice(0, 3)"
                    :key="v.name"
                    color="blue"
                    style="margin-bottom: 4px"
                  >
                    {{ v.label }}
                  </a-tag>
                  <span v-if="item.variables?.length > 3" class="more-vars">
                    +{{ item.variables.length - 3 }}
                  </span>
                </div>
                <div class="card-footer">
                  <a-space>
                    <a-button type="primary" size="small" @click="handleUse(item)">
                      使用模板
                    </a-button>
                    <a-button size="small" @click="openModal(item)">
                      编辑
                    </a-button>
                    <a-dropdown>
                      <a-button size="small">
                        <template #icon><MoreOutlined /></template>
                      </a-button>
                      <template #overlay>
                        <a-menu>
                          <a-menu-item @click="handleClone(item)">
                            <CopyOutlined /> 复制模板
                          </a-menu-item>
                          <a-menu-item @click="viewVersions(item)">
                            <HistoryOutlined /> 版本历史
                          </a-menu-item>
                          <a-menu-divider />
                          <a-menu-item danger @click="handleDelete(item.id)">
                            <DeleteOutlined /> 删除
                          </a-menu-item>
                        </a-menu>
                      </template>
                    </a-dropdown>
                  </a-space>
                </div>
              </a-card>
            </a-col>
          </a-row>
          <a-empty v-if="templateList.length === 0" description="暂无模板" />
        </div>
      </a-card>
    </a-spin>

    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑模板' : '新建模板'"
      :width="900"
      @ok="handleSubmit"
      @cancel="modalVisible = false"
      :confirm-loading="submitLoading"
      destroy-on-close
    >
      <a-form
        :model="formData"
        layout="vertical"
        ref="formRef"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-tabs v-model:activeKey="formTab">
          <a-tab-pane key="basic" tab="基础信息">
            <a-form-item label="模板名称" required>
              <a-input v-model:value="formData.name" placeholder="请输入模板名称" />
            </a-form-item>
            <a-form-item label="模板类型" required>
              <a-select v-model:value="formData.type" placeholder="请选择模板类型">
                <a-select-option
                  v-for="t in typeOptions"
                  :key="t.value"
                  :value="t.value"
                >
                  {{ t.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="模板分类" required>
              <a-select v-model:value="formData.category" placeholder="请选择分类">
                <a-select-option
                  v-for="c in categoryOptions"
                  :key="c.value"
                  :value="c.value"
                >
                  {{ c.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="模板描述">
              <a-textarea
                v-model:value="formData.description"
                placeholder="请输入模板描述"
                :rows="3"
              />
            </a-form-item>
            <a-form-item label="状态">
              <a-switch
                :checked="formData.status === 'active'"
                checked-children="启用"
                un-checked-children="停用"
              />
            </a-form-item>
          </a-tab-pane>
          <a-tab-pane key="content" tab="模板内容">
            <a-form-item label="模板内容">
              <a-textarea
                v-model:value="formData.content"
                placeholder="请输入模板内容，使用 {{变量名}} 格式插入变量"
                :rows="12"
                style="font-family: monospace"
              />
            </a-form-item>
            <div class="variable-tips">
              <span class="tips-label">可用变量：</span>
              <a-tag
                v-for="v in formData.variables"
                :key="v.name"
                color="blue"
                style="cursor: pointer"
                @click="insertVariable(v.name)"
              >
                {{ formatVar(v.name) }}
              </a-tag>
            </div>
          </a-tab-pane>
          <a-tab-pane key="variables" tab="变量配置">
            <a-button type="dashed" style="width: 100%; margin-bottom: 12px" @click="addVariable">
              <template #icon><PlusOutlined /></template>
              添加变量
            </a-button>
            <div v-for="(v, index) in formData.variables" :key="v.name" class="variable-item">
              <a-row :gutter="12">
                <a-col :span="5">
                  <a-input v-model:value="v.name" placeholder="变量名" />
                </a-col>
                <a-col :span="5">
                  <a-input v-model:value="v.label" placeholder="显示名称" />
                </a-col>
                <a-col :span="4">
                  <a-select v-model:value="v.type" placeholder="类型">
                    <a-select-option value="string">字符串</a-select-option>
                    <a-select-option value="number">数字</a-select-option>
                    <a-select-option value="boolean">布尔</a-select-option>
                    <a-select-option value="select">下拉选择</a-select-option>
                  </a-select>
                </a-col>
                <a-col :span="6">
                  <a-input v-model:value="v.defaultValue" placeholder="默认值" />
                </a-col>
                <a-col :span="2">
                  <a-checkbox v-model:checked="v.required">必填</a-checkbox>
                </a-col>
                <a-col :span="2">
                  <a-button type="text" danger @click="removeVariable(index)">
                    <DeleteOutlined />
                  </a-button>
                </a-col>
              </a-row>
            </div>
          </a-tab-pane>
          <a-tab-pane key="versions" tab="版本历史" v-if="isEdit">
            <a-timeline>
              <a-timeline-item
                v-for="ver in versionList"
                :key="ver.id"
                :color="ver.version === formData.version ? 'blue' : 'gray'"
              >
                <div class="version-item">
                  <div class="version-header">
                    <span class="version-tag">v{{ ver.version }}</span>
                    <span class="version-time">{{ ver.createdAt }}</span>
                    <span class="version-author">{{ ver.createdBy }}</span>
                  </div>
                  <div class="version-changelog">{{ ver.changelog }}</div>
                  <div class="version-actions">
                    <a-button type="link" size="small">
                      查看内容
                    </a-button>
                    <a-button type="link" size="small">
                      回滚到此版本
                    </a-button>
                  </div>
                </div>
              </a-timeline-item>
            </a-timeline>
            <a-empty v-if="versionList.length === 0" description="暂无版本历史" />
          </a-tab-pane>
        </a-tabs>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import {
  FileTextOutlined,
  SettingOutlined,
  FireOutlined,
  TrophyOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  MoreOutlined,
  CopyOutlined,
  HistoryOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import {
  articleTemplateApi,
  type ArticleTemplate,
  type ArticleTemplateForm,
  type TemplateStats,
  type TemplateVariable,
  type TemplateVersion,
} from '../../api/articleTemplate'

const authStore = useAuthStore()

const loading = ref(false)
const submitLoading = ref(false)
const modalVisible = ref(false)
const formTab = ref('basic')
const viewMode = ref<'list' | 'card'>('list')
const isEdit = ref(false)
const formRef = ref()

const stats = reactive<TemplateStats>({
  totalCount: 0,
  systemCount: 0,
  hotKeywordCount: 0,
  caseCount: 0,
  customCount: 0,
})

const typeOptions = ref([
  { value: 'hot_keyword', label: '热词模板' },
  { value: 'case', label: '案例模板' },
  { value: 'system', label: '系统模板' },
  { value: 'custom', label: '自定义' },
])

const categoryOptions = ref([
  { value: 'tech', label: '科技' },
  { value: 'finance', label: '财经' },
  { value: 'health', label: '健康' },
  { value: 'education', label: '教育' },
  { value: 'entertainment', label: '娱乐' },
  { value: 'general', label: '通用' },
])

const queryParams = reactive({
  type: null as string | null,
  category: null as string | null,
  keyword: '',
})

const paginationConfig = reactive({
  current: 1,
  pageSize: 12,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const templateList = ref<ArticleTemplate[]>([])
const versionList = ref<TemplateVersion[]>([])

const currentVersion = ref('')

const formData = reactive({
  name: '',
  type: 'custom',
  category: 'general',
  description: '',
  content: '',
  variables: [] as TemplateVariable[],
  status: 'active',
}) as ArticleTemplateForm & { status: string }

const columns = [
  { title: '模板名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '类型', key: 'type', width: 100 },
  { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
  { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
  { title: '使用次数', key: 'useCount', width: 100 },
  { title: '状态', key: 'status', width: 80 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 280 },
]

function getTypeColor(type: string): string {
  const map: Record<string, string> = {
    hot_keyword: 'orange',
    case: 'green',
    system: 'blue',
    custom: 'purple',
  }
  return map[type] || 'default'
}

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    hot_keyword: '热词模板',
    case: '案例模板',
    system: '系统模板',
    custom: '自定义',
  }
  return map[type] || type
}

async function loadStats() {
  try {
    const data = await articleTemplateApi.stats()
    Object.assign(stats, data)
  } catch (e) {
    console.error('加载统计数据失败', e)
  }
}

async function loadTemplates() {
  loading.value = true
  try {
    const data = await articleTemplateApi.list({
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      type: queryParams.type as any || undefined,
      category: queryParams.category || undefined,
      keyword: queryParams.keyword || undefined,
    })
    templateList.value = data.records
    paginationConfig.total = data.total
  } catch (e) {
    console.error('加载模板列表失败', e)
    message.error('加载模板列表失败')
  } finally {
    loading.value = false
  }
}

function openModal(record?: ArticleTemplate) {
  isEdit.value = !!record
  formTab.value = 'basic'
  if (record) {
    currentVersion.value = record.version
    formData.name = record.name
    formData.type = record.type
    formData.category = record.category
    formData.description = record.description
    formData.content = record.content
    formData.variables = JSON.parse(JSON.stringify(record.variables || []))
    formData.status = record.status
    loadVersions(record.id)
  } else {
    currentVersion.value = ''
    formData.name = ''
    formData.type = 'custom'
    formData.category = 'general'
    formData.description = ''
    formData.content = ''
    formData.variables = []
    formData.status = 'active'
    versionList.value = []
  }
  modalVisible.value = true
}

async function loadVersions(id: number) {
  try {
    const data = await articleTemplateApi.versions(id)
    versionList.value = data
  } catch (e) {
    console.error('加载版本历史失败', e)
  }
}

async function handleSubmit() {
  submitLoading.value = true
  try {
    if (isEdit.value) {
      message.success('模板更新成功')
    } else {
      message.success('模板创建成功')
    }
    modalVisible.value = false
    loadTemplates()
    loadStats()
  } catch (e) {
    message.error('保存失败')
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await articleTemplateApi.delete(id)
    message.success('删除成功')
    loadTemplates()
    loadStats()
  } catch (e) {
    message.error('删除失败')
  }
}

async function handleClone(record: ArticleTemplate) {
  try {
    const result = await articleTemplateApi.clone(record.id)
    message.success('复制成功')
    loadTemplates()
    loadStats()
  } catch (e) {
    message.error('复制失败')
  }
}

function handleUse(record: ArticleTemplate) {
  message.info(`使用模板：${record.name}`)
}

function viewVersions(record: ArticleTemplate) {
  openModal(record)
  formTab.value = 'versions'
}

function handleTableChange(pagination: any) {
  paginationConfig.current = pagination.current
  paginationConfig.pageSize = pagination.pageSize
  loadTemplates()
}

function addVariable() {
  const newVar: TemplateVariable = {
    name: `var${formData.variables.length + 1}`,
    label: `变量${formData.variables.length + 1}`,
    type: 'string',
    required: false,
    defaultValue: '',
    description: '',
  }
  formData.variables.push(newVar)
}

function removeVariable(index: number) {
  formData.variables.splice(index, 1)
}

function formatVar(name: string): string {
  return `{{${name}}}`
}

function insertVariable(name: string) {
  const textarea = document.querySelector('.ant-modal-body textarea') as HTMLTextAreaElement
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = `{{${name}}}`
    formData.content = formData.content.substring(0, start) + text + formData.content.substring(end)
  }
}

onMounted(async () => {
  await loadStats()
  await loadTemplates()
})

watch(() => authStore.selectedTenantId, () => {
  paginationConfig.current = 1
  loadStats()
  loadTemplates()
})
</script>

<style scoped lang="less">
.article-template-manage-page {
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

.use-count {
  color: #1890ff;
  font-weight: 500;
}

.card-view {
  padding-top: 16px;
}

.template-card {
  margin-bottom: 16px;
  border-radius: 12px;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.card-type-tag {
  flex-shrink: 0;
}

.card-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
}

.meta-label {
  color: #999;
}

.meta-value {
  color: #666;
  font-weight: 500;
}

.card-variables {
  margin-bottom: 16px;
  min-height: 32px;
}

.vars-label {
  font-size: 12px;
  color: #999;
  margin-right: 4px;
}

.more-vars {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}

.card-footer {
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.variable-tips {
  margin-top: 8px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.tips-label {
  font-size: 13px;
  color: #666;
  margin-right: 8px;
}

.variable-item {
  margin-bottom: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.version-item {
  padding: 8px 0;
}

.version-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.version-tag {
  font-weight: 600;
  color: #1890ff;
}

.version-time {
  font-size: 12px;
  color: #999;
}

.version-author {
  font-size: 12px;
  color: #666;
}

.version-changelog {
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.version-actions {
  display: flex;
  gap: 8px;
}
</style>
