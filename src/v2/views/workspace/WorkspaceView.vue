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
          <span class="logo-text">内容管理系统 v2</span>
        </div>
      </div>
      <div class="header-right">
        <a-space>
          <TenantSwitcher v-if="auth.isSuperAdmin" />
          <a-tooltip title="统计面板">
            <a-button type="text" @click="openDashboard">
              <BarChartOutlined />
            </a-button>
          </a-tooltip>
          <a-divider type="vertical" />
          <a @click="router.push('/')" style="margin-right: 12px; color: #1890ff; font-weight: 500; cursor: pointer;">
            ← 返回旧版
          </a>
          <a-dropdown>
            <a-button type="text">
              <UserOutlined />
              <span>管理员</span>
              <DownOutlined />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item key="profile">个人中心</a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout" @click="handleLogout">退出登录</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </a-space>
      </div>
    </a-layout-header>

    <!-- 主体内容区 -->
    <a-layout class="main-layout">
      <!-- 左侧侧边栏 -->
      <a-layout-sider width="220" class="side-menu" :collapsed="collapsed" collapsible :trigger="null">
        <a-menu
          v-model:selectedKeys="selectedKeys"
          v-model:openKeys="openKeys"
          mode="inline"
          :inline-collapsed="collapsed"
          class="sidebar-menu"
          @click="handleMenuClick"
        >
          <!-- 仪表盘 -->
          <a-menu-item key="dashboard">
            <template #icon><DashboardOutlined /></template>
            <span>工作台</span>
          </a-menu-item>

          <!-- 内容生产 -->
          <a-sub-menu key="content">
            <template #icon><FireOutlined /></template>
            <template #title>内容生产</template>
            <a-menu-item key="keywords">
              <template #icon><DownloadOutlined /></template>
              热词管理
            </a-menu-item>
            <a-menu-item key="cluster">
              <template #icon><ClusterOutlined /></template>
              聚类分析
            </a-menu-item>
            <a-menu-item key="article-generate">
              <template #icon><EditOutlined /></template>
              AI生成
            </a-menu-item>
            <a-menu-item key="review">
              <template #icon><CheckCircleOutlined /></template>
              审核管理
            </a-menu-item>
            <a-menu-item key="publish">
              <template #icon><RocketOutlined /></template>
              发布管理
            </a-menu-item>
            <a-menu-item key="publish-config">
              <template #icon><SettingOutlined /></template>
              发布配置
            </a-menu-item>
            <a-menu-item key="publish-queue">
              <template #icon><OrderedListOutlined /></template>
              发布队列
            </a-menu-item>
          </a-sub-menu>

          <!-- 文章管理 -->
          <a-sub-menu key="articleManage">
            <template #icon><FileTextOutlined /></template>
            <template #title>文章管理</template>
            <a-menu-item key="articles">
              <template #icon><FileTextOutlined /></template>
              文章列表
            </a-menu-item>
            <a-menu-item key="categories">
              <template #icon><FolderOutlined /></template>
              栏目管理
            </a-menu-item>
            <a-menu-item key="article-templates">
              <template #icon><FileDoneOutlined /></template>
              软文模板
            </a-menu-item>
          </a-sub-menu>

          <!-- 知识库 -->
          <a-sub-menu key="knowledge">
            <template #icon><BookOutlined /></template>
            <template #title>知识库</template>
            <a-menu-item key="knowledge/dashboard">
              <template #icon><DashboardOutlined /></template>
              知识仪表板
            </a-menu-item>
            <a-menu-item key="knowledge/documents">
              <template #icon><FolderOutlined /></template>
              资料库
            </a-menu-item>
            <a-menu-item key="knowledge/cards">
              <template #icon><IdcardOutlined /></template>
              知识卡片
            </a-menu-item>
            <a-menu-item key="knowledge/categories">
              <template #icon><FolderOutlined /></template>
              知识分类
            </a-menu-item>
            <a-menu-item key="knowledge/tags">
              <template #icon><TagsOutlined /></template>
              标签管理
            </a-menu-item>
            <a-menu-item key="knowledge/graph">
              <template #icon><ApartmentOutlined /></template>
              知识图谱
            </a-menu-item>
          </a-sub-menu>

          <!-- 案例管理 -->
          <a-sub-menu key="caseManage">
            <template #icon><ProjectOutlined /></template>
            <template #title>案例管理</template>
            <a-menu-item key="case/list">
              <template #icon><FileTextOutlined /></template>
              案例列表
            </a-menu-item>
          </a-sub-menu>

          <!-- 计费系统 -->
          <a-sub-menu key="billing">
            <template #icon><AccountBookOutlined /></template>
            <template #title>计费系统</template>
            <a-menu-item key="billing/manage">
              <template #icon><AccountBookOutlined /></template>
              账单管理
            </a-menu-item>
            <a-menu-item key="billing/stats">
              <template #icon><BarChartOutlined /></template>
              消费统计
            </a-menu-item>
          </a-sub-menu>

          <!-- 门户网站 -->
          <a-sub-menu key="portal">
            <template #icon><GlobalOutlined /></template>
            <template #title>门户网站</template>
            <a-menu-item key="portal/templates">
              <template #icon><LayoutOutlined /></template>
              模板管理
            </a-menu-item>
            <a-menu-item key="portal/banners">
              <template #icon><PictureOutlined /></template>
              Banner管理
            </a-menu-item>
            <a-menu-item key="portal/jobs">
              <template #icon><UserAddOutlined /></template>
              招聘管理
            </a-menu-item>
            <a-menu-item key="portal/messages">
              <template #icon><MessageOutlined /></template>
              站内信
            </a-menu-item>
            <a-menu-item key="portal/guestbook">
              <template #icon><FormOutlined /></template>
              留言管理
            </a-menu-item>
            <a-menu-item key="portal/company">
              <template #icon><BankOutlined /></template>
              企业信息
            </a-menu-item>
            <a-menu-item key="portal/seo">
              <template #icon><SearchOutlined /></template>
              SEO配置
            </a-menu-item>
          </a-sub-menu>

          <!-- GEO地理 -->
          <a-sub-menu key="geo">
            <template #icon><EnvironmentOutlined /></template>
            <template #title>GEO地理</template>
            <a-menu-item key="geo/regions">
              <template #icon><ApartmentOutlined /></template>
              行政区划
            </a-menu-item>
            <a-menu-item key="geo/stores">
              <template #icon><ShopOutlined /></template>
              门店管理
            </a-menu-item>
            <a-menu-item key="geo/nearby">
              <template #icon><EnvironmentOutlined /></template>
              附近门店
            </a-menu-item>
          </a-sub-menu>

          <!-- AI配置 -->
          <a-sub-menu key="ai">
            <template #icon><RobotOutlined /></template>
            <template #title>AI配置</template>
            <a-menu-item key="ai/models">
              <template #icon><RobotOutlined /></template>
              大模型配置
            </a-menu-item>
            <a-menu-item key="ai/vector-db">
              <template #icon><DatabaseOutlined /></template>
              向量数据库
            </a-menu-item>
            <a-menu-item key="ai/embedding">
              <template #icon><ApiOutlined /></template>
              向量化配置
            </a-menu-item>
            <a-menu-item key="ai/usage">
              <template #icon><BarChartOutlined /></template>
              用量监控
            </a-menu-item>
            <a-menu-item key="ai/article-templates">
              <template #icon><FileTextOutlined /></template>
              模板库
            </a-menu-item>
          </a-sub-menu>

          <!-- 运营管理 -->
          <a-sub-menu key="operation">
            <template #icon><PieChartOutlined /></template>
            <template #title>运营管理</template>
            <a-menu-item key="operation/dashboard">
              <template #icon><DashboardOutlined /></template>
              运营概览
            </a-menu-item>
            <a-menu-item key="operation/cases">
              <template #icon><ProjectOutlined /></template>
              客户案例
            </a-menu-item>
            <a-menu-item key="operation/reports">
              <template #icon><FileSearchOutlined /></template>
              数据报表
            </a-menu-item>
          </a-sub-menu>

          <!-- 系统管理 -->
          <a-sub-menu key="system">
            <template #icon><SettingOutlined /></template>
            <template #title>系统管理</template>
            <a-menu-item key="sites" v-if="auth.user?.isAdmin || auth.isAdmin">
              <template #icon><GlobalOutlined /></template>
              站点管理
            </a-menu-item>
            <a-menu-item key="tenant">
              <template #icon><TeamOutlined /></template>
              租户管理
            </a-menu-item>
            <a-menu-item key="users">
              <template #icon><UserOutlined /></template>
              用户管理
            </a-menu-item>
            <a-menu-item key="roles">
              <template #icon><TeamOutlined /></template>
              角色管理
            </a-menu-item>
            <a-menu-item key="permissions">
              <template #icon><SafetyOutlined /></template>
              权限管理
            </a-menu-item>
            <a-menu-item key="system-prompt">
              <template #icon><ApiOutlined /></template>
              Prompt管理
            </a-menu-item>
            <a-menu-item key="settings">
              <template #icon><SettingOutlined /></template>
              系统设置
            </a-menu-item>
            <a-menu-item key="audit-log">
              <template #icon><AuditOutlined /></template>
              审计日志
            </a-menu-item>
          </a-sub-menu>
        </a-menu>
      </a-layout-sider>

      <!-- 主要工作区 -->
      <a-layout-content class="workspace-content">
        <!-- 面包屑导航 -->
        <div class="breadcrumb-wrapper">
          <a-breadcrumb>
            <a-breadcrumb-item @click="router.push('/v2/workspace/dashboard')">
              <DashboardOutlined style="margin-right: 4px" />
              首页
            </a-breadcrumb-item>
            <a-breadcrumb-item v-if="currentParentMenu">
              {{ currentParentMenu }}
            </a-breadcrumb-item>
            <a-breadcrumb-item>
              {{ currentMenuLabel }}
            </a-breadcrumb-item>
          </a-breadcrumb>
          
          <!-- 上下文操作按钮 -->
          <div class="context-actions">
            <a-space>
              <a-button type="primary" v-if="showStartTask" @click="startTask">
                <template #icon><PlayCircleOutlined /></template>
                开始任务
              </a-button>
              <a-button type="primary" v-if="showImportBtn" @click="handleImport">
                <template #icon><UploadOutlined /></template>
                导入数据
              </a-button>
              <a-button @click="refresh">
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
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, provide, inject, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import TenantSwitcher from '../../components/TenantSwitcher.vue'
import {
  DownloadOutlined,
  ClusterOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  UserOutlined,
  SettingOutlined,
  HomeOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  DownOutlined,
  BarChartOutlined,
  ApartmentOutlined,
  EditOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UploadOutlined,
  FolderOutlined,
  GlobalOutlined,
  TeamOutlined,
  SafetyOutlined,
  UserAddOutlined,
  ApiOutlined,
  PictureOutlined,
  FireOutlined,
  OrderedListOutlined,
  FileDoneOutlined,
  BookOutlined,
  IdcardOutlined,
  TagsOutlined,
  ProjectOutlined,
  AccountBookOutlined,
  LayoutOutlined,
  MessageOutlined,
  FormOutlined,
  BankOutlined,
  SearchOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  RobotOutlined,
  DatabaseOutlined,
  PieChartOutlined,
  FileSearchOutlined,
  AuditOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const collapsed = ref(false)
const openKeys = ref<string[]>(['content', 'articleManage', 'knowledge', 'system'])

const refreshCallback = ref<(() => void) | null>(null)
const startTaskCallback = ref<(() => void) | null>(null)
const importCallback = ref<(() => void) | null>(null)

const menuLabels: Record<string, string> = {
  dashboard: '工作台',
  keywords: '热词管理',
  cluster: '聚类分析',
  'article-generate': 'AI生成',
  review: '审核管理',
  publish: '发布管理',
  'publish-config': '发布配置',
  'publish-queue': '发布队列',
  articles: '文章列表',
  categories: '栏目管理',
  'article-templates': '软文模板',
  'knowledge/dashboard': '知识仪表板',
  'knowledge/documents': '资料库',
  'knowledge/cards': '知识卡片',
  'knowledge/categories': '知识分类',
  'knowledge/tags': '标签管理',
  'knowledge/graph': '知识图谱',
  'case/list': '案例列表',
  'billing/manage': '账单管理',
  'billing/stats': '消费统计',
  'portal/templates': '模板管理',
  'portal/banners': 'Banner管理',
  'portal/jobs': '招聘管理',
  'portal/messages': '站内信',
  'portal/guestbook': '留言管理',
  'portal/company': '企业信息',
  'portal/seo': 'SEO配置',
  'geo/regions': '行政区划',
  'geo/stores': '门店管理',
  'geo/nearby': '附近门店',
  'ai/models': '大模型配置',
  'ai/vector-db': '向量数据库',
  'ai/embedding': '向量化配置',
  'ai/usage': '用量监控',
  'ai/article-templates': '模板库',
  'operation/dashboard': '运营概览',
  'operation/cases': '客户案例',
  'operation/reports': '数据报表',
  sites: '站点管理',
  tenant: '租户管理',
  'system-prompt': 'Prompt管理',
  roles: '角色管理',
  permissions: '权限管理',
  users: '用户管理',
  settings: '系统设置',
  'audit-log': '审计日志'
}

const getMenuKey = () => {
  const pathParts = route.path.replace('/v2/workspace/', '').split('/')
  if (pathParts.length >= 2 && ['knowledge', 'case', 'billing', 'portal', 'geo', 'ai', 'operation'].includes(pathParts[0])) {
    return pathParts.join('/')
  }
  return pathParts[0] || 'dashboard'
}

const currentMenuLabel = computed(() => {
  const key = getMenuKey()
  return menuLabels[key] || key
})

const currentParentMenu = computed(() => {
  const key = getMenuKey()
  const parentMap: Record<string, string> = {
    keywords: '内容生产',
    cluster: '内容生产',
    'article-generate': '内容生产',
    review: '内容生产',
    publish: '内容生产',
    'publish-config': '内容生产',
    'publish-queue': '内容生产',
    articles: '文章管理',
    categories: '文章管理',
    'article-templates': '文章管理',
    'knowledge/dashboard': '知识库',
    'knowledge/documents': '知识库',
    'knowledge/cards': '知识库',
    'knowledge/categories': '知识库',
    'knowledge/tags': '知识库',
    'knowledge/graph': '知识库',
    'case/list': '案例管理',
    'billing/manage': '计费系统',
    'billing/stats': '计费系统',
    'portal/templates': '门户网站',
    'portal/banners': '门户网站',
    'portal/jobs': '门户网站',
    'portal/messages': '门户网站',
    'portal/guestbook': '门户网站',
    'portal/company': '门户网站',
    'portal/seo': '门户网站',
    'geo/regions': 'GEO地理',
    'geo/stores': 'GEO地理',
    'geo/nearby': 'GEO地理',
    'ai/models': 'AI配置',
    'ai/vector-db': 'AI配置',
    'ai/embedding': 'AI配置',
    'ai/usage': 'AI配置',
    'ai/article-templates': 'AI配置',
    'operation/dashboard': '运营管理',
    'operation/cases': '运营管理',
    'operation/reports': '运营管理',
    sites: '系统管理',
    tenant: '系统管理',
    'system-prompt': '系统管理',
    roles: '系统管理',
    permissions: '系统管理',
    users: '系统管理',
    settings: '系统管理',
    'audit-log': '系统管理',
  }
  return parentMap[key]
})

const selectedKeys = computed(() => {
  const key = getMenuKey()
  return [key]
})

const showStartTask = computed(() => {
  const key = getMenuKey()
  return ['keywords', 'cluster', 'article-generate', 'review', 'publish'].includes(key)
})

const showImportBtn = computed(() => {
  const key = getMenuKey()
  return key === 'keywords'
})

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

const goHome = () => {
  router.push('/v2/workspace/dashboard')
}

const handleMenuClick = ({ key }: { key: string }) => {
  router.push(`/v2/workspace/${key}`)
}

const openDashboard = () => {
  message.info('打开统计面板')
}

const refresh = () => {
  if (refreshCallback.value) {
    refreshCallback.value()
  } else {
    message.success('已刷新')
    router.replace(route.path)
  }
}

const startTask = () => {
  if (startTaskCallback.value) {
    startTaskCallback.value()
    return
  }
  
  const key = getMenuKey()
  switch (key) {
    case 'keywords':
      message.success('关键词采集任务已启动')
      break
    case 'cluster':
      message.success('聚类分析任务已启动')
      break
    case 'article-generate':
      message.success('AI生成任务已启动')
      break
    case 'review':
      message.success('内容审核任务已启动')
      break
    case 'publish':
      message.success('内容发布任务已启动')
      break
    default:
      message.success('任务已开始')
  }
}

const handleImport = () => {
  if (importCallback.value) {
    importCallback.value()
  }
}

const handleLogout = () => {
  message.success('已退出登录')
  // 可以跳转到登录页
  router.push('/')
}

// 提供给子组件的方法
provide('setRefreshCallback', (callback: () => void) => {
  refreshCallback.value = callback
})

provide('setStartTaskCallback', (callback: () => void) => {
  startTaskCallback.value = callback
})

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
  const unregisterRouter = router.afterEach(() => {
    refreshCallback.value = null
    startTaskCallback.value = null
    importCallback.value = null
  })
})
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

.sidebar-menu {
  border-right: none;
  height: 100%;
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
</style>
