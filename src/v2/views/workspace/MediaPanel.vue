<template>
  <div class="media-panel-page">
    <!-- 项目列表视图 -->
    <template v-if="!currentProject">
      <div class="panel-header">
        <h3>媒体库</h3>
        <a-button type="primary" @click="showNewProjectModal = true">
          <template #icon><PlusOutlined /></template>
          新建项目
        </a-button>
      </div>

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
                {{ project.count }} 个文件 · {{ formatSize(project.totalSize) }}
                <br />
                <span style="font-size: 12px; color: #999">
                  {{ project.imageCount }} 图片 · {{ project.videoCount }} 视频
                </span>
              </template>
            </a-card-meta>
          </a-card>
        </a-col>
        <a-col :span="6" v-if="projects.length === 0 && !loading">
          <a-empty description="暂无项目，点击新建项目创建" />
        </a-col>
      </a-row>

      <!-- 新建项目弹窗 -->
      <a-modal v-model:open="showNewProjectModal" title="新建项目" @ok="createProject" :confirmLoading="creating">
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
            accept="image/*,video/*"
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
            <a-input-search v-model:value="searchText" placeholder="搜索文件" style="width: 200px" />
            <template v-if="selectedIds.length > 0">
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
                  <div v-else class="video-placeholder">
                    <VideoCameraOutlined />
                  </div>
                </div>
              </template>
              <a-card-meta>
                <template #title>
                  <a-typography-paragraph :ellipsis="{ rows: 1 }" :content="file.originalName" style="margin: 0; font-size: 13px" />
                </template>
                <template #description>
                  <span style="font-size: 12px">{{ formatSize(file.fileSize) }}</span>
                </template>
              </a-card-meta>
              <template #actions>
                <a @click="previewFile(file)">预览</a>
                <a @click="downloadFile(file)">下载</a>
                <a-popconfirm title="确认删除？" @confirm="deleteFile(file.id)">
                  <span style="color: #ff4d4f">删除</span>
                </a-popconfirm>
              </template>
            </a-card>
          </a-col>
        </a-row>

        <!-- 列表视图 -->
        <a-table
          v-else
          :columns="columns"
          :data-source="filteredFiles"
          :pagination="{ pageSize: 20 }"
          :loading="loading"
          row-key="id"
          :row-selection="{ selectedRowKeys: selectedIds, onChange: (keys: any) => selectedIds = keys }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <a-space>
                <FileImageOutlined v-if="isImage(record.mimeType)" />
                <VideoCameraOutlined v-else />
                <span>{{ record.originalName }}</span>
              </a-space>
            </template>
            <template v-if="column.key === 'size'">
              {{ formatSize(record.fileSize) }}
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatTime(record.createdAt) }}
            </template>
            <template v-if="column.key === 'action'">
              <a-space size="small">
                <a-button type="link" size="small" @click="previewFile(record)">预览</a-button>
                <a-button type="link" size="small" @click="downloadFile(record)">下载</a-button>
                <a-popconfirm title="确认删除？" @confirm="deleteFile(record.id)">
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </template>

    <!-- 预览弹窗 -->
    <a-modal v-model:open="previewVisible" :title="previewFileData?.originalName" :footer="null" width="800px">
      <div style="text-align: center">
        <img
          v-if="previewFileData && isImage(previewFileData.mimeType)"
          :src="`/api/v2/workspace/media/${previewFileData.id}/file`"
          style="max-width: 100%; max-height: 600px"
        />
        <video
          v-else-if="previewFileData"
          :src="`/api/v2/workspace/media/${previewFileData.id}/file`"
          controls
          style="max-width: 100%; max-height: 600px"
        />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  UploadOutlined,
  ArrowLeftOutlined,
  FolderOpenOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons-vue'
import { mediaApi } from '../../api'
import { formatTime } from '@/v2/utils/format'

interface MediaFile {
  id: number
  originalName?: string
  mimeType?: string
  fileSize: number
  createdAt: string
  category: string
}

interface Project {
  name: string
  displayName?: string
  count: number
  totalSize: number
  coverUrl: string | null
  imageCount: number
  videoCount: number
}

const loading = ref(false)
const uploading = ref(false)
const creating = ref(false)
const projects = ref<Project[]>([])
const files = ref<MediaFile[]>([])
const currentProject = ref<string | null>(null)
const viewMode = ref('grid')
const searchText = ref('')
const selectedIds = ref<number[]>([])
const showNewProjectModal = ref(false)
const newProjectName = ref('')
const previewVisible = ref(false)
const previewFileData = ref<MediaFile | null>(null)

const columns = [
  { title: '文件名', key: 'name' },
  { title: '大小', key: 'size', width: 120 },
  { title: '上传时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200 },
]

const filteredFiles = computed(() => {
  if (!searchText.value) return files.value
  return files.value.filter(f => f.originalName?.includes(searchText.value))
})

function isImage(mimeType?: string): boolean {
  return mimeType?.startsWith('image/') ?? false
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function loadProjects() {
  loading.value = true
  try {
    const res = await mediaApi.projects()
    projects.value = res || []
  } catch (e) {
    console.error('加载项目失败:', e)
    message.error('加载项目失败')
  } finally {
    loading.value = false
  }
}

async function loadFiles() {
  if (!currentProject.value) return
  loading.value = true
  try {
    const res = await mediaApi.list({ category: currentProject.value })
    files.value = res.records || []
  } catch (e) {
    console.error('加载文件失败:', e)
    message.error('加载文件失败')
  } finally {
    loading.value = false
  }
}

function enterProject(name: string) {
  currentProject.value = name
  selectedIds.value = []
  loadFiles()
}

function backToProjects() {
  currentProject.value = null
  files.value = []
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
  files.value = []
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

function previewFile(file: MediaFile) {
  previewFileData.value = file
  previewVisible.value = true
}

function downloadFile(file: MediaFile) {
  const link = document.createElement('a')
  link.href = `/api/v2/workspace/media/${file.id}/file`
  link.download = file.originalName || `media_${file.id}`
  link.click()
}

async function deleteFile(id: number) {
  try {
    await mediaApi.delete(id)
    message.success('删除成功')
    await loadFiles()
  } catch (e) {
    message.error('删除失败')
  }
}

async function batchDelete() {
  if (selectedIds.value.length === 0) return
  try {
    await mediaApi.deleteBatch(selectedIds.value)
    message.success(`已删除 ${selectedIds.value.length} 个文件`)
    selectedIds.value = []
    await loadFiles()
  } catch (e) {
    message.error('批量删除失败')
  }
}

onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.media-panel-page {
  padding: 24px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.panel-header h3 {
  margin: 0;
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
}

.project-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  font-size: 48px;
  color: #d9d9d9;
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
}

.media-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.video-placeholder {
  font-size: 48px;
  color: #722ed1;
}

.media-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 1;
}
</style>
