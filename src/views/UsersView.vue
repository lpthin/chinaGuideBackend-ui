<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock, Check, Close } from '@element-plus/icons-vue'
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
  <div class="users-page">
    <div class="page-header-wrapper">
      <div class="page-header-left">
        <div class="header-icon">
          <User class="icon" />
        </div>
        <div>
          <h2 class="page-title">用户管理</h2>
          <p class="page-subtitle">管理系统用户和角色分配</p>
        </div>
      </div>
      <div class="page-header-right">
        <div class="stats-card">
          <span class="stats-value">{{ users.length }}</span>
          <span class="stats-label">总用户数</span>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-header">
        <span class="table-title">用户列表</span>
      </div>
      <el-table 
        v-loading="loading" 
        :data="users" 
        class="user-table"
        :row-class-name="(row) => row.status === 'disabled' ? 'disabled-row' : ''"
      >
        <el-table-column prop="id" label="ID" width="80">
          <template #default="{ row }">
            <span class="id-badge">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" min-width="160">
          <template #default="{ row }">
            <div class="user-info">
              <div class="user-avatar">
                {{ row.username.charAt(0).toUpperCase() }}
              </div>
              <span class="username-text">{{ row.username }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" min-width="160" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <div :class="['status-badge', row.status === 'enabled' ? 'status-active' : 'status-disabled']">
              <component :is="row.status === 'enabled' ? Check : Close" class="status-icon" />
              <span>{{ row.status === 'enabled' ? '启用' : '禁用' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button 
              size="small" 
              class="action-btn"
              @click="openUserRoleDialog(row)"
            >
              <Edit class="btn-icon" />
              <span>角色分配</span>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="users.length === 0 && !loading" class="empty-state">
        <div class="empty-icon">
          <User class="icon" />
        </div>
        <p class="empty-text">暂无用户数据</p>
      </div>
    </div>

    <el-dialog 
      v-model="dialogVisible" 
      title="用户角色分配" 
      width="520px"
      class="role-dialog"
    >
      <div class="dialog-content">
        <p class="dialog-desc">为用户选择角色权限</p>
        <el-checkbox-group v-model="selectedUserRoles" class="role-checkbox-group">
          <el-checkbox 
            v-for="role in roles" 
            :key="role.id" 
            :label="role.id" 
            :value="role.id"
            class="role-checkbox"
          >
            <div class="role-info">
              <span class="role-name">{{ role.name }}</span>
              <span class="role-desc">{{ role.description }}</span>
            </div>
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" class="cancel-btn">取消</el-button>
          <el-button type="primary" @click="saveUserRoles" class="save-btn">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.users-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
}

.page-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon .icon {
  font-size: 28px;
  color: #ffffff;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 6px;
}

.page-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

.stats-card {
  background: rgba(255, 255, 255, 0.2);
  padding: 12px 24px;
  border-radius: 12px;
  text-align: center;
}

.stats-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
}

.stats-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.table-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.table-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  background: #f8fafc;
}

.table-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.user-table {
  width: 100%;
}

.user-table::deep .el-table__header {
  background: #f8fafc;
}

.user-table::deep .el-table__header th {
  color: #64748b;
  font-weight: 600;
  font-size: 13px;
  padding: 16px 12px;
  border-bottom: 2px solid #e2e8f0;
}

.user-table::deep .el-table__body tr:hover {
  background: #f8fafc;
}

.user-table::deep .el-table__body td {
  padding: 16px 12px;
  color: #334155;
}

.disabled-row {
  opacity: 0.6;
}

.id-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.username-text {
  font-weight: 500;
  color: #1a1a2e;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.status-active {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.status-disabled {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}

.status-icon {
  font-size: 14px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  border: none;
  border-radius: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: #ffffff;
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 14px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.empty-icon .icon {
  font-size: 40px;
  color: #94a3b8;
}

.empty-text {
  font-size: 14px;
  color: #94a3b8;
}

.role-dialog::deep .el-dialog__header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 24px;
}

.role-dialog::deep .el-dialog__title {
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.role-dialog::deep .el-dialog__headerbtn .el-dialog__close {
  color: rgba(255, 255, 255, 0.8);
}

.role-dialog::deep .el-dialog__body {
  padding: 24px;
}

.dialog-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.dialog-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 20px;
}

.role-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-checkbox {
  padding: 14px;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.role-checkbox:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
}

.role-checkbox::deep.is-checked {
  background: rgba(64, 158, 255, 0.08);
  border-color: #409eff;
}

.role-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
}

.role-desc {
  font-size: 12px;
  color: #94a3b8;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: 500;
}

.save-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: 500;
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border: none;
}

.save-btn:hover {
  background: linear-gradient(135deg, #337ecc 0%, #409eff 100%);
}

@media (max-width: 768px) {
  .page-header-wrapper {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .page-header-left {
    flex-direction: column;
  }
}
</style>
