import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import InquiryFormBlock from '../blocks/InquiryFormBlock.vue'
import type { PortalSiteShell } from '../api/portalPublic'
import { submitInquiry } from '../api/portalPublic'

/**
 * 留资表单（inquiry-form）。
 *
 * 钉住四条后端约定（口径全部来自 InquiryService，不在这里另立一套）：
 * 1. 长度上限与电话/邮箱格式在前端就地提醒——后端不合规是静默丢弃并回成功，访客拿不到第二次提醒；
 * 2. 提醒过的表单一次请求都不该发出去；
 * 3. website 是蜜罐，访客看不到、也永远不带初值；
 * 4. 返回值对「真收/限流/蜜罐」完全同形，所以成功分支只有一句回执，不判 accepted。
 */

vi.mock('../api/portalPublic', () => ({
  submitInquiry: vi.fn().mockResolvedValue(undefined)
}))

function siteShell(overrides: Partial<PortalSiteShell> = {}): PortalSiteShell {
  return {
    siteId: 12,
    siteName: '示例站点',
    siteCode: 'acme',
    baseUrl: null,
    company: {
      name: '示例科技有限公司',
      logo: null,
      description: null,
      copyright: null,
      phone: null,
      email: null,
      address: null
    },
    seo: null,
    nav: [],
    ...overrides
  }
}

/** 演示壳（画廊/骨架预览）与搭建器预览的 null 壳：这两种上下文里不许发真实请求 */
function demoShell(): PortalSiteShell {
  return siteShell({ siteId: 0, siteCode: 'demo' })
}

function mountBlock(blockProps: Record<string, unknown> = {}, shell: PortalSiteShell | null = siteShell()) {
  return mount(InquiryFormBlock, { props: { blockProps, shell } })
}

async function fill(wrapper: ReturnType<typeof mountBlock>, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    await wrapper.find(`[name="${name}"]`).setValue(value)
  }
}

async function submit(wrapper: ReturnType<typeof mountBlock>) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

function payloadOf(call: number): Record<string, unknown> {
  return vi.mocked(submitInquiry).mock.calls[call][0] as unknown as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(submitInquiry).mockResolvedValue(undefined)
})

describe('访客侧提交', () => {
  it('按后端 InquiryForm 的字段形状提交，并把来源页带上', async () => {
    const wrapper = mountBlock()
    await fill(wrapper, { name: ' 张三 ', phone: '13800000000', email: 'a@example.com', content: '想了解报价' })
    await submit(wrapper)

    expect(submitInquiry).toHaveBeenCalledTimes(1)
    expect(payloadOf(0)).toEqual({
      name: '张三',
      phone: '13800000000',
      email: 'a@example.com',
      content: '想了解报价',
      website: '',
      page: window.location.pathname
    })
  })

  it('成功只展示后端配的文案，表单随即收起', async () => {
    const wrapper = mountBlock({ successText: '线索已登记，运营会在工作日联系您' })
    await fill(wrapper, { phone: '010-88886666', content: '预约看厂' })
    await submit(wrapper)

    expect(wrapper.find('.pb-inquiry__receipt').text()).toContain('线索已登记')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('后端没写回执文案时也给一句不承诺结果的话', async () => {
    const wrapper = mountBlock()
    await fill(wrapper, { email: 'a@example.com', content: '要一份方案' })
    await submit(wrapper)

    expect(wrapper.find('.pb-inquiry__receipt').text()).toContain('已收到')
  })

  it('请求真的没到后端才说失败，且表单还在', async () => {
    vi.mocked(submitInquiry).mockRejectedValueOnce(new Error('无法连接服务器，请确认后端已启动'))
    const wrapper = mountBlock()
    await fill(wrapper, { name: '李四', content: '合作咨询' })
    await submit(wrapper)

    expect(wrapper.find('.pb-inquiry__receipt').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).toContain('无法连接服务器')
  })
})

describe('就地软校验：不合规就不发请求', () => {
  it('姓名/电话/邮箱一个都没留时提示至少留一个', async () => {
    const wrapper = mountBlock()
    await fill(wrapper, { content: '只想说一句不错' })
    await submit(wrapper)

    expect(submitInquiry).not.toHaveBeenCalled()
    expect(wrapper.find('.pb-inquiry__error').text()).toContain('至少留一个')
  })

  it('留言为空时提示必填', async () => {
    const wrapper = mountBlock()
    await fill(wrapper, { name: '王五', content: '   ' })
    await submit(wrapper)

    expect(submitInquiry).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请填写留言内容')
  })

  it('超出后端长度上限（姓名 50 / 邮箱 120 / 留言 2000）时不发请求', async () => {
    const wrapper = mountBlock()
    await fill(wrapper, {
      name: '名'.repeat(51),
      email: `${'b'.repeat(110)}@example.com`,
      content: '容'.repeat(2001)
    })
    await submit(wrapper)

    expect(submitInquiry).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('姓名不超过 50')
    expect(wrapper.text()).toContain('邮箱不超过 120')
    expect(wrapper.text()).toContain('留言不超过 2000')
  })

  it('电话与邮箱格式不对时提示到具体那一格', async () => {
    const wrapper = mountBlock()
    await fill(wrapper, { phone: 'abc', email: 'not-an-email', content: '咨询' })
    await submit(wrapper)

    expect(submitInquiry).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('电话只能含数字')
    expect(wrapper.text()).toContain('邮箱格式不对')
  })
})

describe('蜜罐与演示态', () => {
  it('蜜罐字段藏在访客看不到的位置、没有初值，也不带任何可见标签', async () => {
    const wrapper = mountBlock()
    const honeypot = wrapper.find('.pb-inquiry__honeypot')
    const input = honeypot.find<HTMLInputElement>('[name="website"]')

    expect(honeypot.attributes('aria-hidden')).toBe('true')
    expect(input.attributes('tabindex')).toBe('-1')
    expect(input.element.value).toBe('')
    // 访客看得见的字段就是后端会收的字段：可见 label 里不许出现「网站」
    const visibleLabels = wrapper.findAll('label.pb-inquiry__label').map(node => node.text()).join('')
    expect(visibleLabels).not.toContain('网站')
  })

  it('蜜罐恒随表单原样提交，由后端决定丢弃', async () => {
    const wrapper = mountBlock()
    await fill(wrapper, { name: '赵六', content: '要一份报价单' })
    await submit(wrapper)

    expect(payloadOf(0).website).toBe('')
  })

  it('画廊那份演示壳（siteId 0）里提交按钮不可用，点了也不发请求', async () => {
    const wrapper = mountBlock({}, demoShell())
    await fill(wrapper, { name: '孙七', content: '演示内容' })
    expect(wrapper.find('[type="submit"]').attributes('disabled')).toBeDefined()

    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitInquiry).not.toHaveBeenCalled()
  })

  it('搭建器预览没有站点壳时同样不给提交', async () => {
    const wrapper = mountBlock({}, null)
    await fill(wrapper, { name: '周八', content: '预览内容' })
    await submit(wrapper)

    expect(submitInquiry).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('提交不会发出请求')
  })
})
