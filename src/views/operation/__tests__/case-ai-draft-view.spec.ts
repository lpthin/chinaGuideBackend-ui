import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { Button, Checkbox, Input } from 'ant-design-vue'
import CaseManageView from '../CaseManageView.vue'
import { customerCaseApi } from '../../../api/operation'
import { message, notification } from 'ant-design-vue'
import { useAuthStore } from '../../../stores/auth'

/**
 * 案例列表上「AI 起草」那一条路的界面纪律（任务 #29 / Spec §16.3 第 7 项，问题四）。
 *
 * 钉的是四件事，全部属于「花钱的按钮该长什么样」：
 * 1. 打开弹窗只取预估，一次都不起草——预估那一发后端也不调模型，两边合起来才是「先看价再动手」；
 * 2. 没勾确认时「确定」是禁用的，界面压根发不出 confirm:false 那一发；
 * 3. 真的起草时带 confirm:true，并且把「这一轮的额外要求」原样传过去；
 * 4. 门禁 4 的 warn 提示不许被吞：它不拦落地，但必须让人看见。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    notification: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/operation', () => ({
  customerCaseApi: {
    list: vi.fn(),
    statistics: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    batchDelete: vi.fn(),
    estimateAiDraft: vi.fn(),
    aiDraft: vi.fn()
  }
}))

const DRAFT_TITLE = '让 AI 重写这一条案例'

/**
 * 后端 M-P37 拍板 1 把这五张口（新建/编辑/删除/批量删除/AI 起草）挂在 operation:case:manage 上，
 * 起草那一发会真的花租户的钱，所以它跟增删改同档，不跟「查看」同档。
 * 这一串用例走的是有码的人，所以两码都给；缺码那一档由下面那组用例单独钉。
 */
const CASE_CODES = ['operation:case:view', 'operation:case:manage']

/** 只渲染「开着的那一扇」，并把 ok 事件与 okButtonProps.disabled 如实接出来 */
const MODAL_STUB = defineComponent({
  name: 'AModal',
  props: ['open', 'title', 'confirmLoading', 'okButtonProps'],
  emits: ['update:open', 'ok', 'cancel'],
  setup(props: any, { slots, emit }: any) {
    return () =>
      props.open
        ? h('div', { class: 'modal-stub', 'data-title': props.title }, [
            slots.default ? slots.default() : null,
            h(
              'button',
              {
                class: 'modal-ok',
                disabled: props.okButtonProps?.disabled === true,
                onClick: () => emit('ok')
              },
              '确 定'
            )
          ])
        : null
  }
})

/** 行内按钮长在 bodyCell 插槽里：按 dataSource 逐行走一遍，判断与按钮仍是视图自己的代码 */
const TABLE_STUB = defineComponent({
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    pagination: { type: Object, default: null }
  },
  setup(props: any, { slots }: any) {
    return () =>
      h(
        'div',
        { class: 'table-stub' },
        [
          ...props.dataSource.flatMap((record: any) =>
            props.columns.map((column: any) =>
              column.key === 'actions' && slots.bodyCell ? slots.bodyCell({ column, record }) : null
            )
          ),
          // 翻页那条腿真组件里是分页器给的，桩件摆一颗替它点一下：筛选用例要先让人站到第 2 页上
          props.pagination?.onChange
            ? h(
                'button',
                { class: 'stub-page-2', onClick: () => props.pagination.onChange(2, props.pagination.pageSize) },
                '翻到第 2 页'
              )
            : null
        ]
      )
  }
})

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'placeholder', 'value'],
  template: `<div class="${name}-stub"><slot /><slot name="message" /></div>`
})

/** 预估那一句话（消耗 / 剩余 / 开关提示）是从 message 与 description 两个 prop 来的，桩件必须把它渲出来 */
const ALERT_STUB = {
  name: 'AAlert',
  props: ['type', 'message', 'description'],
  template: '<div class="AAlert-stub">{{ message }} {{ description }}<slot /></div>'
}

const CASE = {
  id: 65,
  tenantId: 15,
  customerName: '一位缺牙客户',
  customerLogo: '',
  industry: 'health',
  title: '种植修复案例',
  summary: '一位客户的种植经过',
  content: '<p>旧稿</p>',
  coverImage: '',
  tags: '种植,修复',
  viewCount: 3,
  sort: 0,
  status: 'PUBLISHED',
  seoTitle: null,
  seoDescription: null,
  seoKeywords: null,
  schemaJson: null,
  createdAt: '2026-09-20T09:00:00',
  updatedAt: '2026-09-20T09:00:00'
}

function estimate(overrides: Record<string, unknown> = {}) {
  return {
    caseId: 65,
    estimatedTokens: 3_900,
    remainingTokens: 20_000,
    aiDraftEnabled: true,
    notice: null,
    ...overrides
  }
}

async function mountView(permissions: string[] = CASE_CODES) {
  const auth = useAuthStore()
  auth.user = { id: 1, username: 'tester', roles: ['SITE_ADMIN'], permissions } as any
  const wrapper = mount(CaseManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-checkbox': Checkbox,
        'a-input': Input,
        'a-textarea': Input.TextArea,
        'a-table': TABLE_STUB,
        'a-modal': MODAL_STUB,
        'a-tag': PASS_THROUGH('ATag'),
        'a-alert': ALERT_STUB,
        'a-space': PASS_THROUGH('ASpace'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-select': PASS_THROUGH('ASelect'),
        // a-card 沿用 setup.ts 的空壳等于把表格整个删掉，行内按钮就全没了
        'a-card': { ...PASS_THROUGH('ACard'), template: '<div class="ACard-stub"><slot name="title" /><slot /></div>' },
        'a-select-option': PASS_THROUGH('ASelectOption'),
        'a-input-search': PASS_THROUGH('AInputSearch'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
        'a-input-number': PASS_THROUGH('AInputNumber'),
        MediaImagePicker: PASS_THROUGH('MediaImagePicker')
      }
    }
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

function draftButtons(wrapper: any) {
  return wrapper.findAll('button').filter((node: any) => node.text().trim() === 'AI 起草')
}

/** 只看这一个组件实例里的弹窗：attachTo document.body 会把上一个用例的 DOM 留在原地 */
function draftModal(wrapper: any) {
  const modals = wrapper
    .findAll('.modal-stub')
    .filter((node: any) => node.attributes('data-title') === DRAFT_TITLE)
  return modals.length ? modals[modals.length - 1] : null
}

function confirmBox(wrapper: any) {
  const box = wrapper.findAllComponents(Checkbox).find((node: any) =>
    (node.text() || '').includes('我确认消耗')
  )
  expect(box, '弹窗里应有那一个确认勾选').toBeTruthy()
  return box
}

async function openDraftModal(wrapper: any) {
  await draftButtons(wrapper)[0].trigger('click')
  await flushPromises()
  return draftModal(wrapper)
}

describe('CaseManageView 的 AI 起草', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(customerCaseApi.list).mockResolvedValue({ records: [CASE], total: 1, page: 1, size: 10 } as any)
    vi.mocked(customerCaseApi.statistics).mockResolvedValue({
      total: 1,
      published: 1,
      draft: 0,
      totalViews: 3,
      industryCount: 1
    } as any)
    vi.mocked(customerCaseApi.estimateAiDraft).mockResolvedValue(estimate() as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('打开弹窗只取预估，一次都不起草', async () => {
    const wrapper = await mountView()

    const modal = await openDraftModal(wrapper)

    expect(customerCaseApi.estimateAiDraft).toHaveBeenCalledWith(65)
    expect(customerCaseApi.aiDraft).not.toHaveBeenCalled()
    expect(modal.text()).toContain('预计 3900 token')
    expect(modal.text()).toContain('剩余配额 20000 token')
  })

  it('没勾确认时确定按钮是禁用的', async () => {
    const wrapper = await mountView()
    const modal = await openDraftModal(wrapper)

    expect(modal.get('.modal-ok').attributes('disabled')).toBeDefined()

    confirmBox(wrapper).vm.$emit('update:checked', true)
    await nextTick()

    expect(modal.get('.modal-ok').attributes('disabled')).toBeUndefined()
  })

  it('起草带 confirm:true 与那句额外要求，成功后重读列表', async () => {
    vi.mocked(customerCaseApi.aiDraft).mockResolvedValue({
      case: { ...CASE, title: '小山口腔为一位缺牙客户完成种植修复' },
      warnings: [],
      attempts: 1,
      draftId: 501,
      tokensCharged: 1_800
    } as any)
    const wrapper = await mountView()
    const modal = await openDraftModal(wrapper)

    confirmBox(wrapper).vm.$emit('update:checked', true)
    const textarea = wrapper.findAllComponents(Input.TextArea).find((node: any) =>
      (node.props('placeholder') || '').includes('复查')
    )
    expect(textarea, '弹窗里应有那个「额外要求」输入框').toBeTruthy()
    textarea!.vm.$emit('update:value', '把复查那一段写细一点')
    await nextTick()

    await modal.get('.modal-ok').trigger('click')
    await flushPromises()

    expect(customerCaseApi.aiDraft).toHaveBeenCalledWith(65, true, '把复查那一段写细一点')
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('本次扣 1800 token'))
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('#501'))
    // 写库之后以服务端为准：列表与统计都要重读一遍，界面不自己拼那一行
    expect(customerCaseApi.list).toHaveBeenCalledTimes(2)
  })

  it('门禁的 warn 提示不许被吞', async () => {
    vi.mocked(customerCaseApi.aiDraft).mockResolvedValue({
      case: CASE,
      warnings: ['门禁4：文案与参考站原文重合 71%，疑似照抄', '门禁4：引用了本站之外的素材地址'],
      attempts: 2,
      draftId: 502,
      tokensCharged: 2_100
    } as any)
    const wrapper = await mountView()
    const modal = await openDraftModal(wrapper)

    confirmBox(wrapper).vm.$emit('update:checked', true)
    await nextTick()
    await modal.get('.modal-ok').trigger('click')
    await flushPromises()

    expect(notification.warning).toHaveBeenCalledWith(
      expect.objectContaining({
        description: '门禁4：文案与参考站原文重合 71%，疑似照抄；门禁4：引用了本站之外的素材地址'
      })
    )
  })

  it('预估没回来之前不给起草', async () => {
    vi.mocked(customerCaseApi.estimateAiDraft).mockRejectedValue(new Error('boom'))
    const wrapper = await mountView()
    const modal = await openDraftModal(wrapper)

    expect(modal.text()).toContain('正在估算')
    expect(modal.get('.modal-ok').attributes('disabled')).toBeDefined()
    await modal.get('.modal-ok').trigger('click')
    await flushPromises()

    expect(customerCaseApi.aiDraft).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith(expect.stringContaining('预估失败'))
  })
})

/**
 * 缺码的人在这一页上能做什么（M-P37 拍板 1 的界面那一半）。
 *
 * 这里必须挂真实按钮：把手只要还在，点下去就是后端一句 403，界面等于摆了个坏按钮。
 * 反过来，只有查看码的人不该被整页挡在门外——清单、详情、统计他本来就该看，
 * 所以「不加那句说明」和「把整页藏起来」两种做法都不对。
 */
describe('CaseManageView 按 operation:case:manage 摆把手', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(customerCaseApi.list).mockResolvedValue({ records: [CASE], total: 1, page: 1, size: 10 } as any)
    vi.mocked(customerCaseApi.statistics).mockResolvedValue({
      total: 1,
      published: 1,
      draft: 0,
      totalViews: 3,
      industryCount: 1
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  function buttonLabels(wrapper: any) {
    return wrapper.findAll('button').map((node: any) => node.text().trim())
  }

  it('两码齐的人四颗都在', async () => {
    const wrapper = await mountView()
    const labels = buttonLabels(wrapper)

    expect(labels).toContain('新建案例')
    expect(labels).toContain('编辑')
    expect(labels).toContain('AI 起草')
    expect(labels).toContain('删除')
    expect(wrapper.find('.AAlert-stub').exists()).toBe(false)
  })

  it('只有查看码的人四颗写把手都不在，但清单照旧看得见，并有一句说明缺哪一码', async () => {
    const wrapper = await mountView(['operation:case:view'])
    const labels = buttonLabels(wrapper)

    expect(labels).not.toContain('新建案例')
    expect(labels).not.toContain('编辑')
    expect(labels).not.toContain('AI 起草')
    expect(labels).not.toContain('删除')
    // 读口不该被顺手一起藏掉：这一页对他是「看得了、改不动」，不是「进不来」
    // （表格桩件只替 actions 那一列渲染插槽，所以行在不在看「查看」那颗与 table-stub）
    expect(labels).toContain('查看')
    expect(wrapper.find('.table-stub').exists()).toBe(true)
    expect(customerCaseApi.list).toHaveBeenCalled()

    const notice = wrapper.findAll('.AAlert-stub').map((node: any) => node.text()).join(' ')
    expect(notice).toContain('operation:case:manage')
  })

  it('一码都没有时不喊起草：这一发要真花钱，缺码的人压根点不到', async () => {
    const wrapper = await mountView([])

    expect(buttonLabels(wrapper)).not.toContain('AI 起草')
    expect(customerCaseApi.aiDraft).not.toHaveBeenCalled()
  })
})

/**
 * 筛选栏那三个控件（任务 #455，M-P53 现场看到的缺陷）。
 *
 * 缺陷的形状：这一屏的行业／状态两个下拉没挂 `@change`、搜索框没挂 `@search`，
 * 条件改了要等翻页才动 ⇒ 人看到的是「筛了没反应」，而不是「筛出来是空的」。
 * 同一族另一屏（素材库 `ImageLibraryView`）早就是「改条件回第一页再取」这一形，这里照它接。
 *
 * 桩件发事件的顺序照 ant-design-vue 的真实顺序：先 `update:value`（v-model 落值）、
 * 再 `change`（处理器读到的就是新值）。反过发来会造出一个真代码里不存在的「带旧条件取数」。
 */
describe('CaseManageView 改筛选条件立刻重新取数', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(customerCaseApi.list).mockResolvedValue({ records: [CASE], total: 1, page: 1, size: 10 } as any)
    vi.mocked(customerCaseApi.statistics).mockResolvedValue({
      total: 1,
      published: 1,
      draft: 0,
      totalViews: 3,
      industryCount: 1
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  /** 顺序照 ant：update:value 先落进 v-model，change 才是那一下「条件变了」 */
  async function emitSelect(wrapper: any, index: number, value: unknown) {
    const select = wrapper.findAllComponents({ name: 'ASelect' })[index]
    expect(select, `第 ${index + 1} 个下拉应存在`).toBeTruthy()
    select.vm.$emit('update:value', value)
    select.vm.$emit('change', value)
    await nextTick()
    await flushPromises()
  }

  it('选行业当场多发一发取数，带上这一格的条件', async () => {
    const wrapper = await mountView()
    expect(customerCaseApi.list).toHaveBeenCalledTimes(1)

    await emitSelect(wrapper, 0, 'health')

    expect(customerCaseApi.list).toHaveBeenCalledTimes(2)
    expect(customerCaseApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, industry: 'health' })
    )
  })

  it('状态那一格同样当场重新取', async () => {
    const wrapper = await mountView()

    await emitSelect(wrapper, 1, 'DRAFT')

    expect(customerCaseApi.list).toHaveBeenCalledTimes(2)
    expect(customerCaseApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, status: 'DRAFT' })
    )
  })

  it('清掉那一格也重新取，并且不再带那一格', async () => {
    const wrapper = await mountView()
    await emitSelect(wrapper, 0, 'health')

    await emitSelect(wrapper, 0, undefined)

    expect(customerCaseApi.list).toHaveBeenCalledTimes(3)
    expect(customerCaseApi.list).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ industry: expect.anything() })
    )
  })

  it('人站在第 2 页改条件时退回第 1 页，不停在老那一页', async () => {
    const wrapper = await mountView()
    await wrapper.get('.stub-page-2').trigger('click')
    await flushPromises()
    expect(customerCaseApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    await emitSelect(wrapper, 0, 'finance')

    expect(customerCaseApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, industry: 'finance' })
    )
  })

  it('搜索要在那一发（点按钮或回车）才取，带 keyword', async () => {
    const wrapper = await mountView()
    const search = wrapper.findAllComponents({ name: 'AInputSearch' })[0]
    expect(search, '应搜到那颗搜索框').toBeTruthy()

    search.vm.$emit('update:value', '种植')
    await nextTick()
    // 光打字不许取数：那一发是点「搜索」或回车才发的
    expect(customerCaseApi.list).toHaveBeenCalledTimes(1)

    search.vm.$emit('search', '种植')
    await flushPromises()

    expect(customerCaseApi.list).toHaveBeenCalledTimes(2)
    expect(customerCaseApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, keyword: '种植' })
    )
  })
})
