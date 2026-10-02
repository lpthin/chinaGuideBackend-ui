<template>
  <div class="image-library-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card stat-card-blue" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <PictureOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.total }}</div>
                <div class="stat-title">图片总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card stat-card-purple" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <InboxOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalSize }}</div>
                <div class="stat-title">总容量</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card stat-card-green" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalUsed }}</div>
                <div class="stat-title">使用次数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card stat-card-orange" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <FolderOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ categoryCount }}</div>
                <div class="stat-title">分类数</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <!-- 卡头 #title/#extra 两处控件并到一行 FilterBar：#title 槽 overflow:hidden，窄容器下会被裁 -->
        <filter-bar>
          <a-select
            v-model:value="queryParams.category"
            style="width: 150px"
            placeholder="选择分类"
            allowClear
            @change="handleQueryChange"
          >
            <a-select-option v-for="cat in categories" :key="cat.category" :value="cat.category">
              {{ cat.category }}（{{ cat.count }}）
            </a-select-option>
          </a-select>
          <a-select
            v-model:value="queryParams.fileType"
            style="width: 120px"
            placeholder="文件类型"
            allowClear
            @change="handleQueryChange"
          >
            <a-select-option value="image">图片</a-select-option>
            <a-select-option value="video">视频</a-select-option>
            <a-select-option value="document">文档</a-select-option>
          </a-select>
          <a-input-search
            v-model:value="queryParams.keyword"
            placeholder="搜索文件名/标签"
            style="width: 250px"
            enter-button
            @search="handleQueryChange"
          />
          <a-radio-group v-model:value="viewMode" button-style="solid">
            <a-radio-button value="grid">网格视图</a-radio-button>
            <a-radio-button value="list">列表视图</a-radio-button>
          </a-radio-group>
          <template #actions>
            <a-space>
              <a-button v-if="selectedKeys.length" type="link" danger @click="batchDelete">
                批量删除 ({{ selectedKeys.length }})
              </a-button>
              <a-button type="primary" @click="showUploadModal = true">
                <template #icon><UploadOutlined /></template>
                上传文件
              </a-button>
            </a-space>
          </template>
        </filter-bar>

        <!-- 网格视图 -->
        <div v-if="viewMode === 'grid'" class="grid-view">
          <a-row :gutter="16">
            <a-col :span="6" v-for="item in imageList" :key="item.id">
              <div
                class="grid-item"
                :class="{ selected: selectedKeys.includes(item.id) }"
                @click="toggleSelect(item.id)"
              >
                <div class="image-thumbnail">
                  <!-- 素材库自 Spec-J 起列的是全部类别（文档、取证截图都在里面），
                       无脑 <img> 会让 .docx 与磁盘上已不存在的文件在网格里画成碎图，
                       还往控制台刷 onerror。非图片给类别块，图片读不出来给占位。 -->
                  <img
                    v-if="isImageItem(item) && !failedIds.has(item.id)"
                    :src="item.url"
                    :alt="item.name"
                    @error="onThumbError(item.id)"
                  />
                  <div v-else class="file-tile">
                    <PictureOutlined v-if="isImageItem(item)" class="file-tile__icon" />
                    <span v-else class="file-tile__ext">{{ extOf(item) }}</span>
                    <span class="file-tile__note">{{ isImageItem(item) ? '文件读不出来' : '非图片' }}</span>
                  </div>
                  <div class="overlay">
                    <a-space>
                      <a-button type="primary" size="small" @click.stop="previewImage(item)">
                        <EyeOutlined />
                      </a-button>
                      <a-button type="primary" size="small" @click.stop="copyUrl(item)">
                        <CopyOutlined />
                      </a-button>
                      <a-popconfirm
                        title="确定要删除这张图片吗？"
                        @confirm="handleDelete(item.id)"
                      >
                        <a-button size="small" danger><DeleteOutlined /></a-button>
                      </a-popconfirm>
                    </a-space>
                  </div>
                </div>
                <div class="image-info">
                  <div class="image-name" :title="item.name">{{ item.name }}</div>
                  <div v-if="getItemTags(item).length" class="image-tags">
                    <a-tag
                      v-for="tag in getItemTags(item)"
                      :key="tag"
                      size="small"
                      color="blue"
                    >
                      {{ tag }}
                    </a-tag>
                  </div>
                  <div class="image-meta">
                    <span>{{ formatFileSize(item.fileSize) }}</span>
                    <span>{{ item.useCount }} 次使用</span>
                  </div>
                </div>
              </div>
            </a-col>
          </a-row>
        </div>

        <!-- 列表视图 -->
        <div v-else class="list-view">
          <a-table
            :scroll="{ x: 'max-content' }"
            :data-source="imageList"
            :columns="listColumns"
            :row-key="(record: any) => record.id"
            :row-selection="tableRowSelection"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'preview'">
                <img
                  v-if="isImageItem(record) && !failedIds.has(record.id)"
                  :src="record.url"
                  class="table-thumbnail"
                  @click="previewImage(record)"
                  @error="onThumbError(record.id)"
                />
                <div v-else class="file-tile file-tile--small">
                  <PictureOutlined v-if="isImageItem(record)" class="file-tile__icon" />
                  <span v-else class="file-tile__ext">{{ extOf(record) }}</span>
                </div>
              </template>
              <template v-else-if="column.key === 'tags'">
                <div class="table-tags">
                  <a-tag
                    v-for="tag in getItemTags(record).slice(0, 3)"
                    :key="tag"
                    size="small"
                    color="blue"
                  >
                    {{ tag }}
                  </a-tag>
                  <span v-if="getItemTags(record).length > 3" class="more-tags">
                    +{{ getItemTags(record).length - 3 }}
                  </span>
                </div>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="previewImage(record)">预览</a-button>
                  <a-button type="link" size="small" @click="copyUrl(record)">复制链接</a-button>
                  <a-popconfirm
                    title="确定要删除这张图片吗？"
                    @confirm="handleDelete(record.id)"
                  >
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>

        <div class="pagination-wrapper">
          <a-pagination
            v-model:current="pagination.page"
            v-model:pageSize="pagination.size"
            :total="pagination.total"
            :show-size-changer="true"
            :show-quick-jumper="true"
            :page-size-options="['12', '24', '48', '96']"
            :show-total="(total: number) => `共 ${total} 条`"
            @change="handlePageChange"
          />
        </div>
      </a-card>
    </a-spin>

    <!-- 上传弹窗 -->
    <a-modal
      v-model:open="showUploadModal"
      title="上传文件"
      @ok="handleUploadOk"
      :confirm-loading="uploading"
      width="700px"
    >
      <a-upload-dragger
        v-model:file-list="uploadFileList"
        :before-upload="beforeUpload"
        :show-upload-list="true"
        :multiple="true"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
      >
        <p class="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p class="ant-upload-text">点击或拖拽文件到这个区域上传</p>
        <p class="ant-upload-hint">
          支持单个或批量上传图片、视频和文档文件
        </p>
      </a-upload-dragger>
      <div style="margin-top: 16px">
        <a-form layout="vertical">
          <a-form-item label="分类">
            <a-select
              v-model:value="uploadCategory"
              style="width: 100%"
              placeholder="选择分类"
              allowClear
              show-search
              :filter-option="filterCategoryOption"
            >
              <a-select-option v-for="cat in categories" :key="cat.category" :value="cat.category">
                {{ cat.category }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-form>
      </div>
    </a-modal>

    <!-- 图片预览弹窗 -->
    <a-modal
      v-model:open="showPreviewModal"
      :title="previewItem?.name"
      :footer="null"
      width="800px"
    >
      <div style="text-align: center">
        <img
          v-if="previewItem && isImageItem(previewItem) && !failedIds.has(previewItem.id)"
          :src="previewItem.url"
          style="max-width: 100%; max-height: 500px"
          @error="onThumbError(previewItem.id)"
        />
        <div v-else-if="previewItem" class="preview-fallback">
          <PictureOutlined />
          <p>{{ isImageItem(previewItem) ? '这张图在服务器上读不出来了（文件可能已被清理），下面的地址是它记录的位置' : `这不是图片，是 ${extOf(previewItem)} 文件，预览打不开` }}</p>
        </div>
        <div style="margin-top: 16px; text-align: left">
          <p><strong>文件名：</strong>{{ previewItem?.name }}</p>
          <p><strong>文件大小：</strong>{{ previewItem?.fileSize ? formatFileSize(previewItem.fileSize) : '-' }}</p>
          <p><strong>分辨率：</strong>{{ formatResolution(previewItem) }}</p>
          <p><strong>分类：</strong>{{ previewItem?.category }}</p>
          <p><strong>标签：</strong>
            <a-tag v-for="tag in previewItem ? getItemTags(previewItem) : []" :key="tag" size="small" color="blue" style="margin-right: 4px">
              {{ tag }}
            </a-tag>
            <span v-if="!previewItem || !getItemTags(previewItem).length">-</span>
          </p>
          <p><strong>使用次数：</strong>{{ previewItem?.useCount }} 次</p>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PictureOutlined,
  InboxOutlined,
  EyeOutlined,
  FolderOutlined,
  UploadOutlined,
  CopyOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import { imageLibraryApi } from '../../api/article'
import { describeHttpError } from '../../api/http'
import { formatDateTime, formatFileSize } from '../../utils/format'
import type { ImageLibrary } from '../../types/article'
import { useAuthStore } from '../../stores/auth'
import { logError } from '../../utils/errorLog'
import FilterBar from '../../components/FilterBar.vue'

const authStore = useAuthStore()
const getTenantId = () => authStore.selectedTenantId || authStore.tenantId || 1

const loading = ref(false)
const uploading = ref(false)
const showUploadModal = ref(false)
const showPreviewModal = ref(false)
const previewItem = ref<ImageLibrary | null>(null)
const uploadCategory = ref('')
const uploadFileList = ref<any[]>([])

const stats = reactive({
  total: 0,
  totalSize: '0 KB',
  totalUsed: 0,
})

const queryParams = reactive({
  tenantId: getTenantId(),
  category: undefined as string | undefined,
  fileType: undefined as string | undefined,
  keyword: '',
})

const pagination = reactive({
  page: 1,
  size: 24,
  total: 0,
})

const viewMode = ref<'grid' | 'list'>('grid')
const selectedKeys = ref<number[]>([])
const imageList = ref<ImageLibrary[]>([])

// Spec-J：筛选项读 /media/categories 真数据。旧版这里硬编码六个假类别，
// 与库里的真实类别一个都对不上——选任何一项都筛不出东西。
const categories = ref<{ category: string; count: number }[]>([])

async function loadCategories() {
  try {
    categories.value = await imageLibraryApi.categories()
  } catch (error) {
    logError('article/image-library-view', '类别列表加载失败:', error)
    categories.value = []
  }
}

const categoryCount = computed(() => categories.value.length)

const listColumns = [
  { title: '预览', key: 'preview', width: 80 },
  { title: '文件名', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
  { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
  { title: '标签', key: 'tags', width: 200, ellipsis: true },
  { title: '文件大小', key: 'fileSize', width: 100, customRender: ({ record }: { record: ImageLibrary }) => formatFileSize(record.fileSize) },
  { title: '分辨率', key: 'resolution', width: 110, customRender: ({ record }: { record: ImageLibrary }) => formatResolution(record) },
  { title: '使用次数', dataIndex: 'useCount', key: 'useCount', width: 90 },
  { title: '上传时间', key: 'createdAt', width: 170, customRender: ({ record }: { record: ImageLibrary }) => formatDateTime(record.createdAt) },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 },
]

const tableRowSelection = computed(() => ({
  selectedRowKeys: selectedKeys.value,
  onChange: (keys: (string | number)[]) => {
    selectedKeys.value = keys.map(Number)
  },
}))

function formatResolution(item: ImageLibrary | null): string {
  if (!item || !item.width || !item.height) return '-'
  return `${item.width} × ${item.height}`
}

function getItemTags(item: ImageLibrary): string[] {
  if (!item.tags) return []
  if (Array.isArray(item.tags)) return item.tags
  if (typeof item.tags === 'string') return item.tags.split(',').filter(t => t.trim())
  return []
}

function toggleSelect(id: number) {
  const index = selectedKeys.value.indexOf(id)
  if (index > -1) {
    selectedKeys.value.splice(index, 1)
  } else {
    selectedKeys.value.push(id)
  }
}

function previewImage(item: ImageLibrary) {
  previewItem.value = item
  showPreviewModal.value = true
}

/** 读不出来的缩略图（磁盘上文件已被清理）记在这里：一块占位代替浏览器碎图 + 一条 onerror */
const failedIds = ref<Set<number>>(new Set())
function onThumbError(id: number) {
  if (!failedIds.value.has(id)) failedIds.value = new Set(failedIds.value).add(id)
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i

/**
 * 素材库列的是全部类别，fileType 存的是 MIME；上传时没识别出类型的行落在
 * application/octet-stream，只能退回按文件名后缀判。
 */
function isImageItem(item: ImageLibrary): boolean {
  const t = (item.fileType || '').toLowerCase()
  if (t.startsWith('image/')) return true
  if (t && t !== 'application/octet-stream') return false
  return IMAGE_EXT.test(item.url || '') || IMAGE_EXT.test(item.name || '')
}

function extOf(item: ImageLibrary): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(item.name || item.url || '')
  return m ? m[1].toUpperCase() : '文件'
}

function copyUrl(item: ImageLibrary) {
  const fullUrl = window.location.origin + item.url
  navigator.clipboard.writeText(fullUrl).then(() => {
    message.success('链接已复制')
  }).catch(() => {
    message.error('浏览器已阻止复制，请手动复制链接')
  })
}

function beforeUpload(file: any) {
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    message.error('文件大小不能超过 10MB')
    return false
  }
  return true
}

async function handleUploadOk() {
  if (uploadFileList.value.length === 0) {
    message.warning('请选择要上传的文件')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    uploadFileList.value.forEach((fileItem) => {
      if (fileItem.originFileObj) {
        formData.append('files', fileItem.originFileObj)
      }
    })
    if (uploadCategory.value) {
      formData.append('category', uploadCategory.value)
    }

    await imageLibraryApi.uploadBatch(formData)
    message.success('上传成功')
    showUploadModal.value = false
    uploadFileList.value = []
    uploadCategory.value = ''
    selectedKeys.value = []
    await loadData()
  } catch (error) {
    logError('article/image-library-view', '上传失败:', error)
    message.error(describeHttpError(error))
  } finally {
    uploading.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await imageLibraryApi.delete(id)
    message.success('删除成功')
    selectedKeys.value = selectedKeys.value.filter(k => k !== id)
    await loadData()
  } catch (error) {
    logError('article/image-library-view', '删除失败:', error)
    message.error(describeHttpError(error))
  }
}

async function batchDelete() {
  if (selectedKeys.value.length === 0) {
    message.warning('请选择要删除的文件')
    return
  }
  try {
    await imageLibraryApi.batchDelete(selectedKeys.value)
    message.success('批量删除成功')
    selectedKeys.value = []
    await loadData()
  } catch (error) {
    logError('article/image-library-view', '批量删除失败:', error)
    message.error(describeHttpError(error))
  }
}

function handleQueryChange() {
  pagination.page = 1
  loadData()
}

function handlePageChange(page: number, size: number) {
  pagination.page = page
  pagination.size = size
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      size: pagination.size,
    }
    if (queryParams.category) params.category = queryParams.category
    if (queryParams.fileType) params.fileType = queryParams.fileType
    if (queryParams.keyword) params.keyword = queryParams.keyword

    const result = await imageLibraryApi.list(params)
    imageList.value = result.records || []
    pagination.total = result.total || 0

    updateStats()
  } catch (error) {
    logError('article/image-library-view', '加载文件列表失败:', error)
    message.error(describeHttpError(error))
    imageList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function updateStats() {
  stats.total = pagination.total
  const totalBytes = imageList.value.reduce((sum, item) => sum + (item.fileSize || 0), 0)
  stats.totalSize = formatFileSize(totalBytes)
  stats.totalUsed = imageList.value.reduce((sum, item) => sum + (item.useCount || 0), 0)
}

function filterCategoryOption(input: string, option: any) {
  return String(option.value).toLowerCase().includes(input.toLowerCase())
}

onMounted(() => {
  loadData()
  loadCategories()
})
</script>

<style scoped lang="less">
.image-library-page {
  width: 100%;
  padding: 8px 0;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 12px;
  overflow: hidden;

  :deep(.ant-card-body) {
    padding: 20px;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  &.stat-card-blue {
    .stat-icon {
      background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
    }
  }

  &.stat-card-purple {
    .stat-icon {
      background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%);
    }
  }

  &.stat-card-green {
    .stat-icon {
      background: linear-gradient(135deg, #52c41a 0%, #95de64 100%);
    }
  }

  &.stat-card-orange {
    .stat-icon {
      background: linear-gradient(135deg, #fa8c16 0%, #ffd591 100%);
    }
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.grid-view {
  .grid-item {
    margin-bottom: 16px;
    border: 2px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.3s;
    cursor: pointer;

    &:hover {
      border-color: #1890ff;
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);

      .overlay {
        opacity: 1;
      }
    }

    &.selected {
      border-color: #52c41a;
    }
  }

  .image-thumbnail {
    position: relative;
    width: 100%;
    padding-top: 75%;
    background: #f5f5f5;

    img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .image-info {
    padding: 12px;
    background: #fff;
  }

  .image-name {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .image-tags {
    margin-bottom: 8px;
    min-height: 24px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;

    :deep(.ant-tag) {
      margin: 0;
    }
  }

  .image-meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #8c8c8c;
  }
}

.table-tags {
  display: flex;
  align-items: center;
  gap: 4px;

  .more-tags {
    font-size: 12px;
    color: #8c8c8c;
  }

  :deep(.ant-tag) {
    margin: 0;
  }
}

.table-thumbnail {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}

/* 非图片 / 读不出来的素材：跟 .image-thumbnail 一样铺满那块 4:3 的位置，别把网格顶变形 */
.file-tile {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #8c8c8c;
  background: #fafafa;

  &__icon {
    font-size: 22px;
  }

  &__ext {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  &__note {
    font-size: 11px;
  }

  &--small {
    position: static;
    width: 60px;
    height: 60px;
    border-radius: 4px;
    background: #fafafa;
  }
}

.preview-fallback {
  padding: 40px 0;
  color: #8c8c8c;
  font-size: 24px;

  p {
    margin-top: 12px;
    font-size: 13px;
  }
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
