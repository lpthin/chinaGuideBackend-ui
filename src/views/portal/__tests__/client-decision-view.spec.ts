import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import http from '../../../api/http'
import ClientDecisionView from '../ClientDecisionView.vue'

/**
 * 客户选择页（Spec-C §7 的 ClientDecisionView、§5 公开两口；拍板 5A / 10 / 11A / 3A）。
 *
 * 这一族用例守的是「免鉴权页最容易犯的三种假」：
 * 1. **假准入**（拍板 10）：页面上不许出现任何索取姓名/邮箱/手机号的字段——令牌本身就是凭证。
 *    判据落在 DOM 上：所有可填字段的 name 只有 `chosen-site`（选哪套）与 `website`（蜜罐，不初值），
 *    外加那一句「要改什么」的 textarea。多一根身份输入框就是违背拍板 10。
 * 2. **假成功**（§9-7）：作废链接、读不到、被限流都不许被演成「一切正常」。
 *    三种形状各有各的一句话：地址里没令牌 / 请求没走通（明说这不是链接作废）/ 后端回了空清单
 *    （这条链接现在打不开方案）。后端真回 404 时把它那句原文照挂出来，不改写、不翻译。
 * 3. **假差异**（拍板 5A）：三套必须并排、每套各用自己的预览令牌在新标签打开；
 *    「差在哪」这一句只许用响应真有的字段，后端没随链接下发差异原话时照实说没有。
 *
 * 网络口整体换成 vi.fn（`api/http` 的默认导出），页面走真实现：包括 `clientCandidatesDifference`
 * 与 `resolvePreviewUrl` 两个 helper——它们就是这一页的契约翻译层，mock 掉了测不到东西。
 */

const { routeState } = vi.hoisted(() => ({
  routeState: { current: { params: {} as Record<string, string>, query: {} as Record<string, string> } }
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState.current,
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }
})

vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

const A_LINK_STUB = defineComponent({
  name: 'ALink',
  props: ['href', 'target', 'rel'],
  setup: (props: any) => () => h('a', { href: props.href, target: props.target, rel: props.rel }, h('slot'))
})

function briefView(overrides: Record<string, unknown> = {}) {
  return {
    briefId: 12,
    briefStatus: 'awaiting_client',
    title: '甲租户',
    candidateCount: 3,
    candidates: [
      { siteId: 31, candidateNo: 1, name: '稳一稳', skeletonKey: 'corporate-base', previewUrl: '/?reviewToken=t31' },
      { siteId: 32, candidateNo: 2, name: '先留资', skeletonKey: 'lead-gen', previewUrl: '/?reviewToken=t32' },
      { siteId: 33, candidateNo: 3, name: '讲案例', skeletonKey: 'content-first', previewUrl: 'https://demo.preview.internal/?reviewToken=t33' }
    ],
    demoNotice: '演示内容由 AI 生成，交付后可替换（后端原话）',
    previewNotice: '候选阶段只有可点开的预览链接（后端原话）',
    ...overrides
  }
}

async function mountView(options: {
  token?: string
  queryToken?: string
  data?: Record<string, unknown> | null
  error?: string
} = {}) {
  routeState.current = {
    params: options.token ? { token: options.token } : {},
    query: options.queryToken ? { reviewToken: options.queryToken } : {}
  }
  if (options.error) {
    vi.mocked(http.get).mockRejectedValue(new Error(options.error))
  } else {
    vi.mocked(http.get).mockResolvedValue(options.data === null ? undefined : (options.data ?? briefView()) as any)
  }
  const wrapper = mount(ClientDecisionView, {
    attachTo: document.body,
    global: { stubs: { a: A_LINK_STUB } }
  })
  await flushPromises()
  return wrapper
}

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')]
}

function buttonByPrefix(prefix: string): HTMLButtonElement | undefined {
  return buttons().find(node => (node.textContent || '').replace(/\s+/g, '').startsWith(prefix))
}

function submitButton(): HTMLButtonElement {
  const node = buttons().find(button => (button.textContent || '').includes('提交'))
  if (!node) throw new Error('页面上没有提交按钮')
  return node as HTMLButtonElement
}

function click(node: Element) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function radios(): HTMLInputElement[] {
  return [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
}

function textarea(): HTMLTextAreaElement | null {
  return document.querySelector('textarea')
}

/** v-model 认的是 input 事件：只改 .value 不会同步进组件（改完就是假的「没写意见」） */
async function writeNote(wrapper: { vm: { $nextTick: () => Promise<void> } }, value: string) {
  const node = textarea()
  if (!node) throw new Error('页面上没有意见框')
  node.value = value
  node.dispatchEvent(new Event('input', { bubbles: true }))
  await wrapper.vm.$nextTick()
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('零身份表单（拍板 10：打开链接即可看）', () => {
  it('整页可填字段只有「选哪套」与蜜罐，外加那一句意见：没有一根身份输入框', async () => {
    const wrapper = await mountView({ token: 'tok' })
    const inputs = [...document.querySelectorAll('input')] as HTMLInputElement[]
    // 单选只有「选哪一套」这一组（N 套 + 一根「先不选」），别的 input 只剩蜜罐
    expect(inputs.filter(node => node.type === 'radio').every(node => node.name === 'chosen-site')).toBe(true)
    expect(inputs.filter(node => node.type === 'radio')).toHaveLength(4)
    expect(inputs.filter(node => node.type !== 'radio').map(node => node.name)).toEqual(['website'])
    expect(document.querySelectorAll('textarea')).toHaveLength(1)
    // 身份字段的硬判据：没有邮箱/电话输入框，也没有一句「请输入姓名/邮箱/手机号才能看」
    expect(document.querySelectorAll('input[type="email"], input[type="tel"], input[type="password"]')).toHaveLength(0)
    expect(wrapper.text()).not.toMatch(/请输入(您的)?(姓名|邮箱|手机|电话)/)
    expect(wrapper.text()).not.toMatch(/请填写(姓名|邮箱|手机号|电话)/)
    expect(wrapper.text()).not.toMatch(/留下(您的)?(联系方式|姓名)/)
    wrapper.unmount()
  })

  it('蜜罐藏在访客看不到的位置、没有初值、也不进 Tab 序', async () => {
    const wrapper = await mountView({ token: 'tok' })
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement
    expect(honeypot.value).toBe('')
    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.closest('[aria-hidden="true"]')).toBeTruthy()
    wrapper.unmount()
  })

  it('地址里没有令牌时连接口都不发：那不是你抄错就是链接残缺，不假装在读', async () => {
    const wrapper = await mountView({})
    expect(http.get).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('这条地址里没有凭证')
    expect(buttons().some(node => (node.textContent || '').includes('提交'))).toBe(false)
    wrapper.unmount()
  })

  it('令牌贴在 query 上（把预览地址整条抄过来那种）也认', async () => {
    await mountView({ queryToken: 'tok-from-query' })
    expect(http.get).toHaveBeenCalledWith('/portal/public/brief/tok-from-query')
  })
})

describe('读这一单：作废 / 没走通 / 空清单是三句话（拍板 3A + §9-7）', () => {
  it('后端真回 404：错误原文照挂，并说明这条链接不再生效，不渲染候选也不给提交', async () => {
    const wrapper = await mountView({ token: 'tok', error: '请求的内容不存在或已被删除' })
    const text = wrapper.text()
    expect(text).toContain('请求的内容不存在或已被删除')
    expect(text).toContain('这条链接已经不再生效')
    expect(text).not.toContain('这不是链接作废')
    expect(text).not.toContain('就这套')
    expect(buttons().some(node => (node.textContent || '').includes('提交'))).toBe(false)
    wrapper.unmount()
  })

  it('网络不通：明说这不是链接作废，并给重试；重试就是再发同一发读口', async () => {
    const wrapper = await mountView({ token: 'tok', error: '无法连接服务器，请确认后端已启动' })
    const text = wrapper.text()
    expect(text).toContain('无法连接服务器，请确认后端已启动')
    expect(text).toContain('这不是链接作废')
    expect(text).not.toContain('已经不再生效')
    click(buttonByPrefix('重新读取')!)
    await flushPromises()
    expect(http.get).toHaveBeenCalledTimes(2)
    expect(vi.mocked(http.get).mock.calls[1][0]).toBe('/portal/public/brief/tok')
    wrapper.unmount()
  })

  it('后端回 200 + 空清单（静默失败那一份形状）：说这条链接打不开方案，且不摆任何像成功的控件', async () => {
    const wrapper = await mountView({ token: 'tok', data: briefView({ candidates: [], candidateCount: 0, briefId: null, briefStatus: null, title: null }) })
    const text = wrapper.text()
    expect(text).toContain('这条链接现在打不开方案')
    expect(text).toContain('链接无效、已过期（预览链接 14 天有效）')
    // 与「没走通」两句互斥：不许把静默失败说成网络问题，也不许说成加载成功
    expect(text).not.toContain('这不是链接作废')
    expect(text).not.toContain('就这套')
    expect(buttons().some(node => (node.textContent || '').includes('提交'))).toBe(false)
    wrapper.unmount()
  })

  it('读口路径逐字是后端那个 @RequestMapping（令牌只出现在这一发里，不当 query 传）', async () => {
    await mountView({ token: 'abc' })
    expect(http.get).toHaveBeenCalledWith('/portal/public/brief/abc')
  })
})

describe('三套并排（拍板 5A + 1A：每套各用自己的预览令牌）', () => {
  it('三张卡 + 三个新标签链接：相对预览地址按当前 origin 拼，绝对地址原样用', async () => {
    const wrapper = await mountView({ token: 'tok' })
    const cards = [...document.querySelectorAll('.client-decision__card')]
    expect(cards).toHaveLength(3)
    const links = [...document.querySelectorAll('.client-decision__card a')] as HTMLAnchorElement[]
    expect(links).toHaveLength(3)
    expect(links.every(node => node.target === '_blank')).toBe(true)
    expect(links[0].getAttribute('href')).toBe(`${window.location.origin}/?reviewToken=t31`)
    expect(links[1].getAttribute('href')).toBe(`${window.location.origin}/?reviewToken=t32`)
    expect(links[2].getAttribute('href')).toBe('https://demo.preview.internal/?reviewToken=t33')
    expect(links.every(node => node.rel === 'noopener noreferrer')).toBe(true)
    wrapper.unmount()
  })

  it('两句法务原话来自响应体，不是本地抄第二份（§9-4 / §6.7）', async () => {
    const wrapper = await mountView({ token: 'tok', data: briefView({ demoNotice: 'DEMO 原话', previewNotice: 'PREVIEW 原话' }) })
    const text = wrapper.text()
    expect(text).toContain('DEMO 原话')
    expect(text).toContain('PREVIEW 原话')
    wrapper.unmount()
  })

  it('响应没带差异原话时：只用真有的字段说差异，并明写「宁可空着也不替它写一句」', async () => {
    const wrapper = await mountView({ token: 'tok' })
    const text = wrapper.text()
    expect(text).toContain('套的骨架各不相同')
    expect(text).toContain('corporate-base')
    expect(text).toContain('lead-gen')
    expect(text).toContain('这里宁可空着也不替它写一句')
    wrapper.unmount()
  })

  it('后端给了差异原话就一个字不改地显示（界面不替它写一句）', async () => {
    const data = briefView({
      candidates: [
        { siteId: 31, candidateNo: 1, name: '甲', skeletonKey: 'lead-gen', previewUrl: '/?reviewToken=t31', differentiation: '这一套把留资表单摆第一屏' },
        { siteId: 32, candidateNo: 2, name: '乙', skeletonKey: 'content-first', previewUrl: '/?reviewToken=t32', differentiation: '这一套先讲案例与实力' }
      ]
    })
    const wrapper = await mountView({ token: 'tok', data })
    const text = wrapper.text()
    expect(text).toContain('这一套把留资表单摆第一屏')
    expect(text).toContain('这一套先讲案例与实力')
    expect(text).not.toContain('这里宁可空着也不替它写一句')
    wrapper.unmount()
  })

  it('某一套没有预览地址时不摆死链：那一套只留一句实话', async () => {
    const data = briefView({
      candidates: [
        { siteId: 31, candidateNo: 1, name: '甲', skeletonKey: 'lead-gen', previewUrl: '/?reviewToken=t31' },
        { siteId: 32, candidateNo: 2, name: '乙', skeletonKey: 'content-first', previewUrl: null }
      ]
    })
    const wrapper = await mountView({ token: 'tok', data })
    expect([...document.querySelectorAll('.client-decision__card a')]).toHaveLength(1)
    expect(wrapper.text()).toContain('这一套的预览地址没在这份响应里')
    wrapper.unmount()
  })
})

describe('提交一次，然后锁死', () => {
  it('选一套 + 写一句 → POST decide 一发，路径带令牌、body 只有后端那三根字段', async () => {
    vi.mocked(http.post).mockResolvedValue(undefined as any)
    const wrapper = await mountView({ token: 'tok' })
    const target = radios().find(node => node.value === '32')!
    target.click()
    await writeNote(wrapper, '第二套的语气太硬，案例想放到首页第一屏')
    click(submitButton())
    await flushPromises()
    expect(http.post).toHaveBeenCalledTimes(1)
    expect(vi.mocked(http.post).mock.calls[0][0]).toBe('/portal/public/brief/tok/decide')
    expect(vi.mocked(http.post).mock.calls[0][1]).toEqual({
      chosenSiteId: 32,
      clientNote: '第二套的语气太硬，案例想放到首页第一屏',
      website: undefined
    })
    wrapper.unmount()
  })

  it('提交后本地锁死：再点第二下不会多发一发，且回执只说「不再接受第二次答复」，不冒充平台已收到', async () => {
    vi.mocked(http.post).mockResolvedValue(undefined as any)
    const wrapper = await mountView({ token: 'tok' })
    radios()[1].click()
    await writeNote(wrapper, '就第二套')
    click(submitButton())
    await flushPromises()
    expect(http.post).toHaveBeenCalledTimes(1)
    const button = submitButton()
    expect(button.disabled).toBe(true)
    click(button)
    await flushPromises()
    expect(http.post).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('已经提交过了：这一页不再接受第二次答复')
    expect(text).toContain('前端无从知道你那条到底进没进库')
    // 后端对所有情况都回同一个成功，所以这句话不许被写成「已收到/已记录/已成功」
    expect(text).not.toMatch(/已收到|已记录|提交成功/)
    // 提交后表单控件全部锁上（不可自助修改）
    expect(radios().every(node => node.disabled)).toBe(true)
    expect(textarea()!.disabled).toBe(true)
    wrapper.unmount()
  })

  it('交付后的正式地址：这份响应里没有那个字段，于是只写文案、不摆按钮也不拼链接', async () => {
    vi.mocked(http.post).mockResolvedValue(undefined as any)
    const wrapper = await mountView({ token: 'tok' })
    radios()[0].click()
    await wrapper.vm.$nextTick()
    click(submitButton())
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('正式地址')
    expect(text).toContain('maintenanceUrl')
    expect(text).toContain('也不摆一个「查看正式地址」的按钮')
    // 页面上唯一的链接是三个预览链接，没有第四个「看起来像正式地址」的东西
    expect([...document.querySelectorAll('.client-decision__receipt a')]).toHaveLength(0)
    wrapper.unmount()
  })

  it('只提意见不选也是合法答复：chosenSiteId 发 null（后端明列的形状）', async () => {
    vi.mocked(http.post).mockResolvedValue(undefined as any)
    const wrapper = await mountView({ token: 'tok' })
    const noteOnly = radios().find(node => node.value === '0')!
    noteOnly.click()
    await writeNote(wrapper, '都不够像我们，想再出一轮')
    expect(submitButton().disabled).toBe(false)
    click(submitButton())
    await flushPromises()
    expect(vi.mocked(http.post).mock.calls[0][1]).toMatchObject({ chosenSiteId: null, clientNote: '都不够像我们，想再出一轮' })
    wrapper.unmount()
  })

  it('两格都空着时不发：后端会把这条当误触丢掉，按钮就是灭的', async () => {
    const wrapper = await mountView({ token: 'tok' })
    expect(submitButton().disabled).toBe(true)
    expect(wrapper.text()).toContain('还没选、也没写意见')
    expect(http.post).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('意见超过后端 NOTE_MAX：本地拦住并说清后端会整条丢弃，不让人白写一遍', async () => {
    const wrapper = await mountView({ token: 'tok' })
    await writeNote(wrapper, '一'.repeat(2001))
    expect(submitButton().disabled).toBe(true)
    expect(wrapper.text()).toContain('超过了 2000 字')
    expect(http.post).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('这一发真的没走通（POST 抛错）：不锁死、错误原文挂着、可以再试', async () => {
    vi.mocked(http.post).mockRejectedValue(new Error('无法连接服务器，请确认后端已启动'))
    const wrapper = await mountView({ token: 'tok' })
    radios()[0].click()
    await wrapper.vm.$nextTick()
    click(submitButton())
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('这一句没发出去：无法连接服务器，请确认后端已启动')
    expect(text).not.toContain('已经提交过了')
    expect(submitButton().disabled).toBe(false)
    wrapper.unmount()
  })

  it('响应里的需求单状态已是 decided：这一页直接锁，不再收第二份答复', async () => {
    const wrapper = await mountView({ token: 'tok', data: briefView({ briefStatus: 'decided' }) })
    expect(wrapper.text()).toContain('这条链接上已经交过一次答复')
    expect(radios().every(node => node.disabled)).toBe(true)
    expect(textarea()!.disabled).toBe(true)
    expect(http.post).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
