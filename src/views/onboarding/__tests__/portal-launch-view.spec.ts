import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PortalLaunchView from '../PortalLaunchView.vue'
import { companyInfoApi } from '../../../api'
import { portalSitesApi } from '../../../api/portalSites'
import { demoSiteApi, portalVisibilityApi } from '../../../api/onboarding'

/**
 * 「门户上线」检查表第 1 格（站点）的三条说法（Q-3）。
 *
 * 改前的现场（scratch/site-audit/permission-mismatch-t15.md §4，租户 15 · CONTENT_EDITOR 真跑）：
 * 这一格无条件打 `/api/admin/sites`（要 portal:build:manage），403 的 rejection 没人接，
 * `Promise.all` 直接断在半路 → `loading.value = false` 永远跑不到，刷新按钮一直转；
 * 而 `errors.site` 也从来没被赋值，于是界面照「读到了但没有」那条分支渲染成「该租户还没有站点」。
 * 站点一直在，读的人没权限——这一页顶部自己承诺的是「取不到就显示「未取到」而不是 0」。
 *
 * 所以钉三件事：读不到时说不清从哪读不到（无权限 / 读取失败 / 真的没有），以及任何一口挂了
 * 都不许把整页钉在转圈上。
 */

const authState = {
  isSuperAdmin: false,
  selectedTenantId: null as number | null,
  tenantId: 15,
  permissions: [] as string[],
  hasPermission(code: string) {
    return this.permissions.includes(code)
  },
}

vi.mock('../../../stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/workspace/portal/launch', query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('../../../api', () => ({
  companyInfoApi: { get: vi.fn() },
}))
vi.mock('../../../api/portalSites', () => ({
  portalSitesApi: { listMine: vi.fn() },
}))
vi.mock('../../../api/onboarding', () => ({
  backendFileUrl: (path: string) => `https://backend.example${path}`,
  demoSiteApi: { status: vi.fn(), bootstrap: vi.fn(), publish: vi.fn() },
  portalVisibilityApi: { publishedArticles: vi.fn(), publishedCases: vi.fn() },
}))

const PASS_THROUGH = (name: string, extraSlots: string[] = []) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'column', 'bordered', 'span', 'value', 'href', 'options'],
  template: `<div class="${name.toLowerCase()}-stub"><span>${'{{ description }}'}</span><span>${'{{ title }}'}</span><slot name="title" />${extraSlots
    .map(slot => `<slot name="${slot}" />`)
    .join('')}<slot /></div>`,
})

function stubs() {
  return {
    'a-alert': PASS_THROUGH('AAlert'),
    'a-form': PASS_THROUGH('AForm'),
    'a-form-item': PASS_THROUGH('AFormItem'),
    'a-button': PASS_THROUGH('AButton'),
    'a-spin': { name: 'ASpin', props: ['spinning'], template: '<div class="aspin-stub" :data-spinning="String(spinning)"><slot /></div>' },
    'a-card': PASS_THROUGH('ACard', ['extra']),
    'a-descriptions': PASS_THROUGH('ADescriptions'),
    'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
    'a-tag': PASS_THROUGH('ATag'),
    'a-space': PASS_THROUGH('ASpace'),
    'a-select': PASS_THROUGH('ASelect'),
    'a-popconfirm': PASS_THROUGH('APopconfirm'),
    'a-row': PASS_THROUGH('ARow'),
    'a-col': PASS_THROUGH('ACol'),
    'a-statistic': PASS_THROUGH('AStatistic'),
    'a-tooltip': PASS_THROUGH('ATooltip'),
    RouterLink: { name: 'RouterLink', props: ['to'], template: '<a class="router-link-stub"><slot /></a>' },
  }
}

async function mountView() {
  const wrapper = mount(PortalLaunchView, {
    attachTo: document.body,
    global: { stubs: stubs() },
  })
  await flushPromises()
  return wrapper
}

/** 第 1 格那张卡：按卡标题里的「站点与访问域名」取，不靠卡的序号（别的格也会加） */
function siteCard(wrapper: Awaited<ReturnType<typeof mountView>>) {
  const card = wrapper.findAll('.acard-stub').find(node => node.text().includes('站点与访问域名'))
  if (!card) {
    throw new Error('找不到「站点与访问域名」那张卡')
  }
  return card
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  authState.isSuperAdmin = false
  authState.selectedTenantId = null
  authState.tenantId = 15
  authState.permissions = ['portal:siteinfo:manage']
  vi.mocked(companyInfoApi.get).mockResolvedValue({ companyName: '牙科诊所' } as any)
  vi.mocked(portalVisibilityApi.publishedArticles).mockResolvedValue({ total: 3 } as any)
  vi.mocked(portalVisibilityApi.publishedCases).mockResolvedValue({ total: 1 } as any)
})

describe('第 1 格 · 站点', () => {
  it('走租户侧自己的口，不再打建设域那个 /admin/sites', async () => {
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([
      { id: 9, code: 'xiaoshansdental', name: '萧山竟天口腔', domain: 'xiaoshansdental.com' },
    ] as any)
    const wrapper = await mountView()
    expect(portalSitesApi.listMine).toHaveBeenCalledTimes(1)
    expect(siteCard(wrapper).text()).toContain('萧山竟天口腔（ID 9）')
    expect(siteCard(wrapper).text()).toContain('xiaoshansdental')
    expect(siteCard(wrapper).text()).toContain('xiaoshansdental.com')
    expect(siteCard(wrapper).text()).toContain('已绑定域名')
  })

  it('站点在但域名没绑：说「未绑定」，这一条是真话', async () => {
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([
      { id: 9, code: 'xiaoshansdental', name: '萧山竟天口腔', domain: null },
    ] as any)
    const wrapper = await mountView()
    expect(siteCard(wrapper).text()).toContain('未绑定')
    expect(siteCard(wrapper).text()).not.toContain('未取到')
  })

  it('口回空列表才说「该租户还没有站点」', async () => {
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([] as any)
    const wrapper = await mountView()
    expect(siteCard(wrapper).text()).toContain('该租户还没有站点')
    expect(siteCard(wrapper).text()).toContain('缺少站点')
  })

  it('没有那一码时不发请求，格子说「没有站点信息的查看权限」而不是「还没有站点」', async () => {
    authState.permissions = []
    const wrapper = await mountView()
    expect(portalSitesApi.listMine).not.toHaveBeenCalled()
    expect(siteCard(wrapper).text()).toContain('没有站点信息的查看权限')
    expect(siteCard(wrapper).text()).toContain('无查看权限')
    expect(siteCard(wrapper).text()).not.toContain('该租户还没有站点')
    // 读不到时那一格下面的字段也不许演成「未绑定」
    expect(siteCard(wrapper).text()).toContain('未取到')
  })

  it('超管没选租户时这一格是「未取数」，不是凭空报一个「缺少站点」', async () => {
    authState.isSuperAdmin = true
    authState.selectedTenantId = null
    const wrapper = await mountView()
    expect(portalSitesApi.listMine).not.toHaveBeenCalled()
    expect(demoSiteApi.status).not.toHaveBeenCalled()
    expect(siteCard(wrapper).text()).toContain('未选租户，未取数')
    expect(siteCard(wrapper).text()).toContain('未取数')
    expect(siteCard(wrapper).text()).not.toContain('该租户还没有站点')
    expect(siteCard(wrapper).text()).not.toContain('未绑定')
  })

  it('超管选了租户时站点也走 /portal/sites：demo-status 的 siteCode 为 null 不等于没有站点', async () => {
    // 现场（scratch/site-audit/demo-status-15.json）：siteCount=16 而 siteId/siteCode/domain 全 null，
    // 以前这一格把它演成「该租户还没有站点」
    authState.isSuperAdmin = true
    authState.selectedTenantId = 15
    authState.permissions = ['portal:siteinfo:manage', 'portal:build:manage']
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([
      { id: 1783358986675, code: 'jingtian-dental-site', name: '萧山景天牙科医院官网', domain: 'xiaoshansdental.com' },
    ] as any)
    vi.mocked(demoSiteApi.status).mockResolvedValue({
      tenantId: 15,
      siteCount: 16,
      siteId: null,
      siteCode: null,
      siteName: null,
      domain: null,
      demo: { categories: 12, articles: 60, cases: 18, banners: 0, jobs: 0 },
      published: { articles: 10, cases: 3 },
    } as any)
    const wrapper = await mountView()
    expect(demoSiteApi.status).toHaveBeenCalledWith(15)
    expect(portalSitesApi.listMine).toHaveBeenCalledTimes(1)
    expect(siteCard(wrapper).text()).toContain('萧山景天牙科医院官网')
    expect(siteCard(wrapper).text()).not.toContain('该租户还没有站点')
  })

  it('读挂了只说读取失败，刷新按钮不许永远转着（改前就是这个死循环）', async () => {
    vi.mocked(portalSitesApi.listMine).mockRejectedValue(new Error('缺少权限: portal:build:manage'))
    const wrapper = await mountView()
    expect(siteCard(wrapper).text()).toContain('未取到')
    expect(siteCard(wrapper).text()).toContain('读取失败')
    expect(siteCard(wrapper).text()).toContain('缺少权限: portal:build:manage')
    expect(siteCard(wrapper).text()).not.toContain('该租户还没有站点')
    expect(wrapper.find('.aspin-stub').attributes('data-spinning')).toBe('false')
  })

  it('企业信息那一口挂了也不影响站点这一格收尾', async () => {
    vi.mocked(companyInfoApi.get).mockRejectedValue(new Error('企业信息读取失败'))
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([
      { id: 9, code: 'c', name: '萧山竟天口腔', domain: 'x.com' },
    ] as any)
    const wrapper = await mountView()
    expect(siteCard(wrapper).text()).toContain('萧山竟天口腔')
    expect(wrapper.find('.aspin-stub').attributes('data-spinning')).toBe('false')
  })
})
