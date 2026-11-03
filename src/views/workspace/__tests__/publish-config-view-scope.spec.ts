import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { Button } from 'ant-design-vue'
import PublishConfigView from '../PublishConfigView.vue'
import { publishConfigApi } from '../../../api/workspace'

/**
 * 发布配置这一屏的两种档（M-P106 拍板 Q1 的 B 类）：配置与平台清单都按客户存。
 *
 * 钉两件：
 * 1. 平台档（超管没选客户）一口业务请求都不发，写口全灰，屏上明说去哪儿选客户；
 * 2. 选了客户之后，读口与写口带的都是那一家选中的编号，不是悄悄回到 1 号家。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  publishConfigApi: {
    get: vi.fn(),
    update: vi.fn(),
    modes: vi.fn(),
    listPlatforms: vi.fn(),
    createPlatform: vi.fn(),
    updatePlatform: vi.fn(),
    deletePlatform: vi.fn(),
    testPlatform: vi.fn()
  }
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
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="extra" /><slot name="message" /></div>`
})

const STUBS = {
  'a-alert': {
    name: 'AAlert',
    props: ['message', 'type', 'showIcon'],
    template: '<div class="alert-stub"><slot name="message" />{{ message }}</div>'
  },
  'a-tabs': PASS_THROUGH('ATabs'),
  'a-tab-pane': PASS_THROUGH('ATabPane'),
  'a-card': PASS_THROUGH('ACard'),
  'a-form': PASS_THROUGH('AForm'),
  'a-form-item': PASS_THROUGH('AFormItem'),
  'a-space': PASS_THROUGH('ASpace'),
  'a-radio-group': PASS_THROUGH('ARadioGroup'),
  'a-radio-button': PASS_THROUGH('ARadioButton'),
  'a-radio': PASS_THROUGH('ARadio'),
  'a-switch': { name: 'ASwitch', template: '<span class="switch-stub"></span>' },
  'a-select': { name: 'ASelect', props: ['value'], template: '<select class="select-stub"></select>' },
  'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
  'a-input': { name: 'AInput', props: ['value'], template: '<input class="input-stub" />' },
  'a-input-password': { name: 'AInputPassword', props: ['value'], template: '<input class="input-password-stub" />' },
  'a-textarea': { name: 'ATextarea', props: ['value'], template: '<textarea class="textarea-stub"></textarea>' },
  'a-table': { name: 'ATable', props: ['dataSource', 'columns', 'loading'], template: '<div class="table-stub" />' },
  'a-modal': PASS_THROUGH('AModal'),
  'a-tag': PASS_THROUGH('ATag'),
  'a-button': Button
}

function mountView() {
  return mount(PublishConfigView, { global: { stubs: STUBS } })
}

function findButton(wrapper: any, text: string) {
  return wrapper.findAll('button').find((node: any) => node.text().includes(text))
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.isSuperAdmin = true
  authState.selectedTenantId = null
  authState.tenantId = 1
  vi.mocked(publishConfigApi.get).mockResolvedValue({
    id: 9,
    publishMode: 'MANUAL',
    autoPublishEnabled: false,
    reviewFlow: 'NONE',
    publishFrequency: ''
  } as any)
  vi.mocked(publishConfigApi.listPlatforms).mockResolvedValue([] as any)
  vi.mocked(publishConfigApi.update).mockResolvedValue({ id: 9 } as any)
})

describe('发布配置 · 平台档与选客户两档', () => {
  it('平台档：配置与平台清单都不发请求，写口全灰并明说请先选客户', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(publishConfigApi.get).not.toHaveBeenCalled()
    expect(publishConfigApi.listPlatforms).not.toHaveBeenCalled()

    const text = wrapper.text()
    expect(text).toContain('请先在右上角切到「客户」并选一家')
    expect(text).toContain('平台档这里不发业务请求')

    // 灰到点不动：写口根本走不到，所以这里只钉「灰」与「没发过写口」
    expect(findButton(wrapper, '保存配置').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, '新增发布平台').attributes('disabled')).toBeDefined()
    expect(publishConfigApi.update).not.toHaveBeenCalled()
    expect(publishConfigApi.createPlatform).not.toHaveBeenCalled()
  })

  it('选客户 558 后：读口与写口都带 558，提示收起、按钮放开', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(publishConfigApi.get).not.toHaveBeenCalled()

    authState.selectedTenantId = 558
    await flushPromises()

    expect(publishConfigApi.get).toHaveBeenLastCalledWith(558)
    expect(publishConfigApi.listPlatforms).toHaveBeenLastCalledWith({ tenantId: 558 })
    expect(wrapper.text()).not.toContain('平台档这里不发业务请求')

    const save = findButton(wrapper, '保存配置')
    expect(save.attributes('disabled')).toBeUndefined()
    await save.trigger('click')
    await flushPromises()

    const calls = vi.mocked(publishConfigApi.update).mock.calls
    const [payload, tenantId] = calls[calls.length - 1] as any
    expect(tenantId).toBe(558)
    expect(payload.id).toBe(9)
  })
})
