import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import type { RouteComponent } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { message } from 'ant-design-vue'
import { slugOfPath } from '../portal/portalPath'

// 🔐 主布局
const WorkspaceView = () => import('../views/workspace/WorkspaceView.vue')

// 类型定义
type LazyComponent = () => Promise<{ default: RouteComponent }>

// 路由懒加载
const createRoute = (path: string, component: LazyComponent, name?: string) => ({
  path,
  name,
  component
})

// 🔐 登录页面
const LoginView = () => import('../views/LoginView.vue')

// 📚 知识库模块
const KnowledgeDashboardView = () => import('../views/knowledge/KnowledgeDashboardView.vue')
const KnowledgeDocumentView = () => import('../views/knowledge/KnowledgeDocumentView.vue')
const KnowledgeGraphView = () => import('../views/knowledge/KnowledgeGraphView.vue')
const KnowledgeCategoryView = () => import('../views/knowledge/KnowledgeCategoryView.vue')
const KnowledgeCardListView = () => import('../views/knowledge/KnowledgeCardListView.vue')
const KnowledgeCardDetailView = () => import('../views/knowledge/KnowledgeCardDetailView.vue')
const KnowledgeCardEditView = () => import('../views/knowledge/KnowledgeCardEditView.vue')
const KnowledgeTagView = () => import('../views/knowledge/KnowledgeTagView.vue')
const KnowledgeSearchView = () => import('../views/knowledge/KnowledgeSearchView.vue')

// ✍️ 文章系统模块
const ArticleDetailView = () => import('../views/article/ArticleDetailView.vue')
const ArticleEditView = () => import('../views/article/ArticleEditView.vue')
const ArticleTemplateManageView = () => import('../views/article/ArticleTemplateManageView.vue')

// 📚 关键词库模块（原热词管理→企业关键词生产体系，统一走 keyword SOT）
const KeywordLibraryView = () => import('../views/workspace/KeywordLibraryView.vue')

// 💼 案例管理模块
const CaseListView = () => import('../views/case/CaseListView.vue')

// 💰 计费系统模块
const BillingView = () => import('../views/billing/BillingView.vue')
const BillingStatsView = () => import('../views/billing/BillingStatsView.vue')
const WalletView = () => import('../views/billing/WalletView.vue')
const InvoiceView = () => import('../views/billing/InvoiceView.vue')
const OrdersView = () => import('../views/billing/OrdersView.vue')

// 🏢 门户网站模块
const PortalDynamicPage = () => import('../portal/PortalDynamicPage.vue')
const PortalArticleDetail = () => import('../portal/PortalArticleDetail.vue')
const PortalCaseDetail = () => import('../portal/PortalCaseDetail.vue')
const BannerManageView = () => import('../views/portal/BannerManageView.vue')
const JobManageView = () => import('../views/portal/JobManageView.vue')
const MessageManageView = () => import('../views/portal/MessageManageView.vue')
const GuestbookManageView = () => import('../views/portal/GuestbookManageView.vue')
const CompanyInfoView = () => import('../views/portal/CompanyInfoView.vue')
const SeoConfigView = () => import('../views/portal/SeoConfigView.vue')
const PageBuilderView = () => import('../views/portal/PageBuilderView.vue')
const RevisionTicketView = () => import('../views/portal/RevisionTicketView.vue')
const ReferenceSiteView = () => import('../views/portal/ReferenceSiteView.vue')
const ThemePresetView = () => import('../views/portal/ThemePresetView.vue')
const PortalHealthView = () => import('../views/portal/PortalHealthView.vue')
const PortalAnalyticsView = () => import('../views/analytics/PortalAnalyticsView.vue')
const PortalLaunchView = () => import('../views/onboarding/PortalLaunchView.vue')

// 🔍 SEO & GEO 模块
const GeoSeoDashboardView = () => import('../views/geoseo/GeoSeoDashboardView.vue')
const GeoSeoConfigView = () => import('../views/geoseo/GeoSeoConfigView.vue')
const GeoSeoPageView = () => import('../views/geoseo/GeoSeoPageView.vue')
const GeoSeoCompanyView = () => import('../views/geoseo/GeoSeoCompanyView.vue')
const GeoSeoCompetitorView = () => import('../views/geoseo/GeoSeoCompetitorView.vue')
const GeoSeoKeywordView = () => import('../views/geoseo/GeoSeoKeywordView.vue')

// 🤖 AI 配置模块
const ModelConfigView = () => import('../views/ai/ModelConfigView.vue')
const EmbeddingConfigView = () => import('../views/ai/EmbeddingConfigView.vue')
const ModelUsageView = () => import('../views/ai/ModelUsageView.vue')
const ArticleTemplateView = () => import('../views/ai/ArticleTemplateView.vue')

// 📊 运营管理模块
const CaseManageView = () => import('../views/operation/CaseManageView.vue')
const DataReportView = () => import('../views/operation/DataReportView.vue')
const OperationDashboardView = () => import('../views/operation/OperationDashboardView.vue')
const CustomerManageView = () => import('../views/admin/CustomerManageView.vue')

// 用户中心
const UserProfileView = () => import('../views/user/UserProfileView.vue')

// 工作流页面
const DashboardView = () => import('../views/workspace/DashboardView.vue')
const ClusterPanel = () => import('../views/workspace/ClusterPanel.vue')
const ArticleGeneratePanel = () => import('../views/workspace/ArticleGeneratePanel.vue')
const ReviewPanel = () => import('../views/workspace/ReviewPanel.vue')
const PublishCenterView = () => import('../views/workspace/PublishCenterView.vue')
const PublishConfigView = () => import('../views/workspace/PublishConfigView.vue')
const ArticlesPanel = () => import('../views/workspace/ArticlesPanel.vue')
const CategoriesPanel = () => import('../views/workspace/CategoriesPanel.vue')
const SystemPromptPanel = () => import('../views/workspace/SystemPromptPanel.vue')
const RolesPanel = () => import('../views/workspace/RolesPanel.vue')
const PermissionsPanel = () => import('../views/workspace/PermissionsPanel.vue')
const UsersPanel = () => import('../views/workspace/UsersPanel.vue')
const SystemSettingsView = () => import('../views/workspace/SystemSettingsView.vue')
const AuditLogView = () => import('../views/workspace/AuditLogView.vue')
const SitesView = () => import('../views/workspace/SitesView.vue')
const TenantPanel = () => import('../views/workspace/TenantPanel.vue')
const AlertRuleManageView = () => import('../views/workspace/AlertRuleManageView.vue')
const AlertRecordView = () => import('../views/workspace/AlertRecordView.vue')
const AlertChannelView = () => import('../views/workspace/AlertChannelView.vue')
const NotFoundView = () => import('../views/NotFoundView.vue')

const routes: RouteRecordRaw[] = [
  // 🌐 门户网站前台页面。内置页的短路径都挂同一个组件：slug 由路径换算（见 portalPath.ts），
  // 取数与渲染只此一条路。这里曾经是「灰度闸门」PortalHome——站点没开页面模型就
  // 退回三套写死的旧模板，两条渲染路径并存；旧模板与那个开关已整条删除（Spec D3 / R8 的 sunset 项）。
  {
    path: '/',
    name: 'portal-home',
    component: PortalDynamicPage,
    props: route => ({ slug: slugOfPath(route.path) }),
    meta: { title: '首页', requiresAuth: false }
  },
  {
    path: '/about',
    name: 'portal-about',
    component: PortalDynamicPage,
    props: route => ({ slug: slugOfPath(route.path) }),
    meta: { title: '关于我们', requiresAuth: false }
  },
  {
    path: '/services',
    name: 'portal-services',
    component: PortalDynamicPage,
    props: route => ({ slug: slugOfPath(route.path) }),
    meta: { title: '服务项目', requiresAuth: false }
  },
  {
    path: '/cases',
    name: 'portal-cases',
    component: PortalDynamicPage,
    props: route => ({ slug: slugOfPath(route.path) }),
    meta: { title: '案例展示', requiresAuth: false }
  },
  {
    path: '/news',
    name: 'portal-news',
    component: PortalDynamicPage,
    props: route => ({ slug: slugOfPath(route.path) }),
    meta: { title: '新闻动态', requiresAuth: false }
  },
  {
    path: '/contact',
    name: 'portal-contact',
    component: PortalDynamicPage,
    props: route => ({ slug: slugOfPath(route.path) }),
    meta: { title: '联系我们', requiresAuth: false }
  },
  // 招聘页：内置页（后端 BuiltInPages 有它，PortalUrls.page 才发得出 /jobs 这个短地址），
  // 区块 job-list 绑 {"$data":"jobs"}。历史上 /jobs 只存在于后端清单里、前端没有这条路由，
  // 所以它是个打不开的门面；这次是地址、内置页、区块三者一起补上的。
  {
    path: '/jobs',
    name: 'portal-jobs',
    component: PortalDynamicPage,
    props: route => ({ slug: slugOfPath(route.path) }),
    meta: { title: '加入我们', requiresAuth: false }
  },
  // 租户自定义页：路径由后端 PortalUrls.page() 生成（内置页仍走上面那些原路径，不搬家）
  {
    path: '/p/:slug',
    name: 'portal-page',
    component: PortalDynamicPage,
    props: route => ({ slug: String(route.params.slug ?? '') }),
    meta: { title: '页面', requiresAuth: false }
  },
  // 详情页：路径与后端 PortalUrls（sitemap / llms.txt / 门户列表返回的 link）完全一致，
  // 少了这两条路由，爬虫按 sitemap 抓过来全是 404，访客点新闻列表也是 404。
  {
    path: '/news/:idOrSlug',
    name: 'portal-article-detail',
    component: PortalArticleDetail,
    meta: { title: '文章详情', requiresAuth: false }
  },
  {
    path: '/cases/:id',
    name: 'portal-case-detail',
    component: PortalCaseDetail,
    meta: { title: '案例详情', requiresAuth: false }
  },
  // 登录页面
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/workspace',
    name: 'workspace',
    component: WorkspaceView,
    redirect: '/workspace/dashboard',
    meta: { requiresAuth: true },
    children: [
      // ===== 📊 工作区仪表板 =====
      {
        path: 'dashboard',
        name: 'workspace-dashboard',
        component: DashboardView,
        meta: { title: '工作台', icon: 'dashboard', breadcrumb: ['首页', '工作台'] }
      },

      // ===== 📚 内容生产工作流 =====
      {
        path: 'keywords',
        name: 'workspace-keywords',
        component: KeywordLibraryView,
        meta: { title: '关键词库', icon: 'database', breadcrumb: ['首页', '内容生产', '关键词库'] }
      },
      {
        path: 'article-templates',
        name: 'workspace-article-templates',
        component: ArticleTemplateManageView,
        meta: { title: '软文模板', icon: 'file-text', breadcrumb: ['首页', '文章管理', '软文模板'] }
      },
      {
        path: 'cluster',
        name: 'workspace-cluster',
        component: ClusterPanel,
        meta: { title: '聚类分析', icon: 'cluster', breadcrumb: ['首页', '内容生产', '聚类分析'] }
      },
      {
        path: 'article-generate',
        name: 'workspace-article-generate',
        component: ArticleGeneratePanel,
        meta: { title: 'AI生成', icon: 'ai', breadcrumb: ['首页', '内容生产', 'AI生成'] }
      },
      {
        path: 'review',
        name: 'workspace-review',
        component: ReviewPanel,
        meta: { title: '审核管理', icon: 'audit', breadcrumb: ['首页', '内容生产', '审核管理'] }
      },
      {
        path: 'publish',
        name: 'workspace-publish',
        component: PublishCenterView,
        meta: { title: '发布中心', icon: 'upload', breadcrumb: ['首页', '内容生产', '发布中心'] }
      },
      {
        path: 'publish-config',
        name: 'workspace-publish-config',
        component: PublishConfigView,
        meta: { title: '发布配置', icon: 'setting', breadcrumb: ['首页', '内容生产', '发布配置'] }
      },
      {
        // 发布队列已合并进发布中心，保留旧地址可达
        path: 'publish-queue',
        redirect: { name: 'workspace-publish' }
      },

      // ===== ✍️ 文章管理 =====
      {
        path: 'articles',
        name: 'workspace-articles',
        component: ArticlesPanel,
        meta: { title: '文章管理', icon: 'article', breadcrumb: ['首页', '文章管理'] }
      },
      {
        path: 'articles/:id',
        name: 'workspace-article-detail',
        component: ArticleDetailView,
        meta: { title: '文章详情', hidden: true, breadcrumb: ['首页', '文章管理', '详情'] }
      },
      {
        path: 'articles/edit/:id?',
        name: 'workspace-article-edit',
        component: ArticleEditView,
        meta: { title: '编辑文章', hidden: true, breadcrumb: ['首页', '文章管理', '编辑'] }
      },
      {
        path: 'categories',
        name: 'workspace-categories',
        component: CategoriesPanel,
        meta: { title: '栏目管理', icon: 'category', breadcrumb: ['首页', '文章管理', '栏目管理'] }
      },

      // ===== 📚 知识库 =====
      {
        path: 'knowledge/dashboard',
        name: 'workspace-knowledge-dashboard',
        component: KnowledgeDashboardView,
        meta: { title: '知识库仪表板', icon: 'dashboard', breadcrumb: ['首页', '知识库', '仪表板'] }
      },
      {
        path: 'knowledge/search',
        name: 'workspace-knowledge-search',
        component: KnowledgeSearchView,
        meta: { title: '知识库搜索', icon: 'search', breadcrumb: ['首页', '知识库', '搜索'] }
      },
      {
        path: 'knowledge/documents',
        name: 'workspace-knowledge-documents',
        component: KnowledgeDocumentView,
        meta: { title: '资料库', icon: 'folder', breadcrumb: ['首页', '知识库', '资料库'] }
      },
      {
        path: 'knowledge/graph',
        name: 'workspace-knowledge-graph',
        component: KnowledgeGraphView,
        meta: { title: '知识图谱', icon: 'apartment', breadcrumb: ['首页', '知识库', '知识图谱'] }
      },
      {
        path: 'knowledge/categories',
        name: 'workspace-knowledge-categories',
        component: KnowledgeCategoryView,
        meta: { title: '知识分类', icon: 'category', breadcrumb: ['首页', '知识库', '分类管理'] }
      },
      {
        path: 'knowledge/cards',
        name: 'workspace-knowledge-cards',
        component: KnowledgeCardListView,
        meta: { title: '知识卡片', icon: 'card', breadcrumb: ['首页', '知识库', '卡片列表'] }
      },
      {
        path: 'knowledge/cards/:id',
        name: 'workspace-knowledge-card-detail',
        component: KnowledgeCardDetailView,
        meta: { title: '卡片详情', hidden: true, breadcrumb: ['首页', '知识库', '卡片详情'] }
      },
      {
        path: 'knowledge/cards/edit/:id?',
        name: 'workspace-knowledge-card-edit',
        component: KnowledgeCardEditView,
        meta: { title: '编辑卡片', hidden: true, breadcrumb: ['首页', '知识库', '编辑卡片'] }
      },
      {
        path: 'knowledge/tags',
        name: 'workspace-knowledge-tags',
        component: KnowledgeTagView,
        meta: { title: '标签管理', icon: 'tag', breadcrumb: ['首页', '知识库', '标签管理'] }
      },

      // ===== 💼 案例管理 =====
      {
        path: 'case/list',
        name: 'workspace-case-list',
        component: CaseListView,
        meta: { title: '案例列表', icon: 'file-text', breadcrumb: ['首页', '案例管理', '案例列表'] }
      },

      // ===== 💰 计费系统 =====
      {
        path: 'billing/manage',
        name: 'workspace-billing-manage',
        component: BillingView,
        meta: { title: '账单管理', icon: 'account-book', breadcrumb: ['首页', '计费系统', '账单管理'], requiresSuperAdmin: true }
      },
      {
        path: 'billing/stats',
        name: 'workspace-billing-stats',
        component: BillingStatsView,
        meta: { title: '消费统计', icon: 'chart', breadcrumb: ['首页', '计费系统', '消费统计'], requiresSuperAdmin: true }
      },
      {
        path: 'billing/wallet',
        name: 'workspace-billing-wallet',
        component: WalletView,
        meta: { title: '我的钱包', icon: 'wallet', breadcrumb: ['首页', '计费系统', '我的钱包'], requiresSuperAdmin: true }
      },
      {
        path: 'billing/invoices',
        name: 'workspace-billing-invoices',
        component: InvoiceView,
        meta: { title: '发票管理', icon: 'file-invoice', breadcrumb: ['首页', '计费系统', '发票管理'], requiresSuperAdmin: true }
      },
      {
        path: 'billing/orders',
        name: 'workspace-billing-orders',
        component: OrdersView,
        meta: { title: '订单管理', icon: 'shopping', breadcrumb: ['首页', '计费系统', '订单管理'], requiresSuperAdmin: true }
      },

      // ===== 🏢 门户网站 =====
      {
        path: 'portal/launch',
        name: 'workspace-portal-launch',
        component: PortalLaunchView,
        meta: { title: '门户上线', icon: 'rocket', breadcrumb: ['首页', '门户网站', '门户上线'] }
      },
      // 「模板管理」这一项随 portal_template 整条删除：挑了模板也不会改变访客看到的样子，
      // 换样式由「样式沉淀」（portal/presets，皮肤 + 平台模板）承担。
      {
        path: 'portal/banners',
        name: 'workspace-portal-banners',
        component: BannerManageView,
        meta: { title: 'Banner管理', icon: 'image', breadcrumb: ['首页', '门户网站', 'Banner管理'] }
      },
      {
        path: 'portal/jobs',
        name: 'workspace-portal-jobs',
        component: JobManageView,
        meta: { title: '招聘管理', icon: 'job', breadcrumb: ['首页', '门户网站', '招聘管理'] }
      },
      {
        path: 'portal/messages',
        name: 'workspace-portal-messages',
        component: MessageManageView,
        meta: { title: '站内信', icon: 'message', breadcrumb: ['首页', '门户网站', '站内信'] }
      },
      {
        path: 'portal/guestbook',
        name: 'workspace-portal-guestbook',
        component: GuestbookManageView,
        meta: { title: '留言管理', icon: 'guestbook', breadcrumb: ['首页', '门户网站', '留言管理'] }
      },
      {
        path: 'portal/company',
        name: 'workspace-portal-company',
        component: CompanyInfoView,
        meta: { title: '企业信息', icon: 'building', breadcrumb: ['首页', '门户网站', '企业信息'] }
      },
      {
        path: 'portal/seo',
        name: 'workspace-portal-seo',
        component: SeoConfigView,
        meta: { title: 'SEO配置', icon: 'seo', breadcrumb: ['首页', '门户网站', 'SEO配置'] }
      },
      {
        path: 'portal/pages',
        name: 'workspace-portal-pages',
        component: PageBuilderView,
        // 菜单显隐与这里的判断用同一个权限码（后端 @RequirePermission 也是它）：
        // 只藏菜单不挡路由，等于「看不见但敲地址就能进」，那样权限只是装饰。
        meta: {
          title: '页面搭建',
          icon: 'template',
          breadcrumb: ['首页', '门户网站', '页面搭建'],
          requiredPermission: 'portal:page:manage'
        }
      },
      {
        path: 'portal/tickets',
        name: 'workspace-portal-tickets',
        component: RevisionTicketView,
        meta: {
          title: '改版工单',
          icon: 'message',
          breadcrumb: ['首页', '门户网站', '改版工单'],
          requiredPermission: 'portal:review:manage'
        }
      },
      {
        path: 'portal/reference-sites',
        name: 'workspace-portal-reference-sites',
        component: ReferenceSiteView,
        // 摄取别人站点这条路的入口权限（V81 已发）：菜单显隐、路由守卫、后端 @RequirePermission 同一个码
        meta: {
          title: '参考站摄取',
          icon: 'global',
          breadcrumb: ['首页', '门户网站', '参考站摄取'],
          requiredPermission: 'portal:reference:use'
        }
      },
      {
        path: 'portal/presets',
        name: 'workspace-portal-presets',
        component: ThemePresetView,
        // 整页都是写动作（沉淀/应用/建页/删除），所以按写权限挡；promote 那一半另有更小的权限码，
        // 由界面按 auth.hasPermission('portal:template:promote') 决定是否出现入口。
        meta: {
          title: '样式沉淀',
          icon: 'template',
          breadcrumb: ['首页', '门户网站', '样式沉淀'],
          requiredPermission: 'portal:page:manage'
        }
      },
      {
        path: 'portal/health',
        name: 'workspace-portal-health',
        component: PortalHealthView,
        // 同一个码覆盖「看巡检结果」与「让 AI 出手」：出手只产出建议或待审阅草稿，
        // 真正把内容推给访客仍然是 portal:page:manage 的应用/发布动作。
        meta: {
          title: '页面巡检',
          icon: 'safety',
          breadcrumb: ['首页', '门户网站', '页面巡检'],
          requiredPermission: 'portal:health:use'
        }
      },
      {
        path: 'portal/analytics',
        name: 'workspace-portal-analytics',
        component: PortalAnalyticsView,
        meta: { title: '访问统计', icon: 'chart', breadcrumb: ['首页', '门户网站', '访问统计'] }
      },

      // ===== 🔍 SEO & GEO =====
      {
        path: 'geoseo/dashboard',
        name: 'workspace-geoseo-dashboard',
        component: GeoSeoDashboardView,
        meta: { title: '总览仪表盘', icon: 'dashboard', breadcrumb: ['首页', 'SEO & GEO', '总览仪表盘'] }
      },
      {
        path: 'geoseo/config',
        name: 'workspace-geoseo-config',
        component: GeoSeoConfigView,
        meta: { title: '站点配置', icon: 'setting', breadcrumb: ['首页', 'SEO & GEO', '站点配置'] }
      },
      {
        path: 'geoseo/pages',
        name: 'workspace-geoseo-pages',
        component: GeoSeoPageView,
        meta: { title: '页面SEO', icon: 'file-text', breadcrumb: ['首页', 'SEO & GEO', '页面SEO'] }
      },
      {
        path: 'geoseo/company',
        name: 'workspace-geoseo-company',
        component: GeoSeoCompanyView,
        meta: { title: '企业信息', icon: 'building', breadcrumb: ['首页', 'SEO & GEO', '企业信息'] }
      },
      {
        path: 'geoseo/competitors',
        name: 'workspace-geoseo-competitors',
        component: GeoSeoCompetitorView,
        meta: { title: '竞品追踪', icon: 'team', breadcrumb: ['首页', 'SEO & GEO', '竞品追踪'] }
      },
      {
        path: 'geoseo/keywords',
        name: 'workspace-geoseo-keywords',
        component: GeoSeoKeywordView,
        meta: { title: '关键词排名', icon: 'search', breadcrumb: ['首页', 'SEO & GEO', '关键词排名'] }
      },

      // ===== 🤖 AI 配置中心 =====
      {
        path: 'ai/models',
        name: 'workspace-ai-models',
        component: ModelConfigView,
        meta: { title: '大模型配置', icon: 'robot', breadcrumb: ['首页', 'AI配置', '大模型'], requiresSuperAdmin: true }
      },
      {
        path: 'ai/vector-db',
        redirect: { name: 'workspace-ai-embedding' },
      },
      {
        path: 'ai/embedding',
        name: 'workspace-ai-embedding',
        component: EmbeddingConfigView,
        meta: { title: '向量化配置', icon: 'api', breadcrumb: ['首页', 'AI配置', '向量化配置'], requiresSuperAdmin: true }
      },
      {
        path: 'ai/usage',
        name: 'workspace-ai-usage',
        component: ModelUsageView,
        meta: { title: '用量监控', icon: 'chart', breadcrumb: ['首页', 'AI配置', '用量监控'], requiresSuperAdmin: true }
      },
      {
        path: 'ai/article-templates',
        name: 'workspace-ai-article-templates',
        component: ArticleTemplateView,
        // ai_article_template 是 AI 生成时真正读取的模板表，与「文章管理 > 软文模板」(article_template) 不是同一份数据
        meta: { title: '生成模板', icon: 'article', breadcrumb: ['首页', 'AI配置', '生成模板'], requiresSuperAdmin: true }
      },

      // ===== 📊 运营管理 =====
      {
        path: 'operation/dashboard',
        name: 'workspace-operation-dashboard',
        component: OperationDashboardView,
        meta: { title: '运营概览', icon: 'chart', breadcrumb: ['首页', '运营管理', '运营概览'] }
      },
      {
        path: 'operation/customers',
        name: 'workspace-operation-customers',
        component: CustomerManageView,
        meta: { title: '客户管理', icon: 'team', breadcrumb: ['首页', '运营管理', '客户管理'], requiresSuperAdmin: true }
      },
      {
        path: 'operation/cases',
        name: 'workspace-operation-cases',
        component: CaseManageView,
        meta: { title: '客户案例', icon: 'case', breadcrumb: ['首页', '运营管理', '客户案例'] }
      },
      {
        path: 'operation/reports',
        name: 'workspace-operation-reports',
        component: DataReportView,
        meta: { title: '数据报表', icon: 'report', breadcrumb: ['首页', '运营管理', '数据报表'] }
      },

      // ===== 👤 用户中心 =====
      {
        path: 'user/profile',
        name: 'workspace-user-profile',
        component: UserProfileView,
        meta: { title: '个人中心', icon: 'user', breadcrumb: ['首页', '用户中心', '个人中心'] }
      },

      // ===== ⚙️ 系统管理 =====
      {
        path: 'sites',
        name: 'workspace-sites',
        component: SitesView,
        meta: { title: '站点管理', icon: 'global', breadcrumb: ['首页', '系统管理', '站点管理'], requiresSuperAdmin: true }
      },
      {
        path: 'tenant',
        name: 'workspace-tenant',
        component: TenantPanel,
        meta: { title: '租户管理', icon: 'team', breadcrumb: ['首页', '系统管理', '租户管理'], requiresSuperAdmin: true }
      },
      {
        path: 'system-prompt',
        name: 'workspace-system-prompt',
        component: SystemPromptPanel,
        meta: { title: 'Prompt管理', icon: 'prompt', breadcrumb: ['首页', '系统配置', 'Prompt管理'], requiresSuperAdmin: true }
      },
      {
        path: 'roles',
        name: 'workspace-roles',
        component: RolesPanel,
        meta: { title: '角色管理', icon: 'role', breadcrumb: ['首页', '系统管理', '角色管理'], requiresSuperAdmin: true }
      },
      {
        path: 'permissions',
        name: 'workspace-permissions',
        component: PermissionsPanel,
        meta: { title: '权限管理', icon: 'permission', breadcrumb: ['首页', '系统管理', '权限管理'], requiresSuperAdmin: true }
      },
      {
        path: 'users',
        name: 'workspace-users',
        component: UsersPanel,
        meta: { title: '用户管理', icon: 'user', breadcrumb: ['首页', '系统管理', '用户管理'], requiresSuperAdmin: true }
      },
      {
        path: 'settings',
        name: 'workspace-settings',
        component: SystemSettingsView,
        meta: { title: '系统设置', icon: 'setting', breadcrumb: ['首页', '系统管理', '系统设置'], requiresSuperAdmin: true }
      },
      {
        path: 'audit-log',
        name: 'workspace-audit-log',
        component: AuditLogView,
        meta: { title: '审计日志', icon: 'audit', breadcrumb: ['首页', '系统管理', '审计日志'], requiresSuperAdmin: true }
      },

      // ===== 🔔 报警管理 =====
      {
        path: 'alert/rules',
        name: 'workspace-alert-rules',
        component: AlertRuleManageView,
        meta: { title: '报警规则', icon: 'alert', breadcrumb: ['首页', '报警管理', '报警规则'], requiresSuperAdmin: true }
      },
      {
        path: 'alert/records',
        name: 'workspace-alert-records',
        component: AlertRecordView,
        meta: { title: '报警记录', icon: 'notification', breadcrumb: ['首页', '报警管理', '报警记录'], requiresSuperAdmin: true }
      },
      {
        path: 'alert/channels',
        name: 'workspace-alert-channels',
        component: AlertChannelView,
        meta: { title: '通知渠道', icon: 'setting', breadcrumb: ['首页', '报警管理', '通知渠道'], requiresSuperAdmin: true }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { title: '页面未找到', requiresAuth: false }
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 路由守卫
router.beforeEach((to) => {
  const authStore = useAuthStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth !== false)

  if (requiresAuth && !authStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && authStore.isLoggedIn) {
    return { name: 'workspace-dashboard' }
  }
  const requiresSuperAdmin = to.matched.some(record => record.meta.requiresSuperAdmin === true)
  if (requiresSuperAdmin && !authStore.isSuperAdmin) {
    message.error('无权限访问该页面')
    return { name: 'workspace-dashboard' }
  }
  // 细粒度权限：与菜单显隐、后端 @RequirePermission 用同一个 permission.code 字符串。
  // 后端仍是唯一的执法者，这里只是不让用户敲地址进了一个满屏 403 的页面。
  const permissionCodes = to.matched
    .map(record => record.meta.requiredPermission as string | undefined)
    .filter((code): code is string => !!code)
  if (permissionCodes.some(code => !authStore.hasPermission(code))) {
    message.error('无权限访问该页面')
    return { name: 'workspace-dashboard' }
  }
  return true
})

export default router
