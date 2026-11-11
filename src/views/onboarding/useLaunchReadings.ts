import { computed, ref } from 'vue'
import { companyInfoApi } from '../../api'
import { portalSitesApi } from '../../api/portalSites'
import { demoSiteApi, portalVisibilityApi } from '../../api/onboarding'
import type { DemoStatusResult } from '../../api/onboarding'
import type { MySite } from '../../api/portalSites'
import type { CompanyInfo } from '../../types'
import { useAuthStore } from '../../stores/auth'
import type { ChecklistStep } from '../../components/checklistPageModel'
import {
  buildLaunchSteps,
  portalPreviewUrl,
  siteNameText,
  siteOpenToPublic,
  type LaunchReadings,
  type LaunchSiteBrief
} from './launchChecklist'

/**
 * 「上线那五步现在各是什么状态」这一组读数的取数处（Spec-Q §4.4，P4）。
 *
 * 为什么单独一个文件而不是抄在两屏里：Q7 拍的是「门户上线收成超管专用，租户那半的『还差什么』
 * 并进内容工作台」。两处念的是同一件事，取数与三态判断一旦各写一份，迟早长成两个真相——
 * 一边把「这个账号读不到」演成「这家没有站点」，另一边把它演成「读取失败」，
 * 而这两种都是改前真实踩过的坑（证据见 portal-launch-view.spec.ts 顶部那段）。
 *
 * 纪律（与 launchChecklist.ts 那三条一套）：
 * 1. 站点这一格先按码决定发不发：没有 `portal:siteinfo:manage` 就只记 denied，
 *    不发那一发 403——控制台的红色 rejection 不是用户要看的东西，而这一格要说的是「读不到」。
 * 2. 每一发自己收尾。任何一个口挂了都不许把整页钉在转圈上（改前 `Promise.all` 断在半路，
 *    `loading` 永远回不来，刷新按钮一直转）。
 * 3. 演示包那一格只有超管读得到（后端 admin/tenants 下那三个 demo 口里 checkSuperAdmin），
 *    租户这一侧连请求都不发。
 */
export function useLaunchReadings(refreshHint = '点页头的「刷新」重来一次') {
  const authStore = useAuthStore()

  const loading = ref(false)
  const site = ref<LaunchSiteBrief | null>(null)
  const siteIssue = ref<'denied' | 'failed' | null>(null)
  const company = ref<CompanyInfo | null>(null)
  const demo = ref<DemoStatusResult | null>(null)
  const visibility = ref<{ articles: number | null, cases: number | null }>({ articles: null, cases: null })
  const errors = ref<Record<string, string>>({})

  /** 超管还没选客户：整屏一格都没去取。它既不是「读失败」也不是「这家什么都没有」 */
  const tenantNotSelected = computed(() => authStore.isSuperAdmin && authStore.selectedTenantId === null)

  const readings = computed<LaunchReadings>(() => ({
    tenantNotSelected: tenantNotSelected.value,
    refreshHint,
    site: site.value,
    siteIssue: siteIssue.value,
    siteError: errors.value.site,
    company: company.value,
    companyError: errors.value.company,
    demoReadable: authStore.isSuperAdmin,
    demo: demo.value,
    demoError: errors.value.demo,
    visibility: visibility.value,
    visibilityError: errors.value.visibility
  }))

  const steps = computed<ChecklistStep[]>(() => buildLaunchSteps(readings.value))
  const siteName = computed(() => siteNameText(readings.value))
  const previewUrl = computed(() => portalPreviewUrl(readings.value))

  function describeError(error: unknown): string {
    return error instanceof Error ? error.message : '请求未成功'
  }

  function toBrief(row: MySite): LaunchSiteBrief {
    return { id: row.id, code: row.code, name: row.name, domain: row.domain || '', status: row.status }
  }

  async function loadSite(): Promise<void> {
    siteIssue.value = null
    if (!authStore.hasPermission('portal:siteinfo:manage')) {
      site.value = null
      siteIssue.value = 'denied'
      return
    }
    try {
      const rows = await portalSitesApi.listMine()
      const first = Array.isArray(rows) ? rows[0] : undefined
      site.value = first ? toBrief(first) : null
    } catch (error) {
      site.value = null
      siteIssue.value = 'failed'
      errors.value.site = describeError(error)
    }
  }

  async function loadCompany(): Promise<void> {
    try {
      company.value = await companyInfoApi.get(authStore.selectedTenantId ?? undefined)
    } catch (error) {
      company.value = null
      errors.value.company = describeError(error)
    }
  }

  /** 演示包那一格：只有超管读得到，租户这一侧不发这一发 */
  async function loadDemo(): Promise<void> {
    if (!authStore.isSuperAdmin || authStore.selectedTenantId === null) {
      return
    }
    try {
      demo.value = await demoSiteApi.status(authStore.selectedTenantId)
    } catch (error) {
      demo.value = null
      errors.value.demo = describeError(error)
    }
  }

  async function loadVisibility(siteCode: string): Promise<void> {
    const [articles, cases] = await Promise.all([
      portalVisibilityApi.publishedArticles(siteCode).catch((error) => {
        errors.value.visibility = describeError(error)
        return null
      }),
      portalVisibilityApi.publishedCases(siteCode).catch((error) => {
        errors.value.visibility = describeError(error)
        return null
      })
    ])
    visibility.value = {
      articles: articles ? Number(articles.total) : null,
      cases: cases ? Number(cases.total) : null
    }
  }

  async function reload(): Promise<void> {
    errors.value = {}
    visibility.value = { articles: null, cases: null }
    if (tenantNotSelected.value) {
      site.value = null
      company.value = null
      demo.value = null
      return
    }
    loading.value = true
    try {
      // 站点这一格两种身份都读 /api/portal/sites：超管带的 X-Tenant-Id 就是右上角选中的那个租户。
      // 以前超管走 demo-status 里的 siteCode，而「一个租户多套站点」时那个字段恒为 null——
      // 现场同一份返回里 siteCount=16，界面却报「该租户还没有站点」。
      const tasks: Promise<void>[] = [loadCompany(), loadSite()]
      tasks.push(loadDemo())
      await Promise.all(tasks)
      // 站点没上线（disabled 等）时公开口整站 404——不发那两发探测，界面上第 4 步
      // 会按状态说「站点未上线」；对着关门的站发请求只会给控制台留红色 404
      if (site.value?.code && siteOpenToPublic(site.value.status)) {
        await loadVisibility(site.value.code)
      }
    } finally {
      // 每个 load* 自己收尾，这一段不许因为哪一发挂了而跳过 finally：
      // 转圈钉死就是改前那个死循环
      loading.value = false
    }
  }

  return {
    authStore,
    loading,
    tenantNotSelected,
    readings,
    steps,
    site,
    siteIssue,
    siteName,
    previewUrl,
    company,
    demo,
    visibility,
    errors,
    reload,
    loadDemo,
    loadVisibility,
    describeError
  }
}
