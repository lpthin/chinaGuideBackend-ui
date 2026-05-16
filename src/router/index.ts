import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AdminLayout from '@/layouts/AdminLayout.vue'

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
      { path: 'users', name: 'users', component: () => import('@/views/UsersView.vue') },
      { path: 'roles', name: 'roles', component: () => import('@/views/RolesView.vue') },
      { path: 'permissions', name: 'permissions', component: () => import('@/views/PermissionsView.vue') }
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
