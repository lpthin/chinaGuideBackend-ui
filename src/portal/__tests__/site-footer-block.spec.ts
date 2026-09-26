import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SiteFooterBlock from '../blocks/SiteFooterBlock.vue'
import type { BlockProps } from '../blocks/types'
import type { PortalSiteShell } from '../api/portalPublic'

/**
 * 页脚那两行字（版权句 + ICP 备案号，D0 第 4 项）。
 *
 * 钉的是「访客看到的每一行都有真源」：
 * 1. 备案号自己一个元素——它是法定展示项，不是版权句的后半截；混在一行里，版权行哪天没数据不渲染，
 *    备案号就跟着消失，而它俩的来源本来就不是同一格；
 * 2. 没有值就一个节点都不留：备案号摆一句「暂无备案号」上去，是把「库里没填」演成站点的一条声明；
 * 3. 版权句的次序仍然只有两级：区块槽位（字面或 $data 绑定，服务端已解析）优先，壳里那份兜底。
 *    「租户填的文案赢过机械拼法」这半条在后端做完（V132 起 `PortalAggregationService` 把
 *    `copyright_text` 折进 `companyInfo.copyright`），浏览器收到的从来不是一个叫 `copyrightText` 的字段，
 *    这边再判一次就是第二份真相；
 * 4. 组件不自己拼「© 年份 + 公司名」：那种写法会在没填的站点上凭空生出一条看起来合法的版权句。
 */

function shell(overrides: Record<string, unknown> = {}): PortalSiteShell {
  return {
    siteId: 1,
    siteName: '示例站点',
    siteCode: 'acme',
    baseUrl: null,
    company: {
      name: '示例公司',
      logo: null,
      description: null,
      copyright: '© 2026 示例公司',
      phone: null,
      email: null,
      address: null
    },
    seo: null,
    nav: [],
    ...overrides
  } as unknown as PortalSiteShell
}

function mountFooter(blockProps: BlockProps = {}, shellValue: PortalSiteShell | null = shell()) {
  return mount(SiteFooterBlock, { props: { blockProps, shell: shellValue } })
}

describe('备案号那一行', () => {
  it('槽位里有值就渲成自己的一个元素，不并进版权句', () => {
    const wrapper = mountFooter({
      copyright: '© 示例科技保留所有权利',
      icpNumber: '京ICP备2026000000号-1'
    })
    const icp = wrapper.find('.pb-footer__icp')
    expect(icp.exists()).toBe(true)
    expect(icp.text()).toBe('京ICP备2026000000号-1')
    // 两行是两行：版权行里不该混进备案号
    expect(wrapper.find('.pb-footer__copy').text()).toBe('© 示例科技保留所有权利')
  })

  it('壳里带这一格时也认（后端把 companyInfo.icpNumber 放进壳就不用改组件）', () => {
    const wrapper = mountFooter({}, shell({
      company: { name: '示例公司', copyright: null, icpNumber: '浙ICP备2026000001号' }
    }))
    expect(wrapper.find('.pb-footer__icp').text()).toBe('浙ICP备2026000001号')
    expect(wrapper.find('.pb-footer__copy').exists()).toBe(false)
  })

  it('槽位与壳都没有：一个节点都不留，也不摆「暂无备案号」这种占位话', () => {
    const wrapper = mountFooter({}, shell({ company: { name: '示例公司', copyright: null } }))
    expect(wrapper.find('.pb-footer__icp').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('备案')
    expect(wrapper.text()).not.toContain('暂无')
  })

  it.each([
    ['空串', ''],
    ['只有空白', '   '],
    ['null', null],
    ['undefined', undefined]
  ])('备案号是 %s 时按「没填」处理', (_label, value) => {
    const wrapper = mountFooter({ icpNumber: value as unknown })
    expect(wrapper.find('.pb-footer__icp').exists()).toBe(false)
  })
})

describe('版权句的次序', () => {
  it('区块槽位那条赢过壳里那份', () => {
    const wrapper = mountFooter({ copyright: '© 某某集团版权所有' })
    expect(wrapper.find('.pb-footer__copy').text()).toBe('© 某某集团版权所有')
  })

  it('槽位没填时退回壳里那份（后端已经把租户填的文案与机械拼法在那一侧分好了）', () => {
    const wrapper = mountFooter({}, shell({ company: { name: '示例公司', copyright: '© 示例集团（自定义文案）' } }))
    expect(wrapper.find('.pb-footer__copy').text()).toBe('© 示例集团（自定义文案）')
  })

  it('两处都没有就不渲这一行，组件自己绝不拼一个年份出来', () => {
    const wrapper = mountFooter({}, shell({ company: { name: '示例公司', copyright: null } }))
    expect(wrapper.find('.pb-footer__copy').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/©/)
  })
})
