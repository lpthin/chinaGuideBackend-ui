import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import SectionAdviceCard from '../SectionAdviceCard.vue'
import { portalSectionsApi } from '../../../api/portalSections'

/**
 * 「AI 推导栏目建议」复核卡（Spec-D D4，拍板 N2：栏目动作只归超管，AI 只出建议）。
 *
 * 四条钉住的：
 * 1. 进卡片只发那一条 GET，一次模型都不调；生成只在人明确点那一颗按钮时发出去；
 * 2. 后端这一口还没上线（404）时说的是「这一套还没准备好」并带上中文原因，
 *    绝不退化成一张空的建议列表——空列表会被读成「生成过了、结论是没有」；
 * 3. 采纳有两条落点（apply 交给父组件填草稿 / save 自己发那一条 bulk），互斥、都要求人再点一次；
 * 4. 理由那句中文原样显示，那是这条建议唯一可复核的依据。
 *
 * 挂真实控件：真 Button，点真 DOM 节点、读真 DOM 文本。
 */

vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

// 建议这一口挂在需求单下，要的是 portal:build:manage；桩掉 store 免得把 router 那一串拖进来。
const authState = vi.hoisted(() => ({ permissions: ['portal:build:manage'] as string[] }))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ hasPermission: (code: string) => authState.permissions.includes(code) })
}))

vi.mock('../../../api/portalSections', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/portalSections')>()
  return {
    ...actual,
    portalSectionsApi: {
      advice: vi.fn(),
      generateAdvice: vi.fn(),
      adminBulkUpdate: vi.fn()
    }
  }
})

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'spinning'],
  template: `<div class="${name}-stub"><slot name="title" /><slot /><slot name="message" /></div>`
})

function item(sectionKey = 'news', label = '公司新闻', navSort = 5) {
  return { sectionKey, label, enabled: true, navVisible: true, navSort, reason: '需求单里第 4 题勾了「常发行业动态」' }
}

function mounted(options: Partial<{ briefId: number | null; siteId: number | null; mode: 'apply' | 'save'; localEditsPending: boolean }> = {}) {
  return mount(SectionAdviceCard, {
    attachTo: document.body,
    props: {
      briefId: options.briefId === undefined ? 12 : options.briefId,
      siteId: options.siteId === undefined ? 3 : options.siteId,
      mode: options.mode ?? 'save',
      localEditsPending: options.localEditsPending ?? false
    },
    global: {
      stubs: {
        'a-card': PASS_THROUGH('a-card'),
        'a-alert': PASS_THROUGH('a-alert'),
        'a-spin': PASS_THROUGH('a-spin'),
        'a-tag': PASS_THROUGH('a-tag'),
        'a-space': PASS_THROUGH('a-space'),
        'a-button': Button
      }
    }
  })
}

function buttons(wrapper = null as any) {
  const scope: ParentNode = wrapper ? wrapper.element.parentNode as ParentNode : document.body
  return [...scope.querySelectorAll('button')] as HTMLButtonElement[]
}

function buttonThat(text: string) {
  return buttons().find(node => (node.textContent || '').includes(text))
}

function suggestionRows() {
  return [...document.querySelectorAll('.advice-card__item')]
}

async function click(node: HTMLButtonElement | undefined) {
  expect(node, '界面上应有那颗按钮').toBeTruthy()
  node!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

function bodyText() {
  return document.body.textContent || ''
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  authState.permissions = ['portal:build:manage']
  vi.mocked(portalSectionsApi.advice).mockResolvedValue({ generated: false, items: [], generatedAt: null } as any)
})

describe('进页面只读，不自己花钱', () => {
  it('挂载只发那一条 GET；generated=false 时说「还没有生成过建议」，并只给那一颗生成按钮', async () => {
    mounted()
    await flushPromises()
    expect(portalSectionsApi.advice).toHaveBeenCalledTimes(1)
    expect(portalSectionsApi.advice).toHaveBeenCalledWith(12)
    expect(portalSectionsApi.generateAdvice).not.toHaveBeenCalled()
    expect(bodyText()).toContain('还没有生成过建议')
    expect(suggestionRows()).toHaveLength(0)
    expect(buttonThat('生成一版建议')).toBeTruthy()
    expect(buttonThat('再生成一版')).toBeUndefined()
  })

  it('那句花钱的提示在按钮之前就说清了：点一次花一次，不会自己跑', async () => {
    mounted()
    await flushPromises()
    expect(bodyText()).toContain('会真的调用模型')
    expect(bodyText()).toContain('点一次花一次')
    expect(bodyText()).toContain('要人明确点这一颗')
  })

  it('没有需求单编号时一颗按钮都不给，并说清为什么', async () => {
    mounted({ briefId: null })
    await flushPromises()
    expect(portalSectionsApi.advice).not.toHaveBeenCalled()
    expect(bodyText()).toContain('还没有需求单编号')
    expect(buttonThat('生成一版建议')).toBeUndefined()
  })

  it('缺 portal:build:manage：一条请求都不发，既不演成「读失败」也不演成「没有建议」', async () => {
    // 这一口挂在需求单下（要 manage），而这张卡会出现在只按 portal:build:section 放行的栏目页上
    authState.permissions = ['portal:build:section']
    document.body.innerHTML = ''
    mounted()
    await flushPromises()
    expect(portalSectionsApi.advice).not.toHaveBeenCalled()
    expect(portalSectionsApi.generateAdvice).not.toHaveBeenCalled()
    expect(bodyText()).toContain('这个账号没有 portal:build:manage')
    expect(bodyText()).not.toContain('建议没读到')
    expect(bodyText()).not.toContain('还没有生成过建议')
    expect(buttonThat('生成一版建议')).toBeUndefined()
  })
})

describe('后端这一口还没上线时不许装成「生成过了」', () => {
  it('GET 打回 404：显示「这一套还没准备好」并带上中文原因，不给一张空列表', async () => {
    vi.mocked(portalSectionsApi.advice).mockRejectedValueOnce(new Error('请求的内容不存在或已被删除'))
    mounted()
    await flushPromises()
    expect(bodyText()).toContain('这一套还没准备好')
    expect(bodyText()).toContain('请求的内容不存在或已被删除')
    expect(suggestionRows()).toHaveLength(0)
    // 「还没有生成过建议」这句只在后端真的说 generated=false 时才允许出现
    expect(bodyText()).not.toContain('还没有生成过建议')
    expect(buttonThat('保存到站点')!.disabled).toBe(true)
  })

  it('其它错误就说是没读到，同样不演任何结论', async () => {
    vi.mocked(portalSectionsApi.advice).mockRejectedValueOnce(new Error('没有权限执行该操作'))
    mounted()
    await flushPromises()
    expect(bodyText()).toContain('建议没读到（后端原话：没有权限执行该操作）')
    expect(bodyText()).not.toContain('这一套还没准备好')
  })
})

describe('生成那一发', () => {
  it('点一次只发一次 POST，然后由前端再拉一次 GET 看生成到没生成出来', async () => {
    vi.mocked(portalSectionsApi.advice)
      .mockResolvedValueOnce({ generated: false, items: [], generatedAt: null } as any)
      .mockResolvedValueOnce({ generated: true, items: [item()], generatedAt: '2026-09-01T10:00:00Z' } as any)
    mounted()
    await flushPromises()

    await click(buttonThat('生成一版建议'))
    expect(portalSectionsApi.generateAdvice).toHaveBeenCalledTimes(1)
    expect(portalSectionsApi.generateAdvice).toHaveBeenCalledWith(12)
    expect(portalSectionsApi.advice).toHaveBeenCalledTimes(2)
    expect(suggestionRows()).toHaveLength(1)
    expect(bodyText()).toContain('2026-09-01T10:00:00Z')
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('逐条过目'))
  })

  it('生成中那颗按钮点不动（连点两下不会花两次钱）', async () => {
    let release: () => void = () => {}
    vi.mocked(portalSectionsApi.generateAdvice).mockImplementationOnce(
      () => new Promise(resolve => {
        release = () => resolve(undefined as any)
      })
    )
    mounted()
    await flushPromises()

    const generate = buttonThat('生成一版建议')!
    generate.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(generate.disabled).toBe(true)
    generate.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalSectionsApi.generateAdvice).toHaveBeenCalledTimes(1)

    release()
    await flushPromises()
    expect(buttonThat('生成一版建议')!.disabled).toBe(false)
  })

  it('POST 之后后端还说没生成好：界面如实讲「这一发是异步的」，不猜结果', async () => {
    mounted()
    await flushPromises()
    await click(buttonThat('生成一版建议'))
    expect(bodyText()).toContain('还没生成好')
    expect(bodyText()).toContain('点「刷新建议」看结果')
  })

  it('生成被后端拒（开关没开/配额不够）：中文原话挂出来，不写「已生成」', async () => {
    vi.mocked(portalSectionsApi.generateAdvice).mockRejectedValueOnce(new Error('这一路没开模型，先去模型配置里选一个'))
    mounted()
    await flushPromises()
    await click(buttonThat('生成一版建议'))
    expect(bodyText()).toContain('这一路没开模型，先去模型配置里选一个')
    expect(suggestionRows()).toHaveLength(0)
  })
})

describe('建议怎么落地（AI 只出建议，写库那一下是人按的）', () => {
  async function withAdvice(options: Parameters<typeof mounted>[0] = {}) {
    vi.mocked(portalSectionsApi.advice).mockResolvedValueOnce(
      { generated: true, items: [item('news', '公司新闻', 5), item('jobs', '招聘', 8)], generatedAt: '2026-09-01' } as any
    )
    const wrapper = mounted(options)
    await flushPromises()
    return wrapper
  }

  it('界面上那句话把「建议」和「生效」分开说：点了「保存到站点」才会生效', async () => {
    await withAdvice()
    expect(bodyText()).toContain('这些是建议')
    expect(bodyText()).toContain('才会生效')
    expect(suggestionRows()[0].textContent).toContain('需求单里第 4 题勾了「常发行业动态」')
    expect(suggestionRows()[0].textContent).toContain('导航顺序 5')
  })

  it('需求单详情里那种（save）：点「保存到站点」才把 items 映射成那一条 bulk 请求体', async () => {
    vi.mocked(portalSectionsApi.adminBulkUpdate).mockResolvedValueOnce([] as any)
    await withAdvice({ mode: 'save' })
    await click(buttonThat('保存到站点'))

    expect(portalSectionsApi.adminBulkUpdate).toHaveBeenCalledTimes(1)
    expect(portalSectionsApi.adminBulkUpdate).toHaveBeenCalledWith(3, [
      { key: 'news', displayName: '公司新闻', enabled: true, navVisible: true, navSort: 5 },
      { key: 'jobs', displayName: '招聘', enabled: true, navVisible: true, navSort: 8 }
    ])
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('已保存'))
  })

  it('整批被后端拒：中文原话挂在卡上，不写「已保存」', async () => {
    vi.mocked(portalSectionsApi.adminBulkUpdate).mockRejectedValueOnce(new Error('第 1 条的栏目 key 重复'))
    await withAdvice({ mode: 'save' })
    await click(buttonThat('保存到站点'))
    expect(bodyText()).toContain('第 1 条的栏目 key 重复')
    expect(bodyText()).toContain('库里还是保存前那份')
    expect(message.success).not.toHaveBeenCalled()
  })

  it('这一单还没绑定站点：按钮是灭的，那句话说清没地方写', async () => {
    await withAdvice({ mode: 'save', siteId: null })
    expect(buttonThat('保存到站点')!.disabled).toBe(true)
    expect(bodyText()).toContain('还没有绑定站点')
    await click(buttonThat('保存到站点'))
    expect(portalSectionsApi.adminBulkUpdate).not.toHaveBeenCalled()
  })

  it('栏目页上那种（apply）：点「填进下面的草稿」只把值交回父组件，一条写请求都不发', async () => {
    const wrapper = await withAdvice({ mode: 'apply' })
    await click(buttonThat('填进下面的草稿'))

    expect(portalSectionsApi.adminBulkUpdate).not.toHaveBeenCalled()
    const applied = wrapper.emitted('apply')
    expect(applied).toHaveLength(1)
    expect(applied![0][0]).toEqual([item('news', '公司新闻', 5), item('jobs', '招聘', 8)])
    expect(bodyText()).toContain('仍然要在下面那条「保存到站点」按一次才落库')
  })

  it('栏目页上还有未保存改动时「填进下面的草稿」是灭的：建议不许盖掉人还没存的东西', async () => {
    await withAdvice({ mode: 'apply', localEditsPending: true })
    expect(buttonThat('填进下面的草稿')!.disabled).toBe(true)
    expect(bodyText()).toContain('先点「保存到站点」或「全部还原」再来填草稿')
  })

  it('后端真的回了 0 条：这句是「生成过、结论是没有」，和「还没生成过」两句话不许混用', async () => {
    vi.mocked(portalSectionsApi.advice).mockResolvedValueOnce({ generated: true, items: [], generatedAt: '2026-09-01' } as any)
    mounted()
    await flushPromises()
    expect(bodyText()).toContain('回的是 0 条建议')
    expect(bodyText()).not.toContain('还没有生成过建议')
    expect(buttonThat('保存到站点')!.disabled).toBe(true)
  })
})
