import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Tag, message } from 'ant-design-vue'
import CandidateGalleryView from '../CandidateGalleryView.vue'
import {
  briefGenerationApi,
  siteBriefsApi,
  vocabularyApi,
  CANDIDATE_SHOT_UNAVAILABLE_TEXT,
  DEMO_CONTENT_DISCLAIMER_TEXT,
  PREVIEW_LINK_PENDING_TEXT
} from '../../../api/siteBriefs'
import { portalSkeletonsApi } from '../../../api/portalSkeletons'
import { siteApi } from '../../../api/workspace'

/**
 * 候选画廊（Spec-C §7 新增页 / §3.2 三列卡 / §6.1 / §6.7 / §9-4，任务 P3 + #51 契约对齐）。
 * 这一页最容易出现的那些「假通」，用例就一件件钉：
 * 1. 槽位按需求单的 candidateCount 排满——一套没建出来必须明说「还没建出来」，
 *    只列已存在的行等于把「出 3 套」演成「当初只有 2 套」；
 * 2. 「这套侧重什么」只能转述 plan 落库的 `focus` 原话，没落库就直说没落库；
 *    骨架的中文名只认骨架库那一份（进度口只回 key），查不到就露 key；
 * 3. 截图位今天必须空着并带 §6.7 那句原话（内网 host 闸拒收预览域，不为截图放宽 SSRF 闸），
 *    页面里出现任何 <img> 都是放假缩略图，判红；
 * 4. 预览地址**点一下才签**（§5 的 POST /admin/sites/{id}/preview-links）：不在页面加载时替三套
 *    各签一枚令牌，也不自己拼 token；后端对非候选身份的那一句中文拒原样挂在卡上；
 * 5. 认槽先看进度行报的 siteId：重跑一轮后同号的上一轮站是 archived，
 *    只按 candidateNo 找就会把上一轮的站当成本轮那一套（站名/状态/链接三格说的都是别人的事）；
 * 6. 配图的三本账分开讲：skipped（按设计先不花这钱）与 failed（试了没成）混一格就是两句假话。
 * 另加数据口径：演示内容档位中文与 §9-4 那句防纠纷标注原样在卡上；进度口读失败时错误原文挂顶、
 * 卡面退回站点列表那份真相（不把「没取到」演成「没在跑」）。
 *
 * stub 的形状照 2026-09-26 的真回包抄：进度口回的是**一个数组**（每套一行），字段名是
 * `focus`/`skeletonKey`/`imageDone` 这一族——以前这一档按 `{candidates:[…]}` + `differentiation`
 * + `previewUrl` 造假数据，视图读不到真字段也照样一片绿，于是「这一格永远说后端还没给」被用例
 * 当成了正确行为。stub 说假话，用例就只是把假话钉住。
 */

const { pushSpy, routeParams } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  routeParams: { current: {} as Record<string, string> }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy }),
  useRoute: () => ({ params: routeParams.current, query: {} })
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

vi.mock('../../../api/siteBriefs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/siteBriefs')>()
  return {
    ...actual,
    siteBriefsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), summaryPreview: vi.fn() },
    vocabularyApi: { adminVocabulary: vi.fn(), portalVocabulary: vi.fn() },
    briefGenerationApi: {
      estimate: vi.fn(),
      generate: vi.fn(),
      progress: vi.fn(),
      previewLink: vi.fn(),
      revokePreviewLinks: vi.fn()
    }
  }
})

vi.mock('../../../api/portalSkeletons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/portalSkeletons')>()
  return { ...actual, portalSkeletonsApi: { list: vi.fn(), pending: vi.fn() } }
})

vi.mock('../../../api/workspace', () => ({
  tenantApi: { list: vi.fn() },
  siteApi: { list: vi.fn() }
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'color'],
  template: `<div class="${name}-stub"><span>{{ message }}{{ description }}</span>`
    + '<slot name="title" /><slot name="message" /><slot /></div>'
})

function brief(overrides: Record<string, unknown> = {}) {
  return {
    id: 12, tenantId: 15, siteId: null, status: 'awaiting_client', statusLabel: null,
    candidateCount: 3, demoContentMode: 'full',
    industry: null, subIndustry: null, audiences: [], primaryGoal: null, mustHave: [], tone: null,
    languages: [], scale: null, avoid: [], channels: [], businessModel: null, brandColor: null,
    referenceUrls: [], notes: null, requirementsSummary: '渲染过的那句话',
    createdBy: 'admin', createdAt: null, updatedAt: null,
    ...overrides
  }
}

const VOCAB = {
  questions: [],
  siteProfile: [],
  candidateMaxCount: 3,
  demoContentModes: [{ value: 'full', label: '整套演示', articleCount: 10, caseCount: 3 }],
  statusLabels: { awaiting_client: '等客户确认' }
}

/** 骨架库里就两套：进度口回的 key 只有拿到这里才有人话 */
const SKELETONS = [
  { skeletonKey: 'lead-gen', name: '获客型骨架', pages: [] },
  { skeletonKey: 'editorial', name: '内容型骨架', pages: [] }
]

function site(id: number, candidateNo: number | null, status = 'candidate') {
  return { id, code: `s${id}`, name: `候选站 ${id}`, domain: '', status, tenantId: 15, buildBriefId: 12, candidateNo }
}

/** 进度口的一行：字段名与后端 `CandidateProgress` 逐字对齐 */
function row(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: 71, siteId: 31, attempt: 1, candidateNo: 1, status: 'succeeded', statusLabel: '已完成',
    stage: 'preview', stageLabel: '预览链接就绪', skeletonKey: 'lead-gen',
    focus: '这一套把案例与联系方式放在首屏，侧重点是把访客变成来电',
    notices: [], estimatedTokens: 130000, promptTokens: 90000, completionTokens: 40000,
    demoArticles: 10, demoCases: 3, imageDone: 2, imageFailed: 0, imageSkipped: 0,
    ...overrides
  }
}

interface MountOptions {
  briefData?: Record<string, unknown> | null
  sites?: any[]
  sitesError?: string
  vocabError?: boolean
  skeletons?: any[]
  skeletonsError?: string
  progressData?: unknown
  progressError?: string
}

async function mountView(options: MountOptions = {}) {
  routeParams.current = { id: '12' }
  if (options.briefData === null) {
    vi.mocked(siteBriefsApi.get).mockRejectedValue(new Error('没这一单'))
  } else {
    vi.mocked(siteBriefsApi.get).mockResolvedValue(brief(options.briefData ?? {}) as any)
  }
  if (options.vocabError) {
    vi.mocked(vocabularyApi.adminVocabulary).mockRejectedValue(new Error('词表 500'))
  } else {
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue(VOCAB as any)
  }
  if (options.sitesError) {
    vi.mocked(siteApi.list).mockRejectedValue(new Error(options.sitesError))
  } else {
    vi.mocked(siteApi.list).mockResolvedValue((options.sites ?? []) as any)
  }
  if (options.skeletonsError) {
    vi.mocked(portalSkeletonsApi.list).mockRejectedValue(new Error(options.skeletonsError))
  } else {
    vi.mocked(portalSkeletonsApi.list).mockResolvedValue((options.skeletons ?? SKELETONS) as any)
  }
  if (options.progressError) {
    vi.mocked(briefGenerationApi.progress).mockRejectedValue(new Error(options.progressError))
  } else {
    // 真回包是一个数组，不是 {briefId, candidates}
    vi.mocked(briefGenerationApi.progress).mockResolvedValue((options.progressData ?? []) as any)
  }
  const wrapper = mount(CandidateGalleryView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-tag': Tag,
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-card': PASS_THROUGH('ACard'),
        'a-popconfirm': PASS_THROUGH('APopconfirm')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '') === text
  )
}

function click(node: Element) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('槽位排满与每格只转述后端给的', () => {
  it('出 3 套就排 3 张卡：没建出来的那一套明说「还没建出来」，不把 3 演成 2', async () => {
    const wrapper = await mountView({ sites: [site(31, 1), site(32, 2)] })
    const text = wrapper.text()
    expect(text).toContain('第 1 套')
    expect(text).toContain('第 2 套')
    expect(text).toContain('第 3 套')
    expect(text).toContain('还没建出来')
    wrapper.unmount()
  })

  it('「这套侧重什么」转述进度口的 focus 原话；骨架中文名查骨架库那一份', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1)],
      progressData: [row()]
    })
    const text = wrapper.text()
    // 原话一个字不改：断言用的就是后端那整句
    expect(text).toContain('这一套把案例与联系方式放在首屏，侧重点是把访客变成来电')
    expect(text).toContain('获客型骨架')
    expect(text).toContain('已完成')
    expect(text).toContain('预览链接就绪')
    wrapper.unmount()

    document.body.innerHTML = ''
    const bare = await mountView({ sites: [site(31, 1)] })
    expect(bare.text()).toContain('进度口没回这一套')
    expect(bare.text()).toContain('后端还没给这一套的骨架')
    bare.unmount()
  })

  it('骨架库里查不到这个 key：露 key 并说清查不到，不自己起一个名', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1)],
      progressData: [row({ skeletonKey: 'brand-new' })]
    })
    expect(wrapper.text()).toContain('brand-new')
    expect(wrapper.text()).toContain('骨架库里没有这个 key')
    wrapper.unmount()
  })

  it('状态中文只认后端 label：没有 label 的那套露原码，不编第二份映射', async () => {
    const wrapper = await mountView({
      progressData: [{ siteId: null, candidateNo: 1, status: 'queued_x', stage: 'plan' }]
    })
    const text = wrapper.text()
    expect(text).toContain('queued_x')
    expect(text).toContain('plan')
    expect(text).not.toMatch(/排队中|规划中/)
    wrapper.unmount()
  })

  /**
   * 重跑一轮会再建一套同号的候选站，上一轮那套转 archived 留在库里备查（拍板 3A 不删）。
   * 卡面必须认进度行报的 siteId：只按 candidateNo 找，第二轮的卡会说第一轮那个站的名字与状态。
   */
  it('同号有两轮的站：按进度行的 siteId 认，不把上一轮的归档站当成本轮那一套', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1, 'archived'), site(41, 1, 'candidate')],
      progressData: [row({ siteId: 41 })]
    })
    const text = wrapper.text()
    expect(text).toContain('候选站 41')
    expect(text).not.toContain('候选站 31')
    // 上一轮那个归档站根本不进卡面：它今天既不是本轮那一套，也不该被说成「已归档候选」的当前状态
    expect(text).not.toContain('已归档候选')
    wrapper.unmount()
  })
})

describe('配图三本账与演示内容', () => {
  it('成功/失败/跳过分开讲：skipped 不并进 failed（拍板 8B）', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1)],
      progressData: [row({
        imageDone: 1, imageFailed: 0, imageSkipped: 1,
        notices: ['这个租户没有可用的图像模型：图位按 §6.5 记为 skipped，交付后由人上传']
      })]
    })
    const text = wrapper.text()
    expect(text).toContain('成功 1 张')
    expect(text).toContain('跳过 1 张')
    // 一句都没说成「失败 1 张」：把按设计先不花这钱讲成试了没成，是两句假话
    expect(text).not.toMatch(/失败 \d+ 张/)
    // 这一套自己的降级说明也原话列出来（后端逐条给的话）
    expect(text).toContain('这一套的降级说明（后端原话）')
    expect(text).toContain('图位按 §6.5 记为 skipped')
    wrapper.unmount()
  })

  it('进度口没回配图那一档时不写「成功 0 张」：没有数字就是没数字', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1)],
      progressData: [{ siteId: 31, candidateNo: 1, status: 'running', statusLabel: '进行中' }]
    })
    expect(wrapper.text()).not.toContain('成功 0 张')
    wrapper.unmount()
  })

  it('演示内容：档位取词表原话，进度回了实际落库数就一并说；§9-4 标注每张卡都挂', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1), site(32, 2)],
      progressData: [row({ siteId: 31, demoArticles: 12, demoCases: 4 })]
    })
    const text = wrapper.text()
    expect(text).toContain('整套演示（文章 10 篇 / 案例 3 条）')
    expect(text).toContain('实际落了文章 12 篇 / 案例 4 条')
    expect(text).toContain(DEMO_CONTENT_DISCLAIMER_TEXT)
    // 两张卡各挂一遍，不是页头挂一句就完事
    expect(text.split(DEMO_CONTENT_DISCLAIMER_TEXT).length - 1).toBeGreaterThanOrEqual(2)
    wrapper.unmount()

    document.body.innerHTML = ''
    const noVocab = await mountView({ sites: [site(31, 1)], vocabError: true })
    expect(noVocab.text()).toContain('full')
    expect(noVocab.text()).not.toContain('整套演示')
    noVocab.unmount()
  })
})

describe('截图位与预览链接（点一下才签）', () => {
  it('截图位空着并带 §6.7 原话；整页没有一张 <img>（放假缩略图就是把没有演成完成）', async () => {
    const wrapper = await mountView({ sites: [site(31, 1)] })
    expect(wrapper.text()).toContain(CANDIDATE_SHOT_UNAVAILABLE_TEXT)
    expect(wrapper.text()).toContain('不为截图放宽 SSRF 闸')
    expect(wrapper.html()).not.toContain('<img')
    wrapper.unmount()
  })

  it('页面加载不替任何一套签令牌：预览地址那一格只有「签发」入口，没有已发出去的链接', async () => {
    const wrapper = await mountView({ sites: [site(31, 1)], progressData: [row()] })
    expect(briefGenerationApi.previewLink).not.toHaveBeenCalled()
    expect(byText('签发预览地址').length).toBe(1)
    expect(byText('复制').length).toBe(0)
    wrapper.unmount()
  })

  it('点「签发预览地址」才调那一口：回相对路径时按当前 origin 拼，复制的是同一条', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    vi.mocked(briefGenerationApi.previewLink).mockResolvedValue({
      siteId: 31, previewToken: 'abc123', previewUrl: '/?reviewToken=abc123', expiresAt: null
    } as any)
    const wrapper = await mountView({ sites: [site(31, 1)], progressData: [row()] })
    click(byText('签发预览地址')[0])
    await flushPromises()
    expect(briefGenerationApi.previewLink).toHaveBeenCalledWith(31, expect.stringContaining('第 1 套'))
    const href = document.querySelector('a.candidate-gallery__url')!.getAttribute('href') || ''
    expect(href).toBe(`${window.location.origin}/?reviewToken=abc123`)
    click(byText('复制')[0])
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(href)
    expect(vi.mocked(message.success).mock.calls.flat().join()).toContain('已复制')
    wrapper.unmount()
  })

  it('后端拒签（已转正/已归档不再补发）：那句中文原话挂在卡上，不摆一条看起来对的链接', async () => {
    vi.mocked(briefGenerationApi.previewLink).mockRejectedValue(
      new Error('站点「候选站 31」当前状态是 已归档候选：预览令牌只对候选站签发与撤销')
    )
    const wrapper = await mountView({ sites: [site(31, 1, 'archived')], progressData: [row()] })
    click(byText('签发预览地址')[0])
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('签发被后端拒了（原话）：站点「候选站 31」当前状态是 已归档候选')
    expect(document.querySelectorAll('a.candidate-gallery__url').length).toBe(0)
    wrapper.unmount()
  })

  it('撤销回执那份数字照实用：撤了几条就说几条，不写「已撤销」就完事', async () => {
    vi.mocked(briefGenerationApi.previewLink).mockResolvedValue({
      siteId: 31, previewToken: 'abc123', previewUrl: 'https://demo-a.preview.internal/?reviewToken=abc123', expiresAt: null
    } as any)
    vi.mocked(briefGenerationApi.revokePreviewLinks).mockResolvedValue(2 as any)
    const wrapper = await mountView({ sites: [site(31, 1)], progressData: [row()] })
    click(byText('签发预览地址')[0])
    await flushPromises()
    // 绝对地址原样透传，不重复拼 origin
    expect(document.querySelector('a.candidate-gallery__url')!.getAttribute('href'))
      .toBe('https://demo-a.preview.internal/?reviewToken=abc123')
    // 撤销走的是二次确认：真控件是那颗 popconfirm 的 confirm 事件（点里面的按钮只会把弹层打开）
    wrapper.findComponent({ name: 'APopconfirm' }).vm.$emit('confirm')
    await flushPromises()
    expect(briefGenerationApi.revokePreviewLinks).toHaveBeenCalledWith(31)
    expect(vi.mocked(message.success).mock.calls.flat().join()).toContain('已撤销 2 条')
    expect(document.querySelectorAll('a.candidate-gallery__url').length).toBe(0)
    wrapper.unmount()
  })

  it('连站都没有的那一套只能挂那句原话（含「转正那一刻全部收回」），不编一条待发的链接', async () => {
    const wrapper = await mountView({ briefData: { candidateCount: 1 } })
    expect(wrapper.text()).toContain(PREVIEW_LINK_PENDING_TEXT)
    expect(wrapper.text()).toContain('转正那一刻候选令牌全部收回')
    expect(byText('签发预览地址').length).toBe(0)
    expect(byText('复制').length).toBe(0)
    wrapper.unmount()
  })
})

describe('读不到就说什么读不到', () => {
  it('进度口失败：错误原文挂顶，卡面退回站点列表那份真相并明说不等于没在跑', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1)],
      progressError: 'Request failed with status code 404'
    })
    const text = wrapper.text()
    expect(text).toContain('进度没读到')
    expect(text).toContain('Request failed with status code 404')
    expect(text).toContain('不是「没在跑」')
    expect(text).toContain('候选站 31') // 站点列表那一份真相照常渲染
    wrapper.unmount()
  })

  it('骨架库失败只影响「骨架」那一格：露 key 并说清是骨架库没取到', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1)],
      progressData: [row()],
      skeletonsError: '骨架库 500'
    })
    const text = wrapper.text()
    expect(text).toContain('骨架库没取到（骨架库 500）')
    expect(text).toContain('lead-gen')
    expect(text).toContain('这一套把案例与联系方式放在首屏') // 别的格子不受影响
    wrapper.unmount()
  })

  it('站点列表失败只影响「有没有这一站」那一格；需求单失败才有整页错误', async () => {
    const sitesDown = await mountView({ sitesError: '站点接口 503' })
    expect(sitesDown.text()).toContain('站点列表没取到')
    expect(sitesDown.text()).toContain('第 1 套') // 槽位仍按单子的套数排
    sitesDown.unmount()

    document.body.innerHTML = ''
    const briefDown = await mountView({ briefData: null })
    expect(briefDown.text()).toContain('需求单没读到')
    expect(briefDown.text()).toContain('没这一单')
    briefDown.unmount()
  })

  it('回详情是真跳转：入口从详情页过来，就回得去', async () => {
    const wrapper = await mountView()
    click(byText('回需求单详情')[0])
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-detail', params: { id: '12' } })
    wrapper.unmount()
  })
})
