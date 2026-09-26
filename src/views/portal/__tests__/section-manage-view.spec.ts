import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Card, Input, Switch, message } from 'ant-design-vue'
import SectionManageView from '../SectionManageView.vue'
import { portalSectionsApi } from '../../../api/portalSections'
import { portalPagesApi } from '../../../api/portalPages'
import { siteApi } from '../../../api/workspace'

/**
 * 超管栏目卡片页（Spec §5.2 / §7.2 + Spec-D D4，N5：栏目归超管）。
 *
 * 四条要紧的：
 * 1. 卡片集合与显示名/对外地址/内容入口只能是接口——前端抄一份栏目清单，超管改名字就不再生效；
 * 2. 顶部那条导航预览读的是草稿：不点保存也得当场看到名字与顺序变了（这一版真正给的东西是
 *    「改完就知道访客看到什么」）；
 * 3. 保存只发<strong>一条</strong> bulk 请求，载荷是全部栏目的五项字段（换序天然动两栏，
 *    少发一栏就会留下一对相同的 navSort）；界面拿后端回的全量生效态覆盖本地，不自己数「改了几条」；
 * 4. 后端整批拒时那句中文原因必须挂在页面上，而且草稿不许被清空——人改的名字不能因为一次失败就找不回。
 *
 * 全部挂在真实控件上：真 Button/Input/Switch/Card，点真 DOM 节点、读真 DOM 文本。
 */

const routeQuery = vi.hoisted(() => ({ current: {} as Record<string, string> }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.current, params: {} }),
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/portalSections', () => ({
  portalSectionsApi: {
    adminList: vi.fn(),
    adminUpdate: vi.fn(),
    adminBulkUpdate: vi.fn(),
    list: vi.fn(),
    summary: vi.fn(),
    advice: vi.fn(),
    generateAdvice: vi.fn()
  }
}))
vi.mock('../../../api/workspace', () => ({ siteApi: { list: vi.fn() } }))
vi.mock('../../../api/portalPages', () => ({ portalPagesApi: { preview: vi.fn() } }))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'column', 'spinning'],
  template: `<div class="${name}-stub"><slot name="title" /><slot /><slot name="message" /></div>`
})

const PREVIEW_STUB = {
  name: 'PortalViewportPreview',
  props: ['blocks', 'theme'],
  template: '<div class="pbv-stub">{{ (blocks || []).length }}</div>'
}

const ADVICE_STUB = {
  name: 'SectionAdviceCard',
  props: ['briefId', 'siteId', 'mode', 'localEditsPending'],
  template: '<div class="advice-stub"></div>'
}

function state(
  key: string,
  displayName: string,
  options: Partial<{ enabled: boolean; navVisible: boolean; navSort: number; landingPageId: number | null }> = {}
) {
  return {
    key,
    displayName,
    pageKind: key,
    dataSource: null,
    contentEntry: 'article',
    publicPath: `/${key}`,
    enabled: options.enabled ?? true,
    navVisible: options.navVisible ?? true,
    navSort: options.navSort ?? 3,
    landingPageId: options.landingPageId ?? null
  }
}

async function mountView(
  states = [state('news', '资讯', { navSort: 1 }), state('jobs', '招聘', { navSort: 2 })],
  sites: Array<{ id: number; name: string }> = [{ id: 3, name: '演示站' }]
) {
  vi.mocked(siteApi.list).mockResolvedValue(sites as any)
  vi.mocked(portalSectionsApi.adminList).mockResolvedValue(states as any)
  // bulk 口的口径是「回改完后的全量生效态」：这里按请求体把每一行的五项值写回，回的就是这份新状态
  vi.mocked(portalSectionsApi.adminBulkUpdate).mockImplementation(async (_siteId: number, items: any[]) =>
    states.map(row => {
      const sent = items.find(item => item.key === row.key)
      return sent ? { ...row, ...sent, key: row.key } : { ...row }
    }) as any)
  const wrapper = mount(SectionManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-select': { name: 'ASelect', props: ['value', 'options'], template: '<select />' },
        'a-alert': PASS_THROUGH('a-alert'),
        'a-form': PASS_THROUGH('a-form'),
        'a-form-item': PASS_THROUGH('a-form-item'),
        'a-space': PASS_THROUGH('a-space'),
        'a-spin': PASS_THROUGH('a-spin'),
        'a-tag': PASS_THROUGH('a-tag'),
        'a-descriptions': PASS_THROUGH('a-descriptions'),
        'a-descriptions-item': PASS_THROUGH('a-descriptions-item'),
        'a-card': Card,
        'a-button': Button,
        'a-input': Input,
        'a-switch': Switch,
        PortalViewportPreview: PREVIEW_STUB,
        SectionAdviceCard: ADVICE_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function cards() {
  return [...document.querySelectorAll('.section-card')] as HTMLElement[]
}

function nameInput(index: number) {
  return cards()[index].querySelector('input') as HTMLInputElement
}

function switchOf(index: number, which: 0 | 1) {
  return (cards()[index].querySelectorAll('button.ant-switch') as NodeListOf<HTMLButtonElement>)[which]
}

function buttonOf(index: number, text: string) {
  return [...cards()[index].querySelectorAll('button')]
    .find(node => (node.textContent || '').trim() === text) as HTMLButtonElement | undefined
}

function previewButton(index: number) {
  return [...cards()[index].querySelectorAll('button')]
    .find(node => (node.textContent || '').includes('示例页')) as HTMLButtonElement | undefined
}

function sortOf(index: number) {
  return cards()[index].querySelector('.section-card__sort')!.textContent?.trim()
}

function navItems() {
  return [...document.querySelectorAll('.section-admin-page__nav-item')].map(node => node.textContent?.trim())
}

function toolbarButtons() {
  return [...document.querySelectorAll('.section-admin-page__toolbar button')] as HTMLButtonElement[]
}

function bulkButton(): HTMLButtonElement {
  return toolbarButtons().find(node => (node.textContent || '').includes('保存到站点'))!
}

function bulkCalls() {
  return vi.mocked(portalSectionsApi.adminBulkUpdate).mock.calls as any[]
}

async function typeInto(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

async function click(node: HTMLElement | undefined) {
  expect(node, '界面上应有那颗按钮').toBeTruthy()
  node!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

function bodyText() {
  return document.body.textContent || ''
}

beforeEach(() => {
  document.body.innerHTML = ''
  routeQuery.current = {}
  vi.clearAllMocks()
})

describe('卡片来自接口，一张卡一个栏目', () => {
  it('卡上的名字、对外地址、内容入口就是接口回的那几个字', async () => {
    await mountView([state('news', '平台改过的名字'), state('jobs', '另一个名字')])
    expect(cards()).toHaveLength(2)
    expect(nameInput(0).value).toBe('平台改过的名字')
    expect(cards()[0].textContent).toContain('/news')
    expect(cards()[1].textContent).toContain('article')
    expect(vi.mocked(portalSectionsApi.adminList)).toHaveBeenCalledWith(3)
  })

  it('没有站点上下文时不去查栏目表', async () => {
    await mountView([state('news', '资讯')], [])
    expect(vi.mocked(portalSectionsApi.adminList)).not.toHaveBeenCalled()
  })

  it('导航顺序那一格再也没有数字框，表格里那种摊开的列也没了', async () => {
    await mountView()
    expect(document.querySelectorAll('.ant-input-number')).toHaveLength(0)
    expect(document.querySelectorAll('.ant-table')).toHaveLength(0)
  })

  it('卡序按草稿的 navSort 排，不是按接口回的行序：两者不一致时也照 navSort 摆', async () => {
    await mountView([state('news', '资讯', { navSort: 20 }), state('jobs', '招聘', { navSort: 10 })])
    expect(nameInput(0).value).toBe('招聘')
    expect(sortOf(0)).toBe('10')
    expect(nameInput(1).value).toBe('资讯')
  })
})

describe('顶部导航实时预览', () => {
  it('改中文名不点保存，顶上那条预览当场就是新名字，而且一发请求都没走', async () => {
    await mountView()
    expect(navItems()).toEqual(['资讯', '招聘'])
    await typeInto(nameInput(0), '公司新闻')
    expect(navItems()).toEqual(['公司新闻', '招聘'])
    expect(bulkCalls()).toHaveLength(0)
    expect(bulkButton().disabled).toBe(false)
  })

  it('「进顶部导航」一关那一项立刻消失；全关掉时预览说「就是空的」而不是留一条空行', async () => {
    await mountView([state('news', '资讯', { navSort: 1 }), state('jobs', '招聘', { navSort: 2, navVisible: false })])
    expect(navItems()).toEqual(['资讯'])
    await click(switchOf(0, 1))
    expect(navItems()).toEqual([])
    expect(bodyText()).toContain('访客看到的顶部导航就是空的')
  })

  it('栏目关掉时「进顶部导航」那颗是灰的（假选项不给点），两个值仍然分开落库', async () => {
    await mountView([state('news', '资讯', { navSort: 1, navVisible: true })])
    await click(switchOf(0, 0))
    expect(switchOf(0, 1).disabled).toBe(true)
    await click(bulkButton())
    expect(bulkCalls()[0][1][0]).toEqual({
      key: 'news', displayName: '资讯', enabled: false, navVisible: false, navSort: 1
    })
  })

  it('换序在预览里也是看得见的：点 ↓ 之后那两项的先后当场就换了', async () => {
    await mountView([state('news', '资讯', { navSort: 1 }), state('jobs', '招聘', { navSort: 2 })])
    await click(buttonOf(0, '↓'))
    expect(navItems()).toEqual(['招聘', '资讯'])
    expect(nameInput(0).value).toBe('招聘')
  })

  it('头一张没有上邻位、末一张没有下邻位：那两颗箭头是灰的（不给点了没反应的控件）', async () => {
    await mountView([state('news', '资讯', { navSort: 1 }), state('jobs', '招聘', { navSort: 2 })])
    expect(buttonOf(0, '↑')!.disabled).toBe(true)
    expect(buttonOf(0, '↓')!.disabled).toBe(false)
    expect(buttonOf(1, '↑')!.disabled).toBe(false)
    expect(buttonOf(1, '↓')!.disabled).toBe(true)
  })

  it('同值的历史数据（旧数字框能填出两个 3）：点 ↑ 的那张挪到邻位前一名，按钮不是死在那里', async () => {
    await mountView([state('news', '资讯'), state('jobs', '招聘')])
    await click(buttonOf(1, '↑'))
    expect(nameInput(0).value).toBe('招聘')
    expect(sortOf(0)).toBe('2')
  })
})

describe('一次保存整批', () => {
  it('没有改动时保存与还原都是灭的，并且那句话说清这是状态不是坏了', async () => {
    await mountView()
    expect(bulkButton().disabled).toBe(true)
    expect(bodyText()).toContain('没有可保存的改动')
  })

  it('点一次「保存到站点」只发一条 bulk 请求，载荷是全部栏目的五项字段', async () => {
    await mountView([state('news', '资讯', { navSort: 1 }), state('jobs', '招聘', { navSort: 2 })])
    await typeInto(nameInput(0), '公司新闻')
    await click(bulkButton())

    const calls = bulkCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe(3)
    expect(calls[0][1]).toEqual([
      { key: 'news', displayName: '公司新闻', enabled: true, navVisible: true, navSort: 1 },
      { key: 'jobs', displayName: '招聘', enabled: true, navVisible: true, navSort: 2 }
    ])
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('已保存到站点'))
    // 建设域那两条写口之外，租户侧的只读口一次都不该被这一页用到
    expect(vi.mocked(portalSectionsApi.list)).not.toHaveBeenCalled()
    expect(vi.mocked(portalSectionsApi.adminUpdate)).not.toHaveBeenCalled()
  })

  it('换序一次动两栏：这一版点一次保存就把两栏一起写干净（原来要按两次）', async () => {
    await mountView([state('news', '资讯', { navSort: 1 }), state('jobs', '招聘', { navSort: 2 })])
    await click(buttonOf(0, '↓'))
    await click(bulkButton())
    expect(bulkCalls()).toHaveLength(1)
    expect(bulkCalls()[0][1].map((item: any) => [item.key, item.navSort])).toEqual([['jobs', 1], ['news', 2]])
  })

  it('「未保存」标记跟着后端这次回显走，不是界面自己判的：显示名清空时回落成接口那份名字', async () => {
    await mountView([state('news', '资讯', { navSort: 1 })])
    vi.mocked(portalSectionsApi.adminBulkUpdate).mockResolvedValueOnce([state('news', '资讯', { navSort: 1 })] as any)
    await typeInto(nameInput(0), '')
    expect(cards()[0].textContent).toContain('未保存')
    await click(bulkButton())
    expect(nameInput(0).value).toBe('资讯')
    expect(cards()[0].textContent).not.toContain('未保存')
    expect(bulkButton().disabled).toBe(true)
  })

  it('后端整批拒（key 不认识/重复）：中文原因原样挂出来，草稿一个字都不丢', async () => {
    await mountView()
    vi.mocked(portalSectionsApi.adminBulkUpdate).mockRejectedValueOnce(new Error('第 2 条的栏目 key 在词表里没有：xyz'))
    await typeInto(nameInput(0), '公司新闻')
    await click(bulkButton())
    expect(bodyText()).toContain('第 2 条的栏目 key 在词表里没有：xyz')
    expect(bodyText()).toContain('整批是原子的')
    expect(nameInput(0).value).toBe('公司新闻')
    expect(bulkButton().disabled).toBe(false)
  })

  it('「全部还原」把草稿退回接口回显，不需要额外一个撤销端点', async () => {
    await mountView()
    await typeInto(nameInput(0), '公司新闻')
    await click(toolbarButtons().find(node => (node.textContent || '').includes('全部还原')))
    expect(nameInput(0).value).toBe('资讯')
    expect(bulkButton().disabled).toBe(true)
  })
})

describe('示例页缩略沿用访客端那个渲染框', () => {
  it('没有落地页的栏目：按钮是灭的，那句话说清为什么没有缩略（不拿别的页凑一张）', async () => {
    await mountView()
    expect(previewButton(0)!.disabled).toBe(true)
    expect(cards()[0].textContent).toContain('这一栏还没有落地页')
    expect(document.querySelectorAll('.pbv-stub')).toHaveLength(0)
  })

  it('有落地页的栏目：点开才发那一发 preview，缩略交给 PortalViewportPreview 渲', async () => {
    await mountView([state('news', '资讯', { navSort: 1, landingPageId: 77 })])
    expect(vi.mocked(portalPagesApi.preview)).not.toHaveBeenCalled()
    vi.mocked(portalPagesApi.preview).mockResolvedValueOnce({
      id: 77,
      blocks: [{ instanceId: 'b1', blockKey: 'hero', rendererKey: 'hero', props: {} }],
      theme: null
    } as any)
    await click(previewButton(0))
    expect(portalPagesApi.preview).toHaveBeenCalledWith(77)
    expect(document.querySelector('.pbv-stub')!.textContent).toContain('1')
  })

  it('示例页读不到时把中文原因写在卡里，不演成「这一栏没内容」', async () => {
    await mountView([state('news', '资讯', { navSort: 1, landingPageId: 77 })])
    vi.mocked(portalPagesApi.preview).mockRejectedValueOnce(new Error('页面已被删除'))
    await click(previewButton(0))
    expect(cards()[0].textContent).toContain('示例页没读到（后端原话：页面已被删除）')
    expect(document.querySelectorAll('.pbv-stub')).toHaveLength(0)
  })
})

describe('建议卡与草稿的衔接（拍板 N2：AI 只出建议）', () => {
  it('地址不带 briefId 时不挂建议卡，并且说清它是按需求单出的', async () => {
    await mountView()
    expect(document.querySelectorAll('.advice-stub')).toHaveLength(0)
    expect(bodyText()).toContain('从需求单详情点进来')
  })

  it('带 briefId 进来才挂上：采纳只是把值填进草稿，写库仍是这一页那一条保存', async () => {
    routeQuery.current = { briefId: '12' }
    const wrapper = await mountView()
    const card = wrapper.findComponent(ADVICE_STUB)
    expect(card.exists()).toBe(true)
    expect(card.props('mode')).toBe('apply')
    expect(card.props('briefId')).toBe(12)

    card.vm.$emit('apply', [
      { sectionKey: 'news', label: '公司新闻', enabled: true, navVisible: true, navSort: 9, reason: '需求单里说要发新闻' }
    ])
    await flushPromises()

    expect(nameInput(1).value).toBe('公司新闻')
    expect(sortOf(1)).toBe('9')
    expect(cards()[1].textContent).toContain('未保存')
    // 建议把这一栏的导航顺序挪到 9，这张卡就跟着排到最后，顶部预览的顺序也是这个样子
    expect(nameInput(0).value).toBe('招聘')
    expect(navItems()).toEqual(['招聘', '公司新闻'])
    expect(bulkCalls()).toHaveLength(0)

    await click(bulkButton())
    expect(bulkCalls()).toHaveLength(1)
    expect(bulkCalls()[0][1]).toEqual([
      { key: 'jobs', displayName: '招聘', enabled: true, navVisible: true, navSort: 2 },
      { key: 'news', displayName: '公司新闻', enabled: true, navVisible: true, navSort: 9 }
    ])
  })

  it('建议里的 key 对不上这一页的栏目：既不搬进来也不凭空多一张卡，原话说在哪', async () => {
    routeQuery.current = { briefId: '12' }
    const wrapper = await mountView()
    wrapper.findComponent(ADVICE_STUB).vm.$emit('apply', [
      { sectionKey: 'xyz', label: '陌生栏目', enabled: true, navVisible: true, navSort: 1, reason: '词表里没有' }
    ])
    await flushPromises()
    expect(bodyText()).toContain('这几条建议对不上这一页的栏目，没有搬进来：陌生栏目')
    expect(cards()).toHaveLength(2)
  })

  it('这一页有未保存改动时把这件事告诉建议卡：别让建议盖掉人还没存的东西', async () => {
    routeQuery.current = { briefId: '12' }
    const wrapper = await mountView()
    expect(wrapper.findComponent(ADVICE_STUB).props('localEditsPending')).toBe(false)
    await typeInto(nameInput(0), '公司新闻')
    expect(wrapper.findComponent(ADVICE_STUB).props('localEditsPending')).toBe(true)
  })
})
