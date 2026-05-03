<script setup lang="ts">
import { computed, nextTick, reactive, ref, watchEffect } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createFormApi, deleteFormApi, listFormsApi, updateFormApi } from '@/api/forms'
import { useSiteStore } from '@/stores/site'
import type { FormDefinition } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const designerVisible = ref(false)
const forms = ref<FormDefinition[]>([])
const designerRef = ref<any>(null)
const previewRef = ref<any>(null)
const previewData = reactive<Record<string, unknown>>({})

const defaultVFormJson = () => ({
  widgetList: [],
  formConfig: {
    modelName: 'formData',
    refName: 'vForm',
    rulesName: 'rules',
    labelWidth: 80,
    labelPosition: 'left',
    size: '',
    labelAlign: 'label-left-align',
    cssCode: '',
    customClass: '',
    functions: '',
    layoutType: 'PC',
    jsonVersion: 3,
    onFormCreated: '',
    onFormMounted: '',
    onFormDataChange: ''
  }
})

const form = reactive<FormDefinition>({
  name: '',
  code: '',
  description: '',
  status: 'enabled',
  fieldsJson: JSON.stringify(defaultVFormJson()),
  submitButtonText: '提交',
  successMessage: '提交成功，我们会尽快联系您'
})

function normalizeFormJson(raw?: string) {
  if (!raw) return defaultVFormJson()
  try {
    const parsed = JSON.parse(raw)
    if (parsed && parsed.widgetList && parsed.formConfig) return parsed
  } catch {}
  return defaultVFormJson()
}

function reset(payload?: FormDefinition) {
  Object.assign(form, payload || {
    id: undefined,
    name: '',
    code: '',
    description: '',
    status: 'enabled',
    fieldsJson: JSON.stringify(defaultVFormJson()),
    submitButtonText: '提交',
    successMessage: '提交成功，我们会尽快联系您'
  })
  form.fieldsJson = JSON.stringify(normalizeFormJson(form.fieldsJson))
}

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { forms.value = await listFormsApi(currentSiteId.value) }
  finally { loading.value = false }
}

function openCreate() { reset(); dialogVisible.value = true }
function openEdit(row: FormDefinition) { reset({ ...row }); dialogVisible.value = true }

async function openDesigner(row?: FormDefinition) {
  if (row) reset({ ...row })
  designerVisible.value = true
  await nextTick()
  designerRef.value?.setFormJson?.(normalizeFormJson(form.fieldsJson))
}

function applyDesignerJson() {
  const json = designerRef.value?.getFormJson?.()
  if (!json) {
    ElMessage.warning('未能读取设计器内容')
    return
  }
  form.fieldsJson = JSON.stringify(json)
  designerVisible.value = false
  dialogVisible.value = true
  ElMessage.success('表单设计已应用，记得保存')
}

async function save() {
  if (!currentSiteId.value) return
  try { JSON.parse(form.fieldsJson) } catch { ElMessage.warning('表单配置必须是合法 JSON'); return }
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
      <div><h2>表单设计器</h2><p>已集成 VForm3，可拖拽设计字段并保存为表单 JSON。</p></div>
      <el-button type="primary" @click="openCreate">新建表单</el-button>
    </div>
    <el-table v-loading="loading" :data="forms" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="名称" width="160" />
      <el-table-column prop="code" label="代码" width="180" />
      <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
      <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status === 'enabled' ? 'success' : 'info'">{{ row.status === 'enabled' ? '启用' : '停用' }}</el-tag></template></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="230"><template #default="{ row }"><el-button size="small" type="primary" @click="openDesigner(row)">设计</el-button><el-button size="small" @click="openEdit(row)">编辑</el-button><el-button size="small" type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑表单' : '新建表单'" width="720px">
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="代码"><el-input v-model="form.code" placeholder="contact-us" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="form.status"><el-option label="启用" value="enabled" /><el-option label="停用" value="disabled" /></el-select></el-form-item>
        <el-form-item label="表单设计"><el-button type="primary" plain @click="openDesigner()">打开拖拽设计器</el-button></el-form-item>
        <el-form-item label="按钮文案"><el-input v-model="form.submitButtonText" /></el-form-item>
        <el-form-item label="成功提示"><el-input v-model="form.successMessage" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="designerVisible" title="拖拽表单设计器" fullscreen destroy-on-close>
      <div class="designer-toolbar"><el-button @click="designerVisible = false">取消</el-button><el-button type="primary" @click="applyDesignerJson">应用设计</el-button></div>
      <div class="designer-wrap"><v-form-designer ref="designerRef" /></div>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.designer-toolbar{display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px}.designer-wrap{height:calc(100vh - 120px);overflow:hidden}
</style>
