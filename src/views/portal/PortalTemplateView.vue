<template>
  <div class="portal-template-container">
    <div class="header-wrapper">
      <a-page-header title="门户模板管理" sub-title="选择和定制您的门户网站风格">
        <template #extra>
          <a-space>
            <a-button type="primary" @click="refreshTemplates">
              <template #icon><ReloadOutlined /></template>
              刷新
            </a-button>
          </a-space>
        </template>
      </a-page-header>
    </div>

    <div class="content-wrapper">
      <a-row :gutter="16" class="stats-row">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon total">
                <AppstoreOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalTemplates }}</div>
                <div class="stat-label">可用模板总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon system">
                <SafetyOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.techTemplates }}</div>
                <div class="stat-label">科技企业型</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon custom">
                <EditOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.marketingTemplates }}</div>
                <div class="stat-label">营销服务型</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon active">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ currentTemplate?.name || '-' }}</div>
                <div class="stat-label">当前使用模板</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card class="filter-card">
        <a-space size="large" wrap>
          <a-radio-group v-model:value="filterType" button-style @change="handleFilterChange">
            <a-radio-button value="all">全部模板</a-radio-button>
            <a-radio-button value="tech">科技企业型</a-radio-button>
            <a-radio-button value="marketing">营销服务型</a-radio-button>
            <a-radio-button value="minimal">简约商务型</a-radio-button>
          </a-radio-group>
          <a-input-search
            v-model:value="searchKeyword"
            placeholder="搜索模板名称"
            style="width: 250px"
            @search="handleFilterChange"
          />
        </a-space>
      </a-card>

      <a-row :gutter="[24, 24]" class="templates-grid">
        <a-col :xs="24" :sm="12" :md="8" :lg="6" v-for="tpl in templates" :key="tpl.id">
          <a-card
            class="template-card"
            :class="{ active: isCurrentTemplate(tpl) }"
          >
            <div class="template-preview">
              <img :src="tpl.thumbnail" :alt="tpl.name" class="preview-image" />
              <div class="template-overlay">
                <a-space>
                  <a-button type="primary" size="small" @click="previewTemplate(tpl)">
                    <EyeOutlined /> 预览
                  </a-button>
                </a-space>
              </div>
              <a-tag v-if="tpl.isSystem" color="blue" class="system-tag">系统预设</a-tag>
              <a-tag v-if="isCurrentTemplate(tpl)" color="green" class="active-tag">使用中</a-tag>
            </div>
            <a-card-meta>
              <template #title>
                <div class="template-title">
                  <span>{{ tpl.name }}</span>
                  <a-tag :color="getTypeColor(tpl.type)" size="small">{{ getTypeName(tpl.type) }}</a-tag>
                </div>
              </template>
              <template #description>
                <p class="template-desc">{{ tpl.description }}</p>
                <div class="template-stats">
                  <span>{{ tpl.isSystem ? '系统预设' : '自定义模板' }}</span>
                </div>
              </template>
            </a-card-meta>
            <div class="template-actions">
              <a-button
                v-if="!isCurrentTemplate(tpl)"
                type="primary"
                block
                @click="applyTemplate(tpl)"
              >
                <CheckOutlined /> 应用模板
              </a-button>
              <a-button v-else type="primary" disabled block>
                <CheckCircleOutlined /> 已应用
              </a-button>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <div class="pagination-wrapper">
        <a-pagination
          v-model:current="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-size-options="['8', '16', '24', '40']"
          show-size-changer
          show-quick-jumper
          :show-total="(total: number) => `共 ${total} 条模板`"
          @change="handlePageChange"
          @showSizeChange="handlePageSizeChange"
        />
      </div>
    </div>

    <a-modal
      v-model:open="showPreviewModal"
      title="模板预览"
      :width="1200"
      :footer="null"
      class="preview-modal"
    >
      <div v-if="previewingTemplate" class="preview-content">
        <div class="preview-toolbar">
          <a-space>
            <a-button-group>
              <a-button @click="previewDevice = 'desktop'" :type="previewDevice === 'desktop' ? 'primary' : 'default'">
                <DesktopOutlined />
              </a-button>
              <a-button @click="previewDevice = 'tablet'" :type="previewDevice === 'tablet' ? 'primary' : 'default'">
                <TabletOutlined />
              </a-button>
              <a-button @click="previewDevice = 'mobile'" :type="previewDevice === 'mobile' ? 'primary' : 'default'">
                <MobileOutlined />
              </a-button>
            </a-button-group>
            <a-tag :color="getTypeColor(previewingTemplate.type)">{{ getTypeName(previewingTemplate.type) }}</a-tag>
          </a-space>
          <a-space>
            <a-button 
              type="primary" 
              :disabled="previewingTemplate && isCurrentTemplate(previewingTemplate)"
              @click="applyTemplate(previewingTemplate)"
            >
              <CheckOutlined /> 
              {{ previewingTemplate && isCurrentTemplate(previewingTemplate) ? '已应用' : '应用此模板' }}
            </a-button>
          </a-space>
        </div>
        <div class="preview-frame-wrapper" :class="previewDevice">
          <div class="preview-frame">
            <template-preview :template="previewingTemplate" />
          </div>
        </div>
      </div>
    </a-modal>

    <a-modal
      v-model:open="showConfigModal"
      title="模板配置"
      :width="900"
      @ok="saveTemplateConfig"
      ok-text="保存配置"
      cancel-text="取消"
    >
      <a-form v-if="editingTemplate" :model="configForm" layout="vertical">
        <a-tabs>
          <a-tab-pane key="colors" tab="配色方案">
            <a-row :gutter="24">
              <a-col :span="12">
                <a-form-item label="主色调">
                  <a-input v-model:value="configForm.colorConfig.primary" placeholder="#1890ff" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="辅助色">
                  <a-input v-model:value="configForm.colorConfig.secondary" placeholder="#722ed1" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="强调色">
                  <a-input v-model:value="configForm.colorConfig.accent" placeholder="#fa8c16" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="背景色">
                  <a-input v-model:value="configForm.colorConfig.background" placeholder="#f0f2f5" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-divider orientation="left">配色预览</a-divider>
            <div class="color-preview">
              <div class="color-swatch primary" :style="{ backgroundColor: configForm.colorConfig.primary }">主色</div>
              <div class="color-swatch secondary" :style="{ backgroundColor: configForm.colorConfig.secondary }">辅助色</div>
              <div class="color-swatch accent" :style="{ backgroundColor: configForm.colorConfig.accent }">强调色</div>
              <div class="color-swatch background" :style="{ backgroundColor: configForm.colorConfig.background }">背景</div>
            </div>
          </a-tab-pane>
          <a-tab-pane key="typography" tab="字体设置">
            <a-row :gutter="24">
              <a-col :span="12">
                <a-form-item label="标题字体">
                  <a-select v-model:value="configForm.fontConfig.headingFont">
                    <a-select-option value="Inter">Inter</a-select-option>
                    <a-select-option value="PingFang SC">苹方</a-select-option>
                    <a-select-option value="Microsoft YaHei">微软雅黑</a-select-option>
                    <a-select-option value="Noto Sans SC">Noto Sans SC</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="正文字体">
                  <a-select v-model:value="configForm.fontConfig.bodyFont">
                    <a-select-option value="Inter">Inter</a-select-option>
                    <a-select-option value="PingFang SC">苹方</a-select-option>
                    <a-select-option value="Microsoft YaHei">微软雅黑</a-select-option>
                    <a-select-option value="Noto Sans SC">Noto Sans SC</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="基础字号">
                  <a-slider v-model:value="configForm.fontConfig.baseFontSize" :min="12" :max="20" />
                </a-form-item>
              </a-col>
            </a-row>
          </a-tab-pane>
          <a-tab-pane key="layout" tab="布局设置">
            <a-row :gutter="24">
              <a-col :span="12">
                <a-form-item label="头部样式">
                  <a-radio-group v-model:value="configForm.layoutConfig.headerStyle">
                    <a-radio value="classic">经典</a-radio>
                    <a-radio value="modern">现代</a-radio>
                    <a-radio value="centered">居中</a-radio>
                  </a-radio-group>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="底部样式">
                  <a-radio-group v-model:value="configForm.layoutConfig.footerStyle">
                    <a-radio value="full">完整</a-radio>
                    <a-radio value="compact">紧凑</a-radio>
                    <a-radio value="minimal">极简</a-radio>
                  </a-radio-group>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="内容宽度">
                  <a-radio-group v-model:value="configForm.layoutConfig.contentWidth">
                    <a-radio value="full">全宽</a-radio>
                    <a-radio value="boxed">盒式</a-radio>
                    <a-radio value="narrow">窄版</a-radio>
                  </a-radio-group>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="侧边栏">
                  <a-switch v-model:checked="configForm.layoutConfig.sidebarEnabled" />
                </a-form-item>
              </a-col>
            </a-row>
          </a-tab-pane>
        </a-tabs>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="showCreateModal"
      title="新建模板"
      @ok="createTemplate"
      ok-text="创建"
      cancel-text="取消"
    >
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="模板名称" required>
          <a-input v-model:value="createForm.name" placeholder="请输入模板名称" />
        </a-form-item>
        <a-form-item label="模板类型" required>
          <a-select v-model:value="createForm.type">
            <a-select-option value="tech">科技企业型</a-select-option>
            <a-select-option value="marketing">营销服务型</a-select-option>
            <a-select-option value="minimal">简约商务型</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="模板描述">
          <a-textarea v-model:value="createForm.description" placeholder="请输入模板描述" :rows="3" />
        </a-form-item>
        <a-form-item label="基于模板复制">
          <a-select v-model:value="createForm.baseTemplateId" allow-clear placeholder="选择基础模板（可选）">
            <a-select-option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  AppstoreOutlined,
  SafetyOutlined,
  EditOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  CheckOutlined,
  DesktopOutlined,
  TabletOutlined,
  MobileOutlined
} from '@ant-design/icons-vue'
import { portalTemplateApi } from '../../api/portal'
import type { PortalTemplate, PortalTemplateForm } from '../../types/portal'
import type { Tenant } from '../../types/workspace'
import TemplatePreview from './TemplatePreview.vue'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const templates = ref<PortalTemplate[]>([])
const currentTemplate = ref<PortalTemplate | null>(null)
const filterType = ref<string>('all')
const searchKeyword = ref('')
const loading = ref(false)

const showPreviewModal = ref(false)
const showConfigModal = ref(false)
const showCreateModal = ref(false)
const previewingTemplate = ref<PortalTemplate | null>(null)
const editingTemplate = ref<PortalTemplate | null>(null)
const previewDevice = ref<'desktop' | 'tablet' | 'mobile'>('desktop')

const pagination = reactive({
  page: 1,
  size: 8,
  total: 0
})

const stats = reactive({
  totalTemplates: 0,
  techTemplates: 0,
  marketingTemplates: 0,
  minimalTemplates: 0
})

const configForm = reactive({
  name: '',
  type: 'tech' as string,
  description: '',
  colorConfig: {
    primary: '#1890ff',
    secondary: '#722ed1',
    accent: '#eb2f96',
    background: '#ffffff',
    text: '#000000',
    textSecondary: '#666666'
  },
  fontConfig: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    baseFontSize: 14
  },
  layoutConfig: {
    headerStyle: 'modern',
    footerStyle: 'full',
    sidebarEnabled: false,
    contentWidth: 'boxed'
  }
})

const createForm = reactive({
  name: '',
  type: 'tech' as string,
  description: '',
  baseTemplateId: undefined as number | undefined
})

const getTypeName = (type: string) => {
  const names: Record<string, string> = {
    tech: '科技企业型',
    marketing: '营销服务型',
    minimal: '简约商务型'
  }
  return names[type] || type
}

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    tech: 'blue',
    marketing: 'orange',
    minimal: 'purple'
  }
  return colors[type] || 'default'
}

const loadTemplates = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: pagination.page,
      size: pagination.size
    }
    if (filterType.value !== 'all') {
      params.type = filterType.value
    }
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }
    const result = await portalTemplateApi.list(params)
    templates.value = result.records || []
    pagination.total = result.total || 0
    updateStats(templates.value)
  } catch (error) {
    message.error('加载模板失败')
  } finally {
    loading.value = false
  }
}

const loadCurrentTemplate = async () => {
  if (!auth.selectedTenantId) return
  try {
    const result = await portalTemplateApi.getCurrentTemplate(auth.selectedTenantId)
    currentTemplate.value = result
  } catch (error) {
    currentTemplate.value = null
  }
}

const updateStats = (tplList: PortalTemplate[]) => {
  stats.totalTemplates = tplList.length
  stats.techTemplates = tplList.filter(t => t.type === 'tech').length
  stats.marketingTemplates = tplList.filter(t => t.type === 'marketing').length
  stats.minimalTemplates = tplList.filter(t => t.type === 'minimal').length
}

const refreshTemplates = async () => {
  pagination.page = 1
  await Promise.all([loadTemplates(), loadCurrentTemplate()])
  message.success('模板列表已刷新')
}

const handleFilterChange = () => {
  pagination.page = 1
  loadTemplates()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadTemplates()
}

const handlePageSizeChange = (_current: number, size: number) => {
  pagination.page = 1
  pagination.size = size
  loadTemplates()
}

const previewTemplate = (template: PortalTemplate) => {
  previewingTemplate.value = template
  showPreviewModal.value = true
}

const isCurrentTemplate = (template: PortalTemplate) => {
  if (!currentTemplate.value) return false
  return currentTemplate.value.code === template.code
}

const editTemplate = (template: PortalTemplate) => {
  editingTemplate.value = template
  configForm.name = template.name
  configForm.type = template.type
  configForm.description = template.description || ''
  // 从 configJson 解析配置
  if (template.configJson) {
    try {
      const config = JSON.parse(template.configJson)
      if (config.colorConfig) Object.assign(configForm.colorConfig, config.colorConfig)
      if (config.fontConfig) Object.assign(configForm.fontConfig, config.fontConfig)
      if (config.layoutConfig) Object.assign(configForm.layoutConfig, config.layoutConfig)
    } catch (e) {
      // configJson 解析失败，使用默认配置
    }
  }
  showConfigModal.value = true
}

const applyTemplate = async (template: PortalTemplate) => {
  if (!auth.selectedTenantId) {
    message.warning('请先选择租户')
    return
  }
  try {
    message.loading({ content: '正在应用模板...', key: 'apply' })
    await portalTemplateApi.apply(template.id, auth.selectedTenantId)
    currentTemplate.value = template
    showPreviewModal.value = false
    message.success({ content: `已成功应用「${template.name}」`, key: 'apply' })
  } catch (error) {
    message.error('应用模板失败')
  }
}

const saveTemplateConfig = async () => {
  if (!editingTemplate.value) return
  try {
    message.loading({ content: '正在保存配置...', key: 'save' })
    const configJson = JSON.stringify({
      colorConfig: configForm.colorConfig,
      fontConfig: configForm.fontConfig,
      layoutConfig: configForm.layoutConfig
    })
    await portalTemplateApi.update(editingTemplate.value.id, {
      name: configForm.name,
      description: configForm.description,
      configJson
    })
    showConfigModal.value = false
    message.success({ content: '模板配置已保存', key: 'save' })
    loadTemplates()
  } catch (error) {
    message.error('保存配置失败')
  }
}

const createTemplate = async () => {
  if (!createForm.name) {
    message.warning('请输入模板名称')
    return
  }
  try {
    message.loading({ content: '正在创建模板...', key: 'create' })
    await portalTemplateApi.create({
      name: createForm.name,
      type: createForm.type,
      description: createForm.description,
      configJson: JSON.stringify({
        colorConfig: configForm.colorConfig,
        fontConfig: configForm.fontConfig,
        layoutConfig: configForm.layoutConfig
      })
    })
    showCreateModal.value = false
    createForm.name = ''
    createForm.description = ''
    message.success({ content: '模板创建成功', key: 'create' })
    loadTemplates()
  } catch (error) {
    message.error('创建模板失败')
  }
}

onMounted(() => {
  const storedTenantId = localStorage.getItem('geocms_tenant_id')
  if (storedTenantId) {
    auth.selectedTenantId = Number(storedTenantId)
    loadTemplates()
    loadCurrentTemplate()
  }
})
</script>

<style lang="less" scoped>
.portal-template-container {
  padding: 0;
}

.header-wrapper {
  padding: 16px 24px 0;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.content-wrapper {
  padding: 24px;
}

.stats-row {
  margin-bottom: 24px;

  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: #fff;

      &.total {
        background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
      }
      &.system {
        background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
      }
      &.custom {
        background: linear-gradient(135deg, #722ed1 0%, #531dab 100%);
      }
      &.active {
        background: linear-gradient(135deg, #fa8c16 0%, #d46b08 100%);
      }
    }

    .stat-info {
      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: #262626;
        line-height: 1.2;
      }
      .stat-label {
        font-size: 13px;
        color: #8c8c8c;
        margin-top: 4px;
      }
    }
  }
}

.filter-card {
  margin-bottom: 24px;
}

.templates-grid {
  .template-card {
    transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    &.active {
      border: 2px solid #1890ff;
    }

    .template-preview {
      position: relative;
      margin: -16px -16px 16px;
      height: 180px;
      overflow: hidden;
      border-radius: 8px 8px 0 0;

      .preview-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .template-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s;
        z-index: 10;
        pointer-events: none;
      }

      &:hover .template-overlay {
        opacity: 1;
        pointer-events: auto;
      }

      .system-tag,
      .active-tag {
        position: absolute;
        top: 12px;
      }

      .system-tag {
        left: 12px;
      }

      .active-tag {
        right: 12px;
      }
    }

    .template-title {
      display: flex;
      align-items: center;
      gap: 8px;

      span {
        font-weight: 500;
      }
    }

    .template-desc {
      margin: 8px 0;
      color: #595959;
      font-size: 13px;
      line-height: 1.6;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .template-stats {
      font-size: 12px;
      color: #8c8c8c;
    }

    .template-actions {
      margin-top: 16px;
    }
  }
}

.preview-modal {
  :deep(.ant-modal-body) {
    padding: 0;
  }

  .preview-content {
    .preview-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #f0f0f0;
    }

    .preview-frame-wrapper {
      padding: 24px;
      background: #f5f5f5;
      display: flex;
      justify-content: center;

      &.desktop .preview-frame {
        width: 100%;
        max-width: 1000px;
      }
      &.tablet .preview-frame {
        width: 768px;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      }
      &.mobile .preview-frame {
        width: 375px;
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      }

      .preview-frame {
        background: #fff;
        min-height: 600px;
      }
    }
  }
}

.color-preview {
  display: flex;
  gap: 16px;

  .color-swatch {
    flex: 1;
    height: 80px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid #e8e8e8;
  }
}

.system-preset-tag {
  cursor: pointer;
  user-select: none;
  padding: 4px 12px;
  font-size: 14px;
  transition: all 0.3s;

  &:hover {
    opacity: 0.8;
  }
}

.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
</style>
