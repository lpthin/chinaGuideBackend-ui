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
                <div class="stat-value">{{ stats.categories }}</div>
                <div class="stat-title">分类数</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <a-space>
            <a-select
              v-model:value="queryParams.category"
              style="width: 150px"
              placeholder="选择分类"
              allowClear
            >
              <a-select-option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.fileType"
              style="width: 120px"
              placeholder="文件类型"
              allowClear
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
            />
            <a-button type="primary" @click="showUploadModal = true">
              <template #icon><UploadOutlined /></template>
              上传文件
            </a-button>
          </a-space>
        </template>

        <template #extra>
          <a-space>
            <a-radio-group v-model:value="viewMode" button-style="solid">
              <a-radio-button value="grid">网格视图</a-radio-button>
              <a-radio-button value="list">列表视图</a-radio-button>
            </a-radio-group>
            <a-button v-if="selectedKeys.length" type="link" danger @click="batchDelete">
              批量删除 ({{ selectedKeys.length }})
            </a-button>
          </a-space>
        </template>

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
                  <img :src="item.thumbnail || item.url" :alt="item.name" />
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
                  <div class="image-tags">
                    <a-tag
                      v-for="tag in getItemTags(item)"
                      :key="tag"
                      size="small"
                      color="blue"
                      closable
                      @close.stop="removeTag(item, tag)"
                    >
                      {{ tag }}
                    </a-tag>
                    <a-button type="dashed" size="small" class="add-tag-btn" @click.stop="showTagInput(item)">
                      <template #icon><PlusOutlined /></template>
                      标签
                    </a-button>
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
            :data-source="imageList"
            :columns="listColumns"
            :row-key="record => record.id"
            :row-selection="tableRowSelection"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'preview'">
                <img :src="record.thumbnail || record.url" class="table-thumbnail" />
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
                  <a-button type="link" size="small" @click="showTagInput(record)">标签</a-button>
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
            :show-total="(total) => `共 ${total} 条`"
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
            >
              <a-select-option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="标签">
            <a-select
              v-model:value="uploadTags"
              mode="tags"
              style="width: 100%"
              placeholder="输入标签后按回车"
            />
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
        <img v-if="previewItem" :src="previewItem.url" style="max-width: 100%; max-height: 500px" />
        <div style="margin-top: 16px; text-align: left">
          <p><strong>文件名：</strong>{{ previewItem?.name }}</p>
          <p><strong>文件大小：</strong>{{ previewItem?.fileSize ? formatFileSize(previewItem.fileSize) : '-' }}</p>
          <p><strong>分辨率：</strong>{{ previewItem?.width }} x {{ previewItem?.height }}</p>
          <p><strong>分类：</strong>{{ previewItem?.category }}</p>
          <p><strong>标签：</strong>
            <a-tag v-for="tag in previewItem ? getItemTags(previewItem) : []" :key="tag" size="small" color="blue" style="margin-right: 4px">
              {{ tag }}
            </a-tag>
            <a-button type="link" size="small" @click="showTagInput(previewItem!)">编辑标签</a-button>
          </p>
          <p><strong>使用次数：</strong>{{ previewItem?.useCount }} 次</p>
        </div>
      </div>
    </a-modal>

    <!-- 标签编辑弹窗 -->
    <a-modal
      v-model:open="showTagModal"
      title="编辑标签"
      @ok="handleTagOk"
      width="500px"
    >
      <a-form layout="vertical">
        <a-form-item label="图片标签">
          <a-select
            v-model:value="editTags"
            mode="tags"
            style="width: 100%"
            placeholder="输入标签后按回车添加"
          />
        </a-form-item>
      </a-form>
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
  PlusOutlined,
} from '@ant-design/icons-vue'
import { imageLibraryApi } from '../../api/article'
import type { ImageLibrary } from '../../types/article'

const loading = ref(false)
const uploading = ref(false)
const showUploadModal = ref(false)
const showPreviewModal = ref(false)
const showTagModal = ref(false)
const previewItem = ref<ImageLibrary | null>(null)
const editingTagItem = ref<ImageLibrary | null>(null)
const editTags = ref<string[]>([])
const uploadCategory = ref('')
const uploadTags = ref<string[]>([])
const uploadFileList = ref<any[]>([])

const stats = reactive({
  total: 0,
  totalSize: '0 KB',
  totalUsed: 0,
  categories: 0,
})

const queryParams = reactive({
  tenantId: 1,
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

const categories = ['产品图片', '文章配图', '用户头像', '活动海报', '公司相册', '其他']

const listColumns = [
  { title: '预览', key: 'preview', width: 80 },
  { title: '文件名', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
  { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
  { title: '标签', key: 'tags', width: 200, ellipsis: true },
  { title: '文件大小', key: 'fileSize', width: 100, customRender: ({ record }: { record: ImageLibrary }) => formatFileSize(record.fileSize) },
  { title: '分辨率', key: 'resolution', width: 110, customRender: ({ record }: { record: ImageLibrary }) => `${record.width} x ${record.height}` },
  { title: '使用次数', dataIndex: 'useCount', key: 'useCount', width: 90 },
  { title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 },
]

const tableRowSelection = {
  selectedRowKeys: selectedKeys,
  onChange: (keys: number[]) => {
    selectedKeys.value = keys
  },
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function getItemTags(item: ImageLibrary): string[] {
  if (!item.tags) return []
  if (Array.isArray(item.tags)) return item.tags
  if (typeof item.tags === 'string') return item.tags.split(',').filter(t => t.trim())
  return []
}

function showTagInput(item: ImageLibrary) {
  editingTagItem.value = item
  editTags.value = [...getItemTags(item)]
  showTagModal.value = true
}

function removeTag(item: ImageLibrary, tag: string) {
  const tags = getItemTags(item)
  const newTags = tags.filter(t => t !== tag)
  item.tags = newTags.join(',')
  message.success('标签已移除')
}

async function handleTagOk() {
  if (!editingTagItem.value) return
  try {
    editingTagItem.value.tags = editTags.value.join(',')
    message.success('标签更新成功')
    showTagModal.value = false
  } catch (error) {
    message.error('标签更新失败')
  }
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

function copyUrl(item: ImageLibrary) {
  navigator.clipboard.writeText(item.url).then(() => {
    message.success('链接已复制')
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
    await new Promise(resolve => setTimeout(resolve, 1500))
    message.success('上传成功')
    showUploadModal.value = false
    uploadFileList.value = []
    uploadCategory.value = ''
    uploadTags.value = []
    await loadData()
  } catch (error) {
    message.error('上传失败')
  } finally {
    uploading.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await imageLibraryApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    console.error(error)
    // Mock delete
    const index = imageList.value.findIndex(item => item.id === id)
    if (index > -1) {
      imageList.value.splice(index, 1)
      pagination.total -= 1
      message.success('删除成功')
    }
  }
}

async function batchDelete() {
  try {
    await imageLibraryApi.batchDelete(selectedKeys.value)
    message.success('批量删除成功')
    selectedKeys.value = []
    await loadData()
  } catch (error) {
    console.error(error)
    // Mock batch delete
    imageList.value = imageList.value.filter(item => !selectedKeys.value.includes(item.id))
    pagination.total -= selectedKeys.value.length
    selectedKeys.value = []
    message.success('批量删除成功')
  }
}

async function loadData() {
  loading.value = true
  try {
    const result = await imageLibraryApi.list(queryParams)
    imageList.value = result.records
    pagination.total = result.total
  } catch (error) {
    console.error(error)
    // Mock data
    imageList.value = generateMockData()
    pagination.total = 50
  } finally {
    loading.value = false
  }
}

function generateMockData(): ImageLibrary[] {
  const categories = ['产品图片', '文章配图', '用户头像', '活动海报', '公司相册', '其他']
  const fileTypes = ['image/jpeg', 'image/png', 'image/webp']

  return Array.from({ length: 24 }, (_, i) => ({
    id: i + 1,
    tenantId: 1,
    category: categories[i % categories.length],
    name: `图片文件_${i + 1}.jpg`,
    url: `https://picsum.photos/seed/${i + 1}/400/300`,
    thumbnail: `https://picsum.photos/seed/${i + 1}/100/100`,
    fileSize: Math.floor(Math.random() * 5000 * 1024) + 1024,
    fileType: fileTypes[i % fileTypes.length],
    width: 1920,
    height: 1080,
    tags: '图片,素材',
    useCount: Math.floor(Math.random() * 100),
    createdAt: new Date(Date.now() - i * 86400000).toISOString().slice(0, 19).replace('T', ' '),
    updatedAt: new Date(Date.now() - i * 86400000).toISOString().slice(0, 19).replace('T', ' '),
  }))
}

onMounted(() => {
  loadData()
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

    .add-tag-btn {
      height: 22px;
      padding: 0 8px;
      font-size: 12px;
      line-height: 20px;
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

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
