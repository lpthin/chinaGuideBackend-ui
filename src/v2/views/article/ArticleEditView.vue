<template>
  <div class="article-edit-page">
    <a-spin :spinning="loading">
      <a-page-header
        :title="isEdit ? '编辑文章' : '新建文章'"
        @back="goBack"
      >
        <template #extra>
          <a-space>
            <a-button :loading="savingDraft" @click="handleSaveDraft">保存草稿</a-button>
            <a-button type="primary" :loading="submittingReview" @click="handleSubmitReview">
              提交审核
            </a-button>
            <a-dropdown>
              <a-button>
                更多操作
                <template #icon><DownOutlined /></template>
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="preview" @click="handlePreview">
                    <EyeOutlined /> 预览文章
                  </a-menu-item>
                  <a-menu-divider v-if="articleForm.status === 'approved'" />
                  <a-menu-item key="publish" v-if="articleForm.status === 'approved'" @click="handlePublish">
                    <RocketOutlined /> 发布文章
                  </a-menu-item>
                  <a-menu-divider v-if="isEdit" />
                  <a-menu-item key="delete" v-if="isEdit" @click="handleDelete" danger>
                    <DeleteOutlined /> 删除文章
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <a-button type="primary" v-if="articleForm.status === 'approved'" :loading="publishing" @click="handlePublish">
              发布文章
            </a-button>
          </a-space>
        </template>
      </a-page-header>

      <a-row :gutter="24" style="margin-top: 16px">
        <a-col :span="18">
          <a-card :bordered="false">
            <a-form layout="vertical" :model="articleForm">
              <a-form-item label="文章标题" required>
                <a-input
                  v-model:value="articleForm.title"
                  placeholder="请输入文章标题"
                  size="large"
                  :maxlength="100"
                  show-count
                />
              </a-form-item>

              <a-form-item label="文章摘要">
                <a-textarea
                  v-model:value="articleForm.summary"
                  placeholder="请输入文章摘要，建议150-200字"
                  :rows="3"
                  :maxlength="500"
                  show-count
                />
              </a-form-item>

              <a-form-item label="文章内容" required>
                <div class="editor-container">
                  <div class="editor-toolbar">
                    <a-space>
                      <a-button size="small" @click="formatText('bold')">
                        <BoldOutlined />
                      </a-button>
                      <a-button size="small" @click="formatText('italic')">
                        <ItalicOutlined />
                      </a-button>
                      <a-button size="small" @click="formatText('underline')">
                        <UnderlineOutlined />
                      </a-button>
                      <a-divider type="vertical" />
                      <a-button size="small" @click="formatText('h1')">H1</a-button>
                      <a-button size="small" @click="formatText('h2')">H2</a-button>
                      <a-button size="small" @click="formatText('h3')">H3</a-button>
                      <a-divider type="vertical" />
                      <a-button size="small" @click="formatText('ul')">
                        <UnorderedListOutlined />
                      </a-button>
                      <a-button size="small" @click="formatText('ol')">
                        <OrderedListOutlined />
                      </a-button>
                      <a-divider type="vertical" />
                      <a-button size="small" @click="handleInsertImage">
                        <PictureOutlined />
                      </a-button>
                      <a-button size="small" @click="handleInsertLink">
                        <LinkOutlined />
                      </a-button>
                      <a-divider type="vertical" />
                      <a-button size="small" @click="handlePreview">
                        <EyeOutlined />
                      </a-button>
                      <a-button size="small" @click="handleFullscreen">
                        <FullscreenOutlined />
                      </a-button>
                    </a-space>
                  </div>
                  <textarea
                    v-model="articleForm.content"
                    class="editor-textarea"
                    placeholder="请输入文章内容..."
                    rows="25"
                  ></textarea>
                </div>
              </a-form-item>
            </a-form>
          </a-card>
        </a-col>

        <a-col :span="6">
          <a-card title="发布设置" :bordered="false">
            <a-form layout="vertical" :model="articleForm">
              <a-form-item label="文章状态">
                <a-tag :color="statusColor" class="status-tag">{{ statusText }}</a-tag>
                <div class="status-flow-desc">
                  <a-steps :current="statusStepIndex" size="small" direction="vertical" class="status-steps">
                    <a-step title="草稿" description="编辑中，可随时保存" />
                    <a-step title="审核中" description="已提交，等待审核" />
                    <a-step title="已通过" description="审核通过，可发布" />
                    <a-step title="已发布" description="文章已上线" />
                  </a-steps>
                </div>
                <div v-if="articleForm.status === 'rejected'" class="reject-reason">
                  <a-alert type="error" show-icon message="审核未通过">
                    <template #description>
                      {{ rejectReason || '请修改后重新提交审核' }}
                    </template>
                  </a-alert>
                </div>
              </a-form-item>

              <a-form-item label="文章分类" required>
                <a-select
                  v-model:value="articleForm.categoryId"
                  style="width: 100%"
                  placeholder="选择分类"
                >
                  <a-select-option v-for="cat in categoryList" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="文章标签">
                <a-select
                  v-model:value="selectedTags"
                  mode="tags"
                  style="width: 100%"
                  placeholder="输入标签后按回车"
                >
                  <a-select-option v-for="tag in hotTags" :key="tag">{{ tag }}</a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="封面图片">
                <a-upload
                  v-model:file-list="coverFileList"
                  list-type="picture-card"
                  :before-upload="beforeUpload"
                  :max-count="1"
                  accept="image/*"
                >
                  <div>
                    <PlusOutlined />
                    <div style="margin-top: 8px">上传封面</div>
                  </div>
                </a-upload>
                <div class="form-tip">建议尺寸：1200x600px</div>
              </a-form-item>

              <a-form-item label="文章来源">
                <a-input v-model:value="articleForm.source" placeholder="原创/转载/翻译等" />
              </a-form-item>

              <a-form-item label="作者">
                <a-input v-model:value="articleForm.author" placeholder="请输入作者名" />
              </a-form-item>

              <a-form-item label="发布时间">
                <a-date-picker
                  v-model:value="publishDate"
                  show-time
                  style="width: 100%"
                  placeholder="选择发布时间"
                />
              </a-form-item>

              <a-form-item label="是否置顶">
                <a-switch v-model:value="articleForm.isTop" />
              </a-form-item>

              <a-form-item label="是否推荐">
                <a-switch v-model:value="articleForm.isRecommend" />
              </a-form-item>
            </a-form>
          </a-card>

          <a-card title="SEO设置" :bordered="false" style="margin-top: 16px">
            <template #extra>
              <a-button size="small" type="link" :loading="generatingSeo" @click="handleGenerateSeo">
                <BulbOutlined /> 智能生成
              </a-button>
            </template>
            <a-form layout="vertical" :model="seoForm">
              <a-form-item label="SEO标题">
                <a-input
                  v-model:value="seoForm.title"
                  placeholder="默认为文章标题"
                  :maxlength="60"
                  show-count
                />
              </a-form-item>
              <a-form-item label="SEO描述">
                <a-textarea
                  v-model:value="seoForm.description"
                  placeholder="默认为文章摘要"
                  :maxlength="160"
                  :rows="2"
                  show-count
                />
              </a-form-item>
              <a-form-item label="SEO关键词">
                <a-select
                  v-model:value="seoKeywords"
                  mode="tags"
                  style="width: 100%"
                  placeholder="输入关键词后按回车"
                />
              </a-form-item>
            </a-form>
          </a-card>

          <!-- GEO & SEO 设置 -->
          <a-card :bordered="false" style="margin-top: 16px">
            <template #title>
              <a-space>
                <span>GEO & SEO 设置</span>
                <a-tag color="blue" v-if="geoForm.llmsSummary">已优化</a-tag>
              </a-space>
            </template>
            <template #extra>
              <a-tooltip title="GEO字段帮助AI搜索引擎理解和引用你的内容">
                <QuestionCircleOutlined />
              </a-tooltip>
            </template>

            <a-collapse :bordered="false" ghost>
              <a-collapse-panel key="llmsSummary" header="AI搜索引擎摘要 (llmsSummary)">
                <template #extra>
                  <span style="color: #999; font-size: 12px">{{ (geoForm.llmsSummary || '').length }}/200</span>
                </template>
                <a-textarea
                  v-model:value="geoForm.llmsSummary"
                  placeholder="200字以内的精炼摘要，用于AI搜索引擎理解页面内容。AI生成文章时会自动填充，可手动调整优化。"
                  :rows="4"
                  :maxlength="200"
                  show-count
                />
                <a-alert type="info" show-icon banner style="margin-top: 8px">
                  <template #message>
                    <span style="font-size: 12px">此摘要会出现在 /llms.txt 端点中，供 ChatGPT、Perplexity 等 AI 模型读取</span>
                  </template>
                </a-alert>
              </a-collapse-panel>

              <a-collapse-panel key="geoCitationSummary" header="AI引用摘要 (geoCitationSummary)">
                <a-textarea
                  v-model:value="geoForm.geoCitationSummary"
                  placeholder="1-2句话的核心观点，便于AI搜索引擎直接引用。建议突出文章最核心的结论或数据。"
                  :rows="3"
                  :maxlength="300"
                  show-count
                />
                <a-alert type="info" show-icon banner style="margin-top: 8px">
                  <template #message>
                    <span style="font-size: 12px">AI搜索引擎引用内容时会优先使用此摘要，确保信息准确且有吸引力</span>
                  </template>
                </a-alert>
              </a-collapse-panel>

              <a-collapse-panel key="schemaJson" header="Schema.org 结构化数据">
                <a-textarea
                  v-model:value="geoForm.schemaJson"
                  placeholder='JSON-LD格式的Article schema，如：{"@context":"https://schema.org","@type":"Article","headline":"文章标题"...}'
                  :rows="8"
                  :maxlength="2000"
                />
                <a-space style="margin-top: 8px">
                  <a-button size="small" @click="validateJson('schemaJson')">
                    <template #icon><CheckCircleOutlined /></template>
                    校验JSON
                  </a-button>
                  <a-button size="small" @click="formatJson('schemaJson')">
                    格式化
                  </a-button>
                </a-space>
                <a-alert type="info" show-icon banner style="margin-top: 8px">
                  <template #message>
                    <span style="font-size: 12px">结构化数据帮助搜索引擎理解页面内容，支持生成富文本搜索结果</span>
                  </template>
                </a-alert>
              </a-collapse-panel>

              <a-collapse-panel key="faqJson" header="FAQ 问答结构化数据">
                <a-textarea
                  v-model:value="geoForm.faqJson"
                  placeholder='JSON-LD格式的FAQPage schema，如：{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[...]}'
                  :rows="8"
                  :maxlength="3000"
                />
                <a-space style="margin-top: 8px">
                  <a-button size="small" @click="validateJson('faqJson')">
                    <template #icon><CheckCircleOutlined /></template>
                    校验JSON
                  </a-button>
                  <a-button size="small" @click="formatJson('faqJson')">
                    格式化
                  </a-button>
                </a-space>
                <a-alert type="info" show-icon banner style="margin-top: 8px">
                  <template #message>
                    <span style="font-size: 12px">FAQ结构化数据帮助AI搜索引擎直接提取问答对，增加被引用的机会</span>
                  </template>
                </a-alert>
              </a-collapse-panel>
            </a-collapse>
          </a-card>

          <a-card title="操作记录" :bordered="false" style="margin-top: 16px">
            <a-timeline>
              <a-timeline-item color="blue">
                <template #dot><EditOutlined /></template>
                <p>创建文章</p>
                <p class="time">2024-03-15 10:00:00</p>
              </a-timeline-item>
              <a-timeline-item color="green">
                <template #dot><SaveOutlined /></template>
                <p>保存草稿</p>
                <p class="time">2024-03-15 10:30:00</p>
              </a-timeline-item>
            </a-timeline>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <a-modal
      v-model:open="previewVisible"
      title="预览文章"
      width="1000px"
      :footer="null"
    >
      <div class="article-preview">
        <h1>{{ articleForm.title || '文章标题' }}</h1>
        <div class="preview-meta">
          <span>{{ articleForm.author || '作者' }}</span>
          <span>{{ getCategoryName(articleForm.categoryId) }}</span>
          <span>{{ new Date().toLocaleDateString() }}</span>
        </div>
        <div class="preview-summary" v-if="articleForm.summary">
          {{ articleForm.summary }}
        </div>
        <a-divider />
        <div class="preview-content" v-html="formatPreviewContent(articleForm.content)"></div>
      </div>
    </a-modal>

    <a-modal
      v-model:open="deleteVisible"
      title="删除确认"
      @ok="confirmDelete"
      ok-text="确认删除"
      ok-type="danger"
      cancel-text="取消"
    >
      <p>确定要删除这篇文章吗？删除后无法恢复。</p>
    </a-modal>

    <a-modal
      v-model:open="showLinkModal"
      title="插入链接"
      @ok="confirmInsertLink"
      @cancel="showLinkModal = false"
      ok-text="插入"
      cancel-text="取消"
    >
      <a-form layout="vertical">
        <a-form-item label="链接地址">
          <a-input v-model:value="linkUrl" placeholder="请输入URL" />
        </a-form-item>
        <a-form-item label="链接文本">
          <a-input v-model:value="linkText" placeholder="显示的文本（可选）" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  EyeOutlined,
  FullscreenOutlined,
  PlusOutlined,
  EditOutlined,
  SaveOutlined,
  DownOutlined,
  DeleteOutlined,
  RocketOutlined,
  BulbOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons-vue'
import { articleApi, reviewApi } from '../../api/workspace'
import { aiGenerateApi } from '../../api/ai-model'
import { marked } from 'marked'

const router = useRouter()
const route = useRoute()

type ArticleStatus = 'draft' | 'reviewing' | 'approved' | 'rejected' | 'published'

const loading = ref(false)
const savingDraft = ref(false)
const submittingReview = ref(false)
const publishing = ref(false)
const generatingSeo = ref(false)
const previewVisible = ref(false)
const deleteVisible = ref(false)
const rejectReason = ref('')

const isEdit = computed(() => !!route.params.id)
const articleId = computed(() => Number(route.params.id) || 0)

const coverFileList = ref<any[]>([])
const selectedTags = ref<string[]>([])
const seoKeywords = ref<string[]>([])
const publishDate = ref<any>(null)
const isFullscreen = ref(false)
const showLinkModal = ref(false)
const linkUrl = ref('')
const linkText = ref('')

const articleForm = reactive({
  title: '',
  summary: '',
  content: '',
  categoryId: null as number | null,
  source: '原创',
  author: '',
  isTop: false,
  isRecommend: false,
  status: 'draft' as ArticleStatus,
})

const seoForm = reactive({
  title: '',
  description: '',
})

const geoForm = reactive({
  llmsSummary: '',
  geoCitationSummary: '',
  schemaJson: '',
  faqJson: '',
})

const statusText = computed(() => {
  const map: Record<ArticleStatus, string> = {
    draft: '草稿',
    reviewing: '审核中',
    approved: '已通过',
    rejected: '已拒绝',
    published: '已发布',
  }
  return map[articleForm.status] || '未知'
})

const statusColor = computed(() => {
  const map: Record<ArticleStatus, string> = {
    draft: 'default',
    reviewing: 'processing',
    approved: 'success',
    rejected: 'error',
    published: 'green',
  }
  return map[articleForm.status] || 'default'
})

const statusStepIndex = computed(() => {
  const map: Record<ArticleStatus, number> = {
    draft: 0,
    reviewing: 1,
    approved: 2,
    rejected: 1,
    published: 3,
  }
  return map[articleForm.status] ?? 0
})

const categoryList = [
  { id: 1, name: '公司新闻' },
  { id: 2, name: '行业动态' },
  { id: 3, name: '技术博客' },
  { id: 4, name: '产品发布' },
  { id: 5, name: '案例分享' },
]

const hotTags = ['AI', '人工智能', '数字化转型', '智能客服', '机器学习', 'NLP', '计算机视觉', '大数据']

function getCategoryName(id: number | null): string {
  const cat = categoryList.find(c => c.id === id)
  return cat?.name || '未分类'
}

function formatText(type: string) {
  const formatMap: Record<string, { prefix: string; suffix: string }> = {
    bold: { prefix: '**', suffix: '**' },
    italic: { prefix: '*', suffix: '*' },
    underline: { prefix: '<u>', suffix: '</u>' },
    h1: { prefix: '\n# ', suffix: '\n' },
    h2: { prefix: '\n## ', suffix: '\n' },
    h3: { prefix: '\n### ', suffix: '\n' },
    ul: { prefix: '\n- ', suffix: '' },
    ol: { prefix: '\n1. ', suffix: '' },
  }
  
  const format = formatMap[type]
  if (format) {
    articleForm.content += format.prefix + (type === 'ul' || type === 'ol' ? '列表项' : '文本') + format.suffix
  }
}

function handleInsertImage() {
  Modal.info({
    title: '插入图片',
    content: '请先上传图片到服务器，然后复制图片URL粘贴到文章中。目前支持通过封面图片上传功能添加图片。',
    okText: '知道了',
  })
}

function handleInsertLink() {
  showLinkModal.value = true
}

function confirmInsertLink() {
  if (!linkUrl.value.trim()) {
    message.warning('请输入链接地址')
    return
  }
  const text = linkText.value.trim() || linkUrl.value
  articleForm.content += `[${text}](${linkUrl.value})`
  showLinkModal.value = false
  linkUrl.value = ''
  linkText.value = ''
}

function handlePreview() {
  previewVisible.value = true
}

function handleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value) {
    document.documentElement.requestFullscreen?.()
    message.success('已进入全屏编辑模式')
  } else {
    document.exitFullscreen?.()
    message.success('已退出全屏编辑模式')
  }
}

function formatPreviewContent(content: string): string {
  if (!content) {
    return '<p style="color: #8c8c8c; text-align: center; padding: 40px;">暂无内容</p>'
  }
  try {
    return marked.parse(content) as string
  } catch {
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
  }
}

function beforeUpload(file: any) {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    message.error('只能上传图片文件')
    return false
  }
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isLt5M) {
    message.error('图片大小不能超过 5MB')
    return false
  }
  return false
}

const validateJson = (field: 'schemaJson' | 'faqJson') => {
  const value = geoForm[field]
  if (!value || !value.trim()) {
    message.success('JSON为空，校验通过')
    return
  }
  try {
    JSON.parse(value)
    message.success('JSON格式正确')
  } catch (e) {
    message.error('JSON格式错误：' + (e as Error).message)
  }
}

const formatJson = (field: 'schemaJson' | 'faqJson') => {
  const value = geoForm[field]
  if (!value || !value.trim()) return
  try {
    const parsed = JSON.parse(value)
    geoForm[field] = JSON.stringify(parsed, null, 2)
    message.success('JSON已格式化')
  } catch (e) {
    message.error('JSON格式错误，无法格式化')
  }
}

function validateForm(): boolean {
  if (!articleForm.title.trim()) {
    message.error('请输入文章标题')
    return false
  }
  if (!articleForm.content.trim()) {
    message.error('请输入文章内容')
    return false
  }
  return true
}

async function handleSaveDraft() {
  if (!validateForm()) return

  savingDraft.value = true
  try {
    const data = {
      ...articleForm,
      status: 'draft' as ArticleStatus,
      tags: selectedTags.value,
      seoTitle: seoForm.title,
      seoDescription: seoForm.description,
      seoKeywords: seoKeywords.value,
      llmsSummary: geoForm.llmsSummary,
      geoCitationSummary: geoForm.geoCitationSummary,
      schemaJson: geoForm.schemaJson,
      faqJson: geoForm.faqJson,
    }

    if (isEdit.value) {
      await articleApi.update(articleId.value, data)
      message.success('草稿保存成功')
    } else {
      message.success('草稿保存成功（新建模式）')
    }
    articleForm.status = 'draft'
  } catch (error) {
    message.error('保存失败')
  } finally {
    savingDraft.value = false
  }
}

async function handleSubmitReview() {
  if (!validateForm()) return
  if (!articleForm.categoryId) {
    message.error('请选择文章分类')
    return
  }

  submittingReview.value = true
  try {
    const data = {
      ...articleForm,
      tags: selectedTags.value,
      seoTitle: seoForm.title,
      seoDescription: seoForm.description,
      seoKeywords: seoKeywords.value,
      llmsSummary: geoForm.llmsSummary,
      geoCitationSummary: geoForm.geoCitationSummary,
      schemaJson: geoForm.schemaJson,
      faqJson: geoForm.faqJson,
    }

    if (isEdit.value) {
      await articleApi.update(articleId.value, data)
      await reviewApi.submitForReview(articleId.value)
      articleForm.status = 'reviewing'
      message.success('提交审核成功')
    } else {
      message.success('提交审核成功（新建模式）')
      articleForm.status = 'reviewing'
    }
  } catch (error) {
    message.error('提交审核失败')
  } finally {
    submittingReview.value = false
  }
}

async function handlePublish() {
  if (!validateForm()) return
  if (!articleForm.categoryId) {
    message.error('请选择文章分类')
    return
  }

  publishing.value = true
  try {
    const data = {
      ...articleForm,
      status: 'published' as ArticleStatus,
      tags: selectedTags.value,
      seoTitle: seoForm.title,
      seoDescription: seoForm.description,
      seoKeywords: seoKeywords.value,
      llmsSummary: geoForm.llmsSummary,
      geoCitationSummary: geoForm.geoCitationSummary,
      schemaJson: geoForm.schemaJson,
      faqJson: geoForm.faqJson,
    }

    if (isEdit.value) {
      await articleApi.update(articleId.value, data)
      articleForm.status = 'published'
      message.success('文章发布成功')
      router.push('/workspace/articles')
    } else {
      message.success('文章发布成功（新建模式）')
    }
  } catch (error) {
    message.error('发布失败')
  } finally {
    publishing.value = false
  }
}

function handleDelete() {
  deleteVisible.value = true
}

async function confirmDelete() {
  if (!isEdit.value) {
    deleteVisible.value = false
    return
  }

  try {
    await articleApi.delete(articleId.value)
    message.success('删除成功')
    deleteVisible.value = false
    router.push('/workspace/articles')
  } catch (error) {
    message.error('删除失败')
  }
}

async function handleGenerateSeo() {
  if (!articleForm.title.trim() && !articleForm.content.trim()) {
    message.warning('请先填写文章标题或内容')
    return
  }

  generatingSeo.value = true
  try {
    const result = await aiGenerateApi.generateSeo({
      title: articleForm.title,
      content: articleForm.summary || articleForm.content,
      keywords: selectedTags.value.join(','),
    })

    seoForm.title = result.seoTitle
    seoForm.description = result.seoDescription
    if (result.seoKeywords && Array.isArray(result.seoKeywords)) {
      seoKeywords.value = result.seoKeywords
    }

    message.success('SEO 智能生成成功')
  } catch (error: any) {
    console.error('SEO generate failed:', error)
    message.error(error?.message || '生成失败，请重试')
  } finally {
    generatingSeo.value = false
  }
}

function goBack() {
  router.back()
}

async function loadArticleDetail() {
  if (!isEdit.value) return

  loading.value = true
  try {
    const article = await articleApi.get(articleId.value)

    articleForm.title = article.title || ''
    articleForm.summary = article.summary || ''
    let content = article.content || ''
    content = content.replace(/\\n/g, '\n')
    content = content.replace(/\\r/g, '\r')
    content = content.replace(/\\\\/g, '\\')
    articleForm.content = content
    articleForm.categoryId = article.categoryId || null
    articleForm.source = article.source || '原创'
    articleForm.author = article.author || ''
    articleForm.isTop = article.isTop || false
    articleForm.isRecommend = article.isRecommend || false
    articleForm.status = (article.status as ArticleStatus) || 'draft'

    if (article.tags && Array.isArray(article.tags)) {
      selectedTags.value = article.tags
    }

    seoForm.title = article.seoTitle || article.title || ''
    seoForm.description = article.seoDescription || article.summary || ''

    if (article.seoKeywords && Array.isArray(article.seoKeywords)) {
      seoKeywords.value = article.seoKeywords
    }

    geoForm.llmsSummary = (article as any).llmsSummary || ''
    geoForm.geoCitationSummary = (article as any).geoCitationSummary || ''
    geoForm.schemaJson = (article as any).schemaJson || ''
    geoForm.faqJson = (article as any).faqJson || ''
  } catch (error) {
    message.error('加载文章详情失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadArticleDetail()
})
</script>

<style scoped lang="less">
.article-edit-page {
  width: 100%;
}

.editor-container {
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  overflow: hidden;
}

.editor-toolbar {
  background: #fafafa;
  border-bottom: 1px solid #d9d9d9;
  padding: 8px 12px;
}

.editor-textarea {
  width: 100%;
  border: none;
  outline: none;
  padding: 16px;
  font-size: 14px;
  line-height: 1.8;
  resize: vertical;
  min-height: 400px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.form-tip {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 8px;
}

.status-tag {
  font-size: 14px;
  padding: 4px 12px;
  margin-bottom: 12px;
}

.status-flow-desc {
  margin-top: 12px;
  background: #fafafa;
  padding: 12px;
  border-radius: 4px;
}

.status-steps {
  :deep(.ant-steps-item) {
    padding-bottom: 12px;
  }
  :deep(.ant-steps-item-title) {
    font-size: 13px;
  }
  :deep(.ant-steps-item-description) {
    font-size: 12px;
    color: #8c8c8c;
  }
}

.reject-reason {
  margin-top: 12px;
}

.article-preview {
  padding: 24px;

  h1 {
    font-size: 28px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 16px;
    text-align: center;
  }

  .preview-meta {
    display: flex;
    justify-content: center;
    gap: 24px;
    font-size: 14px;
    color: #8c8c8c;
    margin-bottom: 24px;
  }

  .preview-summary {
    padding: 16px;
    background: #f5f5f5;
    border-radius: 4px;
    font-size: 14px;
    color: #595959;
    line-height: 1.8;
    font-style: italic;
  }

  .preview-content {
    font-size: 15px;
    line-height: 2;
    color: #333;

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 32px 0 16px;
      color: #1a1a1a;
      padding-bottom: 8px;
      border-bottom: 2px solid #1890ff;
    }

    h3 {
      font-size: 17px;
      font-weight: 600;
      margin: 24px 0 12px;
      color: #1a1a1a;
    }

    p {
      margin: 16px 0;
      text-indent: 2em;
    }

    ul {
      margin: 16px 0;
      padding-left: 2em;
    }

    li {
      margin: 8px 0;
    }

    strong {
      color: #1a1a1a;
      font-weight: 600;
    }

    em {
      color: #595959;
    }
  }
}

.time {
  font-size: 12px;
  color: #8c8c8c;
  margin: 4px 0 0;
}
</style>
