<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listRolesApi, createRoleApi, updateRoleApi, deleteRoleApi, assignRolePermissionsApi, getRolePermissionsApi, listPermissionsApi, createPermissionApi } from '@/api/roles'
import type { Role, Permission } from '@/types/api'

const roles = ref<Role[]>([])
const permissions = ref<Permission[]>([])
const loading = ref(false)
const roleDialogVisible = ref(false)
const permDialogVisible = ref(false)
const editingRole = ref<Role>({ code: '', name: '' })
const editingPerm = ref<{ code: string; name: string; module: string; action: string }>({ code: '', name: '', module: '', action: '' })
const rolePermIds = ref<number[]>([])

async function load() {
  loading.value = true
  try {
    const [r, p] = await Promise.all([listRolesApi(), listPermissionsApi()])
    roles.value = r; permissions.value = p
  } finally { loading.value = false }
}

function openRoleDialog(role?: Role) {
  editingRole.value = role ? { ...role } : { code: '', name: '' }
  roleDialogVisible.value = true
}

async function saveRole() {
  if (editingRole.value.id) {
    await updateRoleApi(editingRole.value.id, editingRole.value)
    ElMessage.success('角色已更新')
  } else {
    await createRoleApi(editingRole.value)
    ElMessage.success('角色已创建')
  }
  roleDialogVisible.value = false
  await load()
}

async function deleteRole(role: Role) {
  if (!role.id) return
  await ElMessageBox.confirm(`确认删除角色 ${role.name}？`, '删除确认', { type: 'warning' })
  await deleteRoleApi(role.id)
  ElMessage.success('角色已删除')
  await load()
}

async function openPermissionDialog(role: Role) {
  if (!role.id) return
  rolePermIds.value = await getRolePermissionsApi(role.id)
  editingRole.value = { ...role }
  roleDialogVisible.value = true
}

async function saveRolePermissions() {
  if (!editingRole.value.id) return
  await assignRolePermissionsApi(editingRole.value.id, rolePermIds.value)
  ElMessage.success('权限已分配')
  roleDialogVisible.value = false
}

async function savePermission() {
  await createPermissionApi(editingPerm.value)
  ElMessage.success('权限已创建')
  permDialogVisible.value = false
  editingPerm.value = { code: '', name: '', module: '', action: '' }
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-header">
      <div><h2>角色管理</h2><p>管理角色和权限分配。</p></div>
      <div class="actions">
        <el-button @click="permDialogVisible = true">新增权限</el-button>
        <el-button type="primary" @click="openRoleDialog()">新增角色</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="roles" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="code" label="编码" width="140" />
      <el-table-column prop="name" label="名称" width="160" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="280">
        <template #default="{ row }">
          <el-button size="small" @click="openRoleDialog(row)">编辑</el-button>
          <el-button size="small" @click="openPermissionDialog(row)">权限分配</el-button>
          <el-button size="small" type="danger" @click="deleteRole(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-table v-loading="loading" :data="permissions" border style="margin-top:20px">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="code" label="编码" width="180" />
      <el-table-column prop="name" label="名称" width="180" />
      <el-table-column prop="module" label="模块" width="120" />
      <el-table-column prop="action" label="操作" width="120" />
    </el-table>

    <el-dialog v-model="roleDialogVisible" :title="editingRole.id ? '编辑角色' : '新增角色'" width="640px">
      <el-form label-width="100px">
        <el-form-item label="编码"><el-input v-model="editingRole.code" :disabled="!!editingRole.id" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="editingRole.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editingRole.description" /></el-form-item>
        <template v-if="editingRole.id">
          <el-form-item label="权限"><el-checkbox-group v-model="rolePermIds">
            <el-checkbox v-for="perm in permissions" :key="perm.id" :label="perm.id" :value="perm.id">{{ perm.name }}</el-checkbox>
          </el-checkbox-group></el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button v-if="editingRole.id" type="primary" @click="saveRolePermissions">保存权限</el-button>
        <el-button v-else type="primary" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="permDialogVisible" title="新增权限" width="520px">
      <el-form label-width="100px">
        <el-form-item label="编码"><el-input v-model="editingPerm.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="editingPerm.name" /></el-form-item>
        <el-form-item label="模块"><el-input v-model="editingPerm.module" /></el-form-item>
        <el-form-item label="操作"><el-input v-model="editingPerm.action" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="permDialogVisible = false">取消</el-button><el-button type="primary" @click="savePermission">保存</el-button></template>
    </el-dialog>

  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.actions{display:flex;gap:8px}
</style>
