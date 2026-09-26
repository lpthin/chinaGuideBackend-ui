import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
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
import { siteApi } from '../../../api/workspace'

/**
 * 候选画廊（Spec-C §7 新增页 / §3.2 三列卡 / §6.1 / §6.7 / §9-4，任务 P3）。
 * 这一页最容易出现四种「假通」，用例就钉这四件：
 * 1. 槽位按需求单的 candidateCount 排满——一套没建出来必须明说「还没建出来」，
 *    只列已存在的行等于把「出 3 套」演成「当初只有 2 套」；
 * 2. 「这套侧重什么」只能转述 plan 落库的 differentiation 原话，没落库就直说没落库；
 * 3. 截图位今天必须空着并带 §6.7 那句原话（内网 host 闸拒收预览域，不为截图放宽 SSRF 闸），
 *    页面里出现任何 <img> 都是放假缩略图，判红；
 * 4. 预览地址只转述进度口的 previewUrl；口没回来时挂 PREVIEW_LINK_PENDING_TEXT，
 *    不摆一个自己拼 token 的假链接，也不摆 P4 才有的手动补发按钮。
 * 另加两条数据口径：演示内容档位中文与 §9-4 那句防纠纷标注原样在卡上；进度口读失败时
 * 错误原文挂顶、卡面退回站点列表那份真相（不把「没取到」演成「没在跑」）。
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
    briefGenerationApi: { estimate: vi.fn(), generate: vi.fn(), progress: vi.fn() }
  }
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

function site(id: number, candidateNo: number | null, status = 'candidate') {
  return { id, code: `s${id}`, name: `候选站 ${id}`, domain: '', status, tenantId: 15, buildBriefId: 12, candidateNo }
}

interface MountOptions {
  briefData?: Record<string, unknown> | null
  sites?: any[]
  sitesError?: string
  vocabError?: boolean
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
  if (options.progressError) {
    vi.mocked(briefGenerationApi.progress).mockRejectedValue(new Error(options.progressError))
  } else {
    vi.mocked(briefGenerationApi.progress).mockResolvedValue(
      (options.progressData ?? { briefId: 12, candidates: [] }) as any
    )
  }
  const wrapper = mount(CandidateGalleryView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-tag': Tag,
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-card': PASS_THROUGH('ACard')
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

  it('「这套侧重什么」原话转述 plan 落库的 differentiation；没落库就直说没落库', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1)],
      progressData: {
        briefId: 12,
        candidates: [
          { siteId: 31, candidateNo: 1, status: 'done', statusLabel: '完成', stage: 'token',
            stageLabel: '签发预览令牌', skeletonKey: 'lead-gen', skeletonName: '获客型骨架',
            differentiation: '这一套把案例与联系方式放在首屏，侧重点是把访客变成来电' }
        ]
      }
    })
    const text = wrapper.text()
    // 原话一个字不改：断言用的就是后端那整句
    expect(text).toContain('这一套把案例与联系方式放在首屏，侧重点是把访客变成来电')
    expect(text).toContain('获客型骨架')
    expect(text).toContain('完成')
    expect(text).toContain('签发预览令牌')
    wrapper.unmount()

    document.body.innerHTML = ''
    const bare = await mountView({ sites: [site(31, 1)] })
    expect(bare.text()).toContain('后端还没落这句原话')
    expect(bare.text()).toContain('后端还没给这一套的骨架')
    bare.unmount()
  })

  it('状态中文只认后端 label：没有 label 的那套露原码，不编第二份映射', async () => {
    const wrapper = await mountView({
      progressData: {
        briefId: 12,
        candidates: [{ siteId: null, candidateNo: 1, status: 'queued_x', stage: 'plan' }]
      }
    })
    const text = wrapper.text()
    expect(text).toContain('queued_x')
    expect(text).toContain('plan')
    expect(text).not.toMatch(/排队中|规划中/)
    wrapper.unmount()
  })
})

describe('截图位、预览链接与演示内容标注', () => {
  it('截图位空着并带 §6.7 原话；整页没有一张 <img>（放假缩略图就是把没有演成完成）', async () => {
    const wrapper = await mountView({ sites: [site(31, 1)] })
    expect(wrapper.text()).toContain(CANDIDATE_SHOT_UNAVAILABLE_TEXT)
    expect(wrapper.text()).toContain('不为截图放宽 SSRF 闸')
    expect(wrapper.html()).not.toContain('<img')
    wrapper.unmount()
  })

  it('进度回了 previewUrl 就给可复制的链接；没回就挂那句原话（含转正/归档即收回），不自己拼 token', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = await mountView({
      progressData: {
        briefId: 12,
        candidates: [{
          siteId: 31, candidateNo: 1, status: 'done', statusLabel: '完成',
          previewUrl: 'https://demo-a.preview.internal/?reviewToken=abc123'
        }]
      }
    })
    expect(wrapper.text()).toContain('https://demo-a.preview.internal/?reviewToken=abc123')
    click(byText('复制')[0])
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('https://demo-a.preview.internal/?reviewToken=abc123')
    expect(vi.mocked(message.success).mock.calls.flat().join()).toContain('已复制')
    wrapper.unmount()

    document.body.innerHTML = ''
    const none = await mountView({ sites: [site(31, 1)] })
    expect(none.text()).toContain(PREVIEW_LINK_PENDING_TEXT)
    // 那句原话必须点名「转正/归档即收回令牌」（拍板 3A），而不是再假装口还没上线
    expect(none.text()).toContain('转正那一刻候选令牌全部收回')
    expect(none.text()).not.toContain('这一段的后端口还没有')
    expect(byText('复制').length).toBe(0) // 没有链接就不摆复制按钮
    none.unmount()
  })

  it('演示内容：档位与数量取词表原话，§9-4 防纠纷标注每张卡都挂；词表没取到就露档位码', async () => {
    const wrapper = await mountView({ sites: [site(31, 1), site(32, 2)] })
    const text = wrapper.text()
    expect(text).toContain('整套演示（文章 10 篇 / 案例 3 条）')
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

describe('读不到就说什么读不到', () => {
  it('进度口失败：错误原文挂顶，卡面退回站点列表那份真相并明说不等于没在跑', async () => {
    const wrapper = await mountView({
      sites: [site(31, 1)],
      sitesError: undefined,
      progressError: 'Request failed with status code 404'
    })
    const text = wrapper.text()
    expect(text).toContain('进度没读到')
    expect(text).toContain('Request failed with status code 404')
    expect(text).toContain('不是「没在跑」')
    expect(text).toContain('候选站 31') // 站点列表那一份真相照常渲染
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

  it('回详情是真跳转：入口来自详情页，出口回得去', async () => {
    const wrapper = await mountView()
    click(byText('回需求单详情')[0])
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-detail', params: { id: '12' } })
    wrapper.unmount()
  })
})
