<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { createSiteApi, listSitesApi, updateSiteApi } from '@/api/sites'
import { useSiteStore } from '@/stores/site'
import type { Site } from '@/types/api'

const siteStore = useSiteStore()
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const localeOptions = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ru', label: 'Русский' },
  { value: 'th', label: 'ไทย' },
  { value: 'vi', label: 'Tiếng Việt' }
]

const form = reactive<{ code: string; name: string; domain: string; siteType: string; defaultLocale: string; enabledLocalesList: string[]; frontendProjectPath: string; publishMode: string; themeCode: string; status: string }>({ code: '', name: '', domain: '', siteType: 'content', defaultLocale: 'zh-CN', enabledLocalesList: ['zh-CN'], frontendProjectPath: '', publishMode: 'static', themeCode: 'default', status: 'active' })

function resetForm(site?: Site) {
  editingId.value = site?.id || null
  if (site) { Object.assign(form, site); form.enabledLocalesList = (site.enabledLocales || 'zh-CN').split(',').map((l: string) => l.trim()); } else { resetForm(); }
}

async function load() {
  loading.value = true
  try { siteStore.sites = await listSitesApi() } finally { loading.value = false }
}

async function save() {
  try {
    const payload = { ...form, enabledLocales: form.enabledLocalesList.join(',') }
    if (editingId.value) await updateSiteApi(editingId.value, payload)
    else await createSiteApi(payload)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '保存失败') }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-header"><h2>站点管理</h2><el-button type="primary" @click="resetForm(); dialogVisible = true">新建站点</el-button></div>
    <el-table v-loading="loading" :data="siteStore.sites" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="code" label="编码" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="domain" label="域名" />
      <el-table-column prop="status" label="状态" width="100" />
      <el-table-column label="操作" width="160"><template #default="{ row }"><el-button size="small" @click="resetForm(row); dialogVisible = true">编辑</el-button></template></el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑站点' : '新建站点'" width="720px">
      <el-form :model="form" label-width="130px">
        <el-form-item label="编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="域名"><el-input v-model="form.domain" /></el-form-item>
        <el-form-item label="前端项目路径"><el-input v-model="form.frontendProjectPath" /></el-form-item>
        <el-form-item label="默认语言">
          <el-select v-model="form.defaultLocale" style="width:100%"><el-option v-for="loc in localeOptions" :key="loc.value" :label="loc.label" :value="loc.value" /></el-select>
        </el-form-item>
        <el-form-item label="启用语言">
          <el-select v-model="form.enabledLocalesList" multiple collapse-tags collapse-tags-tooltip style="width:100%"><el-option v-for="loc in localeOptions" :key="loc.value" :label="loc.label" :value="loc.value" /></el-select>
        </el-form-item>
        <el-form-item label="发布模式"><el-input v-model="form.publishMode" /></el-form-item>
        <el-form-item label="状态"><el-input v-model="form.status" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0}</style>
