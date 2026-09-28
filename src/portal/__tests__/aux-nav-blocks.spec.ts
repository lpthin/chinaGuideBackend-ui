import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Component } from 'vue'
import BreadcrumbBlock from '../blocks/BreadcrumbBlock.vue'
import RelatedContentBlock from '../blocks/RelatedContentBlock.vue'
import UtilityBarBlock from '../blocks/UtilityBarBlock.vue'
import type { BlockProps } from '../blocks/types'
import type { PortalSiteShell } from '../api/portalPublic'

/**
 * Spec-E #100 那三类补上的区块（页眉辅助条 / 面包屑 / 相关推荐）在渲染侧的三条纪律。
 *
 * 这三块的共同点是「内容都不是租户写的」：面包屑来自导航算出来的位置，辅助条那排链接来自已登记的
 * 站内路径，相关推荐的每一行都是门户聚合里的真条目。所以断言全部围绕一件事——
 * 没有值时整块消失，而不是留一条空带子或一句占位话。
 * 页首那几行尤其要紧：空着的地方用户会以为页面坏了，摆着的地方用户会以为站点真有那一栏。
 */

const shell = { siteId: 12, siteName: '示例', siteCode: 'acme', baseUrl: null } as unknown as PortalSiteShell

/**
 * setup.ts 把 router-link 糊成了空壳 stub，slot 里的文字读不到；
 * 这三块的断言看的正是「哪一格是可点链接、哪一格不是」，必须换成渲染 slot 的桩。
 */
function mountBlock(component: Component, blockProps: BlockProps = {}) {
  return mount(component, {
    props: { blockProps, shell },
    global: { stubs: { 'router-link': { template: '<a><slot /></a>' } } }
  })
}

describe('面包屑：只照后端给的那条路径抄', () => {
  const trail = [
    { title: '首页', url: '/' },
    { title: '犬科疾病', url: '/news?category=dog' }
  ]

  it('父级是可点的，末位是本页所以不给链接（并把 aria-current 挂上）', () => {
    const wrapper = mountBlock(BreadcrumbBlock, { items: trail })
    const links = wrapper.findAll('.pb-breadcrumb__link')
    expect(links).toHaveLength(1)
    expect(links[0].text()).toBe('首页')
    const current = wrapper.find('.pb-breadcrumb__current')
    expect(current.text()).toBe('犬科疾病')
    expect(current.attributes('aria-current')).toBe('page')
  })

  it('只有一格时那一格就是本页，不渲成链接', () => {
    const wrapper = mountBlock(BreadcrumbBlock, { items: [{ title: '犬科疾病', url: '/news?category=dog' }] })
    expect(wrapper.find('.pb-breadcrumb__link').exists()).toBe(false)
    expect(wrapper.find('.pb-breadcrumb__current').text()).toBe('犬科疾病')
  })

  it('items 缺失或为空 ⇒ 整个 nav 都不出，组件不自己按地址猜父级', () => {
    // 猜法是这一块存在的反面：可见的那条与首包 JSON-LD 那条分家，只有拿真机比爬虫读到的那一份才发现
    expect(mountBlock(BreadcrumbBlock, {}).find('nav').exists()).toBe(false)
    expect(mountBlock(BreadcrumbBlock, { items: [] }).find('nav').exists()).toBe(false)
    expect(mountBlock(BreadcrumbBlock, { items: [{ url: '/x' }] }).find('nav').exists()).toBe(false)
  })

  it('标题取 title，name 也算（与其余列表块同一套字段顺序）', () => {
    const wrapper = mountBlock(BreadcrumbBlock, { items: [{ name: '关于我们', url: '/about' }] })
    expect(wrapper.text()).toBe('关于我们')
  })
})

describe('页眉辅助条：一句说明 + 一排站内链接', () => {
  // 链接那一格的槽名后端定死叫 items：AI 造的页上兜底绑法写的就是 items，这边读错名字等于那一排永远取到空
  it('两格都有值时都渲出来，链接走站内路径', () => {
    const wrapper = mountBlock(UtilityBarBlock, {
      text: '工作日 9:00–18:00 急诊 24 小时',
      items: [{ title: '联系我们', url: '/contact' }, { title: '服务网点', url: '/stores' }]
    })
    expect(wrapper.find('.pb-utility__text').text()).toBe('工作日 9:00–18:00 急诊 24 小时')
    expect(wrapper.findAll('.pb-utility__link').map(node => node.text())).toEqual(['联系我们', '服务网点'])
  })

  it('只有一句说明也渲，不因没有链接就整块消失', () => {
    const wrapper = mountBlock(UtilityBarBlock, { text: '全国连锁 · 24 小时急诊' })
    expect(wrapper.text()).toBe('全国连锁 · 24 小时急诊')
    expect(wrapper.find('.pb-utility__links').exists()).toBe(false)
  })

  it('两格都空 ⇒ 一个节点都不留，不留一条只有底色的空带子', () => {
    expect(mountBlock(UtilityBarBlock, {}).find('.pb-utility').exists()).toBe(false)
    expect(mountBlock(UtilityBarBlock, { text: '   ', items: [] }).find('.pb-utility').exists()).toBe(false)
    // 链接条目缺标题的不占位：一排里的空格子读起来像「这里本来有个链接坏了」
    expect(mountBlock(UtilityBarBlock, { items: [{ url: '/contact' }] }).find('.pb-utility').exists()).toBe(false)
  })
})

describe('相关推荐：只有标题链接的一排', () => {
  it('渲出标题与可点的行，来源字段两套键都认', () => {
    const wrapper = mountBlock(RelatedContentBlock, {
      heading: '相关阅读',
      items: [
        { title: '细小病毒的居家护理', link: '/news/1', category: '犬科疾病' },
        { name: '绝育手术套餐', url: '/services/2' }
      ]
    })
    expect(wrapper.find('.pb-section-title').text()).toBe('相关阅读')
    const rows = wrapper.findAll('.pb-related__title')
    expect(rows.map(node => node.text())).toEqual(['细小病毒的居家护理', '绝育手术套餐'])
    expect(wrapper.findAll('.pb-related__row')).toHaveLength(2)
    expect(wrapper.find('.pb-related__meta').text()).toBe('犬科疾病')
  })

  it('一条都没有 ⇒ 整块不渲，包括只有标题的那半', () => {
    // 页尾一段只有标题没有内容是「这块坏了」而不是「这一栏有内容」，所以标题也一起收起
    expect(mountBlock(RelatedContentBlock, { heading: '相关阅读' }).find('.pb-section').exists()).toBe(false)
    expect(mountBlock(RelatedContentBlock, { items: [{ summary: '没有标题的一行' }] }).find('.pb-section').exists()).toBe(false)
  })
})
