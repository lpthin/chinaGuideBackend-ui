import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Checkbox, Select, Tag } from 'ant-design-vue'
import SiteBuildWorkbenchView from '../SiteBuildWorkbenchView.vue'
import { portalHealthApi } from '../../../api/portalHealth'
import { portalPagesApi } from '../../../api/portalPages'
import { portalSectionsApi } from '../../../api/portalSections'
import { portalSkeletonsApi } from '../../../api/portalSkeletons'
import { portalReferenceApi } from '../../../api/referenceSites'
import { siteApi } from '../../../api/workspace'

/**
 * 超管「建站流水线」（Spec §6.1 / §7.2 流水线 0，Q2；Spec-C §3.1 改名）。
 *
 * 这一页最容易出现两种「假通」，用例就钉这两点：
 * 1. 每一步的现状必须真的来自接口——骨架名去骨架库里查不到就只能报 key，状态中文只能来自
 *    `/portal/pages/statuses`（用例把词表换成别的字，页面跟着换；出现本地常量就红）；
 * 2. 五步各自那颗按钮都得有真去处（Spec-C §3.2 P0：不许再出现「点了没地方去」的入口），
 *    但文案必须说准到位在哪一步——组装今天只产逐页草稿、且还不读前采需求单，
 *    谎报「本期未上线」和谎报「一键成站」一样是假通。
 *
 * 依赖体检那一张卡另有两条：格子必须跟着 payload 翻（不是写死五个「未开启」），
 * `guidance` 要逐字是后端那几句——用一句本地永远说不准的配置键原文来验。
 */

const pushSpy = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy })
}))

vi.mock('../../../api/workspace', () => ({ siteApi: { list: vi.fn() } }))
vi.mock('../../../api/portalPages', () => ({ portalPagesApi: { list: vi.fn(), statusLabels: vi.fn() } }))
vi.mock('../../../api/portalSections', () => ({ portalSectionsApi: { adminList: vi.fn() } }))
vi.mock('../../../api/portalSkeletons', () => ({ portalSkeletonsApi: { list: vi.fn() } }))
vi.mock('../../../api/referenceSites', () => ({ portalReferenceApi: { capabilities: vi.fn() } }))
vi.mock('../../../api/portalHealth', () => ({ portalHealthApi: { patrol: vi.fn() } }))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'spinning', 'open'],
  template: `<div class="${name}-stub"><span>{{ message }}{{ description }}</span>`
    + '<slot name="title" /><slot name="message" /><slot /></div>'
})

function site(id: number, name: string, skeletonKey: string | null = null, skeletonVersion: number | null = null) {
  return { id, name, skeletonKey, skeletonVersion }
}

function page(status: string, isDemo: boolean) {
  return {
    id: Math.floor(Math.random() * 1e6), slug: `p-${status}`, title: `一页 ${status}`, pageKind: null,
    layoutJson: null, themeJson: null, navVisible: true, navSort: 1, status, isDemo,
    seoTitle: null, seoDescription: null, seoKeywords: null, version: 1, publishedAt: null,
    createdBy: null, createdAt: null, updatedAt: null
  }
}

function section(key: string, enabled: boolean) {
  return {
    key, displayName: key, pageKind: key, dataSource: null, contentEntry: 'article',
    publicPath: `/${key}`, enabled, navVisible: enabled, navSort: 1, landingPageId: null
  }
}

/** 后端 guidance 的原话（配置键写得很具体）：前端改写一个字就对不上配置文件了，用例就按这个钉 */
const GUIDANCE = [
  '抓取总开关关着（app.portal.reference.crawl-enabled=false）：「开始抓取」会直接拒绝。打开后本服务会真的去请求租户填写的地址，请先确认 host-allowlist、超时与节流这三道闸门。',
  'AI 摄取总开关关着（app.portal.reference.analyze-enabled=false）：token 估算照常出，点「开始 AI 摄取」不会调模型也不会扣费。'
]

/** 全关的那一份快照：五个开关位都是 false，探测按平台（租户 1） */
function capabilities(overrides: Record<string, unknown> = {}) {
  return {
    sidecarConfigured: false,
    sidecarReachable: false,
    sidecarDetail: 'connection refused to http://127.0.0.1:8712/health',
    crawlEnabled: false,
    analyzeEnabled: false,
    reviewAiEnabled: false,
    assemblyEnabled: false,
    visionModelReady: false,
    probedTenantId: 1,
    guidance: [...GUIDANCE],
    ...overrides
  }
}

interface Options {
  sites?: ReturnType<typeof site>[]
  pages?: Array<ReturnType<typeof page>>
  sections?: Array<ReturnType<typeof section>>
  skeletons?: Array<{ skeletonKey: string; name: string; version: number }>
  statusLabels?: Record<string, string>
  pagesError?: string
  sectionsError?: string
  skeletonsError?: string
  capabilities?: ReturnType<typeof capabilities> | null
  capabilitiesError?: string
  patrol?: ReturnType<typeof patrolOutcome>
  patrolError?: string
}

/**
 * 一轮闭环的返回：计数全是后端给的，界面只负责列出来。
 * 数字故意各不相同（opened 3 / drafted 5 / failed 1 / queued 4），这样「把两个数用同一个变量渲染」
 * 或「自己归纳成一句成功」都会红。
 */
function patrolOutcome(overrides: Record<string, unknown> = {}) {
  return {
    siteId: 7,
    siteName: '甲站',
    opened: 3,
    reconfirmed: 1,
    resolved: 2,
    drafted: 5,
    failed: 1,
    queued: 4,
    failures: ['内容过期迹象：AI 没能给出可用的建议（门禁3：描述里出现了链接）'],
    notificationId: 88,
    finishedAt: '2026-09-25T10:00:00',
    ...overrides
  }
}

async function mountView(options: Options = {}) {
  const {
    sites = [site(7, '甲站', 'kb-set', 2)],
    pages = [page('published', true), page('published', false), page('draft', true)],
    sections = [section('news', true), section('careers', false)],
    skeletons = [{ skeletonKey: 'kb-set', name: '知识库那套', version: 2 }],
    statusLabels = { published: '线上', draft: '待定稿' },
    pagesError = '',
    sectionsError = '',
    skeletonsError = '',
    capabilities: caps = capabilities(),
    capabilitiesError = '',
    patrol = patrolOutcome(),
    patrolError = ''
  } = options
  vi.mocked(siteApi.list).mockResolvedValue(sites as any)
  vi.mocked(portalPagesApi.statusLabels).mockResolvedValue(statusLabels as any)
  if (pagesError) {
    vi.mocked(portalPagesApi.list).mockRejectedValueOnce(new Error(pagesError))
  } else {
    vi.mocked(portalPagesApi.list).mockResolvedValue(pages as any)
  }
  if (sectionsError) {
    vi.mocked(portalSectionsApi.adminList).mockRejectedValueOnce(new Error(sectionsError))
  } else {
    vi.mocked(portalSectionsApi.adminList).mockResolvedValue(sections as any)
  }
  if (skeletonsError) {
    vi.mocked(portalSkeletonsApi.list).mockRejectedValueOnce(new Error(skeletonsError))
  } else {
    vi.mocked(portalSkeletonsApi.list).mockResolvedValue(skeletons as any)
  }
  if (capabilitiesError) {
    vi.mocked(portalReferenceApi.capabilities).mockRejectedValueOnce(new Error(capabilitiesError))
  } else {
    vi.mocked(portalReferenceApi.capabilities).mockResolvedValue(caps as any)
  }
  if (patrolError) {
    vi.mocked(portalHealthApi.patrol).mockRejectedValueOnce(new Error(patrolError))
  } else {
    vi.mocked(portalHealthApi.patrol).mockResolvedValue(patrol as any)
  }
  const wrapper = mount(SiteBuildWorkbenchView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-select': Select,
        'a-card': PASS_THROUGH('ACard'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-checkbox': Checkbox,
        'a-tag': Tag
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 体检卡上的五个开关格子（真 a-tag，格子的脸色只跟着 payload） */
function capChips(wrapper: any): Array<{ text(): string }> {
  return wrapper.findAll('.build-workbench__cap-chip')
}

/** 按钮文本比对前先抹掉空白：正好两个汉字的按钮会被 ant-design-vue 中间塞一个空格（「刷 新」） */
function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '') === text
  )
}

function buttonContaining(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '').includes(text)
  )
}

function click(node: Element) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/** 真 a-select：改值既发 update:value（v-model）也发 change（视图挂的就是它） */
async function selectSite(wrapper: any, value: number) {
  const select = wrapper.findAllComponents(Select)[0]
  select.vm.$emit('update:value', value)
  select.vm.$emit('change', value)
  await flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('每一步的现状都来自接口，不是前端编的', () => {
  it('登记了骨架：报 key 与实例化版本，名字去骨架库列表里查', async () => {
    const wrapper = await mountView()
    expect(portalSkeletonsApi.list).toHaveBeenCalled()
    expect(wrapper.text()).toContain('kb-set')
    expect(wrapper.text()).toContain('知识库那套')
    expect(wrapper.text()).toContain('v2')
    expect(wrapper.text()).not.toContain('这站还没登记骨架')
  })

  it('骨架库查不到这个 key：只报 key，不替它编名字', async () => {
    const wrapper = await mountView({
      sites: [site(7, '甲站', 'strange-set', 1)],
      skeletons: [{ skeletonKey: 'other-set', name: '另一套', version: 9 }]
    })
    const text = wrapper.text()
    expect(text).toContain('strange-set')
    expect(text).not.toContain('另一套')
  })

  it('平台版本比站点实例化的高：只报差距，不假装能自动升级', async () => {
    const wrapper = await mountView({
      sites: [site(7, '甲站', 'kb-set', 2)],
      skeletons: [{ skeletonKey: 'kb-set', name: '知识库那套', version: 4 }]
    })
    expect(wrapper.text()).toContain('平台那份已经出到 v4')
    expect(wrapper.text()).toContain('不自动升级')
  })

  it('站点没登记骨架：写清要去骨架库应用一套，而不是空一格', async () => {
    const wrapper = await mountView({ sites: [site(7, '甲站', null)] })
    expect(wrapper.text()).toContain('这站还没登记骨架，先去骨架库应用一套')
  })

  it('状态中文来自 /portal/pages/statuses：词表换了页面跟着换', async () => {
    const wrapper = await mountView({ statusLabels: { published: '给访客看的', draft: '还没定稿' } })
    const text = wrapper.text()
    expect(text).toContain('给访客看的 2 页')
    expect(text).toContain('还没定稿 1 页')
    expect(text).not.toContain('published')
  })

  it('词表里没有的状态照后端原样写出来', async () => {
    const wrapper = await mountView({
      pages: [page('offical', false)],
      statusLabels: { published: '线上' }
    })
    expect(wrapper.text()).toContain('offical 1 页')
  })

  it('演示内容按 isDemo 计数，一页都没有时说明去门户上线生成', async () => {
    const wrapper = await mountView({ pages: [page('published', false)] })
    expect(wrapper.text()).toContain('没有任何带演示标记的内容')
    expect(wrapper.text()).toContain('先去「门户上线」生成演示门户')
    const withDemo = await mountView({ pages: [page('published', true), page('draft', true)] })
    expect(withDemo.text()).toContain('共 2 页，其中带演示标记的内容 2 页')
  })

  it('栏目只报开通数：交棒说明写在页面上，但不放任何开关', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('已开通栏目 1 个（共 2 个可开）')
    // 刷新 + 五步各一颗 + 闭环那颗「跑一轮」和它的去处：再多出来的按钮就说明有人在这一页又塞了一个写动作
    expect(document.querySelectorAll('button').length).toBe(8)
    // 这一页唯一的写动作是巡检闭环，它必须挂着一道确认；除此之外不许有任何开关（栏目租户只读，N2）
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(1)
    expect(document.querySelectorAll('.ant-switch').length).toBe(0)
  })

  it('骨架库读失败不影响这一页：只报 key，不跟着报错', async () => {
    const wrapper = await mountView({ skeletonsError: '没有权限' })
    expect(wrapper.text()).toContain('kb-set')
    expect(wrapper.text()).not.toContain('一个站点都取不到')
  })
})

describe('读口的错各说各的，按钮点了要去哪就去哪', () => {
  it('页面列表读失败：第 2、4 步说清是没取到，而不是显示 0 页', async () => {
    const wrapper = await mountView({ pagesError: '这个账号没有 portal:build:manage' })
    const text = wrapper.text()
    expect(text).toContain('演示内容没取到：这个账号没有 portal:build:manage')
    expect(text).toContain('页面状态没取到：这个账号没有 portal:build:manage')
    expect(text).not.toContain('这站一页都没有')
  })

  it('栏目开通态读失败：只影响第 5 步', async () => {
    const wrapper = await mountView({ sectionsError: '栏目读不了' })
    expect(wrapper.text()).toContain('栏目开通态没取到：栏目读不了')
    expect(wrapper.text()).toContain('共 3 页')
  })

  it('一个站点都没有：说清是账号没挂站点', async () => {
    const wrapper = await mountView({ sites: [] })
    expect(wrapper.text()).toContain('一个站点都取不到')
    expect(wrapper.text()).toContain('先去系统管理 > 站点管理建一个')
    expect(wrapper.text()).toContain('先选站点，才知道这一站登记了哪套骨架')
  })

  it('五步各有真去处：逐个点，按各自那一条路由跳，一个都不落空', async () => {
    await mountView()
    const labels = [
      '去骨架库',
      '去门户上线生成演示内容',
      '去整站组装发起任务',
      '去页面搭建逐页发布',
      '去栏目开通核对开通态'
    ]
    for (const label of labels) {
      const nodes = buttonContaining(label)
      expect(nodes).toHaveLength(1)
      expect((nodes[0] as HTMLButtonElement).disabled).toBe(false)
      click(nodes[0])
    }
    await flushPromises()
    expect(pushSpy.mock.calls.map(call => call[0])).toEqual([
      { name: 'workspace-portal-skeletons' },
      { name: 'workspace-portal-launch' },
      { name: 'workspace-portal-assemble-jobs' },
      { name: 'workspace-portal-pages' },
      { name: 'workspace-portal-sections' }
    ])
    // 改名之后不许留旧叫法：菜单里已经没有「栏目管理」这一项了
    expect(byText('去栏目管理核对开通态')).toHaveLength(0)
  })

  it('没选站点时除骨架库外的入口都点不动', async () => {
    const wrapper = await mountView({ sites: [] })
    expect(wrapper.text()).toContain('先选站点')
    expect(buttonContaining('去页面搭建逐页发布').every(node => (node as HTMLButtonElement).disabled)).toBe(true)
    expect(buttonContaining('去栏目管理核对开通态').every(node => (node as HTMLButtonElement).disabled)).toBe(true)
    expect(buttonContaining('去门户上线生成演示内容').every(node => (node as HTMLButtonElement).disabled)).toBe(true)
  })

  it('换站点会重新取这一站的页面与栏目', async () => {
    const wrapper = await mountView({ sites: [site(7, '甲站', 'kb-set', 1), site(8, '乙站', null)] })
    expect(portalPagesApi.list).toHaveBeenLastCalledWith({ siteId: 7 })
    await selectSite(wrapper, 8)
    expect(portalPagesApi.list).toHaveBeenLastCalledWith({ siteId: 8 })
    expect(portalSectionsApi.adminList).toHaveBeenLastCalledWith(8)
    expect(wrapper.text()).toContain('这站还没登记骨架')
    // 词表只取一次，换站点不重复读
    expect(portalPagesApi.statusLabels).toHaveBeenCalledTimes(1)
  })
})

describe('AI 整站组装：端点已经有了就给真入口，但话要说准到哪一步', () => {
  it('选了站点就能进组装页；文案写清产出是逐页草稿、且今天还不读前采需求单', async () => {
    const wrapper = await mountView()
    const assemble = buttonContaining('去整站组装发起任务')
    expect(assemble).toHaveLength(1)
    expect((assemble[0] as HTMLButtonElement).disabled).toBe(false)
    click(assemble[0])
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-assemble-jobs' })
    expect(wrapper.text()).toContain('逐页草稿')
    expect(wrapper.text()).toContain('它现在还不读前采需求单')
    // 这句谎报已经删掉：组装端点早就存在（PortalAssembleController）
    expect(wrapper.text()).not.toContain('本期未上线')
  })

  it('没选站点时组装入口点不动（和其它四步同口径）', async () => {
    const wrapper = await mountView({ sites: [] })
    expect(buttonContaining('去整站组装发起任务').every(node => (node as HTMLButtonElement).disabled)).toBe(true)
  })
})

describe('依赖体检：格子跟着 payload 翻，说明照后端原话，取不到就明说取不到', () => {
  it('五个开关格子各读响应里那一个布尔位：全 false 就是五格未开启', async () => {
    const wrapper = await mountView()
    const chips = capChips(wrapper)
    expect(chips).toHaveLength(5)
    expect(chips.every(chip => chip.text().includes('未开启'))).toBe(true)
    expect(wrapper.text()).not.toContain('已开启')
  })

  it('逐个翻开：翻哪一个只有那一格变，格子数还是五个', async () => {
    const fields = [
      ['sidecarConfigured', '截图服务'],
      ['crawlEnabled', '参考站抓取'],
      ['analyzeEnabled', 'AI 摄取'],
      ['reviewAiEnabled', '改版草稿'],
      ['assemblyEnabled', '整站组装']
    ] as const
    for (const [field, needle] of fields) {
      document.body.innerHTML = ''
      const wrapper = await mountView({ capabilities: capabilities({ [field]: true }) })
      const chips = capChips(wrapper)
      expect(chips).toHaveLength(5)
      const on = chips.filter(chip => chip.text().includes('已开启'))
      expect(on).toHaveLength(1)
      expect(on[0].text()).toContain(needle)
      expect(chips.filter(chip => chip.text().includes('未开启'))).toHaveLength(4)
    }
  })

  it('五个开关全开也不代表探测与视觉模型跟着开：那两样另有原文说法', async () => {
    const wrapper = await mountView({
      capabilities: capabilities({
        sidecarConfigured: true, crawlEnabled: true, analyzeEnabled: true,
        reviewAiEnabled: true, assemblyEnabled: true
      })
    })
    expect(capChips(wrapper).filter(chip => chip.text().includes('已开启'))).toHaveLength(5)
    // sidecarReachable / visionModelReady 都是 false：这一行必须还在，且不许被算成第六个「已开启」
    expect(wrapper.text()).toContain('探不通')
    expect(wrapper.text()).toContain('没查到')
    expect(wrapper.text()).toContain('connection refused to http://127.0.0.1:8712/health')
  })

  it('视觉模型那一格说清只是查配置：没真调过一次模型，也不在这五个开关里', async () => {
    const wrapper = await mountView({ capabilities: capabilities({ visionModelReady: true }) })
    expect(capChips(wrapper)).toHaveLength(5)
    expect(wrapper.text()).toContain('查到了')
    expect(wrapper.text()).toContain('model_type=vision')
    expect(wrapper.text()).toContain('没有真调过一次模型')
    expect(wrapper.text()).not.toContain('视觉模型已开启')
  })

  it('guidance 逐字来自后端，顺序也不动', async () => {
    const wrapper = await mountView()
    const lines = wrapper.findAll('.build-workbench__guidance li')
    expect(lines.map(line => line.text().replace(/\s+/g, '')))
      .toEqual(GUIDANCE.map(line => line.replace(/\s+/g, '')))
    // 后端那句话里点的配置键要原样出现在页面上（前端自己写的句子不会带得这么准）
    expect(wrapper.text()).toContain('app.portal.reference.crawl-enabled=false')
  })

  it('开关全开时后端那一句「界面没有一键启用」也是照抄，不是前端补的', async () => {
    const allOpen = capabilities({
      sidecarConfigured: true, sidecarReachable: true, crawlEnabled: true, analyzeEnabled: true,
      reviewAiEnabled: true, assemblyEnabled: true, visionModelReady: true,
      guidance: ['这一页上的开关全开着。它只做检查与说明——要关或要开，仍然是改配置重启，界面上没有任何一键启用的入口。']
    })
    const wrapper = await mountView({ capabilities: allOpen })
    expect(wrapper.findAll('.build-workbench__guidance li')).toHaveLength(1)
    expect(wrapper.text()).toContain('这一页上的开关全开着。它只做检查与说明')
    expect(wrapper.text()).toContain('这一页只做检查与说明，开关仍要改配置重启')
  })

  it('后端一行说明都没给时页面明说没给，而不是留一格「一切正常」', async () => {
    const wrapper = await mountView({ capabilities: capabilities({ guidance: [] }) })
    expect(wrapper.findAll('.build-workbench__guidance li')).toHaveLength(0)
    expect(wrapper.text()).toContain('后端这次一行说明都没给')
    expect(wrapper.text()).not.toContain('一切正常')
  })

  it('探测到的租户号用后端回的那个，前端不填', async () => {
    const wrapper = await mountView({ capabilities: capabilities({ probedTenantId: 42 }) })
    expect(wrapper.text()).toContain('42')
    expect(portalReferenceApi.capabilities).toHaveBeenLastCalledWith()
  })

  it('体检读失败：说清是没取到，一格开关都不显示，也不说「已开启」', async () => {
    const wrapper = await mountView({ capabilitiesError: '没有权限读体检' })
    expect(wrapper.text()).toContain('体检没取到就是没取到')
    expect(wrapper.text()).toContain('没有权限读体检')
    expect(capChips(wrapper)).toHaveLength(0)
    expect(wrapper.text()).not.toContain('已开启')
    expect(wrapper.text()).not.toContain('未开启')
  })

  it('体检读失败不影响五步：那几步照旧报现状', async () => {
    const wrapper = await mountView({ capabilitiesError: '接口 500' })
    expect(wrapper.text()).toContain('共 3 页')
    expect(wrapper.text()).toContain('已开通栏目 1 个')
  })

  it('点刷新会连着重取一次体检', async () => {
    const wrapper = await mountView()
    expect(portalReferenceApi.capabilities).toHaveBeenCalledTimes(1)
    click(byText('刷新')[0])
    await flushPromises()
    expect(portalReferenceApi.capabilities).toHaveBeenCalledTimes(2)
    expect(siteApi.list).toHaveBeenCalledTimes(2)
    expect(wrapper.exists()).toBe(true)
  })
})

/**
 * 巡检闭环（Spec §13.3-6）。这一格是整页唯一会花 token 配额的动作，所以钉三件事：
 * 没确认点不动、点下去真的带着 confirm 与这一站、跑完显示的必须是后端那五个计数
 * （前端自己归纳成一句「成功」，就会把「一条都没出」和「出了五条」说得一样）。
 */
describe('巡检闭环：先确认，再花配额，结果照后端那一份列出来', () => {
  async function tickConfirm(wrapper: any) {
    wrapper.findAllComponents(Checkbox)[0].vm.$emit('update:checked', true)
    await flushPromises()
  }

  function patrolButton() {
    const nodes = buttonContaining('跑一轮巡检闭环')
    expect(nodes).toHaveLength(1)
    return nodes[0] as HTMLButtonElement
  }

  it('没勾确认位时按钮是灰的，硬点也不会发请求', async () => {
    await mountView()
    expect(patrolButton().disabled).toBe(true)
    click(patrolButton())
    await flushPromises()
    expect(portalHealthApi.patrol).not.toHaveBeenCalled()
  })

  it('勾上确认后点一次：带上这一站与 confirm，且不去重取页面列表', async () => {
    const wrapper = await mountView()
    await tickConfirm(wrapper)
    expect(patrolButton().disabled).toBe(false)
    click(patrolButton())
    await flushPromises()
    expect(portalHealthApi.patrol).toHaveBeenCalledTimes(1)
    expect(portalHealthApi.patrol).toHaveBeenCalledWith(7, true)
    // 闭环只写 finding 与草稿；跟着刷新页面列表会让人以为线上内容被动过了
    expect(portalPagesApi.list).toHaveBeenCalledTimes(1)
  })

  it('五个计数各报各的，失败原因逐条列出来', async () => {
    const wrapper = await mountView()
    await tickConfirm(wrapper)
    click(patrolButton())
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('新发现 3 条')
    expect(text).toContain('重新确认 1 条')
    expect(text).toContain('AI 出草稿 5 条')
    expect(text).toContain('出稿失败 1 条')
    expect(text).toContain('排在下一轮 4 条')
    expect(wrapper.findAll('.build-workbench__patrol-failures li').map(line => line.text())).toEqual([
      '内容过期迹象：AI 没能给出可用的建议（门禁3：描述里出现了链接）'
    ])
    expect(text).not.toContain('闭环成功')
  })

  it('这一轮没写待办时说明没有欠着的事，而不是留一格空', async () => {
    const wrapper = await mountView({
      patrol: patrolOutcome({ opened: 0, drafted: 0, failed: 0, queued: 0, failures: [], notificationId: null })
    })
    await tickConfirm(wrapper)
    click(patrolButton())
    await flushPromises()
    expect(wrapper.text()).toContain('这一轮没有欠着的事')
    expect(wrapper.findAll('.build-workbench__patrol-failures li')).toHaveLength(0)
  })

  it('排下一轮那条只在真有待排时才说，不写「排在下一轮 0 条」', async () => {
    const wrapper = await mountView({ patrol: patrolOutcome({ queued: 0 }) })
    await tickConfirm(wrapper)
    click(patrolButton())
    await flushPromises()
    expect(wrapper.text()).not.toContain('排在下一轮')
  })

  it('闭环失败只说在这一格：不拿计数充数', async () => {
    const wrapper = await mountView({ patrolError: 'AI 整改建议未开启，请在配置里打开后再试' })
    await tickConfirm(wrapper)
    click(patrolButton())
    await flushPromises()
    expect(wrapper.text()).toContain('AI 整改建议未开启')
    expect(wrapper.text()).not.toContain('AI 出草稿')
  })

  it('没选站点时这一格也跟着点不动', async () => {
    const wrapper = await mountView({ sites: [] })
    await tickConfirm(wrapper)
    expect(patrolButton().disabled).toBe(true)
    expect(buttonContaining('去巡检看待处理与草稿')[0].hasAttribute('disabled')).toBe(true)
  })
})
