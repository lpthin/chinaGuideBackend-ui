<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listPermissionsApi, createPermissionApi, updatePermissionApi, deletePermissionApi } from '@/api/roles'
import type { Permission } from '@/types/api'

const permissions = ref<Permission[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingPerm = ref<{ id?: number; code: string; name: string; module: string; action: string }>({ code: '', name: '', module: '', action: '' })

async function load() {
  loading.value = true
  try { permissions.value = await listPermissionsApi() }
  finally { loading.value = false }
}

function openDialog(perm?: Permission) {
  editingPerm.value = perm ? { ...perm } : { code: '', name: '', module: '', action: '' }
  dialogVisible.value = true
}

async function save() {
  if (editingPerm.value.id) {
    await updatePermissionApi(editingPerm.value.id, editingPerm.value)
    ElMessage.success('权限已更新')
  } else {
    await createPermissionApi(editingPerm.value)
    ElMessage.success('权限已创建')
  }
  dialogVisible.value = false
  await load()
}

async function del(perm: Permission) {
  if (!perm.id) return
  await ElMessageBox.confirm(`确认删除权限 ${perm.name}？`, '删除确认', { type: 'warning' })
  await deletePermissionApi(perm.id)
  ElMessage.success('权限已删除')
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-header">
      <div><h2>权限管理</h2><p>管理系统中的所有权限点。</p></div>
      <div class="actions">
        <el-button type="primary" @click="openDialog()">新增权限</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="permissions" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="code" label="编码" width="180" />
      <el-table-column prop="name" label="名称" width="180" />
      <el-table-column prop="module" label="模块" width="120" />
      <el-table-column prop="action" label="操作" width="120" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="del(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingPerm.id ? '编辑权限' : '新增权限'" width="520px">
      <el-form label-width="100px">
        <el-form-item label="编码"><el-input v-model="editingPerm.code" :disabled="!!editingPerm.id" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="editingPerm.name" /></el-form-item>
        <el-form-item label="模块"><el-input v-model="editingPerm.module" /></el-form-item>
        <el-form-item label="操作"><el-input v-model="editingPerm.action" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.actions{display:flex;gap:8px}
</style>
