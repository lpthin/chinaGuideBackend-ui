<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { createCategoryApi, listCategoriesApi, updateCategoryApi } from '@/api/categories'
import { useSiteStore } from '@/stores/site'
import type { Category } from '@/types/api'

const siteStore = useSiteStore()
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const categories = ref<Category[]>([])
const currentSiteId = computed(() => siteStore.currentSite?.id)
const form = reactive<Category>({ code: '', slug: '', name: '', parentId: null, description: '', moduleCode: 'guide', sortOrder: 0, status: 'active' })

function resetForm(category?: Category) {
  editingId.value = category?.id || null
  Object.assign(form, category || { code: '', slug: '', name: '', parentId: null, description: '', moduleCode: 'guide', sortOrder: 0, status: 'active' })
}

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { categories.value = await listCategoriesApi(currentSiteId.value) } finally { loading.value = false }
}

async function save() {
  if (!currentSiteId.value) return ElMessage.warning('请先选择站点')
  try {
    if (editingId.value) await updateCategoryApi(editingId.value, form)
    else await createCategoryApi(currentSiteId.value, form)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '保存失败') }
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header"><h2>栏目管理</h2><el-button type="primary" @click="resetForm(); dialogVisible = true">新建栏目</el-button></div>
    <el-table v-loading="loading" :data="categories" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="code" label="编码" />
      <el-table-column prop="slug" label="Slug" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="moduleCode" label="模块" />
      <el-table-column prop="sortOrder" label="排序" width="90" />
      <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag v-if="row.status === 'enabled'" type="success">启用</el-tag><el-tag v-else-if="row.status === 'active'" type="success">启用</el-tag><el-tag v-else type="info">{{ row.status === 'disabled' ? '禁用' : row.status }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="160"><template #default="{ row }"><el-button size="small" @click="resetForm(row); dialogVisible = true">编辑</el-button></template></el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑栏目' : '新建栏目'" width="680px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="Slug"><el-input v-model="form.slug" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="父级ID"><el-input-number v-model="form.parentId" :min="0" /></el-form-item>
        <el-form-item label="模块"><el-input v-model="form.moduleCode" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="启用" value="enabled" /><el-option label="禁用" value="disabled" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0}</style>
