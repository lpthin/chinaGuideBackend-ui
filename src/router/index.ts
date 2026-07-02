import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AdminLayout from '@/layouts/AdminLayout.vue'
import WorkspaceLayout from '@/v2/views/workspace/WorkspaceView.vue'
import DashboardView from '@/v2/views/workspace/DashboardView.vue'
import HotKeywordView from '@/v2/views/keyword/HotKeywordView.vue'
import ClusterPanel from '@/v2/views/workspace/ClusterPanel.vue'
import ArticleGeneratePanel from '@/v2/views/workspace/ArticleGeneratePanel.vue'
import ReviewPanel from '@/v2/views/workspace/ReviewPanel.vue'
import PublishPanel from '@/v2/views/workspace/PublishPanel.vue'
import ArticlesPanel from '@/v2/views/workspace/ArticlesPanel.vue'
import MediaPanel from '@/v2/views/workspace/MediaPanel.vue'
import CategoriesPanel from '@/v2/views/workspace/CategoriesPanel.vue'
import SystemPromptPanel from '@/v2/views/workspace/SystemPromptPanel.vue'
import SitesView from '@/v2/views/workspace/SitesView.vue'
import RolesPanel from '@/v2/views/workspace/RolesPanel.vue'
import PermissionsPanel from '@/v2/views/workspace/PermissionsPanel.vue'
import UsersPanel from '@/v2/views/workspace/UsersPanel.vue'

// 📚 知识库模块
const KnowledgeDashboardView = () => import('@/v2/views/knowledge/KnowledgeDashboardView.vue')
const KnowledgeDocumentView = () => import('@/v2/views/knowledge/KnowledgeDocumentView.vue')
const KnowledgeGraphView = () => import('@/v2/views/knowledge/KnowledgeGraphView.vue')
const KnowledgeCategoryView = () => import('@/v2/views/knowledge/KnowledgeCategoryView.vue')
const KnowledgeCardListView = () => import('@/v2/views/knowledge/KnowledgeCardListView.vue')
const KnowledgeCardDetailView = () => import('@/v2/views/knowledge/KnowledgeCardDetailView.vue')
const KnowledgeCardEditView = () => import('@/v2/views/knowledge/KnowledgeCardEditView.vue')
const KnowledgeTagView = () => import('@/v2/views/knowledge/KnowledgeTagView.vue')

// ✍️ 文章系统模块
const ArticleDetailView = () => import('@/v2/views/article/ArticleDetailView.vue')
const ArticleEditView = () => import('@/v2/views/article/ArticleEditView.vue')
const ArticleTemplateManageView = () => import('@/v2/views/article/ArticleTemplateManageView.vue')
const ImageLibraryView = () => import('@/v2/views/article/ImageLibraryView.vue')

// 💼 案例管理模块
const CaseListView = () => import('@/v2/views/case/CaseListView.vue')

// 💰 计费系统模块
const BillingView = () => import('@/v2/views/billing/BillingView.vue')
const BillingStatsView = () => import('@/v2/views/billing/BillingStatsView.vue')

// 🏢 门户网站模块
const BannerManageView = () => import('@/v2/views/portal/BannerManageView.vue')
const JobManageView = () => import('@/v2/views/portal/JobManageView.vue')
const MessageManageView = () => import('@/v2/views/portal/MessageManageView.vue')
const GuestbookManageView = () => import('@/v2/views/portal/GuestbookManageView.vue')
const CompanyInfoView = () => import('@/v2/views/portal/CompanyInfoView.vue')
const SeoConfigView = () => import('@/v2/views/portal/SeoConfigView.vue')
const PortalTemplateView = () => import('@/v2/views/portal/PortalTemplateView.vue')

// 🗺️ GEO地理位置模块
const GeoRegionManage = () => import('@/v2/views/geo/GeoRegionManage.vue')
const GeoStoreManage = () => import('@/v2/views/geo/GeoStoreManage.vue')
const NearbyStoreView = () => import('@/v2/views/geo/NearbyStoreView.vue')

// 🤖 AI 配置模块
const ModelConfigView = () => import('@/v2/views/ai/ModelConfigView.vue')
const VectorDbView = () => import('@/v2/views/ai/VectorDbView.vue')
const EmbeddingConfigView = () => import('@/v2/views/ai/EmbeddingConfigView.vue')
const ModelUsageView = () => import('@/v2/views/ai/ModelUsageView.vue')
const ArticleTemplateView = () => import('@/v2/views/ai/ArticleTemplateView.vue')

// 📊 运营管理模块
const CaseManageView = () => import('@/v2/views/operation/CaseManageView.vue')
const DataReportView = () => import('@/v2/views/operation/DataReportView.vue')
const OperationDashboardView = () => import('@/v2/views/operation/OperationDashboardView.vue')

// 用户中心
const UserProfileView = () => import('@/v2/views/user/UserProfileView.vue')

// 系统管理
const PublishConfigView = () => import('@/v2/views/workspace/PublishConfigView.vue')
const PublishQueueView = () => import('@/v2/views/workspace/PublishQueueView.vue')
const SystemSettingsView = () => import('@/v2/views/workspace/SystemSettingsView.vue')
const AuditLogView = () => import('@/v2/views/workspace/AuditLogView.vue')
const TenantPanel = () => import('@/v2/views/workspace/TenantPanel.vue')

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true }
  },
  {
    path: '/tenant-login',
    name: 'tenant-login',
    component: () => import('@/views/TenantLoginView.vue'),
    meta: { public: true }
  },
  {
    path: '/tenant-register',
    name: 'tenant-register',
    component: () => import('@/views/TenantRegisterView.vue'),
    meta: { public: true }
  },
  {
    path: '/payment-result',
    name: 'payment-result',
    component: () => import('@/views/PaymentResultView.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
      { path: 'admin-dashboard', name: 'admin-dashboard', component: () => import('@/views/AdminDashboardView.vue') },
      { path: 'sites', name: 'sites', component: () => import('@/views/SitesView.vue') },
      { path: 'categories', name: 'categories', component: () => import('@/views/CategoriesView.vue') },
      { path: 'keywords', name: 'keywords', component: () => import('@/views/KeywordsView.vue') },
      { path: 'articles', name: 'articles', component: () => import('@/views/ArticlesView.vue') },
      { path: 'reviews', name: 'reviews', component: () => import('@/views/ReviewsView.vue') },
      { path: 'publishing', name: 'publishing', component: () => import('@/views/PublishingView.vue') },
      { path: 'prompt-templates', name: 'prompt-templates', component: () => import('@/views/PromptTemplatesView.vue') },
      { path: 'media', name: 'media', component: () => import('@/views/MediaView.vue') },
      { path: 'comments', name: 'comments', component: () => import('@/views/CommentsView.vue') },
      { path: 'forms', name: 'forms', component: () => import('@/views/FormsView.vue') },
      { path: 'leads', name: 'leads', component: () => import('@/views/LeadsView.vue') },
      { path: 'notifications', name: 'notifications', component: () => import('@/views/NotificationsView.vue') },
      { path: 'tenant', name: 'tenant', component: () => import('@/views/TenantView.vue') },
      { path: 'usage', name: 'usage', component: () => import('@/views/UsageView.vue') },
      { path: 'plans', name: 'plans', component: () => import('@/views/PlansView.vue') },
      { path: 'plans/compare', name: 'plans-compare', component: () => import('@/views/PlanComparisonView.vue') },
      { path: 'plans/upgrade', name: 'plans-upgrade', component: () => import('@/views/PlanUpgradeView.vue') },
      { path: 'payment-config', name: 'payment-config', component: () => import('@/views/PaymentConfigView.vue') },
      { path: 'billing', name: 'billing', component: () => import('@/views/BillingView.vue') },
      { path: 'invoices', name: 'invoices', component: () => import('@/views/InvoiceView.vue') },
      { path: 'audit-logs', name: 'audit-logs', component: () => import('@/views/AuditLogsView.vue') },
      { path: 'users', name: 'users', component: () => import('@/views/UsersView.vue') },
      { path: 'roles', name: 'roles', component: () => import('@/views/RolesView.vue') },
      { path: 'permissions', name: 'permissions', component: () => import('@/views/PermissionsView.vue') }
    ]
  },
  {
    path: '/v2',
    component: WorkspaceLayout,
    redirect: '/v2/workspace/dashboard',
    children: [
      {
        path: 'workspace',
        name: 'v2-workspace',
        redirect: '/v2/workspace/dashboard',
        children: [
          // ===== 原有 14 个路由（保留） =====
          { path: 'dashboard', name: 'v2-dashboard', component: DashboardView },
          { path: 'keywords', name: 'v2-keywords', component: HotKeywordView },
          { path: 'cluster', name: 'v2-cluster', component: ClusterPanel },
          { path: 'article', name: 'v2-article', component: ArticleGeneratePanel },
          { path: 'review', name: 'v2-review', component: ReviewPanel },
          { path: 'publish', name: 'v2-publish', component: PublishPanel },
          { path: 'categories', name: 'v2-categories', component: CategoriesPanel },
          { path: 'articles', name: 'v2-articles', component: ArticlesPanel },
          { path: 'media', name: 'v2-media', component: MediaPanel },
          { path: 'system-prompt', name: 'v2-system-prompt', component: SystemPromptPanel },
          { path: 'sites', name: 'v2-sites', component: SitesView },
          { path: 'roles', name: 'v2-roles', component: RolesPanel },
          { path: 'permissions', name: 'v2-permissions', component: PermissionsPanel },
          { path: 'users', name: 'v2-users', component: UsersPanel },

          // ===== 新增：内容生产工作流 =====
          { path: 'article-templates', name: 'v2-article-templates', component: ArticleTemplateManageView },
          { path: 'article-generate', name: 'v2-article-generate', component: ArticleGeneratePanel },
          { path: 'publish-config', name: 'v2-publish-config', component: PublishConfigView },
          { path: 'publish-queue', name: 'v2-publish-queue', component: PublishQueueView },
          { path: 'image-library', name: 'v2-image-library', component: ImageLibraryView },

          // ===== 新增：文章详情/编辑 =====
          { path: 'articles/:id', name: 'v2-article-detail', component: ArticleDetailView },
          { path: 'articles/edit/:id?', name: 'v2-article-edit', component: ArticleEditView },

          // ===== 新增：知识库 =====
          { path: 'knowledge/dashboard', name: 'v2-knowledge-dashboard', component: KnowledgeDashboardView },
          { path: 'knowledge/documents', name: 'v2-knowledge-documents', component: KnowledgeDocumentView },
          { path: 'knowledge/graph', name: 'v2-knowledge-graph', component: KnowledgeGraphView },
          { path: 'knowledge/categories', name: 'v2-knowledge-categories', component: KnowledgeCategoryView },
          { path: 'knowledge/cards', name: 'v2-knowledge-cards', component: KnowledgeCardListView },
          { path: 'knowledge/cards/:id', name: 'v2-knowledge-card-detail', component: KnowledgeCardDetailView },
          { path: 'knowledge/cards/edit/:id?', name: 'v2-knowledge-card-edit', component: KnowledgeCardEditView },
          { path: 'knowledge/tags', name: 'v2-knowledge-tags', component: KnowledgeTagView },

          // ===== 新增：案例管理 =====
          { path: 'case/list', name: 'v2-case-list', component: CaseListView },

          // ===== 新增：计费系统 =====
          { path: 'billing/manage', name: 'v2-billing-manage', component: BillingView },
          { path: 'billing/stats', name: 'v2-billing-stats', component: BillingStatsView },

          // ===== 新增：门户网站 =====
          { path: 'portal/templates', name: 'v2-portal-templates', component: PortalTemplateView },
          { path: 'portal/banners', name: 'v2-portal-banners', component: BannerManageView },
          { path: 'portal/jobs', name: 'v2-portal-jobs', component: JobManageView },
          { path: 'portal/messages', name: 'v2-portal-messages', component: MessageManageView },
          { path: 'portal/guestbook', name: 'v2-portal-guestbook', component: GuestbookManageView },
          { path: 'portal/company', name: 'v2-portal-company', component: CompanyInfoView },
          { path: 'portal/seo', name: 'v2-portal-seo', component: SeoConfigView },

          // ===== 新增：GEO 地理位置 =====
          { path: 'geo/regions', name: 'v2-geo-regions', component: GeoRegionManage },
          { path: 'geo/stores', name: 'v2-geo-stores', component: GeoStoreManage },
          { path: 'geo/nearby', name: 'v2-geo-nearby', component: NearbyStoreView },

          // ===== 新增：AI 配置中心 =====
          { path: 'ai/models', name: 'v2-ai-models', component: ModelConfigView },
          { path: 'ai/vector-db', name: 'v2-ai-vector-db', component: VectorDbView },
          { path: 'ai/embedding', name: 'v2-ai-embedding', component: EmbeddingConfigView },
          { path: 'ai/usage', name: 'v2-ai-usage', component: ModelUsageView },
          { path: 'ai/article-templates', name: 'v2-ai-article-templates', component: ArticleTemplateView },

          // ===== 新增：运营管理 =====
          { path: 'operation/dashboard', name: 'v2-operation-dashboard', component: OperationDashboardView },
          { path: 'operation/cases', name: 'v2-operation-cases', component: CaseManageView },
          { path: 'operation/reports', name: 'v2-operation-reports', component: DataReportView },

          // ===== 新增：用户中心 =====
          { path: 'user/profile', name: 'v2-user-profile', component: UserProfileView },

          // ===== 新增：系统管理 =====
          { path: 'tenant', name: 'v2-tenant', component: TenantPanel },
          { path: 'settings', name: 'v2-settings', component: SystemSettingsView },
          { path: 'audit-log', name: 'v2-audit-log', component: AuditLogView }
        ]
      }
    ]
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && auth.isLoggedIn) {
    return '/dashboard'
  }
  return true
})
