import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { Button } from 'ant-design-vue'
import SystemSettingsView from '../SystemSettingsView.vue'
import { adminApi } from '../../../api/workspace'

/**
 * 系统设置这一屏的两种档（M-P106 拍板 Q1 的 B 类）。
 *
 * 站点信息、AI 配置与工作流配置全按客户分开存，所以：
 * 1. 平台档（超管没选客户）一口业务请求都不发，三个保存口全灰，屏上明说去哪儿选客户；
 * 2. 选了客户之后，读口与写口带的都是那一家选中的编号。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  adminApi: {
    settings: {
      get: vi.fn(),
      update: vi.fn(),
      testAiConnection: vi.fn()
    }
  }
}))

vi.mock('../../../api/article', () => ({
  imageLibraryApi: {
    upload: vi.fn()
  }
}))

vi.mock('../../../api/http', () => ({
  describeHttpError: (error: any) => String(error?.message ?? error)
}))

const authState = reactive({
  selectedTenantId: null as number | null,
  tenantId: 1 as number | undefined,
  isSuperAdmin: true
})

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authState
}))

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="extra" /><slot name="message" /><slot name="description" /></div>`
})

const FORM_STUB = {
  name: 'AForm',
  methods: {
    validate: () => Promise.resolve(),
    resetFields: () => undefined
  },
  template: '<form class="form-stub"><slot /></form>'
}

const STUBS = {
  'a-alert': {
    name: 'AAlert',
    props: ['message', 'type', 'showIcon'],
    template: '<div class="alert-stub"><slot name="message" />{{ message }}</div>'
  },
  'a-tabs': PASS_THROUGH('ATabs'),
  'a-tab-pane': PASS_THROUGH('ATabPane'),
  'a-card': PASS_THROUGH('ACard'),
  'a-form': FORM_STUB,
  'a-form-item': PASS_THROUGH('AFormItem'),
  'a-space': PASS_THROUGH('ASpace'),
  'a-divider': PASS_THROUGH('ADivider'),
  'a-upload': PASS_THROUGH('AUpload'),
  'a-input': { name: 'AInput', props: ['value'], template: '<input class="input-stub" />' },
  'a-input-password': { name: 'AInputPassword', props: ['value'], template: '<input class="input-password-stub" />' },
  'a-textarea': { name: 'ATextarea', props: ['value'], template: '<textarea class="textarea-stub"></textarea>' },
  'a-select': { name: 'ASelect', props: ['value'], template: '<select class="select-stub"></select>' },
  'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
  'a-slider': { name: 'ASlider', template: '<div class="slider-stub"></div>' },
  'a-input-number': { name: 'AInputNumber', props: ['value'], template: '<input class="input-number-stub" />' },
  'a-switch': { name: 'ASwitch', template: '<span class="switch-stub"></span>' },
  'a-time-picker': { name: 'ATimePicker', props: ['value'], template: '<input class="time-picker-stub" />' },
  'a-button': Button
}

function mountView() {
  return mount(SystemSettingsView, { global: { stubs: STUBS } })
}

function buttons(wrapper: any, text: string) {
  return wrapper.findAll('button').filter((node: any) => node.text().includes(text))
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.isSuperAdmin = true
  authState.selectedTenantId = null
  authState.tenantId = 1
  vi.mocked(adminApi.settings.get).mockResolvedValue({} as any)
  vi.mocked(adminApi.settings.update).mockResolvedValue({} as any)
})

describe('系统设置 · 平台档与选客户两档', () => {
  it('平台档：设置一口都不读，三个保存口与测试连接全灰，屏上明说请先选客户', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(adminApi.settings.get).not.toHaveBeenCalled()

    const text = wrapper.text()
    expect(text).toContain('请先在右上角切到「客户」并选一家')
    expect(text).toContain('平台档这里不发业务请求')

    const saveButtons = buttons(wrapper, '保存设置')
    expect(saveButtons).toHaveLength(3)
    saveButtons.forEach((node: any) => {
      expect(node.attributes('disabled')).toBeDefined()
    })
    expect(buttons(wrapper, '测试连接')[0].attributes('disabled')).toBeDefined()
    // 灰到点不动：写口根本走不到，所以这里只钉「灰」与「没发过写口」
    expect(adminApi.settings.update).not.toHaveBeenCalled()
  })

  it('选客户 558 后：读口与写口都带 558，保存口放开', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(adminApi.settings.get).not.toHaveBeenCalled()

    authState.selectedTenantId = 558
    await flushPromises()

    expect(adminApi.settings.get).toHaveBeenLastCalledWith(558)
    expect(wrapper.text()).not.toContain('平台档这里不发业务请求')

    const save = buttons(wrapper, '保存设置')[0]
    expect(save.attributes('disabled')).toBeUndefined()
    await save.trigger('click')
    await flushPromises()

    const calls = vi.mocked(adminApi.settings.update).mock.calls
    const [payload, tenantId] = calls[calls.length - 1] as any
    expect(tenantId).toBe(558)
    expect(payload).toHaveProperty('site')
  })
})
