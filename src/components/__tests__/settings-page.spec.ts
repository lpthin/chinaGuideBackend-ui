import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import SettingsPage from '../SettingsPage.vue'
import { settingsAnchorId, settingsProgress, type SettingsGroup } from '../settingsPageModel'

/**
 * C 型「设置表单」页模板 `SettingsPage` 自己的契约（Spec-Q §4.1 C 型，P3 第一次落地）。
 *
 * 用它的是企业信息、站点设置两页。这一档不测那两页的数据，只钉模板这一层——
 * 因为这两屏的完成度读数和三态全靠模板兑现，页面自己看不出来：
 *
 * 1. 锚点那一排和卡片是同一份 id：点了必须真跳得到，改了组名不会两边对不上。
 * 2. 完成度读数只念页面声明的那几格：分母是声明数，不是抄来的好看数；
 *    一格字段都没声明的组（只读表那种）不许摆「已填 0 / 共 0 项」，那是谎报。
 * 3. 「必填还没填」和「还差几项」是两句话：可填可不填的格子不许混进前者。
 * 4. 三态各说各的，且互斥：读失败时整组卡退场（一份没读回来的空表摆着还能点保存，
 *    就是拿空表单去覆盖客户填过的东西），未取到说的是另一件事。
 * 5. 页头只摆一次动作：保存那颗在 `#actions` 里，模板不许在卡头再摆一颗。
 * 6. 两栏开关关掉时，带 `side` 的那一组仍要在主列里出现（否则少一组卡）。
 */

const CARD_STUB = {
  name: 'ACard',
  props: ['title', 'bordered'],
  template: '<div class="a-card-stub"><slot name="title" /><slot /></div>'
}

const ALERT_STUB = {
  name: 'AAlert',
  props: ['message', 'type'],
  template: '<div class="alert-stub" :data-type="type">{{ message }}</div>'
}

const BUTTON_STUB = {
  name: 'AButton',
  template: '<button class="btn-stub"><slot /></button>'
}

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /><slot name="extra" /></div>`
})

const GLOBALS = {
  stubs: {
    'a-card': CARD_STUB,
    'a-alert': ALERT_STUB,
    'a-button': BUTTON_STUB,
    'a-spin': PASS_THROUGH('a-spin'),
    'a-space': PASS_THROUGH('a-space')
  }
}

const GROUPS: SettingsGroup[] = [
  {
    key: 'basic',
    label: '基础信息',
    fields: [
      { key: 'name', label: '公司名称', done: true, required: true },
      { key: 'city', label: '所在城市', done: false },
      { key: 'phone', label: '联系电话', done: false }
    ]
  },
  {
    key: 'brand',
    label: '品牌标识',
    side: true,
    fields: [{ key: 'logo', label: '公司Logo', done: false }]
  },
  { key: 'mirror', label: '逐页镜像' }
]

function mountPage(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  return mount(SettingsPage, {
    props: { groups: GROUPS, ...props },
    slots: { basic: '<span class="in-basic">表单</span>', retry: '<button class="btn-stub retry-stub">重新读取</button>', ...slots },
    global: GLOBALS,
    attachTo: document.body
  } as any)
}

/** 每次跳转记录被滚到的那个元素，用来判「点的是哪一组、跳到的是哪一张卡」 */
let scrolled: Element[] = []

beforeEach(() => {
  scrolled = []
  // happy-dom 的 Element 上没有 scrollIntoView，模板里的 typeof 守卫会直接跳过，
  // 于是「点了跳不跳得到」这一条量不到；补一个可记录的桩，测完再撤。
  ;(Element.prototype as any).scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this)
  })
})

afterEach(() => {
  document.body.innerHTML = ''
  delete (Element.prototype as any).scrollIntoView
})

describe('锚点那一排与卡片是同一份 id', () => {
  it('每一组一个锚点、href 与卡片 id 出自同一个函数', () => {
    const w = mountPage()
    const anchors = w.findAll('[data-anchor-group]')
    expect(anchors).toHaveLength(3)
    expect(anchors.map(a => a.attributes('href'))).toEqual(GROUPS.map(g => `#${settingsAnchorId(g.key)}`))
    for (const group of GROUPS) {
      const card = document.getElementById(settingsAnchorId(group.key))
      expect(card, `卡片 ${group.key} 没有挂在锚点指向的那个 id 上`).not.toBeNull()
    }
  })

  it('点了锚点真跳：滚到的正是这一组那张卡', async () => {
    const w = mountPage()
    await w.findAll('[data-anchor-group]')[1].trigger('click')
    await flushPromises()
    expect(scrolled).toHaveLength(1)
    expect(scrolled[0]).toBe(document.getElementById(settingsAnchorId('brand')))
  })

  it('有字段的那一组才报「齐几项」，只读那一组不摆 0/0', () => {
    const w = mountPage()
    const counts = w.findAll('.settings-page__anchor-count').map(n => n.text())
    expect(counts).toEqual(['1/3', '0/1'])
  })
})

describe('完成度读数只念页面声明的那几格', () => {
  it('分子分母来自声明清单，与纯函数那份账逐字相同', () => {
    const w = mountPage()
    expect(w.find('.settings-page__progress-num').text()).toBe('已填 1 / 共 4 项')
    expect(settingsProgress(GROUPS)).toMatchObject({ total: 4, filled: 1 })
  })

  it('必填没填时点名的只有必填那一格，且点了跳得到它那一组', async () => {
    const w = mountPage({
      groups: [{ key: 'basic', label: '基础信息', fields: [{ key: 'name', label: '公司名称', done: false, required: true }] }]
    })
    expect(w.find('.settings-page__required').text()).toContain('必填还没填')
    expect(w.findAll('.settings-page__required .settings-page__jump').map(n => n.text())).toEqual(['公司名称'])
    expect(w.find('[data-missing-toggle]').exists()).toBe(false)
    await w.find('[data-jump-group]').trigger('click')
    expect(scrolled).toHaveLength(1)
    expect(scrolled[0]).toBe(document.getElementById(settingsAnchorId('basic')))
  })

  it('没有必填缺口时改成「还差 N 项」，点了才摊开清单', async () => {
    const w = mountPage({
      groups: [{
        key: 'basic',
        label: '基础信息',
        fields: [
          { key: 'a', label: '第一格', done: true },
          { key: 'b', label: '第二格', done: false }
        ]
      }]
    })
    expect(w.find('.settings-page__required').exists()).toBe(false)
    expect(w.find('[data-missing-toggle]').text()).toBe('还差 1 项，点这里看')
    expect(w.find('.settings-page__missing').exists()).toBe(false)
    await w.find('[data-missing-toggle]').trigger('click')
    expect(w.find('.settings-page__missing').text()).toContain('第二格')
  })

  it('一格字段都没声明（只读表那种）时整排读数和缺口都不摆', () => {
    const w = mountPage({ groups: [{ key: 'mirror', label: '逐页镜像' }] })
    expect(w.find('.settings-page__bar').exists()).toBe(false)
    expect(w.find('.in-basic').exists()).toBe(false)
    expect(w.text()).toContain('逐页镜像')
  })

  it('progressWord 换掉读数前面那个词（AI 先填好的那一屏念「AI 已填」）', () => {
    const w = mountPage({ progressWord: 'AI 已填' })
    expect(w.find('.settings-page__progress-num').text()).toBe('AI 已填 1 / 共 4 项')
  })
})

describe('三态各说各的且互斥', () => {
  it('连请求都没发出去：页头说清为什么，卡还在（表单是空的，不是读失败）', () => {
    const w = mountPage({ notSent: '当前没有选定客户，这一屏不发请求。' })
    expect(w.find('.alert-stub').text()).toContain('当前没有选定客户')
    expect(w.find('.admin-state-block').exists()).toBe(false)
    expect(w.findAll('.a-card-stub')).toHaveLength(3)
  })

  it('读失败：整组卡退场，只说失败与重试，绝不同屏摆一份能点的空表', () => {
    const w = mountPage({ readFailed: '企业信息没读回来：网关超时', notSent: '' })
    expect(w.findAll('.a-card-stub')).toHaveLength(0)
    expect(w.find('.settings-page__bar').exists()).toBe(false)
    const block = w.find('.admin-state-block')
    expect(block.attributes('data-state')).toBe('error')
    expect(block.text()).toContain('企业信息没读回来：网关超时')
    expect(w.find('.retry-stub').text()).toBe('重新读取')
  })

  it('后端答了但这一屏没内容：说的是「未取到」，与读失败两件事', () => {
    const w = mountPage({ notRead: '这一发读回来了，但里面没有站点信息。' })
    expect(w.find('.a-card-stub').exists()).toBe(false)
    const block = w.find('.admin-state-block')
    expect(block.attributes('data-state')).toBe('not-measured')
    expect(block.text()).toContain('这一发读回来了，但里面没有站点信息。')
  })

  it('读失败盖过未取到：同一条读口两个说法不能都摆', () => {
    const w = mountPage({ readFailed: '读失败那句', notRead: '未取到那句' })
    const blocks = w.findAll('.admin-state-block')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].attributes('data-state')).toBe('error')
  })
})

describe('页头只摆一次动作，两栏折不折都齐组', () => {
  it('#actions 只出现在页头那一个位置', () => {
    const w = mountPage({}, { actions: '<button class="save-once">保存修改</button>' })
    expect(w.findAll('.page-title__extra')).toHaveLength(1)
    expect(w.findAll('.save-once')).toHaveLength(1)
    expect(w.find('.page-title__extra').find('.save-once').exists()).toBe(true)
  })

  it('两栏形：side 那一组在右列，顺序仍按数组', () => {
    const w = mountPage({ twoColumn: true })
    const main = w.find('.settings-page__main')
    const side = w.find('.settings-page__side')
    expect(main.findAll('.a-card-stub')).toHaveLength(2)
    expect(side.findAll('.a-card-stub')).toHaveLength(1)
    expect(side.text()).toContain('品牌标识')
  })

  it('单栏形：带 side 的那一组不许凭空消失', () => {
    const w = mountPage({ twoColumn: false })
    expect(w.find('.settings-page__side').exists()).toBe(false)
    expect(w.find('.settings-page__main').findAll('.a-card-stub')).toHaveLength(3)
    expect(w.text()).toContain('品牌标识')
  })

  it('note 摆在卡标题后面（站点状态那句中文留着这一格）', () => {
    const w = mountPage({ groups: [{ key: 'site', label: '澜山国际旅行社', note: '已上线', fields: [] }] })
    expect(w.find('.settings-page__card-note').text()).toBe('已上线')
  })
})
