import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HeroBlock from '../blocks/HeroBlock.vue'
import StatsBandBlock from '../blocks/StatsBandBlock.vue'
import type { PortalSiteShell } from '../api/portalPublic'
// ?raw：vite/client 已声明该通配模块。读组件源文件是为了钉住「写过的样式守卫没被顺手删掉」——
// jsdom 不算 CSS，动效类规则在挂载里永远是绿的，只能对着源文件断言。
import heroSource from '../blocks/HeroBlock.vue?raw'
import caseGridSource from '../blocks/CaseGridBlock.vue?raw'

/**
 * Spec-D D2 门户动效：全屏 hero、文字入场、stats-band 数字滚动、案例卡图片缩放。
 *
 * 动效分两类断言，各有挂处：
 * 1. 行为类（数字滚动、reduced-motion、observer 生命周期）——挂真实 DOM：
 *    本仓库测试 setup.ts 给 IntersectionObserver 装了一个「什么都不做」的全局 mock，
 *    直接用它，断言会永远绿在「没进视口」上。所以这里换成可控的假实现（记录回调、手动触发、
 *    记录 disconnect），并在用例里显式 stub，不依赖全局那层糊。
 * 2. 纯 CSS 类（100svh、prefers-reduced-motion 整段关闭、hover 能力探测）——读源文件断言规则在场。
 */

const realShell = { siteId: 12, siteName: '示例', siteCode: 'acme', baseUrl: null } as unknown as PortalSiteShell

// ---------- 可控 IntersectionObserver ----------

class ControllableIO {
  static instances: ControllableIO[] = []
  readonly calls: IntersectionObserverCallback
  observed: Element[] = []
  disconnected = false

  constructor(cb: IntersectionObserverCallback) {
    this.calls = cb
    ControllableIO.instances.push(this)
  }

  observe(el: Element) {
    this.observed.push(el)
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true
  }

  /** 模拟进视口：测试里唯一的「进入视口」入口 */
  enterViewport() {
    this.calls([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }

  /** 模拟可见但没进视口（滚到附近）：不该触发任何滚动 */
  stayOutside() {
    this.calls([{ isIntersecting: false } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

function stubMotionApis(reduced = false) {
  ControllableIO.instances = []
  vi.stubGlobal('IntersectionObserver', ControllableIO)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  }))
}

beforeEach(() => {
  vi.useFakeTimers()
  stubMotionApis(false)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** fake timers 下 flush 微任务队列，让 onMounted 里的同步逻辑落定 */
async function flushAndRun() {
  await vi.advanceTimersByTimeAsync(0)
}

// ---------- hero 全屏槽与文字入场 ----------

describe('hero 全屏槽（blockProps.fullScreen）', () => {
  const copy = { title: '让中国之行一次就顺', subtitle: '签证、支付、路线，一次讲清' }

  function mountHero(blockProps: Record<string, unknown>) {
    return mount(HeroBlock, { props: { blockProps, shell: realShell } })
  }

  it('fullScreen 为真时挂上整屏档类名', () => {
    const wrapper = mountHero({ ...copy, fullScreen: true })
    expect(wrapper.find('section').classes()).toContain('pb-hero--full')
  })

  it('默认关：没填、填了字符串都不算开（dataSchema 是布尔槽）', () => {
    expect(mountHero({ ...copy }).find('section').classes()).not.toContain('pb-hero--full')
    expect(mountHero({ ...copy, fullScreen: 'true' }).find('section').classes()).not.toContain('pb-hero--full')
  })

  it('整屏高度用 100svh（100vh 兜旧浏览器），入场动画有 reduced-motion 整段关闭', () => {
    // 移动端地址栏会把 100vh 算错，svh 是按最小视口的诚实高度
    expect(heroSource).toMatch(/min-height:\s*100vh;\s*\n\s*min-height:\s*100svh;/)
    expect(heroSource).toMatch(/@keyframes pb-hero-rise/)
    expect(heroSource).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none;/)
  })
})

// ---------- stats-band 数字滚动 ----------

function mountStats(items: unknown[]) {
  return mount(StatsBandBlock, { props: { blockProps: { heading: '数字说话', items }, shell: realShell } })
}

describe('stats-band count-up', () => {
  it('数字为 0 或没填 ⇒ 不摆这个数字，剩下的照常出', async () => {
    const wrapper = mountStats([
      { value: '1200', label: '服务客户' },
      { value: '0', label: '不该出现的零' },
      { value: '', label: '没填的' },
      { label: '只有名字没有数' },
      { value: '优质', label: '纯文字照旧摆' }
    ])
    await flushAndRun()

    const labels = wrapper.findAll('.pb-stats__label').map(node => node.text())
    expect(labels).toEqual(['服务客户', '纯文字照旧摆'])
    expect(wrapper.text()).not.toContain('不该出现的零')
    expect(wrapper.text()).not.toContain('没填的')
    expect(wrapper.text()).not.toContain('只有名字没有数')
  })

  it('整排数字都是 0 ⇒ 整块不渲染，不摆一排空圈', async () => {
    const wrapper = mountStats([{ value: '0', label: '凑数一' }, { value: '0', label: '凑数二' }])
    await flushAndRun()
    expect(wrapper.find('.pb-stats').exists()).toBe(false)
  })

  it('没进视口时不出现滚动值：真实 DOM 里数值位是空的', async () => {
    const wrapper = mountStats([{ value: '1200', label: '服务客户' }])
    await flushAndRun()

    expect(ControllableIO.instances).toHaveLength(1)
    expect(ControllableIO.instances[0].observed).toHaveLength(1)
    expect(wrapper.find('.pb-stats__value').text()).toBe('')

    ControllableIO.instances[0].stayOutside()
    await flushAndRun()
    expect(wrapper.find('.pb-stats__value').text()).toBe('')
  })

  it('进视口后数字滚动到终值：中途可见中间值，落定就是数据本身', async () => {
    const wrapper = mountStats([{ value: '1200', label: '服务客户' }, { value: '3.2亿', label: '年营收' }])
    await flushAndRun()

    ControllableIO.instances[0].enterViewport()
    vi.advanceTimersByTime(450)
    await flushAndRun()
    const mid = wrapper.find('.pb-stats__value').text()
    expect(mid).not.toBe('')
    expect(mid).not.toBe('1200')

    vi.advanceTimersByTime(600)
    await flushAndRun()
    const finals = wrapper.findAll('.pb-stats__value').map(node => node.text())
    expect(finals).toEqual(['1200', '3.2亿'])
  })

  it('reduced-motion 下直接显示终值不滚动，而且连观察器都不建', async () => {
    stubMotionApis(true)
    const wrapper = mountStats([{ value: '1200', label: '服务客户' }])
    await flushAndRun()

    expect(wrapper.find('.pb-stats__value').text()).toBe('1200')
    expect(ControllableIO.instances).toHaveLength(0)
  })

  it('卸载必须 disconnect：画廊切页反复挂载，漏一次就是观察器越积越多', async () => {
    const wrapper = mountStats([{ value: '1200', label: '服务客户' }])
    await flushAndRun()
    const instance = ControllableIO.instances[0]

    wrapper.unmount()
    expect(instance.disconnected).toBe(true)
  })

  it('滚完一次就断开：回访视口不该把数字再摇一遍', async () => {
    const wrapper = mountStats([{ value: '1200', label: '服务客户' }])
    await flushAndRun()
    const instance = ControllableIO.instances[0]

    instance.enterViewport()
    vi.advanceTimersByTime(1000)
    await flushAndRun()
    expect(instance.disconnected).toBe(true)

    instance.enterViewport()
    vi.advanceTimersByTime(1000)
    await flushAndRun()
    expect(wrapper.find('.pb-stats__value').text()).toBe('1200')
  })
})

// ---------- 案例卡图片缩放 ----------

describe('案例卡图片 zoom 的样式守卫', () => {
  it('缩放走 transform+transition，hover 只在真有 hover 能力的设备上生效，键盘可达也给缩放', () => {
    expect(caseGridSource).toMatch(/transition:\s*transform/)
    // 触屏没有 hover：不加 @media (hover: hover) 守卫，上次点过的卡片会残留放大态
    expect(caseGridSource).toMatch(/@media \(hover: hover\)/)
    expect(caseGridSource).toMatch(/&:focus-visible \.pb-cover/)
  })

  it('reduced-motion 的访客不该被缩放动画追着跑', () => {
    expect(caseGridSource).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition:\s*none;/)
  })
})
