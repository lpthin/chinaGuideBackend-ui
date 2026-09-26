import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HeroBlock from '../blocks/HeroBlock.vue'
import type { BlockProps } from '../blocks/types'
import type { PortalSiteShell } from '../api/portalPublic'

/**
 * hero 的那格图槽（Spec-C §6.5-5）。
 *
 * 加这张图之前，全站除了页头 logo 没有任何能填图的槽——"给主视觉配一张 AI 生成的图"这句话
 * 在渲染层无处落笔，所以候选站配图这条链路的最后一公里其实是不通的。这一档钉住四件事：
 * 1. 有合法图就出底图那一层，没有就一个节点都不留（不留破图、不留灰块）；
 * 2. 认不下的值一律当没有图：这格最后要拼进 CSS 的 url("...")，放行一个带引号/括号的字符串
 *    等于让填图的人往样式里追加声明；
 * 3. 只有一张图、零文案时整块仍然不渲染——缺文案该由"这块没出来"暴露，而不是渲染一张孤图；
 * 4. 底图不带 alt：它是文字之下的装饰，意义由同一块的标题承担（后端 schema 因此只给 imageUrl 一个槽）。
 */

const shell = { siteId: 1, siteName: '示例', siteCode: 'acme', baseUrl: null } as unknown as PortalSiteShell

function mountHero(blockProps: BlockProps) {
  return mount(HeroBlock, { props: { blockProps, shell } })
}

const copy = {
  title: '让中国之行一次就顺',
  subtitle: '签证、支付、路线，一次讲清',
  description: '给第一次来华的人'
}

describe('hero 主视觉图槽', () => {
  it('https 绝对地址：出底图一层，样式按 url("...") 拼', () => {
    const wrapper = mountHero({ ...copy, imageUrl: 'https://cdn.example.com/hero.png' })
    const photo = wrapper.find('.pb-hero__photo')

    expect(photo.exists()).toBe(true)
    expect(photo.attributes('style')).toContain('url("https://cdn.example.com/hero.png")')
    expect(photo.attributes('aria-hidden')).toBeUndefined()
  })

  it('站内相对路径同样放行（素材库的公开地址就是相对路径）', () => {
    const wrapper = mountHero({ ...copy, imageUrl: '/uploads/media/2026/09/hero.png' })

    expect(wrapper.find('.pb-hero__photo').attributes('style')).toContain('/uploads/media/2026/09/hero.png')
  })

  it('没有这一格时一个节点都不留，渐变照旧', () => {
    const wrapper = mountHero({ ...copy })

    expect(wrapper.find('.pb-hero__photo').exists()).toBe(false)
    expect(wrapper.find('.pb-hero').exists()).toBe(true)
  })

  it.each([
    ['http 明文', 'http://cdn.example.com/hero.png'],
    ['javascript 伪协议', 'javascript:alert(1)'],
    ['想逃出 url() 的引号', '/a.png"), color: red, background-image: url("'],
    ['带空格的值', '/a b.png'],
    ['带括号的值', '/a(1).png'],
    ['data: 内联图', 'data:image/svg+xml,<svg onload=alert(1)>']
  ])('认不下的值当作没有图，宁可不显示：%s', (_label, value) => {
    const wrapper = mountHero({ ...copy, imageUrl: value })

    expect(wrapper.find('.pb-hero__photo').exists()).toBe(false)
    // 图不合法不能顺手把整块弄没：文案还在，主视觉就还是主视觉
    expect(wrapper.find('.pb-hero__title').text()).toBe(copy.title)
  })

  it('只有一张图、零文案：整块仍然不渲染，不留一张孤图', () => {
    const wrapper = mountHero({ imageUrl: 'https://cdn.example.com/hero.png' })

    expect(wrapper.find('.pb-hero').exists()).toBe(false)
  })

  it('底图是装饰：不生成 img 元素，也不带 alt', () => {
    const wrapper = mountHero({ ...copy, imageUrl: 'https://cdn.example.com/hero.png' })

    expect(wrapper.find('img').exists()).toBe(false)
  })
})
