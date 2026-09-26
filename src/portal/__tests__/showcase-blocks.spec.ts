import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import faqSource from '../blocks/FaqAccordionBlock.vue?raw'
import TestimonialCardsBlock from '../blocks/TestimonialCardsBlock.vue'
import MilestoneTimelineBlock from '../blocks/MilestoneTimelineBlock.vue'
import AwardGridBlock from '../blocks/AwardGridBlock.vue'
import FaqAccordionBlock from '../blocks/FaqAccordionBlock.vue'
import MapBlock from '../blocks/MapBlock.vue'
import type { BlockProps } from '../blocks/types'
import type { PortalSiteShell } from '../api/portalPublic'

/**
 * 五个「后端已登记、前端刚补上」的区块渲染器（Spec-D D2）。
 *
 * 每条都对着本期要止的血写：
 * ① items 为空（或有 heading 但没条目）⇒ 整块一个节点都不留——访客看到空白格，
 *    和管理端以为「区块渲染成功了」是两种永远不会对上账的错；
 * ② 缺哪个字段少哪一行，头像/证书图缺了不留灰块；
 * ③ 折叠必须是真 button + aria-expanded，动画必须能被 prefers-reduced-motion 关掉。
 */

const shell = { siteId: 1, siteName: '示例', siteCode: 'acme', baseUrl: null } as unknown as PortalSiteShell

function mountBlock(component: new () => unknown, blockProps: BlockProps) {
  return mount(component as Parameters<typeof mount>[0], { props: { blockProps, shell } })
}

describe('testimonial-cards 客户评价', () => {
  it('条目为空：整块不渲染，heading 也不独自留在页面上', () => {
    const wrapper = mountBlock(TestimonialCardsBlock, { heading: '客户怎么说', items: [] })
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('items 槽没数据（undefined）同样整块不渲染', () => {
    const wrapper = mountBlock(TestimonialCardsBlock, { heading: '客户怎么说' })
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('评价、姓名、身份各按各的键渲染；缺头像就不出 img，不留灰圆', () => {
    const wrapper = mountBlock(TestimonialCardsBlock, {
      heading: '客户怎么说',
      items: [{ name: '张三', role: '采购负责人', quote: '交付比说得快。' }]
    })
    expect(wrapper.find('.pb-testimonial__quote').text()).toBe('交付比说得快。')
    expect(wrapper.find('.pb-testimonial__name').text()).toBe('张三')
    expect(wrapper.find('.pb-testimonial__role').text()).toBe('采购负责人')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('全空的条目被丢掉而不是撑出空气泡', () => {
    const wrapper = mountBlock(TestimonialCardsBlock, {
      items: [{ name: '张三', quote: '靠谱' }, { note: '渲染器不认的键' }]
    })
    expect(wrapper.findAll('.pb-testimonial')).toHaveLength(1)
  })

  it('limit 截断显示条数（1..24 的白名单槽位由渲染器执行）', () => {
    const items = [1, 2, 3].map(index => ({ name: `客户${index}`, quote: `评价${index}` }))
    const wrapper = mountBlock(TestimonialCardsBlock, { items, limit: 2 })
    expect(wrapper.findAll('.pb-testimonial')).toHaveLength(2)
  })
})

describe('milestone-timeline 发展时间线', () => {
  it('条目为空：整块不渲染', () => {
    const wrapper = mountBlock(MilestoneTimelineBlock, { heading: '发展历程', items: [] })
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('缺 date 的条目仍然显示事件本身，年份不逼走里程碑', () => {
    const wrapper = mountBlock(MilestoneTimelineBlock, {
      items: [{ title: '拿到甲级资质', description: '同年团队翻倍。' }, { date: '2020', title: '成立' }]
    })
    const items = wrapper.findAll('.pb-timeline__item')
    expect(items).toHaveLength(2)
    expect(items[0].find('.pb-timeline__date').exists()).toBe(false)
    expect(items[0].find('.pb-timeline__title').text()).toBe('拿到甲级资质')
    expect(items[1].find('.pb-timeline__date').text()).toBe('2020')
  })

  it('三样全空的条目丢掉，一条不剩就整块不渲染', () => {
    const wrapper = mountBlock(MilestoneTimelineBlock, { items: [{}, { remark: '键不在契约里' }] })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})

describe('award-grid 资质荣誉', () => {
  it('条目为空：整块不渲染', () => {
    const wrapper = mountBlock(AwardGridBlock, { heading: '资质荣誉', items: [] })
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('缺证书图不出 img；有 url 时整卡走统一外链出口（target=_blank + noopener）', () => {
    const wrapper = mountBlock(AwardGridBlock, {
      heading: '资质荣誉',
      columns: 2,
      items: [
        { name: 'ISO 9001', issuer: '认证机构', description: '2024 年续证。', url: 'https://cert.example.com/iso' },
        { name: '高新技术企业' }
      ]
    })
    expect(wrapper.find('.pb-grid').classes()).toContain('pb-grid--2')
    const links = wrapper.findAll('a.pb-award')
    expect(links).toHaveLength(1)
    expect(links[0].attributes('href')).toBe('https://cert.example.com/iso')
    expect(links[0].attributes('target')).toBe('_blank')
    expect(links[0].attributes('rel')).toBe('noopener')
    expect(wrapper.findAll('.pb-award')).toHaveLength(2)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('既没名称又没图的条目不留空格子', () => {
    const wrapper = mountBlock(AwardGridBlock, { items: [{ issuer: '只填了颁发方' }] })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})

describe('faq-accordion 常见问题', () => {
  it('条目为空：整块不渲染', () => {
    const wrapper = mountBlock(FaqAccordionBlock, { heading: '常见问题', items: [] })
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('折叠触发器是真 button 且带 aria-expanded，点击后展开面板', async () => {
    const wrapper = mountBlock(FaqAccordionBlock, {
      items: [
        { question: '怎么开始？', answer: '先留个联系方式。' },
        { question: '周期多久？', answer: '两周。' }
      ]
    })
    const trigger = wrapper.find('button.pb-faq__trigger')
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.pb-faq__panel')[0].classes()).toContain('pb-faq__panel--open')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('只有问题没有答案：退化成静态一行，不摆点开了里面空着的假按钮', () => {
    const wrapper = mountBlock(FaqAccordionBlock, {
      items: [{ question: '只有问题' }, { answer: '只有答案' }]
    })
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.find('.pb-faq__question--static').text()).toBe('只有问题')
  })

  it('展开动画必须写 prefers-reduced-motion 关闭（?raw 读组件源码钉住）', () => {
    expect(faqSource).toContain('prefers-reduced-motion: reduce')
    expect(faqSource).toContain('transition: none')
  })
})

describe('map-block 门店', () => {
  it('条目为空：整块不渲染', () => {
    const wrapper = mountBlock(MapBlock, { heading: '门店地址', items: [] })
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('没有经纬度也显示地址与电话，跳转退化成按地址搜索', () => {
    const wrapper = mountBlock(MapBlock, {
      items: [{ name: '演示门店', address: '演示路 1 号', phone: '400-000-0000' }]
    })
    expect(wrapper.find('.pb-map__name').text()).toBe('演示门店')
    expect(wrapper.find('.pb-map__address').text()).toBe('演示路 1 号')
    expect(wrapper.find('.pb-map__phone').text()).toBe('400-000-0000')
    const link = wrapper.find('a.pb-map__link')
    expect(link.attributes('href')).toContain('https://uri.amap.com/search?keyword=')
    expect(link.attributes('href')).toContain(encodeURIComponent('演示路 1 号'))
    expect(link.attributes('target')).toBe('_blank')
  })

  it('有合法经纬度时跳落点标记，position 是经度在前', () => {
    const wrapper = mountBlock(MapBlock, {
      items: [{ name: '有坐标的门店', address: '演示路 2 号', latitude: 31.2, longitude: 121.4 }]
    })
    expect(wrapper.find('a.pb-map__link').attributes('href'))
      .toBe('https://uri.amap.com/marker?position=121.4,31.2&name=' + encodeURIComponent('有坐标的门店'))
  })

  it('超出量程或读不懂的坐标按「没有坐标」处理，绝不拼出假落点', () => {
    const wrapper = mountBlock(MapBlock, {
      items: [
        { name: '纬度爆表', address: '演示路 3 号', latitude: 95, longitude: 10 },
        { name: '乱码坐标', address: '演示路 4 号', latitude: 'abc' }
      ]
    })
    const hrefs = wrapper.findAll('a.pb-map__link').map(a => a.attributes('href'))
    expect(hrefs.every(href => href?.startsWith('https://uri.amap.com/search'))).toBe(true)
  })

  it('不引地图 SDK：没有 iframe、没有 script，只有随组件一起打包的静态示意块', () => {
    const wrapper = mountBlock(MapBlock, { items: [{ address: '演示路 1 号' }] })
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('.pb-map__canvas').exists()).toBe(true)
  })

  it('名称、地址、电话全空的条目丢掉，一条不剩就整块不渲染', () => {
    const wrapper = mountBlock(MapBlock, { items: [{ latitude: 30, longitude: 120 }] })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
