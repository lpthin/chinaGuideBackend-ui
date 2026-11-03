import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { knowledgeCategoryApi, knowledgeSearchApi } from '../../../api/knowledge'
import { useAuthStore } from '../../../stores/auth'

/**
 * 知识搜索屏（M-P106 平台模式第 1 批）。
 *
 * 这一屏原来「没选客户就退回 1 号家」：超管没选客户时分类与搜索都落到编号 1 那一家。
 * 现在没选客户就一口不发：分类不读、搜索框与按钮不可用、屏上念「还没有选定客户」。
 */

vi.mock('../../../api/knowledge', () => ({
  knowledgeSearchApi: { search: vi.fn() },
  knowledgeCategoryApi: { all: vi.fn() },
  flattenCategories: (rows: any[]) => rows,
}))

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /><slot name="extra" /></div>`,
})

const ALERT_STUB = { name: 'AAlert', template: '<div class="alert-stub">{{ $attrs.message }}</div>' }

const INPUT_SEARCH_STUB = {
  name: 'AInputSearch',
  props: ['disabled'],
  template: '<div class="search-input-stub" :data-disabled="String(disabled)" />',
}

const GLOBALS = {
  stubs: {
    'a-alert': ALERT_STUB,
    'a-input-search': INPUT_SEARCH_STUB,
    'a-spin': PASS_THROUGH('ASpin'),
    'a-collapse': true,
    'a-collapse-panel': true,
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
  const View = (await import('../KnowledgeSearchView.vue')).default
  const wrapper = mount(View, { global: GLOBALS })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(knowledgeCategoryApi.all as any).mockResolvedValue({ records: [] })
})

describe('超管没选客户时这一屏一口不发', () => {
  it('平台模式：分类不读、搜索不发，搜索框不可用，屏上念「还没有选定客户」', async () => {
    setAuth({ superAdmin: true, selectedTenantId: null })
    const wrapper = await mountView()

    expect(knowledgeCategoryApi.all).not.toHaveBeenCalled()
    expect(knowledgeSearchApi.search).not.toHaveBeenCalled()
    expect(wrapper.find('.alert-stub').text()).toContain('当前没有选定客户')
    expect(wrapper.find('.search-input-stub').attributes('data-disabled')).toBe('true')
    expect(wrapper.text()).toContain('还没有选定客户')
    expect(wrapper.text()).toContain('这一发没发出去')
  })

  it('选了一家客户：分类按这一家的编号读，搜索框可用', async () => {
    setAuth({ superAdmin: true, selectedTenantId: 15 })
    const wrapper = await mountView()

    expect(knowledgeCategoryApi.all).toHaveBeenCalledWith(15)
    expect(wrapper.find('.alert-stub').exists()).toBe(false)
    expect(wrapper.find('.search-input-stub').attributes('data-disabled')).toBe('false')
    expect(wrapper.text()).toContain('开始搜索知识库')
  })
})
