<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Document, User, Check, Edit, CreditCard, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const siteStore = useSiteStore()

const activeMenu = computed(() => route.path)

const menuItems: Array<{ path?: string; label: string; icon: any; children?: Array<{ path: string; label: string; icon: any }> }> = [
  { path: '/dashboard', label: '仪表盘', icon: Document },
  { path: '/categories', label: '栏目管理', icon: Document },
  { path: '/keywords', label: 'AI蒸馏', icon: Document },
  { path: '/articles', label: '内容草稿', icon: Document },
  { path: '/reviews', label: '审核中心', icon: Check },
  { path: '/publishing', label: '发布任务', icon: Document },
  { path: '/prompt-templates', label: 'Prompt模板', icon: Edit },
  { path: '/media', label: '媒体库', icon: Document },
  { path: '/comments', label: '评论管理', icon: Document },
  { path: '/forms', label: '表单设计器', icon: Document },
  { path: '/leads', label: '线索管理', icon: Document },
  { path: '/notifications', label: '站内提醒', icon: Document },
  {
    label: '多租户管理', icon: Document, children: [
      { path: '/tenant', label: '租户信息', icon: Document },
      { path: '/usage', label: '使用量统计', icon: Document },
      { path: '/plans', label: '套餐管理', icon: CreditCard },
      { path: '/billing', label: '账单管理', icon: Document },
      { path: '/invoices', label: '发票管理', icon: Document },
      { path: '/payment-config', label: '支付配置', icon: Edit }
    ]
  },
  {
    label: '系统管理', icon: User, children: [
      { path: '/sites', label: '站点管理', icon: Document },
      { path: '/users', label: '用户管理', icon: User },
      { path: '/roles', label: '角色管理', icon: User },
      { path: '/permissions', label: '权限管理', icon: Lock },
      { path: '/audit-logs', label: '审计日志', icon: Document }
    ]
  }
]

onMounted(() => {
  siteStore.loadSites().catch(() => undefined)
})

function handleSiteChange(value: number | string) {
  siteStore.setCurrentSite(Number(value))
}

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
        <template v-for="item in menuItems" :key="item.label">
          <el-sub-menu v-if="item.children" :index="item.label">
            <template #title><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></template>
            <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
              <el-icon><component :is="child.icon" /></el-icon><span>{{ child.label }}</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="admin-header">
        <el-select
          v-if="siteStore.sites.length > 0"
          :model-value="siteStore.currentSiteId || siteStore.sites[0]?.id"
          placeholder="选择站点"
          style="width: 240px"
          @update:model-value="handleSiteChange"
        >
          <el-option v-for="site in siteStore.sites" :key="site.id" :label="site.name" :value="site.id" />
        </el-select>
        <div class="header-right">
          <el-tag v-if="auth.tenantCode" type="success" size="small" class="tenant-tag">
            {{ auth.tenantCode }}
          </el-tag>
          <router-link to="/v2" style="margin-right: 8px; color: #1890ff; font-weight: 500; text-decoration: none;">
            ✨ 新版工作台
          </router-link>
          <el-button size="small" type="primary" plain @click="$router.push('/')">
            查看前端
          </el-button>
          <span class="username">{{ auth.user?.username || '管理员' }}</span>
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
.admin-shell { min-height: 100vh; background: #f8fafc; }
.admin-sidebar { background: #111827; color: #fff; }
.brand { height: 60px; display: flex; align-items: center; padding: 0 20px; font-size: 20px; font-weight: 800; letter-spacing: .5px; }
.admin-header { height: 60px; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; }
.header-right { display: flex; align-items: center; gap: 12px; color: #475569; }
.tenant-tag { margin-right: 8px; }
.username { font-weight: 500; }
.admin-main { padding: 20px; }
:deep(.el-menu) { border-right: none; }
</style>

<style>
.el-overlay {
  z-index: 2010 !important;
}
.el-dialog {
  z-index: 2020 !important;
}
</style>
