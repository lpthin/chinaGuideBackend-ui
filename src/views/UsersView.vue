<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { listUsersApi, assignUserRolesApi, getUserRolesApi } from '@/api/roles'
import { listRolesApi } from '@/api/roles'
import type { Role } from '@/types/api'

const users = ref<Array<{ id: number; username: string; nickname: string; status: string }>>([])
const roles = ref<Role[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const selectedUser = ref<number>()
const selectedUserRoles = ref<number[]>([])

async function load() {
  loading.value = true
  try {
    const [u, r] = await Promise.all([listUsersApi(), listRolesApi()])
    users.value = u; roles.value = r
  } finally { loading.value = false }
}

async function openUserRoleDialog(user: any) {
  selectedUser.value = user.id
  selectedUserRoles.value = await getUserRolesApi(user.id)
  dialogVisible.value = true
}

async function saveUserRoles() {
  if (!selectedUser.value) return
  await assignUserRolesApi(selectedUser.value, selectedUserRoles.value)
  ElMessage.success('用户角色已更新')
  dialogVisible.value = false
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-header"><div><h2>用户管理</h2><p>管理系统用户和角色分配。</p></div></div>
    <el-table v-loading="loading" :data="users" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户名" width="160" />
      <el-table-column prop="nickname" label="昵称" width="160" />
      <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag v-if="row.status === 'enabled'" type="success">启用</el-tag><el-tag v-else type="info">禁用</el-tag></template></el-table-column>
      <el-table-column label="操作" width="140"><template #default="{ row }"><el-button size="small" @click="openUserRoleDialog(row)">角色分配</el-button></template></el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="用户角色分配" width="520px">
      <el-checkbox-group v-model="selectedUserRoles">
        <el-checkbox v-for="role in roles" :key="role.id" :label="role.id" :value="role.id">{{ role.name }}</el-checkbox>
      </el-checkbox-group>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="saveUserRoles">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}
</style>
