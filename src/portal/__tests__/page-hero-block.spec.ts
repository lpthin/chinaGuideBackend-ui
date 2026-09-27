import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHeroBlock from '../blocks/PageHeroBlock.vue'
import type { BlockProps } from '../blocks/types'
import type { PortalSiteShell } from '../api/portalPublic'

/**
 * 内页标题条（Spec-E T6）。
 *
 * 这一整块存在的理由是「它不是主视觉」：模板站每个内页首屏都是一条窄横幅加标题副标题
 * （实测 180–260px、无图、无按钮），而我们的 hero 是 520px 起、能配图、带 CTA 的一屏。
 * 所以这一档判的重心不是「它能不能画好看」，而是它没有变成第二条 hero 的那几条路：
 * 图槽、按钮槽、以及「整块空着也要占两百像素」。
 */

const shell = { siteId: 1, siteName: '示例', siteCode: 'acme', baseUrl: null } as unknown as PortalSiteShell

function mountHero(blockProps: BlockProps) {
  return mount(PageHeroBlock, { props: { blockProps, shell } })
}

describe('内页标题条', () => {
  it('标题与副标题各就各位，标题是页面那一个 h1', () => {
    const wrapper = mountHero({ title: '服务项目', subtitle: '门诊、疫苗与影像，一次看全' })

    expect(wrapper.find('h1').text()).toBe('服务项目')
    expect(wrapper.find('.pb-page-hero__subtitle').text()).toBe('门诊、疫苗与影像，一次看全')
  })

  it('只有标题时也渲染：内页不该因为没人写副标题就没有页首', () => {
    const wrapper = mountHero({ title: '关于我们' })

    expect(wrapper.find('.pb-page-hero').exists()).toBe(true)
    expect(wrapper.find('.pb-page-hero__subtitle').exists()).toBe(false)
  })

  it('两格都空时整块不渲染，不留一条只有底色的空带子', () => {
    expect(mountHero({}).find('.pb-page-hero').exists()).toBe(false)
    expect(mountHero({ title: '   ', subtitle: '' }).find('.pb-page-hero').exists()).toBe(false)
  })

  /**
   * 后端 dataSchema 只给了两个文字槽（additionalProperties:false 会把多写的判非法），
   * 但渲染层也不许偷偷去读：读了就是「props 里有就会长出一张图」，那条路一旦通，
   * 每个内页首屏都可能长半屏海报——那正是 §5 第一行写明的版面事故。
   */
  it('图与按钮就算被塞进 props 也不认', () => {
    const wrapper = mountHero({
      title: '联系我们',
      imageUrl: '/uploads/media/2026/09/x.png',
      primaryText: '立即预约',
      primaryLink: '/appointment',
      fullScreen: true
    })

    expect(wrapper.html()).not.toContain('uploads/media')
    expect(wrapper.html()).not.toContain('立即预约')
    expect(wrapper.html()).not.toContain('href="/appointment"')
    expect(wrapper.find('.pb-page-hero').classes()).not.toContain('pb-page-hero--full')
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })

  /** 没解析的绑定（后端取不到数据时留 null / 原样对象）当没有这一格，而不是打出 {"$data":"…"} */
  it('绑定没解析出值时按空处理', () => {
    const wrapper = mountHero({ title: { $data: 'siteName' }, subtitle: null })

    expect(wrapper.find('.pb-page-hero').exists()).toBe(false)
  })
})
