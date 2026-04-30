<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listMediaApi, uploadMediaApi } from '@/api/media'
import { useSiteStore } from '@/stores/site'
import type { Media } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const uploading = ref(false)
const mediaList = ref<Media[]>([])
const uploadUrl = ref('')
const previewUrl = ref('')
const previewVisible = ref(false)

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { mediaList.value = await listMediaApi(currentSiteId.value) }
  finally { loading.value = false }
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length || !currentSiteId.value) return
  uploading.value = true
  try {
    const result = await uploadMediaApi(currentSiteId.value, input.files[0])
    mediaList.value.unshift(result)
    ElMessage.success('上传成功')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '上传失败') }
  finally { uploading.value = false; input.value = '' }
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
        <el-upload :show-file-list="false" :http-request="handleUpload" :disabled="uploading">
          <el-button type="primary" :loading="uploading">上传文件</el-button>
        </el-upload>
      </div>
    </div>

    <el-table v-loading="loading" :data="mediaList" border>
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
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.actions{display:flex;gap:8px}
</style>
