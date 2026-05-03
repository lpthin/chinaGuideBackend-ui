<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createFormApi, deleteFormApi, listFormsApi, updateFormApi } from '@/api/forms'
import { useSiteStore } from '@/stores/site'
import type { FormDefinition } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const forms = ref<FormDefinition[]>([])
const form = reactive<FormDefinition>({
  name: '',
  code: '',
  description: '',
  status: 'enabled',
  fieldsJson: '[{"key":"name","label":"姓名","type":"text","required":true}]',
  submitButtonText: '提交',
  successMessage: '提交成功，我们会尽快联系您'
})

function reset(payload?: FormDefinition) {
  Object.assign(form, payload || {
    id: undefined,
    name: '',
    code: '',
    description: '',
    status: 'enabled',
    fieldsJson: '[{"key":"name","label":"姓名","type":"text","required":true}]',
    submitButtonText: '提交',
    successMessage: '提交成功，我们会尽快联系您'
  })
}

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { forms.value = await listFormsApi(currentSiteId.value) }
  finally { loading.value = false }
}

function openCreate() { reset(); dialogVisible.value = true }
function openEdit(row: FormDefinition) { reset({ ...row }); dialogVisible.value = true }

async function save() {
  if (!currentSiteId.value) return
  try { JSON.parse(form.fieldsJson) } catch { ElMessage.warning('字段配置必须是合法 JSON'); return }
  saving.value = true
  try {
    if (form.id) await updateFormApi(currentSiteId.value, form.id, form)
    else await createFormApi(currentSiteId.value, form)
    ElMessage.success('已保存')
    dialogVisible.value = false
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '保存失败') }
  finally { saving.value = false }
}

async function remove(row: FormDefinition) {
  if (!currentSiteId.value || !row.id) return
  await ElMessageBox.confirm(`确认删除表单「${row.name}」？`, '删除确认', { type: 'warning' })
  await deleteFormApi(currentSiteId.value, row.id)
  ElMessage.success('已删除')
  await load()
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header">
      <div><h2>表单设计器</h2><p>配置前台咨询/线索表单，字段以 JSON 保存，便于后续生成前台表单。</p></div>
      <el-button type="primary" @click="openCreate">新建表单</el-button>
    </div>
    <el-table v-loading="loading" :data="forms" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="名称" width="160" />
      <el-table-column prop="code" label="代码" width="180" />
      <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
      <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status === 'enabled' ? 'success' : 'info'">{{ row.status === 'enabled' ? '启用' : '停用' }}</el-tag></template></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="150"><template #default="{ row }"><el-button size="small" @click="openEdit(row)">编辑</el-button><el-button size="small" type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑表单' : '新建表单'" width="720px">
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="代码"><el-input v-model="form.code" placeholder="contact-us" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="form.status"><el-option label="启用" value="enabled" /><el-option label="停用" value="disabled" /></el-select></el-form-item>
        <el-form-item label="字段配置 JSON"><el-input v-model="form.fieldsJson" type="textarea" :rows="8" /></el-form-item>
        <el-form-item label="按钮文案"><el-input v-model="form.submitButtonText" /></el-form-item>
        <el-form-item label="成功提示"><el-input v-model="form.successMessage" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}
</style>
