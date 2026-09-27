import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import InquiryFormBlock from '../blocks/InquiryFormBlock.vue'
import type { PortalSiteShell } from '../api/portalPublic'
import { fetchInquiryBudgets, submitInquiry } from '../api/portalPublic'

/**
 * 留资表单（inquiry-form）。
 *
 * 钉住五条后端约定（口径全部来自 InquiryService，不在这里另立一套）：
 * 1. 长度上限与电话/邮箱格式在前端就地提醒——后端不合规是静默丢弃并回成功，访客拿不到第二次提醒；
 * 2. 提醒过的表单一次请求都不该发出去；
 * 3. website 是蜜罐，访客看不到、也永远不带初值；
 * 4. 返回值对「真收/限流/蜜罐」完全同形，所以成功分支只有一句回执，不判 accepted；
 * 5. 后端那份 {@code previewAuthorized} 为真时这一套站还在预览阶段：表单不给提交，
 *    与后端「预览视图的留资一行都不落」是同一句实话的两半（方案 B，2026-09-27）。
 */

/** 后端 InquiryBudgets 的那六档：这里按码写死，测的就是「界面念的是端点给的码，不是自己编的」 */
const BUDGETS = {
  under_5w: '5 万以内',
  from_5w_to_10w: '5–10 万',
  from_10w_to_30w: '10–30 万',
  from_30w_to_50w: '30–50 万',
  over_50w: '50 万以上',
  not_sure: '还没定'
}

vi.mock('../api/portalPublic', () => ({
  submitInquiry: vi.fn().mockResolvedValue(undefined),
  fetchInquiryBudgets: vi.fn().mockResolvedValue({})
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
  vi.mocked(fetchInquiryBudgets).mockResolvedValue(BUDGETS)
})

describe('访客侧提交', () => {
  it('按后端 InquiryForm 的字段形状提交，并把来源页带上', async () => {
    const wrapper = mountBlock()
    await flushPromises()
    await fill(wrapper, { name: ' 张三 ', phone: '13800000000', email: 'a@example.com', content: '想了解报价' })
    await submit(wrapper)

    expect(submitInquiry).toHaveBeenCalledTimes(1)
    expect(payloadOf(0)).toEqual({
      name: '张三',
      company: '',
      budget: '',
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

/**
 * 预览视图不收线索（方案 B，2026-09-27）。
 *
 * 现场翻过一次车：候选站那条预览链接上，访客填的留资真的落进了库——落到了另一个租户名下
 * （公开写口不带令牌，域名兜底认到了默认站）。后端现在有一条同口径的闸（InquiryService），
 * 界面这一半要跟着一起闭：按钮不给点、一句实话说明为什么，词表也不去取。
 */
describe('预览视图：这套站还没交付，表单不收线索', () => {
  it('壳层带着 previewAuthorized 时按钮不可用，填满了也不发请求', async () => {
    const wrapper = mountBlock({}, siteShell({ previewAuthorized: true }))
    await flushPromises()
    await fill(wrapper, { name: '客户本人', phone: '13800000000', content: '先试一下' })

    expect(wrapper.find('[type="submit"]').attributes('disabled')).toBeDefined()
    await submit(wrapper)
    expect(submitInquiry).not.toHaveBeenCalled()
  })

  it('说的是「这一套方案还在预览阶段」，不是那句「没有能收线索的站点」', async () => {
    // 演示壳那句「这里没有能收线索的站点」用在这一档就是谎话：站点是有的，只是还没交付。
    // 客户看完会以为表单坏了，而不是「上线之后才收」
    const wrapper = mountBlock({}, siteShell({ previewAuthorized: true }))

    expect(wrapper.text()).toContain('还在预览阶段')
    expect(wrapper.text()).toContain('不会进任何人的线索列表')
    expect(wrapper.text()).not.toContain('没有能收线索的站点')
  })

  it('预览视图连预算词表都不取：这一档不会有访客来填', async () => {
    mountBlock({}, siteShell({ previewAuthorized: true }))
    await flushPromises()

    expect(fetchInquiryBudgets).not.toHaveBeenCalled()
  })

  /** 反面对照：闸不能写成「永远不给提交」——正式访客拿的是同一份壳，只是没有那一个字段 */
  it('同一份壳没有 previewAuthorized 时照常收线索', async () => {
    const wrapper = mountBlock()
    await flushPromises()
    await fill(wrapper, { name: '真实访客', phone: '13800000000', content: '想了解报价' })
    await submit(wrapper)

    expect(submitInquiry).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.pb-inquiry__receipt').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('还在预览阶段')
  })
})

/** 拍板 2026-09-27 补的两格：公司名是自由文本（有长度上限），预算是码——档位这份词表不许在前端另立一份 */
describe('公司与预算两格', () => {
  it('下拉念的就是端点给的那几档：顺序、码、中文说法都来自后端词表', async () => {
    const wrapper = mountBlock()
    await flushPromises()

    const options = wrapper.findAll<HTMLInputElement>('[name="budget"] option')
    // 第一项是「可跳过」的占位，不占档位
    expect(options.slice(1).map(option => option.element.value)).toEqual(Object.keys(BUDGETS))
    expect(options.slice(1).map(option => option.text())).toEqual(Object.values(BUDGETS))
    expect(options[0].element.value).toBe('')
  })

  it('公司名与预算档位一起提交，预算带的是码不是那句中文', async () => {
    const wrapper = mountBlock()
    await flushPromises()
    await fill(wrapper, {
      name: '张三',
      company: ' 上海纳欣精密机械 ',
      budget: 'from_10w_to_30w',
      content: '想做企业门户'
    })
    await submit(wrapper)

    expect(payloadOf(0).company).toBe('上海纳欣精密机械')
    expect(payloadOf(0).budget).toBe('from_10w_to_30w')
  })

  it('词表拉不到时下拉只剩占位，表单照旧能提交', async () => {
    vi.mocked(fetchInquiryBudgets).mockRejectedValueOnce(new Error('后端没起'))
    const wrapper = mountBlock()
    await flushPromises()

    expect(wrapper.findAll('[name="budget"] option')).toHaveLength(1)
    expect(wrapper.text()).toContain('档位暂时取不到')

    await fill(wrapper, { name: '李四', content: '先留个电话' })
    await submit(wrapper)

    expect(submitInquiry).toHaveBeenCalledTimes(1)
    expect(payloadOf(0).budget).toBe('')
  })

  it('公司名超出后端上限（100）时不发请求', async () => {
    const wrapper = mountBlock()
    await flushPromises()
    await fill(wrapper, { name: '王五', company: '公'.repeat(101), content: '咨询' })
    await submit(wrapper)

    expect(submitInquiry).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('公司名不超过 100')
  })

  it('预算与公司在画廊演示壳里也不请求词表', async () => {
    mountBlock({}, demoShell())
    await flushPromises()

    expect(fetchInquiryBudgets).not.toHaveBeenCalled()
  })
})
