import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { useSlots } from 'vue'
import RecordListPage from '../RecordListPage.vue'

/**
 * 列表页模板 `RecordListPage` 自己那五件事（Spec-Q §4.1 A/B 型，P1 第一次落地，P2 补 section 形）。
 *
 * 这一档不测页面自己的数据，只钉模板这一层的契约——因为 P1+P2 那七页共用它，契约一旦破了是七屏一起坏，
 * 而页面自己的用例看不出来（它们各自只念自己那一句）：
 *
 * 1. 页面交给表格的插槽（`bodyCell` 这类）必须原样透传到 `a-table`，模板不能把它吃掉；
 *    反过来，模板消费掉的五个名字不许当成表格插槽往下传，否则筛选栏那一坨会被塞进表格里。
 * 2. 读失败时整张表退场，只说失败：不能同屏出现「读取失败」和「这一档没有」。
 * 3. 读数那一行（`countLine`）由页面拼好原样念，模板不加工、不加量词。
 * 4. 分页不由模板摆：不传 `footer` 就没有分页，页面自己摆的才摆。
 *    这一组四个读口里两个分页、两个一次全回，翻页方式写死进模板会替后端决定它没决定的事。
 * 5. 空态那颗新建按钮把 `create` 一路发回页面（事件名写成工厂函数会静默失效，界面照样渲得出来）。
 */

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    pagination: { default: undefined }
  },
  template: `
    <div class="table-stub" :data-pagination="String(pagination)" :data-slots="slotNames">
      <div v-if="!dataSource.length" class="empty-slot"><slot name="emptyText" /></div>
      <div v-for="record in dataSource" :key="record.id" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`,
  setup() {
    // 把「表格这一层到底收到了哪几个插槽名」读成可断言的字符串：
    // 模板吃掉的名字不该出现在这里，出现就说明筛选栏那一坨被塞进了表格。
    const slots = useSlots()
    return { slotNames: Object.keys(slots).sort().join(',') }
  }
}

// 真 a-button：空态那颗要能点，且只发一次 create
const BUTTON = {
  name: 'AButton',
  emits: ['click'],
  template: '<button class="btn-stub" @click="$emit(\'click\')"><slot /></button>'
}

const PASS_THROUGH = (name: string, extraSlots: string[] = []) => ({
  name,
  template: `<div class="${name}-stub">${
    extraSlots.includes('title') ? '<slot name="title" />' : ''
  }<slot /></div>`
})

/** 卡头那句话在模板里是 `:title=` 这个 prop（不是 `#title` 槽），桩要按 prop 渲才量得到 */
const CARD_STUB = {
  name: 'ACard',
  props: ['title', 'bordered'],
  template: '<div class="a-card-stub"><span class="a-card-stub__title">{{ title }}</span><slot /></div>'
}

const mountPage = (props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) =>
  mount(RecordListPage, {
    props,
    slots,
    global: {
      stubs: {
        'a-card': CARD_STUB,
        'a-table': TABLE_STUB,
        'a-button': BUTTON,
        'a-space': PASS_THROUGH('a-space'),
        'a-select': PASS_THROUGH('a-select'),
        'a-alert': PASS_THROUGH('a-alert')
      }
    }
  } as any)

const COLUMNS = [
  { key: 'name', title: '名称' },
  { key: 'actions', title: '操作' }
]

describe('RecordListPage 的插槽分账', () => {
  it('页面给的 bodyCell 原样进表格，逐行按列渲出来', () => {
    const w = mountPage(
      { columns: COLUMNS, rows: [{ id: 1, name: '第一家' }] },
      {
        bodyCell: `<template #bodyCell="{ column, record }">
          <span v-if="column.key === 'name'">{{ record.name }}</span>
          <span v-else class="ops">编辑</span>
        </template>`
      }
    )
    expect(w.findAll('.row')).toHaveLength(1)
    expect(w.text()).toContain('第一家')
    // 两列各走一次 bodyCell：操作列那颗也在
    expect(w.findAll('.ops')).toHaveLength(1)
    // bodyCell 真的以「表格插槽」的身份进了 a-table，不是被模板自己渲了一遍
    expect(w.find('.table-stub').attributes('data-slots')).toBe('bodyCell,emptyText')
  })

  it('模板消费掉的五个名字不往下传给表格，各回各的位置', () => {
    const w = mountPage(
      { description: '这一页是干什么的', columns: COLUMNS, rows: [{ id: 1 }] },
      {
        filters: '<span class="in-filters">状态筛选</span>',
        actions: '<span class="in-actions">新建一条</span>',
        above: '<span class="in-above">三格读数</span>',
        notice: '<span class="in-notice">一条提醒</span>',
        footer: '<span class="in-footer">翻到第 2 页</span>'
      }
    )
    // 五个名字各自在模板那一层落地（看不见的透传等于没接上）
    expect(w.find('.in-filters').exists()).toBe(true)
    expect(w.find('.in-actions').exists()).toBe(true)
    expect(w.find('.in-above').exists()).toBe(true)
    expect(w.find('.in-notice').exists()).toBe(true)
    expect(w.find('.record-list-page__footer .in-footer').exists()).toBe(true)
    // 这一条才是「分账」本身：表格只收到 emptyText，模板消费的五个名字一个都没漏下去
    expect(w.find('.table-stub').attributes('data-slots')).toBe('emptyText')
  })

  /**
   * P1 之后 `extra` 挂了四批、0 个消费者（六页的主按钮全在 `#actions`）。
   * 留着它等于留一条「页头右侧还能摆东西」的假路：下一位照它写，就会长出第二种「主按钮摆哪儿」。
   * 这一条钉的是这条路真的走不通：传进来不会渲在页头上（名字落到表格那一层，表格也没有叫 extra 的格子）。
   */
  it('extra 槽已经摘掉：传进来不渲在页头上', () => {
    const w = mountPage(
      { description: '这一页是干什么的', columns: COLUMNS, rows: [{ id: 1 }] },
      { extra: '<span class="in-extra">页头右侧那颗</span>' }
    )
    expect(w.find('.page-title__extra').exists()).toBe(false)
    expect(w.find('.in-extra').exists()).toBe(false)
  })
})

/**
 * P2 补的两格（读者互动那一屏四块、站内信那张公告表之外还有一块）。
 *
 * 立 `section` 的理由是实测：这两屏上面已经各有一个页头，模板再摆一个就是同一屏两个同名大标题。
 * 但「不再摆页头」只能解释少一块，不能顺手解释别的——读数、筛选靠左动作靠右、三态在 section 形里
 * 一格都不许变，所以下面三条是照着这个写的。
 */
describe('RecordListPage 的 section 形（一屏不止一张卡）', () => {
  it('section：模板不摆页头，卡头念的是这一块的名字', () => {
    const w = mountPage(
      { description: '这一页是干什么的', section: true, cardTitle: '待审评论', columns: COLUMNS, rows: [{ id: 1 }] },
      { actions: '<span class="in-actions">刷新</span>' }
    )
    expect(w.find('.page-title').exists()).toBe(false)
    expect(w.find('.a-card-stub__title').text()).toBe('待审评论')
    // 壳没因为「这次是卡里的一块」就少一件事：动作还在筛选栏右侧那一头
    expect(w.find('.in-actions').exists()).toBe(true)
  })

  it('不传 section（默认）：页头照摆，且卡头不自己造一个名字', () => {
    const w = mountPage({ description: '这一页是干什么的', columns: COLUMNS, rows: [{ id: 1 }] })
    expect(w.find('.page-title').exists()).toBe(true)
    expect(w.find('.page-title__desc').text()).toBe('这一页是干什么的')
    // cardTitle 交空串时 a-card 收到的是 undefined：留一个空字符串等于摆一条没人要的分割线
    expect(w.find('.a-card-stub__title').text()).toBe('')
  })

  it('section 形里读数、空态、错误块三件事一件不少', () => {
    const w = mountPage({
      section: true,
      cardTitle: '示例评论的排产计划',
      countLine: '等我处理：待审 2 条。',
      emptyLine: '示例评论的排产计划：这一档查过了，一条都没有。',
      emptyReason: 'NONE',
      columns: COLUMNS,
      rows: []
    })
    expect(w.find('.record-list-page__count').text()).toBe('等我处理：待审 2 条。')
    expect(w.find('.empty-line').text()).toBe('示例评论的排产计划：这一档查过了，一条都没有。')

    const broken = mountPage({ section: true, readFailed: '读口断了', columns: COLUMNS, rows: [] })
    expect(broken.find('.admin-state-block').attributes('data-state')).toBe('error')
    expect(broken.find('.table-stub').exists()).toBe(false)
  })
})

describe('RecordListPage 的三态分账', () => {
  it('读失败：走错误块，整张表退场，不再念「这一档没有」那句', () => {
    const w = mountPage({
      readFailed: '读口断了',
      columns: COLUMNS,
      rows: [],
      ownLine: '还没有录过门店：点「新增门店」把第一家实体网点填进来'
    })
    expect(w.find('.admin-state-block').attributes('data-state')).toBe('error')
    expect(w.text()).toContain('读口断了')
    expect(w.text()).not.toContain('还没有录过门店')
    expect(w.find('.table-stub').exists()).toBe(false)
  })

  it('后端答了成因时逐字念那句，模板不加工', () => {
    const line = '横幅：这一档查过了，一条都没有。'
    const w = mountPage({ emptyLine: line, emptyReason: 'NONE', columns: COLUMNS, rows: [] })
    expect(w.find('.empty-line').text()).toBe(line)
  })

  it('读数一行由页面拼好，模板只负责摆在表上方', () => {
    const w = mountPage({ countLine: '共 3 家；其中 1 家不在门户上', columns: COLUMNS, rows: [{ id: 1 }] })
    expect(w.find('.record-list-page__count').text()).toBe('共 3 家；其中 1 家不在门户上')
  })

  it('读失败时页面把读数交空串就是不摆这一行（模板不自己补一个 0）', () => {
    const w = mountPage({ countLine: '', readFailed: '读口断了', columns: COLUMNS, rows: [] })
    expect(w.find('.record-list-page__count').exists()).toBe(false)
    expect(w.text()).not.toContain('共 0')
  })
})

describe('RecordListPage 不管分页，也不吞掉新建事件', () => {
  it('不传 footer 就没有分页：模板把 pagination 关死交给表，翻页由页面自己摆', () => {
    const w = mountPage({ columns: COLUMNS, rows: [{ id: 1 }] })
    expect(w.find('.record-list-page__footer').exists()).toBe(false)
    // 交给 a-table 的 pagination 是 false（不是 DataTable 默认那套 20/页），
    // 否则同一页会出现两套翻页：模板一套、页面 footer 一套
    expect(w.find('.table-stub').attributes('data-pagination')).toBe('false')
  })

  it('空态那颗新建按钮把 create 发回页面，只发一次', async () => {
    const w = mountPage(
      { emptyLine: '这一档查过了，一条都没有。', emptyReason: 'NONE', canCreate: true, createLabel: '新增门店', columns: COLUMNS, rows: [] },
      {}
    )
    const btn = w.find('.empty-line .btn-stub')
    expect(btn.text()).toBe('新增门店')
    await btn.trigger('click')
    expect(w.emitted('create')).toHaveLength(1)
  })
})
