<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { House, OfficeBuilding, Collection, Key, Document, Checked, Upload } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const activeMenu = computed(() => route.path)

const menuItems = [
  { path: '/dashboard', label: '仪表盘', icon: House },
  { path: '/sites', label: '站点管理', icon: OfficeBuilding },
  { path: '/categories', label: '栏目管理', icon: Collection },
  { path: '/keywords', label: '关键词库', icon: Key },
  { path: '/articles', label: '内容草稿', icon: Document },
  { path: '/reviews', label: '审核中心', icon: Checked },
  { path: '/publishing', label: '发布任务', icon: Upload }
]

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <el-container class="admin-shell">
    <el-aside width="220px" class="admin-sidebar">
      <div class="brand">GeoCMS</div>
      <el-menu :default-active="activeMenu" router background-color="#111827" text-color="#d1d5db" active-text-color="#ffffff">
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="admin-header">
        <div class="site-chip">当前站点：China Guide</div>
        <div class="user-actions">
          <span>{{ auth.user?.username || '管理员' }}</span>
          <el-button size="small" @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main class="admin-main">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background: #f8fafc;
}
.admin-sidebar {
  background: #111827;
  color: #fff;
}
.brand {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: .5px;
}
.admin-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.site-chip {
  color: #334155;
  font-weight: 600;
}
.user-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #475569;
}
.admin-main {
  padding: 20px;
}
:deep(.el-menu) {
  border-right: none;
}
</style>
