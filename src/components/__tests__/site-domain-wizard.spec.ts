import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { Button, Input } from 'ant-design-vue'
import { siteApi } from '../../api'

/**
 * 域名绑定向导（Spec「上线交付收尾三件事」§2）：
 * 三步（填域名并检测 → 客户侧解析指引 → 确认绑定），检测不通过不是硬闸，只有格式不对拦着。
 */

vi.mock('../../api', () => ({
  siteApi: { domainCheck: vi.fn(), update: vi.fn() },
}))

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /><slot name="extra" /></div>`,
})

const ALERT_STUB = {
  name: 'AAlert',
  template: '<div class="alert-stub"><slot name="message" />{{ $attrs.message }}</div>',
}

const GLOBALS = {
  stubs: {
    'a-modal': { name: 'AModal', template: '<div class="modal-stub"><slot /></div>' },
    'a-form': PASS_THROUGH('AForm'),
    'a-form-item': PASS_THROUGH('AFormItem'),
    'a-input': Input,
    'a-button': Button,
    'a-alert': ALERT_STUB,
    'a-tag': PASS_THROUGH('ATag'),
    'a-descriptions': PASS_THROUGH('ADescriptions'),
    'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
    'a-steps': PASS_THROUGH('ASteps'),
    'a-step': PASS_THROUGH('AStep'),
  },
}

const SITE = { id: 700, name: '演示站', status: 'enabled', domain: '' } as any

async function mountWizard(open = true, site: any = SITE) {
  const Wizard = (await import('../SiteDomainWizard.vue')).default
  const wrapper = mount(Wizard, { props: { open, site }, global: GLOBALS })
  await flushPromises()
  return wrapper
}

function buttonByText(wrapper: VueWrapper, text: string) {
  const buttons = wrapper.findAll('button').filter(node => node.text().replace(/\s/g, '').includes(text))
  expect(buttons.length, `要有「${text}」按钮`).toBeGreaterThan(0)
  return buttons[0]
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('域名绑定向导', () => {
  it('打开时回填站点现有域名', async () => {
    const wrapper = await mountWizard(true, { ...SITE, domain: 'www.old.com' })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('www.old.com')
  })

  it('检测 OK 后放行进指引步，记录值摆的是平台根域名', async () => {
    ;(siteApi.domainCheck as any).mockResolvedValue({
      status: 'OK', message: '解析已生效', domainIps: ['1.2.3.4'], platformIps: ['1.2.3.4'],
      platformRoot: 'portal.example.com',
    })
    const wrapper = await mountWizard()
    await wrapper.find('input').setValue('www.customer.com')
    await buttonByText(wrapper, '检测解析').trigger('click')
    await flushPromises()

    expect(siteApi.domainCheck).toHaveBeenCalledWith(700, 'www.customer.com')
    expect(wrapper.find('.alert-stub').text()).toContain('解析已生效')

    await buttonByText(wrapper, '下一步').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('portal.example.com')
  })

  it('格式不对（INVALID）拦着不进下一步，绑定那一发也不发', async () => {
    ;(siteApi.domainCheck as any).mockResolvedValue({
      status: 'INVALID', message: '域名格式不对：不是域名。', domainIps: [], platformIps: [],
      platformRoot: 'portal.example.com',
    })
    const wrapper = await mountWizard()
    await wrapper.find('input').setValue('不是域名')
    await buttonByText(wrapper, '检测解析').trigger('click')
    await flushPromises()

    await buttonByText(wrapper, '下一步').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('先点「检测解析」拿到结果')
    expect(siteApi.update).not.toHaveBeenCalled()
  })

  it('NOT_MATCHED 时明说仍要绑定但放行；确认后按只动域名的 payload 发 PUT 并收口', async () => {
    ;(siteApi.domainCheck as any).mockResolvedValue({
      status: 'NOT_MATCHED', message: '解析还没生效：www.customer.com 现在指向 [9.9.9.9]。',
      domainIps: ['9.9.9.9'], platformIps: ['1.2.3.4'], platformRoot: 'portal.example.com',
    })
    ;(siteApi.update as any).mockResolvedValue({ ...SITE, domain: 'www.customer.com' })
    const wrapper = await mountWizard()
    await wrapper.find('input').setValue('www.customer.com')
    await buttonByText(wrapper, '检测解析').trigger('click')
    await flushPromises()

    await buttonByText(wrapper, '下一步').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('仍要绑定')

    await buttonByText(wrapper, '下一步').trigger('click')
    await flushPromises()
    await buttonByText(wrapper, '确认绑定').trigger('click')
    await flushPromises()

    expect(siteApi.update).toHaveBeenCalledWith(700, {
      id: 700, name: '演示站', status: 'enabled', domain: 'www.customer.com',
    })
    expect(wrapper.emitted('saved')).toBeTruthy()
    const openEvents = wrapper.emitted('update:open') ?? []
    expect(openEvents[openEvents.length - 1]).toEqual([false])
  })
})
