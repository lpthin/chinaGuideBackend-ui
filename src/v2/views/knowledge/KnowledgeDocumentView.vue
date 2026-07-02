<template>
  <div class="media-panel-page">
    <!-- 项目列表视图 -->
    <template v-if="!currentProject">
      <div class="panel-header">
        <div>
          <h2>资料库</h2>
          <p class="subtitle">上传和管理图片、视频、文档等企业资料</p>
        </div>
        <a-button type="primary" @click="showNewProjectModal = true">
          <template #icon><PlusOutlined /></template>
          新建项目
        </a-button>
      </div>

      <a-spin :spinning="mediaLoading">
        <a-row :gutter="16">
          <a-col :span="6" v-for="project in projects" :key="project.name">
            <a-card class="project-card" hoverable @click="enterProject(project.name)">
              <div class="project-cover">
                <img v-if="project.coverUrl" :src="project.coverUrl" alt="cover" />
                <div v-else class="cover-placeholder">
                  <FolderOpenOutlined />
                </div>
              </div>
              <a-card-meta :title="project.displayName || project.name">
                <template #description>
                  {{ project.count }} 个文件 · {{ formatFileSize(project.totalSize) }}
                  <br />
                  <span style="font-size: 12px; color: #999">
                    {{ project.imageCount }} 图片 · {{ project.videoCount }} 视频
                  </span>
                </template>
              </a-card-meta>
            </a-card>
          </a-col>
          <a-col :span="24" v-if="projects.length === 0 && !mediaLoading">
            <a-empty description="暂无项目，点击新建项目创建" />
          </a-col>
        </a-row>
      </a-spin>

      <a-modal v-model:open="showNewProjectModal" title="新建项目" @ok="createProject">
        <a-input v-model:value="newProjectName" placeholder="请输入项目名称" @pressEnter="createProject" />
      </a-modal>
    </template>

    <!-- 项目详情视图 -->
    <template v-else>
      <div class="panel-header">
        <a-space>
          <a-button @click="backToProjects">
            <template #icon><ArrowLeftOutlined /></template>
            返回
          </a-button>
          <h3 style="margin: 0">{{ currentProject === 'uncategorized' ? '未分类' : currentProject }}</h3>
        </a-space>
        <a-space>
          <a-radio-group v-model:value="viewMode" size="small">
            <a-radio-button value="grid">网格</a-radio-button>
            <a-radio-button value="list">列表</a-radio-button>
          </a-radio-group>
          <a-upload
            :showUploadList="false"
            :multiple="true"
            :beforeUpload="handleBatchUpload"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          >
            <a-button type="primary" :loading="uploading">
              <template #icon><UploadOutlined /></template>
              批量上传
            </a-button>
          </a-upload>
        </a-space>
      </div>

      <a-card :loading="mediaLoading">
        <template #extra>
          <a-space>
            <a-select
              v-model:value="selectedTag"
              placeholder="按标签筛选"
              style="width: 160px"
              allow-clear
              @change="loadFiles"
            >
              <a-select-option v-for="tag in tags" :key="tag.name" :value="tag.name">
                <a-tag :color="tag.color" style="margin-right: 0">{{ tag.name }}</a-tag>
              </a-select-option>
            </a-select>
            <a-input-search v-model:value="searchText" placeholder="搜索文件" style="width: 200px" @search="loadFiles" />
            <template v-if="selectedIds.length > 0">
              <a-button size="small" @click="showBatchCategoryModal">
                设置分类
              </a-button>
              <a-button size="small" @click="showBatchTagModal">
                设置标签
              </a-button>
              <a-button danger size="small" @click="batchDelete">
                删除选中 ({{ selectedIds.length }})
              </a-button>
            </template>
          </a-space>
        </template>

        <!-- 网格视图 -->
        <a-row :gutter="16" v-if="viewMode === 'grid'">
          <a-col :span="6" v-for="file in filteredFiles" :key="file.id">
            <a-card class="media-card" hoverable>
              <template #cover>
                <div class="media-preview" @click="toggleSelect(file.id)">
                  <a-checkbox :checked="selectedIds.includes(file.id)" class="media-checkbox" />
                  <img
                    v-if="isImage(file.mimeType)"
                    :src="`/api/v2/workspace/media/${file.id}/file`"
                    :alt="file.originalName"
                  />
                  <div v-else-if="isVideo(file.mimeType)" class="file-placeholder video-placeholder">
                    <VideoCameraOutlined />
                  </div>
                  <div v-else class="file-placeholder document-placeholder">
                    <FileTextOutlined />
                  </div>
                </div>
              </template>
              <a-card-meta>
                <template #title>
                  <a-typography-paragraph :ellipsis="{ rows: 1 }" :content="file.originalName" style="margin: 0; font-size: 13px" />
                </template>
                <template #description>
                  <span style="font-size: 12px">{{ formatFileSize(file.fileSize) }}</span>
                  <div v-if="file.tags" class="doc-tags">
                    <a-tag
                      v-for="tag in (file.tags || '').split(',').filter((t: string) => t)"
                      :key="tag"
                      size="small"
                      :color="getTagColor(tag)"
                    >
                      {{ tag }}
                    </a-tag>
                  </div>
                  <div v-if="file.parseStatus" class="status-tags">
                    <a-tag :color="getParseStatusColor(file.parseStatus)" size="small">
                      解析: {{ getParseStatusText(file.parseStatus) }}
                    </a-tag>
                    <a-tag v-if="file.vectorStatus" :color="getVectorStatusColor(file.vectorStatus)" size="small">
                      向量: {{ getVectorStatusText(file.vectorStatus) }}
                    </a-tag>
                  </div>
                </template>
              </a-card-meta>
              <template #actions>
                <a @click="previewMediaFile(file)">预览</a>
                <a @click="downloadMediaFile(file)">下载</a>
                <a-popconfirm title="确认删除？" @confirm="deleteMediaFile(file.id)">
                  <span style="color: #ff4d4f">删除</span>
                </a-popconfirm>
              </template>
            </a-card>
          </a-col>
          <a-col :span="24" v-if="filteredFiles.length === 0 && !mediaLoading">
            <a-empty description="暂无文件" />
          </a-col>
        </a-row>

        <!-- 列表视图 -->
        <a-table
          v-else
          :columns="mediaColumns"
          :data-source="filteredFiles"
          :pagination="{ pageSize: 20 }"
          :loading="mediaLoading"
          row-key="id"
          :row-selection="{ selectedRowKeys: selectedIds, onChange: (keys: any) => selectedIds = keys }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <a-space>
                <FileImageOutlined v-if="isImage(record.mimeType)" />
                <VideoCameraOutlined v-else-if="isVideo(record.mimeType)" />
                <FileTextOutlined v-else />
                <span>{{ record.originalName }}</span>
              </a-space>
            </template>
            <template v-if="column.key === 'tags'">
              <template v-if="record.tags">
                <a-tag
                  v-for="tag in (record.tags || '').split(',').filter((t: string) => t)"
                  :key="tag"
                  size="small"
                  :color="getTagColor(tag)"
                >
                  {{ tag }}
                </a-tag>
              </template>
              <span v-else>-</span>
            </template>
            <template v-if="column.key === 'size'">
              {{ formatFileSize(record.fileSize) }}
            </template>
            <template v-if="column.key === 'parseStatus'">
              <a-tag v-if="record.parseStatus" :color="getParseStatusColor(record.parseStatus)">
                {{ getParseStatusText(record.parseStatus) }}
              </a-tag>
              <span v-else>-</span>
            </template>
            <template v-if="column.key === 'vectorStatus'">
              <a-tag v-if="record.vectorStatus" :color="getVectorStatusColor(record.vectorStatus)">
                {{ getVectorStatusText(record.vectorStatus) }}
              </a-tag>
              <span v-else>-</span>
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatAbsoluteTime(record.createdAt) }}
            </template>
            <template v-if="column.key === 'action'">
              <a-space size="small">
                <a-button type="link" size="small" @click="previewMediaFile(record)">预览</a-button>
                <a-button type="link" size="small" @click="downloadMediaFile(record)">下载</a-button>
                <a-popconfirm title="确认删除？" @confirm="deleteMediaFile(record.id)">
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </template>

    <!-- 媒体预览弹窗 -->
    <a-modal
      v-model:open="mediaPreviewVisible"
      :footer="null"
      :width="previewModalWidth"
      :body-style="{ padding: 0 }"
      centered
      class="doc-preview-modal"
    >
      <div v-if="previewLoading" class="preview-loading">
        <a-spin size="large" tip="加载中..." />
      </div>
      <div v-else class="preview-container">
        <div class="preview-header">
          <div class="preview-title-section">
            <FileTextOutlined class="preview-icon" />
            <div class="preview-title-info">
              <h3 class="preview-filename">{{ previewDocData?.originalName || previewMediaData?.originalName }}</h3>
              <div class="preview-meta">
                <span>{{ formatFileSize(previewDocData?.fileSize || previewMediaData?.fileSize) }}</span>
                <span class="meta-divider">·</span>
                <span>{{ previewDocData?.fileType || getFileExt(previewDocData?.originalName || previewMediaData?.originalName) }}</span>
                <span class="meta-divider">·</span>
                <span>{{ formatAbsoluteTime(previewDocData?.createdAt || previewMediaData?.createdAt) }}</span>
              </div>
            </div>
          </div>
          <div class="preview-actions">
            <a-space>
              <a-button v-if="hasPrevDoc" @click="prevDocument" :disabled="previewLoading">
                <template #icon><LeftOutlined /></template>
                上一个
              </a-button>
              <a-button v-if="hasNextDoc" @click="nextDocument" :disabled="previewLoading">
                下一个
                <template #icon><RightOutlined /></template>
              </a-button>
              <a-button type="primary" @click="downloadCurrentDoc">
                <template #icon><DownloadOutlined /></template>
                下载
              </a-button>
              <a-button @click="mediaPreviewVisible = false">
                关闭
              </a-button>
            </a-space>
          </div>
        </div>

        <div class="preview-body">
          <template v-if="currentPreviewType === 'image'">
            <div class="image-preview-wrapper">
              <img
                :src="previewDocData?.fileDownloadUrl || getMediaFileUrl(previewMediaData)"
                :alt="previewDocData?.originalName || previewMediaData?.originalName"
                class="preview-image"
              />
            </div>
          </template>

          <template v-else-if="currentPreviewType === 'pdf'">
            <div class="pdf-preview-wrapper">
              <iframe
                :src="previewDocData?.fileDownloadUrl || getMediaFileUrl(previewMediaData)"
                class="preview-iframe"
                frameborder="0"
              />
            </div>
          </template>

          <template v-else-if="currentPreviewType === 'text'">
            <div class="text-preview-wrapper">
              <div v-if="previewDocData?.content" class="text-content">
                <pre>{{ previewDocData.content }}</pre>
              </div>
              <div v-else class="no-content-placeholder">
                <FileTextOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
                <p>暂无文本内容</p>
                <p style="font-size: 12px; color: #999">文档可能还未解析或不支持文本提取</p>
              </div>
            </div>
          </template>

          <template v-else-if="currentPreviewType === 'office'">
            <div class="office-preview-wrapper">
              <div class="office-preview-header">
                <a-alert message="文本预览" type="info" show-icon style="margin-bottom: 16px">
                  <template #description>
                    以下为文档解析后的文本内容，仅供快速预览。如需完整格式，请下载原文件。
                  </template>
                </a-alert>
              </div>
              <div v-if="previewDocData?.content" class="text-content">
                <pre>{{ previewDocData.content }}</pre>
              </div>
              <div v-else class="no-content-placeholder">
                <FileTextOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
                <p>暂无解析内容</p>
                <p style="font-size: 12px; color: #999">
                  <span v-if="previewDocData?.parseStatus === 'PENDING' || previewDocData?.parseStatus === 'PARSING'">
                    文档正在解析中，请稍后再试
                  </span>
                  <span v-else>文档可能还未解析或解析失败</span>
                </p>
                <a-button style="margin-top: 16px" type="primary" @click="downloadCurrentDoc">
                  <template #icon><DownloadOutlined /></template>
                  下载原文件
                </a-button>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="other-preview-wrapper">
              <div class="file-info-card">
                <FileTextOutlined style="font-size: 64px; color: #8c8c8c; margin-bottom: 24px" />
                <h3>{{ previewDocData?.originalName || previewMediaData?.originalName }}</h3>
                <p style="color: #8c8c8c; margin: 8px 0">
                  {{ formatFileSize(previewDocData?.fileSize || previewMediaData?.fileSize) }}
                </p>
                <p v-if="previewDocData?.parseStatus" style="margin-bottom: 16px">
                  <a-tag :color="getParseStatusColor(previewDocData.parseStatus)">
                    解析状态: {{ getParseStatusText(previewDocData.parseStatus) }}
                  </a-tag>
                </p>
                <a-button type="primary" size="large" @click="downloadCurrentDoc">
                  <template #icon><DownloadOutlined /></template>
                  下载文件
                </a-button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </a-modal>

    <!-- 批量设置分类弹窗 -->
    <a-modal v-model:open="batchCategoryModalVisible" title="批量设置分类" width="500px">
      <a-form layout="vertical">
        <a-form-item label="选择分类">
          <a-select
            v-model:value="batchCategoryId"
            placeholder="请选择分类"
            style="width: 100%"
            :allow-clear="true"
          >
            <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <p style="color: #8c8c8c; font-size: 12px">
          将把选中的 {{ selectedIds.length }} 个文档移动到所选分类
        </p>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="batchCategoryModalVisible = false">取消</a-button>
          <a-button type="primary" :loading="batchSaving" @click="handleBatchSetCategory">
            确认设置
          </a-button>
        </a-space>
      </template>
    </a-modal>

    <!-- 批量设置标签弹窗 -->
    <a-modal v-model:open="batchTagModalVisible" title="批量设置标签" width="500px">
      <a-form layout="vertical">
        <a-form-item label="选择标签">
          <a-select
            v-model:value="batchTagValue"
            mode="tags"
            placeholder="输入或选择标签，回车添加"
            style="width: 100%"
          >
            <a-select-option v-for="tag in tags" :key="tag.name" :value="tag.name">
              {{ tag.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <p style="color: #8c8c8c; font-size: 12px">
          将为选中的 {{ selectedIds.length }} 个文档设置标签（覆盖原有标签）
        </p>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="batchTagModalVisible = false">取消</a-button>
          <a-button type="primary" :loading="batchTagSaving" @click="handleBatchSetTags">
            确认设置
          </a-button>
        </a-space>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined,
  UploadOutlined,
  ArrowLeftOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import { mediaApi } from '../../api/workspace'
import { knowledgeDocumentApi, knowledgeCategoryApi, knowledgeTagApi, knowledgeCardApi } from '../../api/knowledge'
import type { KnowledgeCategory, KnowledgeTag, KnowledgeCard } from '../../types/knowledge'
import { formatTime as formatAbsoluteTime } from '@/utils/format'

// ==================== 媒体库相关状态 ====================
const mediaLoading = ref(false)
const uploading = ref(false)
const projects = ref<any[]>([])
const mediaFiles = ref<any[]>([])
const currentProject = ref<string | null>(null)
const viewMode = ref('grid')
const searchText = ref('')
const selectedIds = ref<number[]>([])
const showNewProjectModal = ref(false)
const newProjectName = ref('')
const mediaPreviewVisible = ref(false)
const previewMediaData = ref<any | null>(null)
const savingCategory = ref(false)
const editingCategoryId = ref<number | null>(null)
const batchCategoryModalVisible = ref(false)
const batchCategoryId = ref<number | null>(null)
const batchSaving = ref(false)
const categories = ref<KnowledgeCategory[]>([])
const tags = ref<KnowledgeTag[]>([])
const selectedTag = ref<string>('')
const batchTagModalVisible = ref(false)
const batchTagValue = ref<string[]>([])
const batchTagSaving = ref(false)
const editingTags = ref<string[]>([])
const relatedCards = ref<KnowledgeCard[]>([])
const relatedCardsLoading = ref(false)

const previewLoading = ref(false)
const previewDocData = ref<any | null>(null)
const previewIndex = ref(-1)

const mediaColumns = [
  { title: '文件名', key: 'name' },
  { title: '标签', key: 'tags', width: 200 },
  { title: '大小', key: 'size', width: 120 },
  { title: '解析状态', key: 'parseStatus', width: 120 },
  { title: '向量化状态', key: 'vectorStatus', width: 130 },
  { title: '上传时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200 }
]

const filteredFiles = computed(() => {
  let result = mediaFiles.value
  if (searchText.value) {
    result = result.filter((f: any) => f.originalName?.includes(searchText.value))
  }
  if (selectedTag.value) {
    result = result.filter((f: any) => {
      const fileTags = f.tags ? f.tags.split(',') : []
      return fileTags.includes(selectedTag.value)
    })
  }
  return result
})

const previewModalWidth = computed(() => {
  const type = currentPreviewType.value
  if (type === 'image' || type === 'pdf') return '90vw'
  if (type === 'text' || type === 'office') return '800px'
  return '600px'
})

const currentPreviewType = computed(() => {
  if (previewDocData.value?.previewType) {
    return previewDocData.value.previewType
  }
  if (previewMediaData.value) {
    const fileName = previewMediaData.value.originalName || ''
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    if (['txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'js', 'csv', 'log', 'yaml', 'yml'].includes(ext)) return 'text'
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf'].includes(ext)) return 'office'
  }
  return 'other'
})

const hasPrevDoc = computed(() => previewIndex.value > 0)
const hasNextDoc = computed(() => previewIndex.value >= 0 && previewIndex.value < filteredFiles.value.length - 1)

// ==================== 媒体库相关方法 ====================
async function loadProjects() {
  mediaLoading.value = true
  try {
    const res: any = await mediaApi.projects()
    const data = Array.isArray(res) ? res : (res?.data || [])
    projects.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error('加载项目失败:', e)
    message.error('加载项目失败')
    projects.value = []
  } finally {
    mediaLoading.value = false
  }
}

async function loadFiles() {
  if (!currentProject.value) return
  mediaLoading.value = true
  try {
    const res: any = await mediaApi.list({ category: currentProject.value })
    const data = Array.isArray(res) ? res : (res?.data?.records || res?.data || res?.records || [])
    mediaFiles.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error('加载文件失败:', e)
    message.error('加载文件失败')
    mediaFiles.value = []
  } finally {
    mediaLoading.value = false
  }
}

function enterProject(name: string) {
  currentProject.value = name
  selectedIds.value = []
  loadFiles()
}

function backToProjects() {
  currentProject.value = null
  mediaFiles.value = []
  selectedIds.value = []
  loadProjects()
}

function createProject() {
  const name = newProjectName.value.trim()
  if (!name) {
    message.warning('请输入项目名称')
    return
  }
  showNewProjectModal.value = false
  newProjectName.value = ''
  currentProject.value = name
  mediaFiles.value = []
  message.success(`项目「${name}」已创建，请上传文件`)
}

async function handleBatchUpload(file: File): Promise<boolean> {
  if (!currentProject.value) return false

  uploading.value = true
  try {
    await mediaApi.upload(file, currentProject.value)
    message.success(`${file.name} 上传成功`)
    await loadFiles()
  } catch (e) {
    console.error('上传失败:', e)
    message.error(`${file.name} 上传失败`)
  } finally {
    uploading.value = false
  }
  return false
}

function toggleSelect(id: number) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function previewMediaFile(file: any) {
  previewMediaData.value = file
  mediaPreviewVisible.value = true
}

function downloadMediaFile(file: any) {
  const link = document.createElement('a')
  link.href = `/api/v2/workspace/media/${file.id}/file`
  link.download = file.originalName
  link.click()
}

async function deleteMediaFile(id: number) {
  try {
    await mediaApi.delete(id)
    message.success('删除成功')
    await loadFiles()
  } catch (e) {
    console.error('删除失败:', e)
    message.error('删除失败')
  }
}

async function batchDelete() {
  if (selectedIds.value.length === 0) return
  Modal.confirm({
    title: '确认批量删除',
    content: `确定要删除选中的 ${selectedIds.value.length} 个文档吗？此操作不可恢复。`,
    okText: '确定删除',
    cancelText: '取消',
    okType: 'danger',
    onOk: async () => {
      try {
        await knowledgeDocumentApi.batchDelete(selectedIds.value)
        message.success(`已删除 ${selectedIds.value.length} 个文档`)
        selectedIds.value = []
        await loadFiles()
      } catch (e) {
        console.error('批量删除失败:', e)
        message.error('批量删除失败')
      }
    },
  })
}

// ==================== 分类相关方法 ====================
async function loadCategories() {
  try {
    const result = await knowledgeCategoryApi.all(1)
    categories.value = result
  } catch (e) {
    console.error('加载分类失败:', e)
    categories.value = []
  }
}

// ==================== 标签相关方法 ====================
async function loadTags() {
  try {
    const result = await knowledgeTagApi.list({ tenantId: 1 })
    tags.value = Array.isArray(result) ? result : (result as any).records || []
  } catch (e) {
    console.error('加载标签失败:', e)
    tags.value = []
  }
}

function getTagColor(tagName: string): string {
  const tag = tags.value.find(t => t.name === tagName)
  return tag?.color || 'blue'
}

function previewMediaFile(file: any) {
  previewMediaData.value = file
  editingCategoryId.value = file.categoryId || null
  editingTags.value = file.tags ? file.tags.split(',').filter((t: string) => t) : []
  
  const idx = filteredFiles.value.findIndex((f: any) => f.id === file.id)
  previewIndex.value = idx
  
  mediaPreviewVisible.value = true
  loadPreviewData(file.id)
  loadRelatedCards(file.id)
}

async function loadPreviewData(docId: number) {
  previewLoading.value = true
  previewDocData.value = null
  try {
    const data = await knowledgeDocumentApi.preview(docId)
    previewDocData.value = data
  } catch (e) {
    console.error('加载预览数据失败:', e)
  } finally {
    previewLoading.value = false
  }
}

function prevDocument() {
  if (!hasPrevDoc.value) return
  const newIndex = previewIndex.value - 1
  const file = filteredFiles.value[newIndex]
  if (file) {
    previewIndex.value = newIndex
    previewMediaData.value = file
    editingCategoryId.value = file.categoryId || null
    editingTags.value = file.tags ? file.tags.split(',').filter((t: string) => t) : []
    loadPreviewData(file.id)
    loadRelatedCards(file.id)
  }
}

function nextDocument() {
  if (!hasNextDoc.value) return
  const newIndex = previewIndex.value + 1
  const file = filteredFiles.value[newIndex]
  if (file) {
    previewIndex.value = newIndex
    previewMediaData.value = file
    editingCategoryId.value = file.categoryId || null
    editingTags.value = file.tags ? file.tags.split(',').filter((t: string) => t) : []
    loadPreviewData(file.id)
    loadRelatedCards(file.id)
  }
}

function downloadCurrentDoc() {
  const id = previewDocData.value?.id || previewMediaData.value?.id
  if (!id) return
  const link = document.createElement('a')
  link.href = previewDocData.value?.fileDownloadUrl || `/api/v2/knowledge/documents/${id}/file`
  link.download = previewDocData.value?.originalName || previewMediaData.value?.originalName
  link.click()
}

function getMediaFileUrl(file: any) {
  if (!file) return ''
  if (file.id) {
    return `/api/v2/workspace/media/${file.id}/file`
  }
  return ''
}

function getFileExt(fileName: string): string {
  if (!fileName || !fileName.includes('.')) return ''
  return fileName.substring(fileName.lastIndexOf('.') + 1).toUpperCase()
}

async function loadRelatedCards(docId: number) {
  if (!docId) return
  relatedCardsLoading.value = true
  try {
    const cards = await knowledgeDocumentApi.getCards(docId)
    relatedCards.value = cards
  } catch (e) {
    console.error('加载关联卡片失败:', e)
    relatedCards.value = []
  } finally {
    relatedCardsLoading.value = false
  }
}

function goToCardDetail(cardId: number) {
  mediaPreviewVisible.value = false
  window.open(`/knowledge/card/${cardId}`, '_blank')
}

async function saveDocumentInfo() {
  if (!previewMediaData.value) return
  savingCategory.value = true
  try {
    await knowledgeDocumentApi.update(previewMediaData.value.id, {
      categoryId: editingCategoryId.value || 0,
      tags: editingTags.value.join(',')
    } as any)
    message.success('保存成功')
    if (previewMediaData.value) {
      previewMediaData.value.categoryId = editingCategoryId.value
      previewMediaData.value.tags = editingTags.value.join(',')
    }
    mediaPreviewVisible.value = false
    await loadFiles()
  } catch (e) {
    console.error('保存失败:', e)
    message.error('保存失败')
  } finally {
    savingCategory.value = false
  }
}

function showBatchCategoryModal() {
  batchCategoryId.value = null
  batchCategoryModalVisible.value = true
}

function showBatchTagModal() {
  batchTagValue.value = []
  batchTagModalVisible.value = true
}

async function handleBatchSetTags() {
  if (selectedIds.value.length === 0) return
  batchTagSaving.value = true
  try {
    await knowledgeDocumentApi.batchSetTags(selectedIds.value, batchTagValue.value.join(','))
    message.success(`已批量设置 ${selectedIds.value.length} 个文档的标签`)
    batchTagModalVisible.value = false
    await loadFiles()
  } catch (e) {
    console.error('批量设置标签失败:', e)
    message.error('批量设置标签失败')
  } finally {
    batchTagSaving.value = false
  }
}

async function handleBatchSetCategory() {
  if (selectedIds.value.length === 0) return
  batchSaving.value = true
  try {
    await knowledgeDocumentApi.batchSetCategory(selectedIds.value, batchCategoryId.value || null)
    message.success(`已批量设置 ${selectedIds.value.length} 个文档的分类`)
    batchCategoryModalVisible.value = false
    selectedIds.value = []
    await loadFiles()
  } catch (e) {
    console.error('批量设置分类失败:', e)
    message.error('批量设置分类失败')
  } finally {
    batchSaving.value = false
  }
}

// ==================== 工具方法 ====================
const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

function isImage(mimeType: string): boolean {
  return mimeType?.startsWith('image/') ?? false
}

function isVideo(mimeType: string): boolean {
  return mimeType?.startsWith('video/') ?? false
}

function isDocument(fileName: string): boolean {
  const ext = fileName?.split('.').pop()?.toLowerCase() || ''
  return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)
}

function getParseStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'default',
    PARSING: 'processing',
    SUCCESS: 'success',
    FAILED: 'error',
    parsed: 'success'
  }
  return map[status] || 'default'
}

function getParseStatusText(status: string): string {
  const map: Record<string, string> = {
    PENDING: '待解析',
    PARSING: '解析中',
    SUCCESS: '成功',
    FAILED: '失败',
    parsed: '已解析'
  }
  return map[status] || status
}

function getVectorStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'default',
    PROCESSING: 'processing',
    COMPLETED: 'success',
    FAILED: 'error',
    NOT_VECTORIZED: 'default',
    VECTORIZING: 'processing',
    VECTORIZED: 'success'
  }
  return map[status] || 'default'
}

function getVectorStatusText(status: string): string {
  const map: Record<string, string> = {
    PENDING: '待向量化',
    PROCESSING: '向量化中',
    COMPLETED: '已完成',
    FAILED: '失败',
    NOT_VECTORIZED: '未向量化',
    VECTORIZING: '向量化中',
    VECTORIZED: '已向量化'
  }
  return map[status] || status
}

onMounted(() => {
  loadProjects()
  loadCategories()
  loadTags()
})
</script>

<style lang="less" scoped>
.media-panel-page {
  padding: 24px;

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #262626;
    }

    .subtitle {
      margin: 4px 0 0 0;
      font-size: 14px;
      color: #8c8c8c;
    }
  }
}

.project-card {
  margin-bottom: 16px;
  cursor: pointer;
}

.project-cover {
  height: 160px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-placeholder {
    font-size: 48px;
    color: #d9d9d9;
  }
}

.media-card {
  margin-bottom: 16px;
}

.media-preview {
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  position: relative;
  cursor: pointer;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .file-placeholder {
    font-size: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .video-placeholder {
    color: #722ed1;
  }

  .document-placeholder {
    color: #1890ff;
  }

  .media-checkbox {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 1;
  }
}

.document-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;

  p {
    margin: 0 0 16px 0;
    font-size: 16px;
    color: #595959;
  }
}

.status-tags {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.doc-tags {
  margin: 4px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.related-cards-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #262626;
    }
  }

  .related-cards-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .related-card-item {
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }

    .card-meta-tags {
      margin-top: 8px;
    }
  }
}

.preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.preview-container {
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;

  .preview-title-section {
    display: flex;
    align-items: center;
    gap: 12px;

    .preview-icon {
      font-size: 28px;
      color: #1890ff;
    }

    .preview-title-info {
      .preview-filename {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
        color: #262626;
        max-width: 400px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .preview-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #8c8c8c;

        .meta-divider {
          color: #d9d9d9;
        }
      }
    }
  }
}

.preview-body {
  flex: 1;
  overflow: auto;
  background: #fff;

  .image-preview-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 24px;
    background: #fafafa;

    .preview-image {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  .pdf-preview-wrapper {
    height: 75vh;
    width: 100%;

    .preview-iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  }

  .text-preview-wrapper,
  .office-preview-wrapper {
    padding: 24px;

    .text-content {
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-radius: 4px;
      padding: 16px;
      max-height: 60vh;
      overflow: auto;

      pre {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: #262626;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    }

    .no-content-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      text-align: center;

      p {
        margin: 0 0 4px 0;
        font-size: 14px;
        color: #595959;
      }
    }
  }

  .office-preview-wrapper {
    .office-preview-header {
      margin-bottom: 16px;
    }
  }

  .other-preview-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 24px;

    .file-info-card {
      text-align: center;
      padding: 48px;

      h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
        color: #262626;
        word-break: break-all;
      }

      p {
        margin: 0;
      }
    }
  }
}

@media (max-width: 768px) {
  .preview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .preview-title-section {
      .preview-title-info {
        .preview-filename {
          max-width: 250px;
        }
      }
    }

    .preview-actions {
      width: 100%;
      
      :deep(.ant-space) {
        width: 100%;
        flex-wrap: wrap;
      }
    }
  }
}
</style>