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
              关键词库
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
              发布中心
            </a-menu-item>
            <a-menu-item key="publish-config">
              <template #icon><SettingOutlined /></template>
              发布配置
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
            <!-- 菜单 key 就是路由首段 'media'（getMenuKey 的口径），别写成 'media/library'——那样永远高亮不上 -->
            <a-menu-item key="media" v-if="auth.hasPermission('media:manage')">
              <template #icon><PictureOutlined /></template>
              图片库
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
          <a-sub-menu key="billing" v-if="auth.isSuperAdmin">
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
            <a-menu-item key="billing/wallet">
              <template #icon><WalletOutlined /></template>
              我的钱包
            </a-menu-item>
            <a-menu-item key="billing/invoices">
              <template #icon><FileTextOutlined /></template>
              发票管理
            </a-menu-item>
            <a-menu-item key="billing/orders">
              <template #icon><ShoppingOutlined /></template>
              订单管理
            </a-menu-item>
          </a-sub-menu>

          <!-- 门户网站 -->
          <a-sub-menu key="portal">
            <template #icon><GlobalOutlined /></template>
            <template #title>门户网站</template>
            <a-menu-item key="portal/launch">
              <template #icon><RocketOutlined /></template>
              门户上线
            </a-menu-item>
            <a-menu-item key="portal/content" v-if="auth.hasPermission('portal:siteinfo:manage')">
              <template #icon><AppstoreOutlined /></template>
              内容工作台
            </a-menu-item>
            <a-menu-item key="portal/sections" v-if="auth.hasPermission('portal:build:section')">
              <template #icon><AppstoreOutlined /></template>
              栏目管理
            </a-menu-item>
            <!-- 建设域三件套（Spec §7.2，Q2）：菜单显隐与路由 meta.requiredPermission、后端 @RequirePermission 同一个码 -->
            <a-menu-item key="portal/build" v-if="auth.hasPermission('portal:build:manage')">
              <template #icon><ProjectOutlined /></template>
              建站工作台
            </a-menu-item>
            <a-menu-item key="portal/skeletons" v-if="auth.hasPermission('portal:build:preset')">
              <template #icon><AppstoreOutlined /></template>
              骨架库
            </a-menu-item>
            <a-menu-item key="portal/blocks" v-if="auth.hasPermission('portal:build:preset')">
              <template #icon><AppstoreOutlined /></template>
              区块画廊
            </a-menu-item>
            <a-menu-item key="portal/pages" v-if="auth.hasPermission('portal:build:manage')">
              <template #icon><AppstoreOutlined /></template>
              页面搭建
            </a-menu-item>
            <a-menu-item key="portal/tickets" v-if="auth.hasPermission('portal:build:review')">
              <template #icon><CommentOutlined /></template>
              改版工单
            </a-menu-item>
            <a-menu-item key="portal/reference-sites" v-if="auth.hasPermission('portal:build:reference')">
              <template #icon><GlobalOutlined /></template>
              参考站摄取
            </a-menu-item>
            <a-menu-item key="portal/presets" v-if="auth.hasPermission('portal:build:preset')">
              <template #icon><BgColorsOutlined /></template>
              样式沉淀
            </a-menu-item>
            <!-- 菜单显隐与路由 meta.requiredPermission 用同一个码，和后端 @RequirePermission 也是一致的 -->
            <a-menu-item key="portal/health" v-if="auth.hasPermission('portal:build:health')">
              <template #icon><SafetyOutlined /></template>
              页面巡检
            </a-menu-item>
            <!-- 探测的发起权只在平台（决议 N10 方案 B + N4 建设域口径）：租户令牌拿不到 portal:build:citation，这一项对它们自然不出现 -->
            <a-menu-item key="portal/citation-probes" v-if="auth.hasPermission('portal:build:citation')">
              <template #icon><AimOutlined /></template>
              品牌引用探测
            </a-menu-item>
            <a-menu-item key="portal/support-queue" v-if="auth.hasPermission('portal:build:review')">
              <template #icon><CommentOutlined /></template>
              平台工单队列
            </a-menu-item>
            <a-menu-item key="portal/banners" v-if="auth.hasPermission('portal:siteinfo:manage')">
              <template #icon><PictureOutlined /></template>
              Banner管理
            </a-menu-item>
            <a-menu-item key="portal/jobs" v-if="auth.hasPermission('portal:siteinfo:manage') && entryOpen('job')">
              <template #icon><UserAddOutlined /></template>
              招聘管理
            </a-menu-item>
            <a-menu-item key="portal/messages">
              <template #icon><MessageOutlined /></template>
              站内信
            </a-menu-item>
            <a-menu-item key="portal/guestbook" v-if="auth.hasPermission('portal:siteinfo:manage')">
              <template #icon><FormOutlined /></template>
              留言管理
            </a-menu-item>
            <a-menu-item key="portal/company" v-if="auth.hasPermission('portal:siteinfo:manage') && entryOpen('company')">
              <template #icon><BankOutlined /></template>
              企业信息
            </a-menu-item>
            <a-menu-item key="portal/analytics" v-if="auth.hasPermission('analytics:view')">
              <template #icon><BarChartOutlined /></template>
              访问统计
            </a-menu-item>
            <!-- 问题七：「谁把我带来的、AI 有没有提到我」交给租户自己看，用的就是访问统计那一码 -->
            <a-menu-item key="portal/citations" v-if="auth.hasPermission('analytics:view')">
              <template #icon><ShareAltOutlined /></template>
              引用与来源
            </a-menu-item>
            <a-menu-item key="portal/support" v-if="auth.hasPermission('portal:ticket:submit')">
              <template #icon><CommentOutlined /></template>
              联系平台
            </a-menu-item>
          </a-sub-menu>

          <!-- SEO & GEO -->
          <a-sub-menu key="geoseo">
            <template #icon><SearchOutlined /></template>
            <template #title>SEO & GEO</template>
            <a-menu-item key="geoseo/dashboard">
              <template #icon><DashboardOutlined /></template>
              总览仪表盘
            </a-menu-item>
            <a-menu-item key="geoseo/config">
              <template #icon><SettingOutlined /></template>
              站点配置
            </a-menu-item>
            <a-menu-item key="geoseo/company">
              <template #icon><BankOutlined /></template>
              企业信息
            </a-menu-item>
            <!--
              竞品追踪 / 关键词排名这两个入口按决议 N10 摘掉：排名数据没有真源，页面上那些数
              是人工抄进去的，摆在菜单里就等于我们承诺「这里能看到排名」。
              路由与页面本身留着——存量数据还得有人看得见、改得动（Spec §13.4 的「下线并注明」）。
            -->
          </a-sub-menu>

          <!-- AI配置 -->
          <a-sub-menu key="ai" v-if="auth.isSuperAdmin">
            <template #icon><RobotOutlined /></template>
            <template #title>AI配置</template>
            <a-menu-item key="ai/models">
              <template #icon><RobotOutlined /></template>
              大模型配置
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
              生成模板
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
            <a-menu-item key="operation/customers" v-if="auth.isSuperAdmin">
              <template #icon><TeamOutlined /></template>
              客户管理
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
          <a-sub-menu key="system" v-if="auth.isSuperAdmin">
            <template #icon><SettingOutlined /></template>
            <template #title>系统管理</template>
            <a-menu-item key="sites">
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
            <a-menu-item key="media-storage">
              <template #icon><CloudServerOutlined /></template>
              素材存储
            </a-menu-item>
          </a-sub-menu>

          <!-- 报警管理 -->
          <a-sub-menu key="alert" v-if="auth.isSuperAdmin">
            <template #icon><BellOutlined /></template>
            <template #title>报警管理</template>
            <a-menu-item key="alert/rules">
              <template #icon><AlertOutlined /></template>
              报警规则
            </a-menu-item>
            <a-menu-item key="alert/records">
              <template #icon><NotificationOutlined /></template>
              报警记录
            </a-menu-item>
            <a-menu-item key="alert/channels">
              <template #icon><SettingOutlined /></template>
              通知渠道
            </a-menu-item>
            <a-menu-item key="notifications">
              <template #icon><BellOutlined /></template>
              待办通知
            </a-menu-item>
          </a-sub-menu>
        </a-menu>
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
import { ref, computed, onMounted, provide, inject, watch, h } from 'vue'
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
  BgColorsOutlined,
  TeamOutlined,
  SafetyOutlined,
  UserAddOutlined,
  ApiOutlined,
  PictureOutlined,
  FireOutlined,
  FileDoneOutlined,
  BookOutlined,
  IdcardOutlined,
  TagsOutlined,
  ProjectOutlined,
  AccountBookOutlined,
  AppstoreOutlined,
  CommentOutlined,
  MessageOutlined,
  FormOutlined,
  BankOutlined,
  SearchOutlined,
  RobotOutlined,
  PieChartOutlined,
  FileSearchOutlined,
  AuditOutlined,
  BellOutlined,
  AlertOutlined,
  NotificationOutlined,
  WalletOutlined,
  ShoppingOutlined,
  AimOutlined,
  ShareAltOutlined,
  CloudServerOutlined
} from '@ant-design/icons-vue'
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

function entryOpen(entry: string): boolean {
  return openContentEntries.value === null || openContentEntries.value.has(entry)
}

async function loadSectionEntries() {
  try {
    const states = await portalSectionsApi.list()
    openContentEntries.value = new Set(
      states.filter(state => state.enabled).map(state => state.contentEntry))
  } catch {
    openContentEntries.value = null
  }
}

const collapsed = ref(false)
const openKeys = ref<string[]>(['content', 'articleManage', 'knowledge', 'system', 'alert'])

const pageKey = ref(0)
const refreshing = ref(false)
const importCallback = ref<(() => void) | null>(null)

const menuLabels: Record<string, string> = {
  dashboard: '工作台',
  keywords: '关键词库',
  cluster: '聚类分析',
  'article-generate': 'AI生成',
  review: '审核管理',
  publish: '发布中心',
  'publish-config': '发布配置',
  articles: '文章列表',
  categories: '栏目管理',
  'article-templates': '软文模板',
  media: '图片库',
  'knowledge/dashboard': '知识仪表板',
  'knowledge/documents': '资料库',
  'knowledge/cards': '知识卡片',
  'knowledge/categories': '知识分类',
  'knowledge/tags': '标签管理',
  'knowledge/graph': '知识图谱',
  'case/list': '案例列表',
  'billing/manage': '账单管理',
  'billing/stats': '消费统计',
  'portal/launch': '门户上线',
  'portal/pages': '页面搭建',
  'portal/tickets': '改版工单',
  'portal/reference-sites': '参考站摄取',
  'portal/presets': '样式沉淀',
  'portal/health': '页面巡检',
  'portal/citation-probes': '品牌引用探测',
  'portal/citations': '引用与来源',
  'portal/banners': 'Banner管理',
  'portal/jobs': '招聘管理',
  'portal/messages': '站内信',
  'portal/guestbook': '留言管理',
  'portal/company': '企业信息',
  'portal/analytics': '访问统计',
  'portal/support': '联系平台',
  'portal/support-queue': '平台工单队列',
  'geoseo/dashboard': '总览仪表盘',
  'geoseo/config': '站点配置',
  'geoseo/company': '企业信息',
  'geoseo/competitors': '竞品追踪',
  'geoseo/keywords': '关键词排名',
  'ai/models': '大模型配置',
  'ai/embedding': '向量化配置',
  'ai/usage': '用量监控',
  'ai/article-templates': '生成模板',
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
  'audit-log': '审计日志',
  'media-storage': '素材存储',
  'alert/rules': '报警规则',
  'alert/records': '报警记录',
  'alert/channels': '通知渠道',
  notifications: '待办通知'
}

const getMenuKey = () => {
  const pathParts = route.path.replace('/workspace/', '').split('/')
  if (pathParts.length >= 2 && ['knowledge', 'case', 'billing', 'portal', 'geoseo', 'ai', 'operation', 'alert'].includes(pathParts[0])) {
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
    articles: '文章管理',
    categories: '文章管理',
    'article-templates': '文章管理',
  media: '文章管理',
    'knowledge/dashboard': '知识库',
    'knowledge/documents': '知识库',
    'knowledge/cards': '知识库',
    'knowledge/categories': '知识库',
    'knowledge/tags': '知识库',
    'knowledge/graph': '知识库',
    'case/list': '案例管理',
    'billing/manage': '计费系统',
    'billing/stats': '计费系统',
    'portal/launch': '门户网站',
    'portal/pages': '门户网站',
    'portal/tickets': '门户网站',
    'portal/reference-sites': '门户网站',
    'portal/banners': '门户网站',
    'portal/jobs': '门户网站',
    'portal/messages': '门户网站',
    'portal/guestbook': '门户网站',
    'portal/company': '门户网站',
    'portal/analytics': '门户网站',
    'portal/health': '门户网站',
    'portal/citation-probes': '门户网站',
    'portal/citations': '门户网站',
    'geoseo/dashboard': 'SEO & GEO',
    'geoseo/config': 'SEO & GEO',
    'geoseo/company': 'SEO & GEO',
    'geoseo/competitors': 'SEO & GEO',
    'geoseo/keywords': 'SEO & GEO',
    'ai/models': 'AI配置',
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
    'media-storage': '系统管理',
    'alert/rules': '报警管理',
    'alert/records': '报警管理',
    'alert/channels': '报警管理',
  }
  return parentMap[key]
})

const selectedKeys = computed(() => {
  const key = getMenuKey()
  return [key]
})

const showImportBtn = computed(() => {
  const key = getMenuKey()
  return key === 'keywords'
})

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

const goHome = () => {
  router.push('/workspace/dashboard')
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
  const unregisterRouter = router.afterEach(() => {
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
