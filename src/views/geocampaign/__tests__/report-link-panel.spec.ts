import { beforeEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input } from 'ant-design-vue'
import GeoReportLinkPanel from '../GeoReportLinkPanel.vue'
import { geoCampaignApi } from '../../../api/geoCampaign'
import type { GeoIssuedReportLink, GeoReportLinkSummary } from '../../../api/geoCampaign'

/**
 * 只读外链管理（Spec-G G6 登录态那一侧，任务 #158 的前端一半）。
 *
 * 这一屏只有三个动作，所以三条口径逐条钉：
 * 1. **地址只出现一次**：库里存的是散列，`list` 回的形状里根本没有令牌那一列
 *    （后端 `ReportLink` record 钉着）。所以界面对已经发出去的旧链接只能显示「活着吗 / 到什么时候」，
 *    <em>不许</em>摆一个点不开的「再复制一次」——那是假入口（§9.6 同一条纪律）；
 * 2. **撤销带的是（这一轮, sessionId）**：少一个位置就等于允许凭一个自增号撤隔壁模块的整站预览令牌；
 * 3. **复制失败不演成功**：内嵌浏览器常没剪贴板权限，那时页面给的是「这一栏你自己选走」，
 *    而不是 notification.success 让人以为已经拿到地址。
 *
 * `a-input` 与 `a-button` 用真组件：备注名要真填得进去，按钮要真按得动（替件按不动就是假绿）。
 */

vi.mock('../../../api/geoCampaign', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/geoCampaign')>()
  return {
    ...actual,
    geoCampaignApi: {
      reportLinks: vi.fn(), issueReportLink: vi.fn(), revokeReportLink: vi.fn(),
    },
  }
})

const { notificationMock } = vi.hoisted(() => ({
  notificationMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('ant-design-vue')
  return { ...actual, notification: notificationMock }
})

const TOKEN = 'a'.repeat(64)

function issued(overrides: Partial<GeoIssuedReportLink> = {}): GeoIssuedReportLink {
  return {
    sessionId: 5,
    token: TOKEN,
    path: `/geo-report/${TOKEN}`,
    expiresAt: '2026-10-15T10:00:00',
    ...overrides,
  }
}

function link(overrides: Partial<GeoReportLinkSummary> = {}): GeoReportLinkSummary {
  return {
    sessionId: 5,
    label: '给张总的第三季度报告',
    createdBy: 't15_admin',
    createdAt: '2026-10-01T09:00:00',
    expiresAt: '2026-10-15T10:00:00',
    revokedAt: null,
    active: true,
    ...overrides,
  }
}

async function mountPanel(props: Record<string, unknown> = {}) {
  const wrapper = mount(GeoReportLinkPanel, {
    props: { runId: 88, ...props },
    global: { stubs: { 'a-button': Button, 'a-input': Input } },
  })
  await flushPromises()
  return wrapper
}

/**
 * ant 的 Button 会给两个汉字的文案中间插一个空格（「复 制」「撤 销」），
 * 所以比对前先抹掉空白——否则找不到的那个按钮是用例的问题，不是界面的问题。
 */
function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
  const target = text.replace(/\s+/g, '')
  return wrapper.findAll('button').filter((node: any) => (node.text() || '').replace(/\s+/g, '') === target)
}

function rowTexts(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('.geo-report-link__table tbody tr').map((row: any) => row.text())
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(geoCampaignApi.reportLinks).mockResolvedValue([] as never)
  vi.mocked(geoCampaignApi.issueReportLink).mockResolvedValue(issued() as never)
  vi.mocked(geoCampaignApi.revokeReportLink).mockResolvedValue(
    link({ active: false, revokedAt: '2026-10-01T09:30:00' }) as never,
  )
})

describe('读列表：这一轮发过哪几条', () => {
  it('一挂上来就按 runId 读一次，读的是 report-links 那条 GET', async () => {
    await mountPanel()
    expect(geoCampaignApi.reportLinks).toHaveBeenCalledTimes(1)
    expect(geoCampaignApi.reportLinks).toHaveBeenCalledWith(88)
    // 列表是读口：这一发不许顺手把链接发出去
    expect(geoCampaignApi.issueReportLink).not.toHaveBeenCalled()
  })

  it('没有轮次时不发请求，按钮也是 disabled：没有轮次就没有「这一轮的链接」这件事', async () => {
    const wrapper = await mountPanel({ runId: null })
    expect(geoCampaignApi.reportLinks).not.toHaveBeenCalled()
    expect(buttonsByText(wrapper, '发一条只读链接')[0].attributes('disabled')).toBeDefined()
  })

  it('换轮次重读并且把上一条刚发出去的地址清掉：那一栏属于上一轮，留着就是让人抄错链接', async () => {
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '发一条只读链接')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="issued-url"]').exists()).toBe(true)

    await wrapper.setProps({ runId: 90 })
    await flushPromises()
    expect(geoCampaignApi.reportLinks).toHaveBeenLastCalledWith(90)
    expect(wrapper.find('[data-testid="issued-url"]').exists()).toBe(false)
  })

  it('列表读失败：原样念后端那句原因，不静默变成「还没发过」', async () => {
    vi.mocked(geoCampaignApi.reportLinks).mockRejectedValue(
      new Error('无权限操作该诊断轮次（FORBIDDEN）'),
    )
    const wrapper = await mountPanel()
    expect(wrapper.text()).toContain('无权限操作该诊断轮次')
    expect(wrapper.text()).not.toContain('这一轮还没发过只读链接')
  })
})

describe('发一条：地址只在这里出现一次', () => {
  it('填了备注名就按那一句发，回执的地址按当前 origin 拼出来', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('input').setValue('  给张总的第三季度报告  ')
    await buttonsByText(wrapper, '发一条只读链接')[0].trigger('click')
    await flushPromises()

    expect(geoCampaignApi.issueReportLink).toHaveBeenCalledWith(88, '给张总的第三季度报告')
    const value = wrapper.find('[data-testid="issued-url"]').element as HTMLInputElement
    expect(value.value).toBe(`${window.location.origin}/geo-report/${TOKEN}`)
    // 相对路径退化只在界面这一侧拼一次：后端不许拿请求的 origin 凑绝对地址
    expect(value.value.startsWith('http')).toBe(true)
    // 发完顺手回读列表，不然刚发的那一条在页面上「不存在」
    expect(geoCampaignApi.reportLinks).toHaveBeenCalledTimes(2)
    // 「只显示一次」这件事必须当着人说出来，不然客户以为列表里还能再翻出来
    expect(notificationMock.success.mock.calls[0][0].description).toContain('只会显示一次')
  })

  it('备注名留空发的是 null：界面无需自己编一个名字（编了就是界面替客户起名）', async () => {
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '发一条只读链接')[0].trigger('click')
    await flushPromises()
    expect(geoCampaignApi.issueReportLink).toHaveBeenCalledWith(88, null)
  })

  it('发不出去时念后端那句，且不摆一个空的地址栏', async () => {
    vi.mocked(geoCampaignApi.issueReportLink).mockRejectedValue(
      new Error('这一轮不属于当前租户（GEO_CAMPAIGN_RUN_NOT_FOUND）'),
    )
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '发一条只读链接')[0].trigger('click')
    await flushPromises()
    expect(notificationMock.error.mock.calls[0][0].description).toContain('这一轮不属于当前租户')
    expect(wrapper.find('[data-testid="issued-link"]').exists()).toBe(false)
    expect(geoCampaignApi.reportLinks).toHaveBeenCalledTimes(1)
  })

  it('连点两下只发一条：地址只出现一次这件事，不能变成两条各挂一半', async () => {
    let resolve!: (value: unknown) => void
    vi.mocked(geoCampaignApi.issueReportLink).mockReturnValue(new Promise((r) => { resolve = r }) as never)
    const wrapper = await mountPanel()
    const button = buttonsByText(wrapper, '发一条只读链接')[0]
    await button.trigger('click')
    await button.trigger('click')
    expect(geoCampaignApi.issueReportLink).toHaveBeenCalledTimes(1)
    resolve(issued())
    await flushPromises()
    expect(wrapper.find('[data-testid="issued-url"]').exists()).toBe(true)
  })
})

describe('复制链接：失败就说失败', () => {
  it('剪贴板可用时才报「已复制」', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '发一条只读链接')[0].trigger('click')
    await flushPromises()
    await buttonsByText(wrapper, '复制')[0].trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/geo-report/${TOKEN}`)
    expect(notificationMock.success.mock.calls.some((call) => call[0].message === '地址已复制')).toBe(true)
  })

  it('剪贴板被浏览器拒了：给的是「这一栏你自己选走」，不演成功', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('Document is not focused')) },
      configurable: true,
    })
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '发一条只读链接')[0].trigger('click')
    await flushPromises()
    await buttonsByText(wrapper, '复制')[0].trigger('click')
    await flushPromises()
    expect(notificationMock.warning).toHaveBeenCalled()
    expect(notificationMock.warning.mock.calls[0][0].description).toContain('选中它手动复制')
    expect(notificationMock.success.mock.calls.some((call) => call[0].message === '地址已复制')).toBe(false)
  })
})

describe('列表那一排：能说什么与不能说什么', () => {
  it('活着的给撤销，已经过期/撤销的只给一句状态——不摆点不开的按钮', async () => {
    vi.mocked(geoCampaignApi.reportLinks).mockResolvedValue([
      link({ sessionId: 5 }),
      link({ sessionId: 6, label: '去年那条', active: false, expiresAt: '2026-04-15T10:00:00' }),
      link({ sessionId: 7, label: '已收回', active: false, revokedAt: '2026-10-01T08:00:00' }),
    ] as never)
    const wrapper = await mountPanel()
    const rows = rowTexts(wrapper)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('有效')
    expect(rows[0]).toContain('给张总的第三季度报告')
    expect(rows[0]).toContain('t15_admin')
    expect(rows[1]).toContain('已过期')
    expect(rows[2]).toContain('已撤销')
    expect(buttonsByText(wrapper, '撤销')).toHaveLength(1)
  })

  it('整块列表里没有「再复制一次」：令牌是散列存的，旧链接的地址连自己都念不出', async () => {
    vi.mocked(geoCampaignApi.reportLinks).mockResolvedValue([link()] as never)
    const wrapper = await mountPanel()
    // 只有刚发出去那一条有「复制」，列表行里没有
    expect(buttonsByText(wrapper, '复制')).toHaveLength(0)
    expect(wrapper.text()).not.toContain(TOKEN)
    expect(wrapper.text()).toContain('令牌是散列存的')
    expect(wrapper.text()).toContain('要再给一个人看，就再发一条')
  })

  it('撤销发的是（这一轮, sessionId），并且用回执就地更新那一行', async () => {
    vi.mocked(geoCampaignApi.reportLinks).mockResolvedValue([link()] as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '撤销')[0].trigger('click')
    await flushPromises()
    expect(geoCampaignApi.revokeReportLink).toHaveBeenCalledWith(88, 5)
    expect(rowTexts(wrapper)[0]).toContain('已撤销')
    expect(buttonsByText(wrapper, '撤销')).toHaveLength(0)
    expect(notificationMock.success.mock.calls[0][0].description).toContain('链接无效或已过期')
  })

  it('撤销被拒（那条链接不是这一轮发的）：原样念后端那句，不把行改成已撤销', async () => {
    vi.mocked(geoCampaignApi.reportLinks).mockResolvedValue([link()] as never)
    vi.mocked(geoCampaignApi.revokeReportLink).mockRejectedValue(
      new Error('这条只读链接不是这一轮发出去的（GEO_REPORT_LINK_NOT_FOUND）'),
    )
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '撤销')[0].trigger('click')
    await flushPromises()
    expect(notificationMock.error.mock.calls[0][0].description).toContain('不是这一轮发出去的')
    expect(rowTexts(wrapper)[0]).toContain('有效')
    expect(buttonsByText(wrapper, '撤销')).toHaveLength(1)
  })
})
