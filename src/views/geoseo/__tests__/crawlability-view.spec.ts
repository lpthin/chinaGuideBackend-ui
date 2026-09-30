import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Card, Collapse, CollapsePanel, Descriptions, DescriptionsItem, Spin, Tag } from 'ant-design-vue'
import GeoCrawlabilityView from '../GeoCrawlabilityView.vue'
import { geoCrawlabilityApi } from '../../../api/geoCrawlability'
import type { CrawlabilityItem, CrawlabilitySnapshot, CrawlabilityVocabulary } from '../../../api/geoCrawlability'
import { useAuthStore } from '../../../stores/auth'
import { message } from 'ant-design-vue'

/**
 * 可抓取性体检页（Spec-F §8 / §10-7 / §11.6）。
 *
 * 这一页是「本 Spec 里唯一能自证的一部分」，所以用例钉的是它最容易说谎的五处：
 * 1. **六项恒六格**：库里只有三行时，剩下三项在界面上各占一格并写着「未跑过」，不是少三行；
 * 2. **中文全部来自接口**：词表与行值这里都是【假句子】，页面上出现的必须就是假句子——
 *    视图里写死一份中文，这一条就会红（#90 那一轮抄标签名的复发形状）；
 * 3. **SSR 那一行不许被灰掉、藏掉或改成未测量**：它带着服务端发回的那句因果红着；
 * 4. **「跑一次」是平台那一发**：没有 seo:audit:run 的人看得见六行、按不动按钮（真 Button，不是替件）；
 * 5. **没有总分**：页面上数不出「体检得分」那一格，只有四档各自几行。
 */

vi.mock('../../../api/geoCrawlability', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/geoCrawlability')>()
  return {
    ...actual,
    geoCrawlabilityApi: {
      vocabulary: vi.fn(),
      latest: vi.fn(),
      run: vi.fn(),
    },
  }
})

const PASS_THROUGH = (name: string) => ({ name, template: '<div><slot /></div>' })

const globalStubs = {
  'a-button': Button,
  'a-card': Card,
  'a-tag': Tag,
  'a-spin': Spin,
  'a-descriptions': Descriptions,
  'a-descriptions-item': DescriptionsItem,
  'a-collapse': Collapse,
  'a-collapse-panel': CollapsePanel,
  'a-space': PASS_THROUGH('ASpace'),
  'a-tooltip': PASS_THROUGH('ATooltip'),
}

const CHECKS = ['ai_search_group', 'training_group', 'llms_txt', 'ssr_first_packet', 'schema_coverage', 'sitemap']

const VOCABULARY = {
  checks: CHECKS,
  checkLabels: {
    ai_search_group: '假项名·答案族',
    training_group: '假项名·训练族',
    llms_txt: '假项名·llms',
    ssr_first_packet: '假项名·首包',
    schema_coverage: '假项名·结构化',
    sitemap: '假项名·地图',
  },
  checkGroups: {},
  howMeasured: { ssr_first_packet: '假取数句·首包' },
  passCriteria: { sitemap: '假判据句·地图' },
  whyItMatters: { llms_txt: '假用途句·llms' },
  verdicts: { PASS: '假绿灯', WARN: '假黄灯', FAIL: '假红灯', NOT_MEASURED: '假未测量' },
  verdictDefinitions: { NOT_MEASURED: '假未测量口径' },
  aiSearchUserAgents: [],
  trainingUserAgents: [],
} as unknown as CrawlabilityVocabulary

const SSR_CAUSAL = '假因果句：首包注入未开启，本期只承认它、不修它'

function item(overrides: Partial<CrawlabilityItem> = {}): CrawlabilityItem {
  return {
    id: 1,
    siteId: 3,
    checkKey: 'ai_search_group',
    label: '假项名·答案族',
    groupCode: 'AI_SEARCH_CRAWLER',
    verdict: 'PASS',
    verdictLabel: '假绿灯',
    verdictDefinition: null,
    observedValue: '假观测值·答案族单独成段',
    numerator: null,
    denominator: null,
    measuredAt: '2026-09-29T10:00:00',
    detail: null,
    howMeasured: null,
    passCriterion: null,
    whyItMatters: null,
    ...overrides,
  }
}

function snapshot(items: CrawlabilityItem[]): CrawlabilitySnapshot {
  return {
    items,
    measuredAt: items.length ? (items[0].measuredAt ?? null) : null,
    siteId: items.length ? (items[0].siteId ?? null) : null,
    neverRun: items.length === 0,
  }
}

function ssrRow(): CrawlabilityItem {
  return item({
    checkKey: 'ssr_first_packet',
    label: '假项名·首包',
    groupCode: 'SSR_SHELL',
    verdict: 'FAIL',
    verdictLabel: '假红灯',
    observedValue: '假观测值·服务端没有出 HTML 的这一层',
    detail: { reason: SSR_CAUSAL, serverHtmlLayerRegistered: false },
  })
}

async function mountView(
  permissionCodes: string[],
  items: CrawlabilityItem[],
  options: { superAdmin?: boolean; selectedTenantId?: number | null } = {},
) {
  const auth = useAuthStore()
  auth.user = {
    id: 1,
    username: 'tester',
    roles: options.superAdmin ? ['SUPER_ADMIN'] : ['SITE_ADMIN'],
    permissions: permissionCodes,
  } as any
  // store 在一个文件里是同一个实例：不每次归零，上一条用例留下的选择会假装成这一条的前提
  auth.selectedTenantId = options.selectedTenantId ?? null
  vi.mocked(geoCrawlabilityApi.vocabulary).mockResolvedValue(VOCABULARY)
  vi.mocked(geoCrawlabilityApi.latest).mockResolvedValue(snapshot(items))
  const wrapper = mount(GeoCrawlabilityView, {
    attachTo: document.body,
    global: { stubs: globalStubs },
  })
  await flushPromises()
  return wrapper
}

function rowOf(wrapper: ReturnType<typeof mount>, checkKey: string) {
  const found = wrapper.find(`[data-check-key="${checkKey}"]`)
  if (!found.exists()) throw new Error(`界面上没有 ${checkKey} 这一行`)
  return found
}

function buttonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const found = wrapper.findAll('button').find(node => (node.text() || '').trim() === text)
  if (!found) throw new Error(`找不到文字为「${text}」的按钮`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  // 不挂 spy 的话 message.success 永远「没被调用过」，那一条断言就是假绿
  vi.spyOn(message, 'success').mockImplementation(() => ({ key: 'toast' } as any))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('六项恒六格', () => {
  it('库里只有三行时也摆出六格，缺的那三项各写着未跑过', async () => {
    const wrapper = await mountView(['seo:audit:view'], [item(), item({ checkKey: 'llms_txt' }), ssrRow()])
    for (const checkKey of CHECKS) {
      expect(rowOf(wrapper, checkKey).exists()).toBe(true)
    }
    expect(rowOf(wrapper, 'sitemap').text()).toContain('未跑过')
    expect(rowOf(wrapper, 'sitemap').attributes('data-verdict')).toBe('absent')
  })

  it('每一项的名字与观测值念的是接口那一份，页面上没有本地抄的第二份中文', async () => {
    const wrapper = await mountView(['seo:audit:view'], [item()])
    const row = rowOf(wrapper, 'ai_search_group')
    expect(row.text()).toContain('假项名·答案族')
    expect(row.text()).toContain('假观测值·答案族单独成段')
    expect(row.text()).not.toContain('结构化数据覆盖率')
  })

  it('跑过之后行上没有判据句子时回落词表，读历史与刚跑完那六行是同一套说法', async () => {
    const wrapper = await mountView(['seo:audit:view'], [
      item(),
      item({ checkKey: 'llms_txt', label: '假项名·llms' }),
      ssrRow(),
      item({ checkKey: 'schema_coverage', label: '假项名·结构化' }),
      item({ checkKey: 'sitemap', label: '假项名·地图' }),
    ])
    expect(rowOf(wrapper, 'sitemap').text()).toContain('假判据句·地图')
    expect(rowOf(wrapper, 'llms_txt').text()).toContain('假用途句·llms')
    expect(rowOf(wrapper, 'ssr_first_packet').text()).toContain('假取数句·首包')
  })
})

describe('SSR 那一行：红着，并且带着那句因果', () => {
  it('Q12「挂着」期间它不灰、不藏、不改成未测量', async () => {
    const wrapper = await mountView(['seo:audit:view'], [ssrRow()])
    const row = rowOf(wrapper, 'ssr_first_packet')
    expect(row.attributes('data-verdict')).toBe('FAIL')
    expect(row.text()).toContain('假红灯')
    expect(row.text()).toContain(SSR_CAUSAL)
    expect(row.text()).not.toContain('未测量')
  })

  it('这一行没有分子分母那一串：它不按比例测，界面不替它编一个 0/0', async () => {
    const wrapper = await mountView(['seo:audit:view'], [ssrRow()])
    expect(rowOf(wrapper, 'ssr_first_packet').text()).not.toContain('0 / 0')
  })

  it('按比例测的那一项把分子分母摆出来，与「不适用」分得开', async () => {
    const wrapper = await mountView(['seo:audit:view'], [
      item({ checkKey: 'schema_coverage', label: '假项名·结构化', verdict: 'WARN', numerator: 3, denominator: 6 }),
    ])
    expect(rowOf(wrapper, 'schema_coverage').text()).toContain('3 / 6')
    expect(rowOf(wrapper, 'ai_search_group').text()).not.toContain('/')
  })
})

describe('四档分开报，页面上没有总分那一格', () => {
  it('计数条念的是词表里的档名，各自一个数', async () => {
    const wrapper = await mountView(['seo:audit:view'], [
      item(),
      item({ checkKey: 'training_group', verdict: 'WARN', verdictLabel: '假黄灯' }),
      ssrRow(),
    ])
    const counts = wrapper.find('.audit-counts')
    expect(counts.exists()).toBe(true)
    expect(counts.text()).toContain('假绿灯 1 项')
    expect(counts.text()).toContain('假黄灯 1 项')
    expect(counts.text()).toContain('假红灯 1 项')
    expect(counts.text()).toContain('未跑过 3 项')
  })

  it('没有「体检得分」「总分」这类把四档合并的说法', async () => {
    const wrapper = await mountView(['seo:audit:view'], [item()])
    expect(wrapper.text()).not.toMatch(/总分|得分/)
  })
})

describe('从没跑过与读不到', () => {
  it('一次都没跑过时念「还没跑过体检」，而不是六盏灯也不是 0', async () => {
    const wrapper = await mountView(['seo:audit:view'], [])
    expect(wrapper.text()).toContain('还没有跑过体检')
    for (const checkKey of CHECKS) {
      expect(rowOf(wrapper, checkKey).attributes('data-verdict')).toBe('absent')
    }
    expect(wrapper.find('.audit-counts').exists()).toBe(false)
  })

  it('读失败时把原因摆出来，不清空六行假装什么都没发生', async () => {
    const auth = useAuthStore()
    auth.user = { id: 1, username: 'tester', roles: ['SITE_ADMIN'], permissions: ['seo:audit:view'] } as any
    vi.mocked(geoCrawlabilityApi.vocabulary).mockResolvedValue(VOCABULARY)
    vi.mocked(geoCrawlabilityApi.latest).mockRejectedValue(new Error('假：后端没起来'))
    const wrapper = mount(GeoCrawlabilityView, { global: { stubs: globalStubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('假：后端没起来')
  })
})

describe('超管没选定租户那一态（P6-B 现场挖出来的）', () => {
  it('念的是「要选定租户」与它的出路，不是一次读取失败', async () => {
    const wrapper = await mountView(['seo:audit:view', 'seo:audit:run'], [item()], { superAdmin: true })
    const text = wrapper.text()
    expect(text).toContain('全站视角读不出体检')
    expect(text).toContain('选定一个租户')
    // 后端这条路回的是业务码 TENANT_REQUIRED，通用错误态会把它念成「读取失败 / 稍后重试」——
    // 出路指错了比不出路更坏，所以这一态必须不走 error 那条渲染路径（钉 data-state，不钉句子）。
    expect(text).not.toContain('读取失败')
    expect(wrapper.find('[data-state="error"]').exists()).toBe(false)
    expect(wrapper.find('[data-state="empty"]').exists()).toBe(true)
  })

  it('这一态下一次请求都不发，「跑一次」也按不动', async () => {
    const wrapper = await mountView(['seo:audit:view', 'seo:audit:run'], [item()], { superAdmin: true })
    expect(geoCrawlabilityApi.vocabulary).not.toHaveBeenCalled()
    expect(geoCrawlabilityApi.latest).not.toHaveBeenCalled()
    const run = buttonByText(wrapper, '跑一次')
    expect((run.element as HTMLButtonElement).disabled).toBe(true)
    await run.trigger('click')
    await flushPromises()
    expect(geoCrawlabilityApi.run).not.toHaveBeenCalled()
  })

  it('超管选定租户后照旧读得出六行：这一态不是给超管另加的一道闸', async () => {
    const wrapper = await mountView(['seo:audit:view'], [item()], { superAdmin: true, selectedTenantId: 15 })
    expect(geoCrawlabilityApi.latest).toHaveBeenCalledTimes(1)
    expect(rowOf(wrapper, 'ai_search_group').text()).toContain('假项名·答案族')
  })

  it('租户身份的账号永远带着自己的租户，看不见这一态', async () => {
    const wrapper = await mountView(['seo:audit:view'], [item()])
    expect(wrapper.text()).not.toContain('全站视角读不出体检')
  })

  it('「测于」那一格念的是格式化后的时间，不是后端直出的 ISO 串', async () => {
    const wrapper = await mountView(['seo:audit:view'], [item()])
    expect(wrapper.text()).toContain('2026-09-29 10:00')
    expect(wrapper.text()).not.toMatch(/2026-09-29T10:00/)
  })
})

describe('「跑一次」只给平台那一档', () => {
  it('只有读码的人看得见六行、按不动那一发', async () => {
    const wrapper = await mountView(['seo:audit:view'], [item()])
    const run = buttonByText(wrapper, '跑一次')
    expect((run.element as HTMLButtonElement).disabled).toBe(true)
    await run.trigger('click')
    await flushPromises()
    expect(geoCrawlabilityApi.run).not.toHaveBeenCalled()
  })

  it('有跑码的人点一下就跑，跑完摆的是这一轮返回的六行而不是再读一次历史', async () => {
    vi.mocked(geoCrawlabilityApi.run).mockResolvedValue(snapshot([
      item({ observedValue: '假观测值·这一轮新测的' }),
    ]))
    const wrapper = await mountView(['seo:audit:view', 'seo:audit:run'], [item()])
    expect(geoCrawlabilityApi.latest).toHaveBeenCalledTimes(1)
    await buttonByText(wrapper, '跑一次').trigger('click')
    await flushPromises()
    expect(geoCrawlabilityApi.run).toHaveBeenCalledTimes(1)
    expect(geoCrawlabilityApi.latest).toHaveBeenCalledTimes(1)
    expect(rowOf(wrapper, 'ai_search_group').text()).toContain('假观测值·这一轮新测的')
    expect(message.success).toHaveBeenCalled()
  })

  it('跑失败时把服务端那句原因摆在页面上，不留下一个假的「刚跑完」', async () => {
    vi.mocked(geoCrawlabilityApi.run).mockRejectedValue(new Error('假：这一租户没有可测的站'))
    const wrapper = await mountView(['seo:audit:view', 'seo:audit:run'], [item()])
    await buttonByText(wrapper, '跑一次').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('假：这一租户没有可测的站')
    expect(message.success).not.toHaveBeenCalled()
  })

  it('读接口一次都不打 run：翻开这一页不改动留痕', async () => {
    await mountView(['seo:audit:view'], [item()])
    expect(geoCrawlabilityApi.run).not.toHaveBeenCalled()
  })
})
