<template>
  <div class="media-panel-page">
    <!-- 分类列表视图 -->
    <template v-if="!currentCategoryId">
      <div class="panel-header">
        <div>
          <h2>资料库项目</h2>
          <p class="subtitle">创建项目，上传文档和图片，自动解析向量化</p>
        </div>
        <a-button type="primary" @click="showNewCategoryModal = true">
          <template #icon><PlusOutlined /></template>
          新建项目
        </a-button>
      </div>

      <a-spin :spinning="loading">
        <a-row :gutter="16">
          <a-col :span="6" v-for="category in categories" :key="category.id">
            <a-card class="project-card" hoverable @click="enterCategory(category.id)">
              <div class="project-cover">
                <div class="cover-placeholder">
                  <FolderOpenOutlined />
                </div>
              </div>
              <a-card-meta :title="category.name">
                <template #description>
                  {{ category.description || '暂无描述' }}
                </template>
              </a-card-meta>
            </a-card>
          </a-col>
          <a-col :span="24" v-if="categories.length === 0 && !loading">
            <a-empty description="暂无项目，点击新建项目创建" />
          </a-col>
        </a-row>
      </a-spin>

      <a-modal v-model:open="showNewCategoryModal" title="新建项目" @ok="createCategory">
        <a-input v-model:value="newCategoryName" placeholder="请输入项目名称" @pressEnter="createCategory" />
      </a-modal>
    </template>

    <!-- 分类详情视图 -->
    <template v-else>
      <div class="panel-header">
        <a-space>
          <a-button @click="backToCategories">
            <template #icon><ArrowLeftOutlined /></template>
            返回
          </a-button>
          <h3 style="margin: 0">{{ getCategoryName(currentCategoryId) }}</h3>
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

      <a-card :loading="loading">
        <template #extra>
          <a-space>
            <a-select
              v-model:value="selectedTag"
              placeholder="按标签筛选"
              style="width: 160px"
              allow-clear
              @change="loadDocuments"
            >
              <a-select-option v-for="tag in tags" :key="tag.name" :value="tag.name">
                <a-tag :color="tag.color" style="margin-right: 0">{{ tag.name }}</a-tag>
              </a-select-option>
            </a-select>
            <a-input-search v-model:value="searchText" placeholder="搜索文件" style="width: 200px" @search="loadDocuments" />
            <template v-if="selectedIds.length > 0">
              <a-button size="small" @click="showBatchCategoryModal">
                设置项目
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
                    v-if="isImageFile(file) && !failedImageIds.has(file.id)"
                    :src="getMediaFileUrl(file)"
                    :alt="file.originalName || file.fileName"
                    @error="onImageError(file.id)"
                  />
                  <div v-else-if="isImageFile(file)" class="file-placeholder image-placeholder">
                    <PictureOutlined />
                  </div>
                  <div v-else-if="isVideoFile(file)" class="file-placeholder video-placeholder">
                    <VideoCameraOutlined />
                  </div>
                  <div v-else class="file-placeholder document-placeholder">
                    <FileTextOutlined />
                  </div>
                </div>
              </template>
              <a-card-meta>
                <template #title>
                  <a-typography-paragraph :ellipsis="{ rows: 1 }" :content="file.originalName || file.fileName" style="margin: 0; font-size: 13px" />
                </template>
                <template #description>
                  <span style="font-size: 12px">{{ formatFileSize(file.fileSize) }}</span>
                  <div v-if="file.tags && file.tags.length" class="doc-tags">
                    <a-tag
                      v-for="tag in file.tags.filter((t: string) => t)"
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
          <a-col :span="24" v-if="filteredFiles.length === 0 && !loading">
            <a-empty description="暂无文件" />
          </a-col>
        </a-row>

        <!-- 列表视图 -->
        <a-table
          v-else
          :columns="mediaColumns"
          :data-source="filteredFiles"
          :pagination="pagination"
          :loading="loading"
          row-key="id"
          :row-selection="{ selectedRowKeys: selectedIds, onChange: (keys: any) => selectedIds = keys }"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <a-space>
                <FileImageOutlined v-if="isImageFile(record)" />
                <VideoCameraOutlined v-else-if="isVideoFile(record)" />
                <FileTextOutlined v-else />
                <span>{{ record.originalName || record.fileName }}</span>
              </a-space>
            </template>
            <template v-if="column.key === 'tags'">
              <template v-if="record.tags && record.tags.length">
                <a-tag
                  v-for="tag in record.tags.filter((t: string) => t)"
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

    <!-- 文档预览弹窗 -->
    <a-modal
      v-model:open="docPreviewVisible"
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
              <a-button 
                type="primary" 
                @click="startGenerateCards" 
                :loading="cardGenerating"
                :disabled="cardGenerationStatus === 'PROCESSING'"
              >
                <template #icon><FileSearchOutlined /></template>
                {{ cardGenerationStatus === 'PROCESSING' ? '生成中...' : '生成知识卡片' }}
              </a-button>
              <a-button type="primary" @click="downloadCurrentDoc">
                <template #icon><DownloadOutlined /></template>
                下载
              </a-button>
              <a-button @click="closePreviewModal">
                关闭
              </a-button>
            </a-space>
          </div>
        </div>

        <div class="preview-body">
          <template v-if="currentPreviewType === 'image'">
            <div class="image-preview-wrapper">
              <img
                v-if="!failedImageIds.has(`preview-${previewDocData?.id || previewMediaData?.id}`)"
                :src="previewDocData?.fileDownloadUrl || getMediaFileUrl(previewMediaData)"
                :alt="previewDocData?.originalName || previewMediaData?.originalName"
                class="preview-image"
                @error="onImageError(`preview-${previewDocData?.id || previewMediaData?.id}`)"
              />
              <div v-else class="preview-image-placeholder">
                <PictureOutlined style="font-size: 64px; color: #d9d9d9" />
                <p style="margin-top: 12px; color: #8c8c8c">图片加载失败</p>
              </div>
            </div>
            <div v-if="previewMediaData?.ocrStatus === 'COMPLETED'" class="ocr-result-section">
              <div v-if="previewMediaData?.aiDescription" class="ocr-field">
                <span class="ocr-label">AI描述：</span>
                <span class="ocr-text">{{ previewMediaData.aiDescription }}</span>
              </div>
              <div v-if="previewMediaData?.ocrText" class="ocr-field">
                <span class="ocr-label">OCR文字：</span>
                <span class="ocr-text">{{ previewMediaData.ocrText }}</span>
              </div>
            </div>
            <div v-else-if="previewMediaData?.ocrStatus === 'ANALYZING'" class="ocr-result-section">
              <a-spin tip="图片分析中..." />
            </div>
            <div v-else-if="previewMediaData?.ocrStatus === 'FAILED'" class="ocr-result-section">
              <span style="color: #ff4d4f">图片分析失败</span>
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

          <!-- 卡片生成区域 -->
          <div 
            v-if="cardGenerationStatus || generatedCards.length > 0" 
            class="card-generation-section"
          >
            <div class="section-header">
              <h4>
                <FileSearchOutlined />
                知识卡片生成
              </h4>
              <a-tag :color="getCardGenerationStatusColor(cardGenerationStatus)">
                {{ getCardGenerationStatusText(cardGenerationStatus) }}
              </a-tag>
            </div>

            <!-- 生成状态和进度 -->
            <div v-if="cardGenerationStatus && cardGenerationStatus !== 'COMPLETED'" class="status-info">
              <a-progress 
                v-if="cardGenerationStatus === 'PROCESSING'" 
                :percent="cardGenerationProgress" 
                status="active"
                style="margin-bottom: 12px"
              />
              <div v-if="cardGenerationMessage" class="status-item">
                <span class="status-text">{{ cardGenerationMessage }}</span>
              </div>
              <div v-if="cardGenerationError" class="status-item">
                <ExclamationCircleOutlined class="status-icon-error" />
                <span class="status-text" style="color: #ff4d4f">{{ cardGenerationError }}</span>
              </div>
            </div>

            <!-- 生成完成的卡片列表 -->
            <div v-if="generatedCards.length > 0">
              <a-alert 
                v-if="cardGenerationStatus === 'COMPLETED'"
                message="卡片生成成功"
                :description="`已成功从文档中提取并生成 ${generatedCards.length} 张知识卡片`"
                type="success"
                show-icon
                style="margin-bottom: 16px"
              />
              <div class="generated-cards-grid">
                <a-card 
                  v-for="card in generatedCards" 
                  :key="card.id"
                  size="small"
                  class="generated-card-item"
                  @click="goToCardDetail(card.id)"
                >
                  <template #title>
                    <a-typography-paragraph :ellipsis="{ rows: 1 }" style="margin: 0; font-weight: 500">
                      {{ card.title }}
                    </a-typography-paragraph>
                  </template>
                  <a-typography-paragraph :ellipsis="{ rows: 2 }" style="margin: 0; font-size: 13px; color: #595959">
                    {{ card.content }}
                  </a-typography-paragraph>
                  <div v-if="card.tagList && card.tagList.length" style="margin-top: 8px">
                    <a-tag 
                      v-for="tag in card.tagList.slice(0, 3)" 
                      :key="tag"
                      size="small"
                      color="blue"
                    >
                      {{ tag }}
                    </a-tag>
                  </div>
                </a-card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- 批量设置项目弹窗 -->
    <a-modal v-model:open="batchCategoryModalVisible" title="批量移动到项目" width="500px">
      <a-form layout="vertical">
        <a-form-item label="选择项目">
          <a-select
            v-model:value="batchCategoryId"
            placeholder="请选择项目"
            style="width: 100%"
            :allow-clear="true"
          >
            <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <p style="color: #8c8c8c; font-size: 12px">
          将把选中的 {{ selectedIds.length }} 个文档移动到所选项目
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
import { ref, computed, onMounted, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined,
  UploadOutlined,
  ArrowLeftOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  PictureOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  LeftOutlined,
  RightOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons-vue'
import { knowledgeDocumentApi, knowledgeCategoryApi, knowledgeTagApi, knowledgeCardApi } from '../../api/knowledge'
import type { KnowledgeCategory, KnowledgeTag, KnowledgeCard, KnowledgeDocument } from '../../types/knowledge'
import { formatTime as formatAbsoluteTime } from '@/v2/utils/format'
import { useAuthStore } from '../../stores/auth'

// ==================== 知识库文档相关状态 ====================
const auth = useAuthStore()
const loading = ref(false)
const uploading = ref(false)
const categories = ref<KnowledgeCategory[]>([])
const documents = ref<KnowledgeDocument[]>([])
const currentCategoryId = ref<number | null>(null)
const viewMode = ref('grid')
const searchText = ref('')
const selectedIds = ref<number[]>([])
const showNewCategoryModal = ref(false)
const newCategoryName = ref('')
const docPreviewVisible = ref(false)
const previewDocData = ref<any | null>(null)
const previewMediaData = ref<any | null>(null)
const previewIndex = ref(-1)
const savingCategory = ref(false)
const editingCategoryId = ref<number | null>(null)
const batchCategoryModalVisible = ref(false)
const batchCategoryId = ref<number | null>(null)
const batchSaving = ref(false)
const tags = ref<KnowledgeTag[]>([])
const selectedTag = ref<string>('')
const batchTagModalVisible = ref(false)
const batchTagValue = ref<string[]>([])
const batchTagSaving = ref(false)
const editingTags = ref<string[]>([])
const relatedCards = ref<KnowledgeCard[]>([])
const relatedCardsLoading = ref(false)
const pagination = ref({
  page: 1,
  size: 20,
  total: 0
})

// 卡片生成相关状态
const cardGenerating = ref(false)
const cardGenerationTaskId = ref<string | null>(null)
const cardGenerationStatus = ref<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | null>(null)
const cardGenerationProgress = ref(0)
const cardGenerationMessage = ref('')
const cardGenerationError = ref('')
const generatedCards = ref<KnowledgeCard[]>([])
let cardGenerationPollingTimer: ReturnType<typeof setInterval> | null = null

const previewLoading = ref(false)

// 记录加载失败的图片 key，用于触发占位图标渲染
const failedImageIds = ref<Set<string | number>>(new Set())

function onImageError(key: string | number) {
  if (!failedImageIds.value.has(key)) {
    failedImageIds.value = new Set(failedImageIds.value).add(key)
  }
}

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
  const result = documents.value as any[]
  if (searchText.value) {
    return result.filter((f: any) => 
      (f.originalName || f.fileName || '').includes(searchText.value)
    )
  }
  if (selectedTag.value) {
    return result.filter((f: any) => {
      const fileTags = Array.isArray(f.tags) ? f.tags : (f.tags ? f.tags.split(',') : [])
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
  const docData = previewDocData.value || previewMediaData.value
  if (docData) {
    const fileName = docData.originalName || docData.fileName || ''
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

// ==================== 知识库文档相关方法 ====================
async function loadCategories() {
  loading.value = true
  try {
    const result = await knowledgeCategoryApi.all(auth.selectedTenantId!) as any
    categories.value = result
  } catch (e) {
    console.error('加载分类失败:', e)
    message.error('加载项目失败')
    categories.value = []
  } finally {
    loading.value = false
  }
}

async function loadDocuments() {
  if (!currentCategoryId.value) return
  loading.value = true
  try {
    const params: any = {
      tenantId: auth.selectedTenantId!,
      categoryId: currentCategoryId.value,
      page: pagination.value.page,
      size: pagination.value.size
    }
    if (searchText.value) {
      params.keyword = searchText.value
    }
    if (selectedTag.value) {
      params.tag = selectedTag.value
    }
    const result = await knowledgeDocumentApi.list(params) as any
    documents.value = result.records
    pagination.value.total = result.total
  } catch (e) {
    console.error('加载文档列表失败:', e)
    message.error('加载文档列表失败')
    documents.value = []
    pagination.value.total = 0
  } finally {
    loading.value = false
  }
}

function enterCategory(categoryId: number) {
  currentCategoryId.value = categoryId
  selectedIds.value = []
  pagination.value.page = 1
  loadDocuments()
}

function backToCategories() {
  currentCategoryId.value = null
  documents.value = []
  selectedIds.value = []
  loadCategories()
}

async function createCategory() {
  const name = newCategoryName.value.trim()
  if (!name) {
    message.warning('请输入项目名称')
    return
  }
  showNewCategoryModal.value = false
  newCategoryName.value = ''
  try {
    await knowledgeCategoryApi.create({
      tenantId: auth.selectedTenantId!,
      name,
      icon: 'folder',
      description: ''
    })
    message.success(`项目「${name}」已创建`)
    await loadCategories()
  } catch (e) {
    console.error('创建分类失败:', e)
    message.error('创建项目失败')
  }
}

async function handleBatchUpload(file: File): Promise<boolean> {
  if (!currentCategoryId.value) return false

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    await knowledgeDocumentApi.upload(auth.selectedTenantId!, formData)
    message.success(`${file.name} 上传成功`)
    await loadDocuments()
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

function downloadMediaFile(file: any) {
  const link = document.createElement('a')
  link.href = getMediaFileUrl(file)
  link.download = file.originalName || file.fileName
  link.click()
}

async function deleteMediaFile(id: number) {
  try {
    await knowledgeDocumentApi.delete(id)
    message.success('删除成功')
    await loadDocuments()
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
        await loadDocuments()
      } catch (e) {
        console.error('批量删除失败:', e)
        message.error('批量删除失败')
      }
    },
  })
}

// ==================== 标签相关方法 ====================
async function loadTags() {
  try {
    const result = await knowledgeTagApi.list({ tenantId: auth.selectedTenantId! }) as any
    tags.value = Array.isArray(result) ? result : (result as any).records || []
  } catch (e) {
    console.error('加载标签失败:', e)
    message.error('加载标签失败')
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
  editingTags.value = Array.isArray(file.tags) ? file.tags.filter((t: string) => t) : (file.tags ? file.tags.split(',').filter((t: string) => t) : [])
  
  const idx = filteredFiles.value.findIndex((f: any) => f.id === file.id)
  previewIndex.value = idx
  
  docPreviewVisible.value = true
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
    editingTags.value = Array.isArray(file.tags) ? file.tags.filter((t: string) => t) : (file.tags ? file.tags.split(',').filter((t: string) => t) : [])
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
    editingTags.value = Array.isArray(file.tags) ? file.tags.filter((t: string) => t) : (file.tags ? file.tags.split(',').filter((t: string) => t) : [])
    loadPreviewData(file.id)
    loadRelatedCards(file.id)
  }
}

function downloadCurrentDoc() {
  const id = previewDocData.value?.id || previewMediaData.value?.id
  if (!id) return
  const link = document.createElement('a')
  const baseUrl = previewDocData.value?.fileDownloadUrl || `/api/v2/knowledge/documents/${id}/file`
  const token = getFileToken()
  link.href = token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl
  link.download = previewDocData.value?.originalName || previewMediaData.value?.originalName
  link.click()
}

function getFileToken(): string {
  return auth.accessToken || localStorage.getItem('v2_access_token') || localStorage.getItem('geocms_token') || ''
}

function getMediaFileUrl(file: any): string {
  if (!file || !file.id) return ''
  const token = getFileToken()
  const baseUrl = `/api/v2/knowledge/documents/${file.id}/file`
  return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl
}

function getFileExt(fileName: string): string {
  if (!fileName || !fileName.includes('.')) return ''
  return fileName.substring(fileName.lastIndexOf('.') + 1).toUpperCase()
}

async function loadRelatedCards(docId: number) {
  if (!docId) return
  relatedCardsLoading.value = true
  try {
    const cards = await knowledgeDocumentApi.getCards(docId) as any
    relatedCards.value = cards
  } catch (e) {
    console.error('加载关联卡片失败:', e)
    relatedCards.value = []
  } finally {
    relatedCardsLoading.value = false
  }
}

function goToCardDetail(cardId: number) {
  docPreviewVisible.value = false
  window.open(`/knowledge/card/${cardId}`, '_blank')
}

// 开始生成知识卡片
async function startGenerateCards() {
  const docId = previewDocData.value?.id || previewMediaData.value?.id
  if (!docId) {
    message.error('无法获取文档ID')
    return
  }

  // 重置状态
  cardGenerating.value = true
  cardGenerationStatus.value = 'PENDING'
  cardGenerationProgress.value = 0
  cardGenerationMessage.value = '正在准备生成卡片...'
  cardGenerationError.value = ''
  generatedCards.value = []

  try {
    const result = await knowledgeDocumentApi.generateCards(docId) as any
    cardGenerationTaskId.value = result.taskId
    cardGenerationStatus.value = 'PROCESSING'
    cardGenerationMessage.value = '正在分析文档内容并提取知识卡片...'
    
    // 开始轮询状态
    startCardGenerationPolling(docId, result.taskId)
  } catch (e: any) {
    console.error('触发卡片生成失败:', e)
    cardGenerating.value = false
    cardGenerationStatus.value = 'FAILED'
    cardGenerationError.value = e.response?.data?.message || e.message || '触发卡片生成失败'
    message.error('触发卡片生成失败')
  }
}

// 开始轮询卡片生成状态
function startCardGenerationPolling(docId: number, taskId: string) {
  if (cardGenerationPollingTimer) {
    clearInterval(cardGenerationPollingTimer)
  }

  cardGenerationPollingTimer = setInterval(async () => {
    try {
      const result = await knowledgeDocumentApi.getCardsGenerationStatus(docId, taskId) as any
      cardGenerationStatus.value = result.status
      cardGenerationProgress.value = result.progress || 0
      cardGenerationMessage.value = result.message || ''
      
      if (result.status === 'COMPLETED') {
        // 生成完成
        cardGenerating.value = false
        generatedCards.value = result.cards || []
        stopCardGenerationPolling()
        message.success(`成功生成 ${generatedCards.value.length} 张知识卡片`)
      } else if (result.status === 'FAILED') {
        // 生成失败
        cardGenerating.value = false
        cardGenerationError.value = result.error || '卡片生成失败'
        stopCardGenerationPolling()
        message.error('卡片生成失败')
      }
    } catch (e: any) {
      console.error('获取卡片生成状态失败:', e)
    }
  }, 2000) // 每2秒轮询一次
}

// 停止轮询卡片生成状态
function stopCardGenerationPolling() {
  if (cardGenerationPollingTimer) {
    clearInterval(cardGenerationPollingTimer)
    cardGenerationPollingTimer = null
  }
}

// 获取卡片生成状态颜色
function getCardGenerationStatusColor(status: string | null): string {
  const map: Record<string, string> = {
    PENDING: 'default',
    PROCESSING: 'processing',
    COMPLETED: 'success',
    FAILED: 'error'
  }
  return map[status || ''] || 'default'
}

// 获取卡片生成状态文本
function getCardGenerationStatusText(status: string | null): string {
  const map: Record<string, string> = {
    PENDING: '待处理',
    PROCESSING: '生成中',
    COMPLETED: '已完成',
    FAILED: '失败'
  }
  return map[status || ''] || '未知状态'
}

// 重置卡片生成状态（关闭预览弹窗时调用）
function resetCardGenerationState() {
  stopCardGenerationPolling()
  cardGenerating.value = false
  cardGenerationTaskId.value = null
  cardGenerationStatus.value = null
  cardGenerationProgress.value = 0
  cardGenerationMessage.value = ''
  cardGenerationError.value = ''
  generatedCards.value = []
}

// 关闭预览弹窗
function closePreviewModal() {
  resetCardGenerationState()
  docPreviewVisible.value = false
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
    docPreviewVisible.value = false
    await loadDocuments()
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
    await loadDocuments()
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
    message.success(`已移动 ${selectedIds.value.length} 个文档到项目`)
    batchCategoryModalVisible.value = false
    selectedIds.value = []
    await loadDocuments()
  } catch (e) {
    console.error('批量设置分类失败:', e)
    message.error('批量移动到项目失败')
  } finally {
    batchSaving.value = false
  }
}

// ==================== 工具方法 ====================
const formatFileSize = (bytes?: number | null): string => {
  if (bytes == null) return '0 B'
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

function isImage(mimeType: string): boolean {
  return mimeType?.startsWith('image/') ?? false
}

function isImageFile(file: any): boolean {
  const fileName = file?.originalName || file?.fileName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)
}

function isVideo(mimeType: string): boolean {
  return mimeType?.startsWith('video/') ?? false
}

function isVideoFile(file: any): boolean {
  const fileName = file?.originalName || file?.fileName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)
}

function getCategoryName(categoryId: number | null): string {
  if (!categoryId) return '-'
  const category = categories.value.find(c => c.id === categoryId)
  return category?.name || '-'
}

function handleTableChange(pagination: any) {
  pagination.value.page = pagination.current
  pagination.value.size = pagination.pageSize
  loadDocuments()
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

function getOcrStatusColor(status: string): string {
  const map: Record<string, string> = {
    ANALYZING: 'processing',
    COMPLETED: 'success',
    FAILED: 'error',
  }
  return map[status] || 'default'
}

function getOcrStatusText(status: string): string {
  const map: Record<string, string> = {
    ANALYZING: '分析中',
    COMPLETED: '已分析',
    FAILED: '分析失败',
  }
  return map[status] || status
}

watch(
  () => auth.selectedTenantId,
  async () => {
    currentCategoryId.value = null
    documents.value = []
    selectedIds.value = []
    await loadCategories()
    await loadTags()
  }
)

onMounted(async () => {
  await loadCategories()
  await loadTags()
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

  :deep(.ant-card-cover) {
    height: 160px;
    overflow: hidden;
  }

  :deep(.ant-card-meta) {
    min-height: 88px;
  }
}

.media-preview {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  position: relative;
  cursor: pointer;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .file-placeholder {
    font-size: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-placeholder {
    color: #8c8c8c;
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

    .preview-image-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;

      p {
        margin: 12px 0 0 0;
        color: #8c8c8c;
      }
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

.ocr-result-section {
  padding: 16px 24px;
  background: #fafafa;
  border-top: 1px solid #f0f0f0;
}
.ocr-field {
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.6;
}
.ocr-label {
  font-weight: 500;
  color: #666;
}
.ocr-text {
  color: #333;
}

.card-generation-section {
  border-top: 1px solid #f0f0f0;
  background: #fafafa;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #262626;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .status-info {
    margin-bottom: 16px;

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .status-icon-success {
        color: #52c41a;
        font-size: 16px;
      }

      .status-icon-error {
        color: #ff4d4f;
        font-size: 16px;
      }

      .status-text {
        font-size: 14px;
        color: #595959;
      }
    }
  }

  .generated-cards-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    .generated-card-item {
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
      }
    }
  }
}
</style>