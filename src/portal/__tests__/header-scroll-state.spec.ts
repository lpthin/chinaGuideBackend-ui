import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import SiteHeaderBlock from '../blocks/SiteHeaderBlock.vue'
import type { PortalSiteShell } from '../api/portalPublic'

/**
 * 页头的滚动态（`pb-header--scrolled`）。
 *
 * <p>这一档存在的理由很具体：那个类在模板第 2 行绑了一年多，仓库里却没有一条对应规则——
 * 「有绑定的类」在模板里看得见、在样式里看不见，正是最容易被当成已完成的那类死钩子：
 * 组件测试会绿（类确实换上了），访客却什么也感觉不到。</p>
 *
 * <p>所以这里两头都钉：
 * 1. 样式那一头——`portal-blocks.less` 里必须有一条选择器包含这个类、并且带真实声明的规则
 *    （CSS 不是组件实例，happy-dom 也不会把 @import 进来的样式表算进 computed style，
 *    所以这里直接读那两个源文件：这是能真的证明「钩子不是死的」的地方）；
 * 2. 行为那一头——滚过 24px 才加类、回到顶上就撤（滚动监听沿用组件里那一条 passive 的，
 *    不为此加 rAF，也不断任何过渡动画的完成）。</p>
 */

/**
 * 从仓库根读那两个源文件（vitest 的 root 就是仓库根）。
 *
 * 为什么不用 vite 的 `?raw` 导入：CSS 插件会先把 `.less?raw` 接单过去，测试里拿到的是空串
 * （2026-09-28 实测：`?raw` 与 `?inline` 在这套 vitest 配置下对 .less 都回空串；`.vue` 那份拿得到，
 * 但两份证据不该用两套读法）。空串在这条用例里判红是好事（规则找不到），
 * 但拿一份读不到的文件当证据就不是了——所以读不到就明说。
 * 这三个环境声明（node:fs / node:path / process 的最小口子）在 `src/vite-env.d.ts` 里，
 * 这份仓库的 tsconfig 没挂 @types/node：不为一个源码扫描用例去动全局类型或新增依赖。
 */
function sourceOf(relative: string): string {
  try {
    return readFileSync(join(process.cwd(), relative), 'utf8')
  } catch {
    throw new Error(`源文件读不到（${relative}）：这一档是照源码断言的，文件挪了就把这里一起改掉`)
  }
}

const SHEET = sourceOf('src/portal/blocks/portal-blocks.less')
const COMPONENT = sourceOf('src/portal/blocks/SiteHeaderBlock.vue')

/** 取某条规则的规则体（本仓库的 less 里这几条都是单层嵌套，够用） */
function ruleBodyOf(selector: string): string | null {
  const start = SHEET.indexOf(selector)
  if (start < 0) {
    return null
  }
  const open = SHEET.indexOf('{', start)
  const close = open < 0 ? -1 : SHEET.indexOf('}', open)
  return close < 0 ? null : SHEET.slice(open + 1, close)
}

const SHELL = {
  siteId: 1,
  siteName: '示例站点',
  siteCode: 'acme',
  baseUrl: null,
  company: { name: '示例公司', logo: null, description: null, copyright: null, phone: null, email: null, address: null },
  seo: null,
  nav: [{ title: '关于我们', url: '/about', articleCount: 1 }]
} as unknown as PortalSiteShell

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true })
  window.dispatchEvent(new Event('scroll'))
}

async function scrollTo(value: number) {
  setScrollY(value)
  // 类是 ref 驱动的，换 ref 之后要等一次渲染才落到 DOM 上（这里不等任何过渡/动画，只等这一帧渲染）
  await nextTick()
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
  wrapper = mount(SiteHeaderBlock, { props: { blockProps: {}, shell: SHELL } })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  setScrollY(0)
})

describe('滚动态的类不是死钩子', () => {
  it('portal-blocks.less 里有一条真带声明的 .pb-header--scrolled 规则', () => {
    const body = ruleBodyOf('.pb-header--scrolled')
    expect(body, '样式里必须有 .pb-header--scrolled 这一条：类绑了而没人接就是死钩子').not.toBeNull()
    // 三条都得有实际声明：收紧高度、实心底、一条投影（只写个空规则同样是假的）
    expect(body).toContain('--pb-header-bar-height')
    expect(body).toContain('--pb-header-bg')
    expect(body).toContain('box-shadow')
    expect(body).not.toMatch(/--pb-header-bar-height:\s*68px/)
  })

  it('组件那边交出的是带默认值的变量口子：静态外观不靠这条规则也照样成立', () => {
    // 56px 这个收紧值只出现在滚动态那一侧，68px 只出现在组件的默认值里：没有第二份数字
    expect(COMPONENT).toContain('var(--pb-header-bar-height, 68px)')
    expect(COMPONENT).toContain('var(--pb-header-bg, rgba(255, 255, 255, 0.92))')
  })
})

describe('类的切换照的是真滚动', () => {
  it('滚过 24px 才加类，回到顶上就撤', async () => {
    const header = wrapper!.find('header')
    expect(header.classes()).not.toContain('pb-header--scrolled')

    await scrollTo(25)
    expect(wrapper!.find('header').classes()).toContain('pb-header--scrolled')

    await scrollTo(0)
    expect(wrapper!.find('header').classes()).not.toContain('pb-header--scrolled')
  })

  it('24px 以内算「还在顶上」：不许一点抖动就换态', async () => {
    await scrollTo(24)
    expect(wrapper!.find('header').classes()).not.toContain('pb-header--scrolled')
  })
})
