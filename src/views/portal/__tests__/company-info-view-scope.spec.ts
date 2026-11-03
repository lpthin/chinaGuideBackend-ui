import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import { companyInfoApi } from '../../../api/portal'
import { vocabularyApi } from '../../../api/siteBriefs'
import { useAuthStore } from '../../../stores/auth'

/**
 * 企业信息屏（M-P106 平台模式第 1 批）。
 *
 * 这一屏原来「没选客户就退回 1 号家」：超管没选客户时读的是编号 1 那一家企业信息，
 * 保存也写进 1 号家。现在没选客户就一口不发：读口不调、表单清空、重置/保存都是灰的。
 */

vi.mock('../../../api/portal', () => ({
  companyInfoApi: { get: vi.fn(), update: vi.fn(), uploadImage: vi.fn() },
}))

vi.mock('../../../api/siteBriefs', () => ({
  PROFILE_QUESTION_KEYS: {
    industry: 'industry',
    targetRegions: 'regions',
    targetAudience: 'audiences',
    businessModel: 'business_models',
    languages: 'languages',
  },
  findProfileQuestion: () => null,
  vocabularyApi: { portalVocabulary: vi.fn() },
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
    'a-card': PASS_THROUGH('ACard'),
    'a-space': PASS_THROUGH('ASpace'),
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
  const View = (await import('../CompanyInfoView.vue')).default
  const wrapper = mount(View, { global: GLOBALS })
  await flushPromises()
  return wrapper
}

function buttonByText(wrapper: ReturnType<typeof mount>, text: string) {
  // antd 会在两个汉字之间插空格（「重 置」），按去掉空白后比对
  const buttons = wrapper.findAll('button').filter(node => node.text().replace(/\s/g, '').includes(text))
  expect(buttons.length, `要有「${text}」按钮`).toBeGreaterThan(0)
  return buttons[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(companyInfoApi.get as any).mockResolvedValue(null)
  ;(vocabularyApi.portalVocabulary as any).mockResolvedValue(null)
})

describe('超管没选客户时这一屏一口不发', () => {
  it('平台模式：企业信息不读，重置与保存都是灰的，屏上说清为什么', async () => {
    setAuth({ superAdmin: true, selectedTenantId: null })
    const wrapper = await mountView()

    expect(companyInfoApi.get).not.toHaveBeenCalled()
    expect(wrapper.find('.alert-stub').text()).toContain('当前没有选定客户')
    expect(buttonByText(wrapper, '重置').attributes('disabled')).toBeDefined()
    expect(buttonByText(wrapper, '保存修改').attributes('disabled')).toBeDefined()
  })

  it('选了一家客户：企业信息按这一家的编号读，保存可用', async () => {
    setAuth({ superAdmin: true, selectedTenantId: 15 })
    const wrapper = await mountView()

    expect(companyInfoApi.get).toHaveBeenCalledWith(15)
    expect(wrapper.find('.alert-stub').exists()).toBe(false)
    expect(buttonByText(wrapper, '保存修改').attributes('disabled')).toBeUndefined()
  })
})
