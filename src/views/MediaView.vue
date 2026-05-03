<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteMediaBatchApi, listMediaApi, uploadMediaBatchApi } from '@/api/media'
import { useSiteStore } from '@/stores/site'
import type { Media } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id || siteStore.currentSiteId)
const loading = ref(false)
const uploading = ref(false)
const mediaList = ref<Media[]>([])
const uploadUrl = ref('')
const previewUrl = ref('')
const previewVisible = ref(false)
const selectedRows = ref<Media[]>([])
const fileInputRef = ref<HTMLInputElement>()

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { mediaList.value = await listMediaApi(currentSiteId.value) }
  finally { loading.value = false }
}

function openFilePicker() {
  fileInputRef.value?.click()
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  if (!currentSiteId.value) { ElMessage.warning('请先选择站点'); return }
  uploading.value = true
  try {
    const results = await uploadMediaBatchApi(currentSiteId.value, files)
    mediaList.value.unshift(...results)
    ElMessage.success(`已上传 ${results.length} 张图片`)
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '上传失败') }
  finally { uploading.value = false; input.value = '' }
}

function handleSelectionChange(rows: Media[]) {
  selectedRows.value = rows
}

async function deleteSelected() {
  if (!currentSiteId.value) { ElMessage.warning('请先选择站点'); return }
  const ids = selectedRows.value.map((item) => item.id).filter((id): id is number => Boolean(id))
  if (!ids.length) { ElMessage.warning('请选择要删除的图片'); return }
  await ElMessageBox.confirm(`确认删除选中的 ${ids.length} 张图片？`, '批量删除确认', { type: 'warning' })
  const result = await deleteMediaBatchApi(currentSiteId.value, ids)
  ElMessage.success(`已删除 ${result.deleted} 张图片`)
  selectedRows.value = []
  await load()
}

function preview(media: Media) {
  previewUrl.value = `/uploads/${currentSiteId.value}/${media.fileName}`
  previewVisible.value = true
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header">
      <div><h2>媒体库</h2><p>上传和管理图片、文件资源。</p></div>
      <div class="actions">
        <input ref="fileInputRef" class="hidden-file-input" type="file" accept="image/*" multiple @change="handleUpload" />
        <el-button type="danger" plain :disabled="!selectedRows.length" @click="deleteSelected">批量删除</el-button>
        <el-button type="primary" :loading="uploading" @click="openFilePicker">上传图片</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="mediaList" border @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" />
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="预览" width="100"><template #default="{ row }">
        <el-image v-if="row.mimeType?.startsWith('image/')" :src="`/uploads/${currentSiteId}/${row.fileName}`" fit="cover" style="width:60px;height:40px;border-radius:4px;cursor:pointer" @click="preview(row)" />
        <el-tag v-else size="small">{{ row.mimeType }}</el-tag>
      </template></el-table-column>
      <el-table-column prop="originalName" label="文件名" min-width="200" show-overflow-tooltip />
      <el-table-column label="大小" width="120"><template #default="{ row }">{{ (row.fileSize / 1024).toFixed(1) }} KB</template></el-table-column>
      <el-table-column prop="mimeType" label="类型" width="140" />
      <el-table-column label="尺寸" width="120"><template #default="{ row }">{{ row.width && row.height ? `${row.width}×${row.height}` : '-' }}</template></el-table-column>
      <el-table-column prop="createdAt" label="上传时间" width="180" />
      <el-table-column label="操作" width="100"><template #default="{ row }"><el-button size="small" @click="preview(row)">查看</el-button></template></el-table-column>
    </el-table>

    <el-dialog v-model="previewVisible" title="文件预览" width="800px">
      <img v-if="previewUrl.endsWith('.svg') || previewUrl.endsWith('.png') || previewUrl.endsWith('.jpg') || previewUrl.endsWith('.jpeg') || previewUrl.endsWith('.webp')" :src="previewUrl" style="max-width:100%" />
      <div v-else>文件不可预览</div>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.actions{display:flex;gap:8px}.hidden-file-input{display:none}
</style>
