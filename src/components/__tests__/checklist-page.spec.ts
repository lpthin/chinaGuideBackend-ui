import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ChecklistPage from '../ChecklistPage.vue'
import {
  CHECKLIST_LEVEL_COLOR,
  checklistAnchorId,
  checklistProgress,
  checklistProgressText,
  type ChecklistStep
} from '../checklistPageModel'

/**
 * D 型「检查清单」页模板 `ChecklistPage` 自己的契约（Spec-Q §4.1 D 型，P4 第一次落地）。
 *
 * 用它的是门户上线那一屏（按 Q7 已收成超管专用）。这一档不测那一屏的数据，只钉模板这一层：
 *
 * 1. 一步一张卡，序号与标题按数组顺序；卡头右上角那颗角标的颜色只来自 CHECKLIST_LEVEL_COLOR。
 * 2. 顶部读数只念页面声明的步数：分母是 steps.length，不是「当下渲出几张卡」。
 * 3. **「还差」与「还不知道」是两组话**：unknown（没取到数）算进「还差」就是替后端说一句它没说过的话，
 *    而改前那一屏的两个统计数恰恰停在「未取到」上、一个字下一步都不指。
 * 4. 锚点一排与卡的 id 同一份出处，点了真跳。
 * 5. 页头动作只摆一次（`#actions` → PageTitle 的 extra），卡头不许再摆一颗同名按钮。
 * 6. 转圈只有一颗 a-spin，跟着 loading。
 */

const STEPS: ChecklistStep[] = [
  { key: 'site', title: '站点与访问域名', level: 'ready', stateText: '已绑定域名' },
  { key: 'company', title: '企业信息', level: 'todo', stateText: '信息不完整', gap: '名称有了，但简介或联系方式还缺。' },
  { key: 'demo', title: '演示内容', level: 'blocked', stateText: '缺少站点', gap: '这一家还没有站点。' },
  { key: 'readers', title: '访客实际能看到的内容', level: 'unknown', stateText: '未取到', links: [{ label: '点页头的「刷新」重来一次' }] },
  { key: 'seo', title: '门户预览与 SEO / GEO 出口', level: 'ready', stateText: '四个出口已列出' },
]

const CARD_STUB = {
  name: 'ACard',
  props: ['title', 'bordered'],
  template: '<div class="a-card-stub"><slot name="title" /><slot name="extra" /><slot /></div>',
}

const TAG_STUB = {
  name: 'ATag',
  props: ['color'],
  template: '<span class="a-tag-stub" :data-color="color"><slot /></span>',
}

const ALERT_STUB = {
  name: 'AAlert',
  props: ['message', 'type'],
  template: '<div class="a-alert-stub" :data-type="type">{{ message }}<slot /></div>',
}

const BUTTON_STUB = { name: 'AButton', template: '<button class="a-button-stub"><slot /></button>' }

const SPIN_STUB = {
  name: 'ASpin',
  props: ['spinning'],
  template: '<div class="a-spin-stub" :data-spinning="String(spinning)"><slot /></div>',
}

function mountPage(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(ChecklistPage, {
    attachTo: document.body,
    props: { steps: STEPS, ...props },
    slots,
    global: {
      stubs: {
        'a-card': CARD_STUB,
        'a-tag': TAG_STUB,
        'a-alert': ALERT_STUB,
        'a-button': BUTTON_STUB,
        'a-spin': SPIN_STUB,
        'a-space': { name: 'ASpace', template: '<div class="a-space-stub"><slot /></div>' },
        // 桩件的键要写成模板里那个标签名（'router-link'），写组件名 'RouterLink' 覆盖不到
        // setup.ts 里那条 `'router-link': true`——实测渲出的是 `<router-link-stub to="[object Object]">`，
        // 那个 `[object Object]` 读不出路由名，等于钉不住「点了这一条真能到该去的那一页」
        'router-link': {
          name: 'RouterLink',
          props: ['to'],
          template: '<a class="router-link-stub" :data-route="to && to.name"><slot /></a>',
        },
      },
    },
  })
}

const scrolled: Element[] = []

beforeEach(() => {
  document.body.innerHTML = ''
  scrolled.length = 0
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    scrolled.push(this)
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('一步一张卡', () => {
  it('卡数就是声明的步数，顺序按数组顺序，序号从 1 起', () => {
    const wrapper = mountPage()
    const cards = wrapper.findAll('.a-card-stub')
    expect(cards).toHaveLength(STEPS.length)
    expect(cards.map(card => card.text())).toEqual([
      expect.stringContaining('1 站点与访问域名'),
      expect.stringContaining('2 企业信息'),
      expect.stringContaining('3 演示内容'),
      expect.stringContaining('4 访客实际能看到的内容'),
      expect.stringContaining('5 门户预览与 SEO / GEO 出口'),
    ])
  })

  it('角标那句中文原样念页面给的，颜色只来自档位映射表', () => {
    const wrapper = mountPage()
    const tags = wrapper.findAll('.a-tag-stub')
    expect(tags.map(tag => tag.text())).toEqual(STEPS.map(step => step.stateText))
    expect(tags.map(tag => tag.attributes('data-color'))).toEqual(
      STEPS.map(step => CHECKLIST_LEVEL_COLOR[step.level]),
    )
  })

  it('每一步的正文走与 key 同名的插槽：五步形状不同，模板不收成统一字段行', () => {
    const wrapper = mountPage({}, {
      site: '<p class="body-site">站点：萧山竟天口腔（ID 9）</p>',
      company: '<p class="body-company">企业名称：萧山竟天口腔</p>',
    })
    expect(wrapper.find('.body-site').exists()).toBe(true)
    expect(wrapper.find('.body-company').exists()).toBe(true)
    // 没给插槽的那一步不许凭空长出一段别人的内容
    const siteParent = wrapper.find('.body-site').element.parentElement
    expect(siteParent?.classList.contains('a-card-stub')).toBe(true)
    expect(siteParent?.getAttribute('data-checklist-step')).toBe('site')
  })

  it('「差什么」与「去哪儿补」各占一行，位置由模板统一给', () => {
    const wrapper = mountPage()
    const gaps = wrapper.findAll('.checklist-page__gap')
    expect(gaps).toHaveLength(2)
    expect(gaps.map(node => node.text())).toEqual([
      '名称有了，但简介或联系方式还缺。',
      '这一家还没有站点。',
    ])
    const links = wrapper.findAll('.checklist-page__links')
    expect(links).toHaveLength(1)
    expect(links[0].text()).toContain('去哪儿补：')
    expect(links[0].text()).toContain('点页头的「刷新」重来一次')
  })
})

describe('顶部读数只念声明过的步数', () => {
  it('「5 步里齐了 2 步」：分子只数 ready，分母是声明数', () => {
    const wrapper = mountPage()
    const progress = checklistProgress(STEPS)
    expect(progress).toEqual({
      total: 5,
      ready: 2,
      pending: [{ key: 'company', title: '企业信息' }, { key: 'demo', title: '演示内容' }],
      notMeasured: [{ key: 'readers', title: '访客实际能看到的内容' }],
    })
    expect(wrapper.find('[data-checklist-progress]').text()).toBe(checklistProgressText(progress))
    expect(wrapper.find('[data-checklist-progress]').text()).toBe('5 步里齐了 2 步')
  })

  it('「还差」只列 todo 与 blocked；unknown 单独一组并明说它不是「确实缺」', () => {
    const wrapper = mountPage()
    const pending = wrapper.find('[data-checklist-pending]')
    expect(pending.text()).toBe('还差：企业信息、演示内容')
    expect(pending.text()).not.toContain('访客实际能看到的内容')
    const unknown = wrapper.find('[data-checklist-unknown]')
    expect(unknown.text()).toContain('还不知道：访客实际能看到的内容')
    expect(unknown.text()).toContain('这几格是没取到数，不是「取到了、确实缺」')
  })

  it('五步全齐时那两句都不摆：读数不能长出一个「还差：（空）」', () => {
    const allReady = STEPS.map(step => ({ ...step, level: 'ready' as const, gap: undefined, links: undefined }))
    const wrapper = mountPage({ steps: allReady })
    expect(wrapper.find('[data-checklist-progress]').text()).toBe('5 步里齐了 5 步')
    expect(wrapper.find('[data-checklist-pending]').exists()).toBe(false)
    expect(wrapper.find('[data-checklist-unknown]').exists()).toBe(false)
  })

  it('空清单不读数：0 步里齐了 0 步这种句子是界面自己造的数', () => {
    const wrapper = mountPage({ steps: [] })
    expect(wrapper.find('[data-checklist-progress]').exists()).toBe(false)
    expect(wrapper.findAll('.a-card-stub')).toHaveLength(0)
  })
})

describe('锚点：一排 chip 就是那五步', () => {
  it('chip 的 href 与卡的 id 出自同一个函数', () => {
    const wrapper = mountPage()
    const chips = wrapper.findAll('[data-checklist-anchor]')
    expect(chips).toHaveLength(STEPS.length)
    chips.forEach((chip, index) => {
      expect(chip.attributes('href')).toBe(`#${checklistAnchorId(STEPS[index].key)}`)
      const card = wrapper.find(`#${checklistAnchorId(STEPS[index].key)}`)
      expect(card.exists()).toBe(true)
      expect(card.classes()).toContain('a-card-stub')
    })
  })

  it('点 chip 真的滚到那一步（scrollIntoView 落在同一张卡上）', async () => {
    const wrapper = mountPage()
    await wrapper.findAll('[data-checklist-anchor]')[3].trigger('click')
    expect(scrolled).toHaveLength(1)
    expect(scrolled[0].id).toBe(checklistAnchorId(STEPS[3].key))
  })
})

describe('页头与转圈各只有一处', () => {
  it('#actions 渲染进 PageTitle 的 extra，卡头不再摆第二颗同名按钮', () => {
    const wrapper = mountPage({}, { actions: '<button class="head-refresh">刷新</button>' })
    const head = wrapper.findAll('.head-refresh')
    expect(head).toHaveLength(1)
    expect(head[0].element.closest('.a-card-stub')).toBeNull()
    expect(head[0].element.closest('.page-title__extra')).not.toBeNull()
  })

  it('转圈只有一颗，跟着 loading', () => {
    const spinning = mountPage({ loading: true })
    const spins = spinning.findAll('.a-spin-stub')
    expect(spins).toHaveLength(1)
    expect(spins[0].attributes('data-spinning')).toBe('true')
    expect(mountPage({ loading: false }).find('.a-spin-stub').attributes('data-spinning')).toBe('false')
  })

  it('#notice 那一格给页面摆顶部说明，位置在读数上面（说明与读数不许互抢）', () => {
    const wrapper = mountPage({}, { notice: '<div class="top-notice">这一页只做一件事</div>' })
    expect(wrapper.findAll('.top-notice')).toHaveLength(1)
    expect(wrapper.find('.top-notice').element.compareDocumentPosition(wrapper.find('[data-checklist-progress]').element))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('「去哪儿补」给 to 走站内路由、给 href 走新窗口，两个都不给只念文字', () => {
    const withBoth = [
      { key: 'a', title: '站内', level: 'todo' as const, stateText: '未填写', links: [{ label: '去填写', to: { name: 'x' } }] },
      { key: 'b', title: '站外', level: 'todo' as const, stateText: '未填写', links: [{ label: '打开预览', href: 'https://p.example/' }] },
      { key: 'c', title: '只有话', level: 'unknown' as const, stateText: '未取到', links: [{ label: '点页头的「刷新」' }] },
    ]
    const wrapper = mountPage({ steps: withBoth })
    const routed = wrapper.findAll('.router-link-stub')
    expect(routed).toHaveLength(1)
    expect(routed[0].attributes('data-route')).toBe('x')
    const anchor = wrapper.findAll('.checklist-page__link').find(node => node.attributes('href') === 'https://p.example/')
    expect(anchor?.attributes('target')).toBe('_blank')
    expect(anchor?.attributes('rel')).toContain('noopener')
    expect(wrapper.findAll('.checklist-page__link-plain')).toHaveLength(1)
  })
})
