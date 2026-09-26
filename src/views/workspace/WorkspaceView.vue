<template>
  <a-layout class="workspace-layout">
    
    <!-- 顶部导航栏 -->
    <a-layout-header class="header">
      <div class="header-left">
        <a-button type="text" @click="toggleCollapse" class="collapse-btn">
          <component :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined" />
        </a-button>
        <div class="logo">
          <span class="logo-icon">📝</span>
          <span class="logo-text">内容管理系统</span>
        </div>
      </div>
      <div class="header-right">
        <a-space>
          <TenantSwitcher v-if="auth.isSuperAdmin" />
          <a-button
            v-if="auth.isSuperAdmin"
            type="primary"
            size="small"
            @click="handleReturnToAdmin"
          >
            返回管理员端
          </a-button>
          <a-tooltip title="统计面板">
            <a-button type="text" @click="openDashboard">
              <BarChartOutlined />
            </a-button>
          </a-tooltip>
          <a-divider type="vertical" />
          <a @click="openPortalHome" style="margin-right: 12px; color: #1890ff; font-weight: 500; cursor: pointer;">
            查看前端
          </a>
          <a-dropdown>
            <a-button type="text" class="user-dropdown-btn">
              <a-avatar
                :size="28"
                :src="auth.user?.avatar"
                :icon="!auth.user?.avatar ? h(UserOutlined) : undefined"
                class="header-avatar"
              />
              <span class="username-text">{{ auth.nickname || auth.username || '管理员' }}</span>
              <DownOutlined />
            </a-button>
            <template #overlay>
              <a-menu @click="handleUserMenuClick">
                <a-menu-item key="profile">个人中心</a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout">退出登录</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </a-space>
      </div>
    </a-layout-header>

    <!-- 主体内容区 -->
    <a-layout class="main-layout">
      <!--
        左侧侧边栏：整棵菜单由 `src/navigation/workspaceMenu.ts` 从路由表生成（Spec「建站重构」§3.1）。
        这一层只渲染，不再抄标签、图标、权限码——以前这里手写 19 个 portal 菜单项，外加 menuLabels 与
        currentParentMenu 两张表：路由改了这里不改，于是「文章分类」在菜单里仍叫「栏目管理」；
        区块画廊这里判 preset 码而路由要 manage 码，看得见、点进去 403。
      -->
      <a-layout-sider width="240" class="side-menu" :collapsed="collapsed" collapsible :trigger="null">
        <nav class="sidebar-nav">
          <a-menu
            v-if="topLeaf"
            mode="inline"
            :selected-keys="selectedKeys"
            :inline-collapsed="collapsed"
            class="sidebar-menu sidebar-menu--single"
            @click="handleMenuClick"
          >
            <a-menu-item :key="topLeaf.key">
              <template #icon><component :is="topLeaf.icon" /></template>
              {{ topLeaf.label }}
            </a-menu-item>
          </a-menu>

          <section v-for="section in menuSections" :key="section.domain" class="menu-domain">
            <div v-if="!collapsed" class="menu-domain__label">
              {{ section.label }}
              <span class="menu-domain__hint">{{ section.hint }}</span>
            </div>
            <div v-else class="menu-domain__rule" aria-hidden="true"></div>

            <a-menu
              mode="inline"
              :selected-keys="selectedKeys"
              :inline-collapsed="collapsed"
              class="sidebar-menu"
              @click="handleMenuClick"
            >
              <a-menu-item-group v-for="group in section.groups" :key="group.def.key">
                <template #title>
                  <span class="menu-group__label">{{ group.def.label }}</span>
                  <span v-if="group.def.hint && !collapsed" class="menu-group__hint">{{ group.def.hint }}</span>
                </template>
                <a-menu-item v-for="leaf in group.items" :key="leaf.key">
                  <template #icon><component :is="leaf.icon" /></template>
                  {{ leaf.label }}
                </a-menu-item>
              </a-menu-item-group>
            </a-menu>
          </section>

          <a-menu
            v-if="bottomLeaf"
            mode="inline"
            :selected-keys="selectedKeys"
            :inline-collapsed="collapsed"
            class="sidebar-menu sidebar-menu--bottom"
            @click="handleMenuClick"
          >
            <a-menu-item :key="bottomLeaf.key">
              <template #icon><component :is="bottomLeaf.icon" /></template>
              {{ bottomLeaf.label }}
            </a-menu-item>
          </a-menu>
        </nav>
      </a-layout-sider>

      <!-- 主要工作区 -->
      <a-layout-content class="workspace-content">
        <!-- 面包屑导航 -->
        <div class="breadcrumb-wrapper">
          <a-breadcrumb>
            <a-breadcrumb-item @click="router.push('/workspace/dashboard')">
              <DashboardOutlined style="margin-right: 4px" />
              首页
            </a-breadcrumb-item>
            <a-breadcrumb-item v-if="crumb.parent">
              {{ crumb.parent }}
            </a-breadcrumb-item>
            <a-breadcrumb-item>
              {{ crumb.current || '工作台' }}
            </a-breadcrumb-item>
          </a-breadcrumb>
          
          <!-- 上下文操作按钮 -->
          <div class="context-actions">
            <a-space>
              <a-button type="primary" v-if="showImportBtn" @click="handleImport">
                <template #icon><UploadOutlined /></template>
                导入数据
              </a-button>
              <a-button :loading="refreshing" @click="refresh">
                <template #icon><ReloadOutlined /></template>
                刷新
              </a-button>
            </a-space>
          </div>
        </div>
        
        <!-- 工作区 -->
        <div class="workspace-area">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" :key="pageKey" />
            </transition>
          </router-view>
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, provide, watch, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import TenantSwitcher from '../../components/TenantSwitcher.vue'
import {
  BarChartOutlined,
  DashboardOutlined,
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  UploadOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import { routes } from '../../router'
import {
  MENU_BOTTOM_ROUTE,
  MENU_TOP_ROUTE,
  buildMenuSections,
  collectMenuLeaves,
  findLeaf,
  leafVisible,
  menuCrumb,
  selectedMenuKey
} from '../../navigation/workspaceMenu'
import { portalSectionsApi } from '../../api/portalSections'
import { message } from 'ant-design-vue'
import { describeHttpError } from '../../api/http'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

/**
 * 内容类菜单项按栏目开通态显隐（Spec §7.1）。判据是后端词表里每个栏目的 contentEntry 字段，
 * 不是在前端再抄一份栏目清单（I-1）。拉取失败就全显示（null = 不知道）：这一处挡的是
 * 「点进去只有一片空白」，权限从来不由这里判，三个只读端点各自挂着 @RequirePermission。
 */
const openContentEntries = ref<Set<string> | null>(null)

async function loadSectionEntries() {
  try {
    const states = await portalSectionsApi.list()
    openContentEntries.value = new Set(
      states.filter(state => state.enabled).map(state => state.contentEntry))
  } catch {
    openContentEntries.value = null
  }
}

/** 路由定义顺序 = 界面上的上下顺序；`router.getRoutes()` 按路径权重排过序，不能用它 */
const menuLeaves = computed(() => collectMenuLeaves(routes))

const visibility = computed(() => ({
  isSuperAdmin: auth.isSuperAdmin,
  hasPermission: (code: string) => auth.hasPermission(code),
  openContentEntries: openContentEntries.value
}))

const menuSections = computed(() => buildMenuSections(menuLeaves.value, visibility.value))

/** 菜单上/下两端各固定一项（工作台、联系平台）：标签与图标同样来自那条路由，视图里不写死中文 */
function visibleFixedLeaf(routeName: string) {
  const leaf = findLeaf(routeName, menuLeaves.value)
  return leaf && leafVisible(leaf, visibility.value) ? leaf : null
}

const topLeaf = computed(() => visibleFixedLeaf(MENU_TOP_ROUTE))
const bottomLeaf = computed(() => visibleFixedLeaf(MENU_BOTTOM_ROUTE))

/**
 * 选中态用最长前缀匹配。旧实现取「路径首段」+ 手抄一份前缀白名单，于是 `media/library`（图片库）
 * 与 `media-storage`（素材存储）抢同一个 key，图片库的高亮跑到素材存储上；
 * 详情页（`articles/12`、`knowledge/cards/3`）也不用再抄映射，自动归到它的列表项。
 */
const currentMenuKey = computed(() => selectedMenuKey(route.path, menuLeaves.value))

const selectedKeys = computed(() => (currentMenuKey.value ? [currentMenuKey.value] : []))

/** 面包屑两级来自组与项本身：那张 60 行的 currentParentMenu 手抄表删掉了 */
const crumb = computed(() => menuCrumb(currentMenuKey.value, menuLeaves.value))

const collapsed = ref(false)
const pageKey = ref(0)
const refreshing = ref(false)
const importCallback = ref<(() => void) | null>(null)

const showImportBtn = computed(() => currentMenuKey.value === 'keywords')

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

const handleMenuClick = ({ key }: { key: string }) => {
  router.push(`/workspace/${key}`)
}

const openDashboard = () => {
  router.push('/workspace/dashboard')
}

/**
 * 刷新要能报错：以前只是 router.replace(同一路径) 再无条件弹「已刷新」，
 * 后端整体 502 时用户看到的仍是成功提示。现在先探活，再重挂载当前页让子组件重新拉数据。
 */
const refresh = async () => {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await auth.fetchCurrentUser()
  } catch (e) {
    message.error(`刷新失败：${describeHttpError(e)}`)
    refreshing.value = false
    return
  }
  // 栏目开通态一并重取：超管刚开的栏目不该等用户换入口才发现菜单里多了那一项
  loadSectionEntries()
  pageKey.value += 1
  message.success('已刷新')
  refreshing.value = false
}

const handleImport = () => {
  if (importCallback.value) {
    importCallback.value()
  }
}

const handleUserMenuClick = ({ key }: { key: string }) => {
  if (key === 'profile') {
    router.push('/workspace/user/profile')
  } else if (key === 'logout') {
    handleLogout()
  }
}

const handleReturnToAdmin = () => {
  auth.switchTenant(null)
  message.success('已切换到管理员视角')
}

const openPortalHome = () => {
  window.open('/', '_blank')
}

const handleLogout = async () => {
  try {
    await auth.logout()
    message.success('已退出登录')
    router.push('/login')
  } catch (error) {
    console.error('退出登录失败:', error)
    message.error('退出登录失败')
  }
}

// 提供给子组件的方法
provide('setImportCallback', (callback: () => void) => {
  importCallback.value = callback
})

// 监听租户切换，刷新当前页面
watch(
  () => auth.selectedTenantId,
  () => {
    refresh()
  }
)

// 清除回调，避免内存泄漏
onMounted(() => {
  // 路由变化时清除回调
  router.afterEach(() => {
    importCallback.value = null
  })

  // 拉取一次最新的当前用户信息，确保头像/角色是最新的
  if (auth.accessToken) {
    auth.fetchCurrentUser().catch((e) => {
      console.warn('刷新当前用户信息失败:', e)
    })
  }
  loadSectionEntries()
})

// 超管切换站点上下文之后，栏目开通态是另一个站点的，菜单得跟着重算
watch(() => [auth.selectedTenantId, auth.selectedTenantCode].join(':'), loadSectionEntries)
</script>

<style scoped>
.workspace-layout {
  height: 100vh;
  background: #f5f7fa;
  overflow: hidden;
}

.welcome-alert {
  margin: 16px 16px 0;
}

.header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  height: 64px;
  line-height: 64px;
  border-bottom: 1px solid #e8e8e8;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  font-size: 16px;
  padding: 8px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.header-right {
  display: flex;
  align-items: center;
}

.main-layout {
  display: flex;
  height: calc(100vh - 64px);
}

.side-menu {
  background: #fff;
  border-right: 1px solid #e8e8e8;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  position: sticky;
  top: 0;
  left: 0;
}

.sidebar-nav {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding-bottom: 8px;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu--single {
  flex: none;
}

/* 「联系平台」压在菜单最后：它是租户唯一的平台沟通口，不该混在内容项中间 */
.sidebar-menu--bottom {
  margin-top: auto;
  border-top: 1px solid #f0f0f0;
}

.menu-domain {
  flex: none;
}

.menu-domain + .menu-domain {
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
  padding-top: 4px;
}

/*
 * 两段标题把「租户日常」与「平台建站动作」分家（Spec「建站重构」R-1 的第一半：先分开）。
 * 折叠成窄栏时只留一条分隔线，两行中文收掉——窄栏里塞说明会把菜单挤成一团。
 */
.menu-domain__label {
  padding: 10px 16px 2px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.45);
  line-height: 18px;
}

.menu-domain__hint {
  display: block;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.35);
}

.menu-domain__rule {
  margin: 10px 12px 4px;
  border-top: 1px solid #f0f0f0;
}

.menu-group__label {
  display: block;
}

.menu-group__hint {
  display: block;
  font-weight: 400;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
  white-space: normal;
  line-height: 15px;
}

.workspace-content {
  flex: 1;
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  overflow-x: visible;
  box-sizing: border-box;
}

.breadcrumb-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  background: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.page-actions {
  display: flex;
  gap: 12px;
}

.workspace-area {
  background: #fff;
  border-radius: 8px;
  padding: 20px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  overflow: visible;
  box-sizing: border-box;
}

/* TenantSwitcher 样式适配白色导航栏 */
:deep(.tenant-switcher) {
  width: 160px;
}

:deep(.tenant-switcher .ant-select-selector) {
  background-color: #f5f7fa !important;
  border: 1px solid #e8e8e8 !important;
  color: #1a1a1a !important;
  border-radius: 4px;
  height: 32px !important;
}

:deep(.tenant-switcher .ant-select-arrow) {
  color: #666 !important;
}

:deep(.tenant-switcher .ant-select-selection-placeholder) {
  color: #999 !important;
}

:deep(.tenant-switcher .ant-select-selection-item) {
  color: #1a1a1a !important;
  line-height: 32px !important;
}

:deep(.tenant-switcher:hover .ant-select-selector) {
  background-color: #e8f0fe !important;
  border-color: #1890ff !important;
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 用户下拉按钮 */
.user-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  height: auto;
}

.user-dropdown-btn :deep(.ant-btn-icon) {
  margin-inline-end: 0 !important;
}

.header-avatar {
  flex-shrink: 0;
  border: 1px solid #e8e8e8;
}

.username-text {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
