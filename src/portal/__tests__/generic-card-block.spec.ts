import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GenericCardBlock from '../blocks/GenericCardBlock.vue'
import type { BlockProps } from '../blocks/types'
import type { PortalSiteShell } from '../api/portalPublic'

/**
 * 通用卡片（rendererKey=genericCard，Spec-M §8 第 3 步）。
 *
 * 这一支是「界面手工新增那一族」唯一可用的渲染器，所以它判的重心不是排版好看，而是三条边界：
 * ① 只认文档里写明的这套槽位，props 里多出来的键（哪怕长得像图、像按钮、像背景）一律不读——
 *   人工组件的 schema 是人在界面上定的，渲染层偷偷认字段等于让「存得进去的键」和「画得出来的键」变成两套真相；
 * ② 全是文本插值：门户是免鉴权公开页，数据由 AI 或租户填，出现 v-html 就等于把渲染权交给数据；
 * ③ 不带标题、说明、图的条目不留空卡，三格皆空时整块一个字都不摆。
 */

const shell = { siteId: 1, siteName: '示例', siteCode: 'acme', baseUrl: null } as unknown as PortalSiteShell

function mountCard(blockProps: BlockProps) {
  return mount(GenericCardBlock, {
    props: { blockProps, shell },
    // setup.ts 把 router-link 糊成了空壳 stub，而卡片正文在 slot 里：换成渲染 slot 的桩，断言才读得到真实 DOM
    global: { stubs: { 'router-link': { template: '<a><slot /></a>' } } }
  })
}

describe('通用卡片 genericCard', () => {
  it('标题、正文、卡片各就各位，卡片取 title/summary/image/link', () => {
    const wrapper = mountCard({
      heading: '合作伙伴',
      text: '我们与二十八家机构长期合作。',
      columns: 3,
      items: [
        { title: '华东物流', summary: '干线与仓配一体', image: '/api/media/1/logo.png', link: '/p/partners' },
        { title: '南方检测', summary: '出具第三方报告' }
      ]
    })

    expect(wrapper.find('.pb-section-title').text()).toBe('合作伙伴')
    expect(wrapper.find('.pb-generic__body').text()).toBe('我们与二十八家机构长期合作。')
    const cards = wrapper.findAll('.pb-generic')
    expect(cards).toHaveLength(2)
    expect(cards[0].find('.pb-generic__title').text()).toBe('华东物流')
    expect(cards[0].find('.pb-generic__summary').text()).toBe('干线与仓配一体')
    expect(cards[0].find('img').attributes('src')).toBe('/api/media/1/logo.png')
    expect(cards[1].find('img').exists()).toBe(false)
    expect(cards[1].find('.pb-generic__summary').text()).toBe('出具第三方报告')
  })

  it('条目字段名按既有区块那套别名认：name 当标题，description 或 text 当说明', () => {
    const wrapper = mountCard({
      items: [
        { name: '质量部', description: '按 GB/T 19001 运行' },
        { name: '研发部', text: '六条产品线' },
        { title: '海外部', imageUrl: '/api/media/1/overseas.png', url: '/p/overseas' }
      ]
    })

    const cards = wrapper.findAll('.pb-generic')
    expect(cards.map(card => card.find('.pb-generic__title').text())).toEqual(['质量部', '研发部', '海外部'])
    expect(cards[1].find('.pb-generic__summary').text()).toBe('六条产品线')
    expect(cards[2].find('img').attributes('src')).toBe('/api/media/1/overseas.png')
    // 卡片本身就是那个 <a>（PortalBlockLink 把 class 摊到根节点），所以判根标签而不是往里找
    expect(cards[2].element.tagName).toBe('A')
    expect(cards[0].element.tagName).toBe('DIV')
  })

  it('只有条目时也渲染：这一族存在的意义就是「没有专属设计也要摆得下」', () => {
    const wrapper = mountCard({ items: [{ title: '只有卡片' }] })

    expect(wrapper.find('.pb-section').exists()).toBe(true)
    expect(wrapper.find('.pb-section-title').exists()).toBe(false)
    expect(wrapper.find('.pb-generic__body').exists()).toBe(false)
  })

  it('三格都空时整块不渲染，连标题都没有就摆不出「组件已就绪」', () => {
    expect(mountCard({}).find('.pb-section').exists()).toBe(false)
    expect(mountCard({ heading: '   ', text: '', items: [] }).find('.pb-section').exists()).toBe(false)
  })

  it('什么都不带的条目丢掉，不给访客一张空卡', () => {
    const wrapper = mountCard({
      heading: '合作伙伴',
      items: [{ link: '/p/a' }, { note: '这一条没有标题说明和图' }, { title: '有名字的才留下' }]
    })

    const cards = wrapper.findAll('.pb-generic')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toBe('有名字的才留下')
  })

  /**
   * 断言的形状要说清楚：这里判的不是「html 字符串里没有 onerror 这几个字」——
   * 转义后的文本本来就带着它，那样断言只会红。判的是**没有被解析成真的元素或事件属性**：
   * 标题那格的 DOM 文本等于原字符串，页面上不存在 script/svg/b 节点，img 也只有一张且没有 on* 属性。
   */
  it('props 里写 HTML 也只当字面量打出来，不产生脚本元素或事件属性', () => {
    const wrapper = mountCard({
      heading: '<img src=x onerror=alert(1)>',
      text: '<script>alert(2)</script>',
      items: [{ title: '<b>粗体</b>', summary: '<svg onload=alert(3)>', image: 'x.png" onerror="alert(4)' }]
    })

    expect(wrapper.find('.pb-section-title').text()).toBe('<img src=x onerror=alert(1)>')
    expect(wrapper.find('.pb-generic__title').text()).toBe('<b>粗体</b>')
    expect(wrapper.find('.pb-generic__summary').text()).toBe('<svg onload=alert(3)>')
    expect(wrapper.findAll('script')).toHaveLength(0)
    expect(wrapper.findAll('svg')).toHaveLength(0)
    expect(wrapper.findAll('b')).toHaveLength(0)
    // 唯一那张图是条目自己带的封面，它的 src 是那串坏值本身，而不是被拆出来的第二个属性
    const images = wrapper.findAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].attributes('src')).toBe('x.png" onerror="alert(4)')
    expect(images[0].attributes('onerror')).toBeUndefined()
    wrapper.findAll('*').forEach(node => {
      Object.keys(node.attributes()).forEach(name => {
        expect(name, `出现了事件属性 ${name}`).not.toMatch(/^on/i)
      })
    })
  })

  it('危险协议与协议相对路径不成链接，卡片退化成 div 而不是假链接', () => {
    const wrapper = mountCard({
      items: [
        { title: '甲', link: 'javascript:alert(1)' },
        { title: '乙', link: 'https://example.com/partner' },
        { title: '丙', link: '//evil.example.com/x' }
      ]
    })

    const cards = wrapper.findAll('.pb-generic')
    expect(cards[0].element.tagName).toBe('DIV')
    expect(cards[2].element.tagName).toBe('DIV')
    expect(wrapper.html()).not.toContain('javascript:')
    expect(wrapper.html()).not.toContain('//evil.example.com')
    expect(cards[1].element.tagName).toBe('A')
    expect(cards[1].attributes('href')).toBe('https://example.com/partner')
    expect(cards[1].attributes('rel')).toBe('noopener')
  })

  it('列数走类名而不是行内 style，非法列数落回 3 列', () => {
    expect(mountCard({ items: [{ title: 'A' }], columns: 4 }).find('.pb-grid').classes()).toContain('pb-grid--4')
    expect(mountCard({ items: [{ title: 'A' }], columns: 7 }).find('.pb-grid').classes()).toContain('pb-grid--3')
    expect(mountCard({ items: [{ title: 'A' }] }).find('.pb-grid').attributes('style')).toBeUndefined()
  })

  it('文档没写的槽位不认：背景、按钮、原始 HTML 都不许从 props 里长出来', () => {
    const wrapper = mountCard({
      heading: '合作伙伴',
      backgroundHtml: '<div class="pb-injected">注入</div>',
      primaryText: '立即咨询',
      primaryLink: '/contact',
      html: '<p>原始段落</p>',
      items: [{ title: 'A', buttonText: '点我', buttonLink: '/x' }]
    })

    expect(wrapper.html()).not.toContain('pb-injected')
    expect(wrapper.html()).not.toContain('注入')
    expect(wrapper.html()).not.toContain('立即咨询')
    expect(wrapper.html()).not.toContain('原始段落')
    expect(wrapper.html()).not.toContain('点我')
    expect(wrapper.findAll('a')).toHaveLength(0)
  })

  it('items 不是数组时按没有条目处理，不把字符串或对象当条目遍历', () => {
    expect(mountCard({ heading: '标题', items: '合作机构' }).find('.pb-generic').exists()).toBe(false)
    expect(mountCard({ heading: '标题', items: { title: '单对象' } }).find('.pb-generic').exists()).toBe(false)
    expect(mountCard({ heading: '标题', items: null }).find('.pb-section').exists()).toBe(true)
  })

  it('绑定没解析出值（后端取不到数据留 null）不占位、不打字', () => {
    const wrapper = mountCard({ heading: { $data: 'partners' }, text: null, items: [{ title: null, summary: 42 }] })

    // heading 是对象不是字符串：text() 认不出来，等于这一格没有
    expect(wrapper.find('.pb-section-title').exists()).toBe(false)
    // 数字照常念出来（field() 的既有约定），但只有数字的条目不会变成一张带图的卡
    expect(wrapper.find('.pb-generic').text()).toBe('42')
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
