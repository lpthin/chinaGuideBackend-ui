import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import { articleApi, dashboardApi, keywordApi, clusterApi } from '../../../api'
import { caseApi } from '../../../api/case'
import { useAuthStore } from '../../../stores/auth'

/**
 * AI 生成屏（M-P106 平台模式第 1 批）。
 *
 * 这一屏原来「没选客户就把租户号当 undefined」：请求头不带客户号，后端按 1 号家回——
 * 读的是 1 号家的词与任务，生成的文章与额度也落进 1 号家。
 * 现在没选客户就一口不发：四张统计卡念「—」、五个读口都不调、模板管理按钮是灰的。
 */

vi.mock('../../../api', () => ({
  articleApi: {
    getGenerationTasks: vi.fn(),
    getGenerationStatus: vi.fn(),
    getTokenStats: vi.fn(),
  },
  dashboardApi: { getStats: vi.fn() },
  keywordApi: { list: vi.fn() },
  clusterApi: { list: vi.fn(), get: vi.fn(), generateSuggestions: vi.fn() },
}))

vi.mock('../../../api/case', () => ({ caseApi: { list: vi.fn() } }))
vi.mock('../../../api/articleTemplate', () => ({ articleTemplateApi: { create: vi.fn() } }))
vi.mock('echarts', () => ({
  init: vi.fn(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
  graphic: { LinearGradient: class {} },
}))

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /><slot name="extra" /></div>`,
})

const ALERT_STUB = { name: 'AAlert', template: '<div class="alert-stub">{{ $attrs.message }}</div>' }

const GLOBALS = {
  stubs: {
    'a-button': Button,
    'a-alert': ALERT_STUB,
    'a-spin': PASS_THROUGH('ASpin'),
    'a-row': PASS_THROUGH('ARow'),
    'a-col': PASS_THROUGH('ACol'),
  },
}

function setAuth(options: { superAdmin?: boolean; selectedTenantId?: number | null } = {}) {
  const auth = useAuthStore()
  auth.user = {
    id: 1,
    username: 'tester',
    tenantId: 15,
    roles: options.superAdmin ? ['SUPER_ADMIN'] : ['SITE_ADMIN'],
    permissions: [],
  } as any
  auth.selectedTenantId = options.selectedTenantId ?? null
}

async function mountView() {
  const View = (await import('../ArticleGeneratePanel.vue')).default
  const wrapper = mount(View, { global: GLOBALS })
  await flushPromises()
  return wrapper
}

function statValues(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.stat-card__value').map(node => node.text())
}

function buttonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const buttons = wrapper.findAll('button').filter(node => node.text().includes(text))
  expect(buttons.length, `要有「${text}」按钮`).toBeGreaterThan(0)
  return buttons[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(dashboardApi.getStats as any).mockResolvedValue({ totalArticles: 9, draftCount: 3, publishedCount: 5, pendingReview: 1 })
  ;(keywordApi.list as any).mockResolvedValue({ records: [] })
  ;(clusterApi.list as any).mockResolvedValue({ records: [] })
  ;(caseApi.list as any).mockResolvedValue({ records: [] })
  ;(articleApi.getGenerationTasks as any).mockResolvedValue([])
})

describe('超管没选客户时这一屏一口不发', () => {
  it('平台模式：五个读口都不调，四张统计卡念「—」，模板管理是灰的，屏上说清为什么', async () => {
    setAuth({ superAdmin: true, selectedTenantId: null })
    const wrapper = await mountView()

    expect(dashboardApi.getStats).not.toHaveBeenCalled()
    expect(keywordApi.list).not.toHaveBeenCalled()
    expect(clusterApi.list).not.toHaveBeenCalled()
    expect(caseApi.list).not.toHaveBeenCalled()
    expect(articleApi.getGenerationTasks).not.toHaveBeenCalled()
    expect(statValues(wrapper)).toEqual(['—', '—', '—', '—'])
    expect(wrapper.find('.scope-hint').text()).toContain('当前没有选定客户')
    expect(buttonByText(wrapper, '模板管理').attributes('disabled')).toBeDefined()
  })

  it('选了一家客户：五个读口都带这一家的编号去读，统计卡摆真数', async () => {
    setAuth({ superAdmin: true, selectedTenantId: 15 })
    const wrapper = await mountView()

    expect(dashboardApi.getStats).toHaveBeenCalledWith(15)
    expect(keywordApi.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 15, page: 1, size: 100 }))
    expect(clusterApi.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 15 }))
    expect(articleApi.getGenerationTasks).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 15 }))
    expect(wrapper.find('.scope-hint').exists()).toBe(false)
    expect(statValues(wrapper)).toEqual(['9篇', '3篇', '5篇', '1篇'])
    expect(buttonByText(wrapper, '模板管理').attributes('disabled')).toBeUndefined()
  })
})
