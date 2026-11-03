import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import { knowledgeCardApi } from '../../../api/knowledge'
import { useAuthStore } from '../../../stores/auth'

/**
 * 知识卡片详情屏（M-P106 平台模式第 1 批）。
 *
 * 这一屏原来「没选客户就退回 1 号家」：超管没选客户时读的是编号 1 那一家卡片，
 * 编辑/删除也落在 1 号家。现在没选客户就一口不发：读口不调、编辑与删除两颗按钮是灰的、屏上说清原因。
 */

vi.mock('../../../api/knowledge', () => ({
  knowledgeCardApi: { get: vi.fn(), list: vi.fn(), delete: vi.fn() },
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
    useRoute: () => ({ params: { id: '5' }, query: {}, meta: {} }),
  }
})

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /><slot name="extra" /><slot name="title" /></div>`,
})

const ALERT_STUB = { name: 'AAlert', template: '<div class="alert-stub">{{ $attrs.message }}</div>' }

const GLOBALS = {
  stubs: {
    'a-button': Button,
    'a-alert': ALERT_STUB,
    'a-spin': PASS_THROUGH('ASpin'),
    'a-page-header': PASS_THROUGH('APageHeader'),
    'a-row': PASS_THROUGH('ARow'),
    'a-col': PASS_THROUGH('ACol'),
    'a-card': PASS_THROUGH('ACard'),
    'a-space': PASS_THROUGH('ASpace'),
    'a-tag': PASS_THROUGH('ATag'),
    'a-divider': true,
    'a-list': true,
    'a-list-item': true,
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
  const View = (await import('../KnowledgeCardDetailView.vue')).default
  const wrapper = mount(View, { global: GLOBALS })
  await flushPromises()
  return wrapper
}

function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').filter(node => node.text().includes(text))
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(knowledgeCardApi.get as any).mockResolvedValue({
    id: 5, title: '卡片', categoryId: 9, categoryName: '分类', content: '', tags: '',
  })
  ;(knowledgeCardApi.list as any).mockResolvedValue({ records: [] })
})

describe('超管没选客户时这一屏一口不发', () => {
  it('平台模式：详情与相关推荐两发都不发，编辑/删除都是灰的，屏上说清为什么', async () => {
    setAuth({ superAdmin: true, selectedTenantId: null })
    const wrapper = await mountView()

    expect(knowledgeCardApi.get).not.toHaveBeenCalled()
    expect(knowledgeCardApi.list).not.toHaveBeenCalled()
    expect(wrapper.find('.alert-stub').text()).toContain('当前没有选定客户')

    for (const text of ['编辑', '删除']) {
      const buttons = buttonsByText(wrapper, text)
      expect(buttons.length, `要有「${text}」按钮`).toBeGreaterThan(0)
      for (const button of buttons) {
        expect(button.attributes('disabled'), `${text}按钮要置灰`).toBeDefined()
      }
    }
  })

  it('选了一家客户：详情读这一张，相关推荐带这一家的编号去读', async () => {
    setAuth({ superAdmin: true, selectedTenantId: 15 })
    const wrapper = await mountView()

    expect(knowledgeCardApi.get).toHaveBeenCalledWith(5)
    expect(knowledgeCardApi.list).toHaveBeenCalledWith({
      tenantId: 15, categoryId: 9, page: 1, size: 5,
    })
    expect(wrapper.find('.alert-stub').exists()).toBe(false)

    for (const text of ['编辑', '删除']) {
      for (const button of buttonsByText(wrapper, text)) {
        expect(button.attributes('disabled'), `${text}按钮不该灰`).toBeUndefined()
      }
    }
  })
})
