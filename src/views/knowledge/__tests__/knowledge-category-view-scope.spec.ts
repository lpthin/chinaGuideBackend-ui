import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import KnowledgeCategoryView from '../KnowledgeCategoryView.vue'
import { knowledgeCategoryApi } from '../../../api/knowledge'

/**
 * M-P101：知识分类屏「这一屏的数属于谁」。
 *
 * 改前的取数链是 `authStore.selectedTenantId || authStore.tenantId || 1`，其中
 * `authStore.tenantId` 那个 getter 自己就是 `user?.tenantId || 1`（stores/auth.ts:66）。
 * 后果是超管打开这一屏、还没在右上角点客户时，树上摆的是 1 号那一家的分类，
 * 三张卡按的也是那一家的数，界面一个字不提；租户管理员则永远拿 1，自己那家的编号根本不参与。
 * 同时后端 `/knowledge/categories/all` 以前根本不读 `tenantId` 参数（只有请求头那一份），
 * 界面发什么都不改得动它。
 *
 * 这份用例钉八件：
 * 1. 选定了客户：树与统计两发都按那一家，页首写明看的是谁；
 * 2. 租户管理员用登录信息里那一家，不再永远拿 1；
 * 3. 没选定客户：两发都不发，三张卡摆「—」，左侧说「这一发没发出去」，「新增」不摆；
 * 4. 统计那一口断了：只那一格摆「—」并单说一句，树上已经读到的数不被抹掉；
 * 5. 树那一口断了：统计照旧发、卡片数照旧真摆，左侧念「读失败」而不是「这一家没有分类」；
 * 6. 后端答了成因就逐字念它那一句；只有它答「真的没有」才摆新建入口；
 * 7. 新建的分类归到当前选定的那一家（写进去的 tenantId 不是 1、不是 0）；
 * 8. 两发还在路上的那一眼里，右侧不许说「这一家还没有分类」，三张卡也不许留着上一家的数。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn() }
  }
})

const authMock = reactive<Record<string, any>>({
  isSuperAdmin: true,
  selectedTenantId: 558 as number | null,
  selectedTenantCode: 'blueshan' as string | null,
  user: { tenantId: 1 as number | null },
  tenantId: 1,
  hasPermission: () => true
})

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authMock
}))

vi.mock('../../../api/knowledge', () => ({
  knowledgeCategoryApi: {
    all: vi.fn(),
    stats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  // 这一屏拿到的 records 直接当平铺列表用（真函数会先展开树）；这里给恒等，样本按平铺写
  flattenCategories: vi.fn((list: any[]) => list)
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'bordered', 'hoverable', 'spinning'],
  template: `<div class="${name}-stub"><slot /><slot name="extra" /></div>`
})

// 全局替件把 a-button 换成什么都不渲的桩（src/tests/setup.ts），这一屏要点的「新增」必须留真把手
const BUTTON_STUB = {
  name: 'AButton',
  props: ['type', 'size', 'disabled', 'loading', 'danger'],
  template: '<button class="btn-stub" :disabled="disabled"><slot name="icon" /><slot /></button>'
}

const ALERT_STUB = {
  name: 'AAlert',
  props: ['message', 'type', 'showIcon'],
  template: '<div class="alert-stub" :data-type="type"><span class="alert-msg">{{ message }}</span></div>'
}

// 树只按「渲出几个节点名」验，不承担拖拽
const TREE_STUB = {
  name: 'ATree',
  props: { treeData: { type: Array, default: () => [] } },
  template: `<div class="tree-stub">
    <span v-for="node in treeData" :key="node.key" class="tree-node-title">{{ node.title }}</span>
  </div>`
}

// 这一屏的输入框用 `v-model:value`（prop 是 value、事件是 update:value），写成 modelValue 会静默填不进去
const INPUT_STUB = {
  name: 'AInput',
  props: ['modelValue', 'value', 'placeholder'],
  emits: ['update:modelValue', 'update:value'],
  template: `<input class="input-stub" :data-placeholder="placeholder" :value="value ?? modelValue"
    @input="$emit('update:modelValue', $event.target.value); $emit('update:value', $event.target.value)" />`
}

const MODAL_STUB = {
  name: 'AModal',
  props: ['open', 'title', 'confirmLoading', 'width'],
  emits: ['ok', 'cancel', 'update:open'],
  template: `<div class="modal-stub" v-if="open"><slot /><button class="modal-ok" @click="$emit('ok')">确定</button></div>`
}

function node(id: number, name: string, parentId: number | null) {
  return {
    id,
    tenantId: 558,
    parentId,
    name,
    icon: 'folder',
    description: '',
    sort: 0,
    status: 'active',
    createdAt: '2026-10-30T09:00:00'
  }
}

const TREE = [node(11, '景点', null), node(12, '华东', 11), node(13, '上海', 12)]

async function mountView() {
  const wrapper = mount(KnowledgeCategoryView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-button': BUTTON_STUB,
        'a-card': PASS_THROUGH('ACard'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-alert': ALERT_STUB,
        'a-tree': TREE_STUB,
        'a-tree-select': { name: 'ATreeSelect', template: '<span class="tree-select-stub" />' },
        'a-select': { name: 'ASelect', template: '<span class="select-stub"><slot /></span>' },
        'a-select-option': { name: 'ASelectOption', template: '<option><slot /></option>' },
        'a-input': INPUT_STUB,
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-input-number': { name: 'AInputNumber', template: '<input class="number-stub" />' },
        'a-textarea': { name: 'ATextarea', template: '<textarea class="textarea-stub"></textarea>' },
        'a-radio-group': { name: 'ARadioGroup', template: '<span class="radio-stub"><slot /></span>' },
        'a-radio': { name: 'ARadio', template: '<label><slot /></label>' },
        'a-form': { name: 'AForm', template: '<form><slot /></form>' },
        'a-form-item': { name: 'AFormItem', template: '<div class="form-item-stub"><slot /></div>' },
        'a-divider': { name: 'ADivider', template: '<hr />' },
        'a-modal': MODAL_STUB,
        'a-empty': { name: 'AEmpty', props: ['description'], template: '<div class="empty-stub">{{ description }}<slot /></div>' },
        'filter-bar': { name: 'FilterBar', template: '<div class="filter-bar-stub"><slot /><slot name="actions" /></div>' }
      }
    }
  })
  await flushPromises()
  return wrapper
}

function statValues(): string[] {
  return [...document.querySelectorAll('.stat-value')].map(n => (n.textContent || '').trim())
}

function alertText(): string {
  return [...document.querySelectorAll('.alert-msg')].map(n => n.textContent).join(' | ')
}

// 只把连续空白压成一个空格：后端原话里的空格（如「网关 502」）是判据的一部分，全删会造出假红
function hintLine(): string {
  return (document.querySelector('.empty-line')?.textContent || '').replace(/\s+/g, ' ').trim()
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === text) as
    HTMLButtonElement | undefined
}

function fillInputByPlaceholder(placeholder: string, value: string) {
  const el = [...document.querySelectorAll('.input-stub')].find(
    n => n.getAttribute('data-placeholder') === placeholder
  ) as HTMLInputElement | undefined
  if (!el) throw new Error(`找不到 placeholder 为「${placeholder}」的输入框（这一屏共 ${document.querySelectorAll('.input-stub').length} 个）`)
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  authMock.isSuperAdmin = true
  authMock.selectedTenantId = 558
  authMock.selectedTenantCode = 'blueshan'
  authMock.user = { tenantId: 1 }
  authMock.tenantId = 1
  vi.mocked(knowledgeCategoryApi.all).mockResolvedValue({
    records: TREE,
    total: TREE.length,
    page: 1,
    size: 3,
    emptyReason: null,
    emptyLine: null
  } as any)
  vi.mocked(knowledgeCategoryApi.stats).mockResolvedValue([
    { id: 11, documentCount: 2, cardCount: 5, totalCount: 7 },
    { id: 12, documentCount: 0, cardCount: 3, totalCount: 3 },
    { id: 13, documentCount: 0, cardCount: 1, totalCount: 1 }
  ] as any)
})

describe('这一屏的数属于谁（M-P101）', () => {
  it('选定了客户：树与统计都按那一家取数，页首写明看的是谁', async () => {
    await mountView()

    expect(knowledgeCategoryApi.all).toHaveBeenCalledWith(558)
    expect(knowledgeCategoryApi.stats).toHaveBeenCalledWith(558)
    expect(alertText()).toContain('客户「blueshan」（编号 #558）')
    // 分类总数与最大层级来自树那一发：3 个节点、最深一条链 3 层
    expect(statValues()).toEqual(['3', '9', '3'])
    expect([...document.querySelectorAll('.tree-node-title')].map(n => n.textContent)).toEqual(['景点'])
  })

  it('租户管理员按自己那一家取数，不再永远拿 1', async () => {
    authMock.isSuperAdmin = false
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null
    authMock.user = { tenantId: 558 }

    await mountView()

    expect(knowledgeCategoryApi.all).toHaveBeenCalledWith(558)
    expect(knowledgeCategoryApi.stats).toHaveBeenCalledWith(558)
    expect(alertText()).toContain('你所在客户（编号 #558）')
  })

  it('超管还没选定客户：两发都不发，卡摆「—」，左侧说这一发没发出去', async () => {
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null

    await mountView()

    expect(knowledgeCategoryApi.all).not.toHaveBeenCalled()
    expect(knowledgeCategoryApi.stats).not.toHaveBeenCalled()
    expect(alertText()).toContain('当前没有选定客户')
    expect(statValues()).toEqual(['—', '—', '—'])
    expect(hintLine()).toContain('这一发没发出去')
    expect(hintLine()).not.toContain('这一家还没有分类')
    expect(buttonByText('新增')).toBeUndefined()
    // 右侧那一栏也不能说「请选择左侧分类进行编辑」——左侧根本没有可选的
    expect(alertText()).toContain('请在右上角选一家客户')
  })

  it('换一家客户要重取，上一家的行不能留着当这一家的', async () => {
    const wrapper = await mountView()
    expect(statValues()[0]).toBe('3')

    authMock.selectedTenantId = 15
    authMock.selectedTenantCode = 'demo'
    vi.mocked(knowledgeCategoryApi.all).mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      size: 1,
      emptyReason: 'NONE',
      emptyLine: '资料库项目：这一档确实没有行（不是读不到，是真没建过）。'
    } as any)
    vi.mocked(knowledgeCategoryApi.stats).mockResolvedValue([] as any)
    await flushPromises()

    expect(knowledgeCategoryApi.all).toHaveBeenLastCalledWith(15)
    expect([...document.querySelectorAll('.tree-node-title')].length).toBe(0)
    expect(statValues()).toEqual(['0', '0', '0'])
    wrapper.unmount()
  })
})

describe('两发各读各的，断了不说成「没有」（M-P101）', () => {
  it('统计那一口断了：只有「知识卡片」摆 —，树上读到的两个数照旧摆', async () => {
    vi.mocked(knowledgeCategoryApi.stats).mockRejectedValue(
      new Error('后端服务不可用（网关 502），请确认服务已启动')
    )
    await mountView()

    expect(statValues()).toEqual(['3', '—', '3'])
    expect(alertText()).toContain('下面那张「知识卡片」没从后端读回来：后端服务不可用（网关 502）')
    expect(alertText()).toContain('这一格摆的是 —，不是 0')
    expect(document.querySelectorAll('.tree-node-title').length).toBe(1)
  })

  it('树那一口断了：统计照旧发、卡片数照旧真摆，左侧念「读失败」', async () => {
    vi.mocked(knowledgeCategoryApi.all).mockRejectedValue(new Error('没有权限执行该操作'))
    await mountView()

    expect(knowledgeCategoryApi.stats).toHaveBeenCalledTimes(1)
    expect(statValues()).toEqual(['—', '9', '—'])
    expect(hintLine()).toContain('这一发读失败：没有权限执行该操作')
    expect(hintLine()).not.toContain('这一家还没有分类')
  })

  it('后端答「这一档读不到」：逐字念它那一句，且不摆新建入口', async () => {
    vi.mocked(knowledgeCategoryApi.all).mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      size: 1,
      emptyReason: 'NOT_VISIBLE',
      emptyLine: '资料库项目：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    } as any)
    await mountView()

    expect(hintLine()).toContain('资料库项目：这一档读不到')
    expect(buttonByText('新增')).toBeDefined()
    expect(buttonByText('新增分类')).toBeUndefined()
  })

  it('后端答「真的没有」：念它那一句，并把新建入口摆出来', async () => {
    vi.mocked(knowledgeCategoryApi.all).mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      size: 1,
      emptyReason: 'NONE',
      emptyLine: '资料库项目：这一档确实没有行（不是读不到，是真没建过）。'
    } as any)
    await mountView()

    expect(hintLine()).toContain('资料库项目：这一档确实没有行')
    expect(buttonByText('新增分类')).toBeDefined()
  })

  /**
   * 现场走查（M-P101-5）撞到的：同一屏页首念「资料库分类」、左侧那一句念后端给的「资料库项目」。
   * 这张表在文档那一屏对外就叫「资料库项目」，所以页首跟着它，一屏只许一个词。
   */
  it('页首那句与左侧那句不许一屏两个词：都念「资料库项目」', async () => {
    await mountView()

    expect(alertText()).toContain('资料库项目')
    expect(alertText()).not.toContain('资料库分类')
  })
})

/**
 * 现场走查（M-P101-5）撞到的那一形：从「没选客户」点回 1 号那一家，两发还在路上时，
 * 右侧那一栏已经念出「这一家还没有分类，先在左侧新增一个。」——而 1 号那一家有 5 个分类。
 * 左侧那一格走 EmptyListHint，它有 `v-if="!loading"` 挡着不抢答；右侧那一栏漏了这一道。
 * 同一眼还有三张卡：页首已经先写上新一家的名字，卡里的数还是上一家那份，等于把数认错了人。
 */
describe('两发还在路上时不许抢答（M-P101 走查现场发现）', () => {
  function rightColumnLine(): string {
    return (document.querySelector('.empty-stub')?.textContent || '').replace(/\s+/g, ' ').trim()
  }

  it('读的过程中：右侧不说「这一家还没有分类」，三张卡也不留上一家的数', async () => {
    let settleAll!: (value: any) => void
    let settleStats!: (value: any) => void
    vi.mocked(knowledgeCategoryApi.all).mockReturnValue(new Promise(r => { settleAll = r }) as any)
    vi.mocked(knowledgeCategoryApi.stats).mockReturnValue(new Promise(r => { settleStats = r }) as any)

    const wrapper = await mountView()

    expect(knowledgeCategoryApi.all).toHaveBeenCalledTimes(1)
    expect(statValues()).toEqual(['—', '—', '—'])
    expect(rightColumnLine()).toContain('正在读这一家的分类')
    expect(rightColumnLine()).not.toContain('这一家还没有分类')
    expect(buttonByText('新增分类')).toBeUndefined()

    // 读回来了才许说这一句：这里给的是后端答「真的没有」那一档
    settleAll({
      records: [],
      total: 0,
      page: 1,
      size: 1,
      emptyReason: 'NONE',
      emptyLine: '资料库项目：这一档确实没有行（不是读不到，是真没建过）。'
    })
    settleStats([])
    await flushPromises()

    expect(rightColumnLine()).toContain('这一家还没有分类')
    expect(buttonByText('新增分类')).toBeDefined()
    expect(statValues()).toEqual(['0', '0', '0'])
    wrapper.unmount()
  })

  it('读回来有分类：右侧改口成「请选择左侧分类进行编辑」，卡上的数来自这一发', async () => {
    let settleAll!: (value: any) => void
    let settleStats!: (value: any) => void
    vi.mocked(knowledgeCategoryApi.all).mockReturnValue(new Promise(r => { settleAll = r }) as any)
    vi.mocked(knowledgeCategoryApi.stats).mockReturnValue(new Promise(r => { settleStats = r }) as any)

    const wrapper = await mountView()
    expect(rightColumnLine()).toContain('正在读这一家的分类')

    settleAll({ records: TREE, total: TREE.length, page: 1, size: 3, emptyReason: null, emptyLine: null })
    settleStats([{ id: 11, documentCount: 2, cardCount: 5, totalCount: 7 }])
    await flushPromises()

    expect(document.querySelector('.empty-stub')).toBeNull()
    expect(statValues()).toEqual(['3', '5', '3'])
    wrapper.unmount()
  })

  it('从一家换到另一家：新那一家还在路上时，卡上不许留着上一家的数', async () => {
    const wrapper = await mountView()
    expect(statValues()).toEqual(['3', '9', '3'])

    let settleAll!: (value: any) => void
    let settleStats!: (value: any) => void
    vi.mocked(knowledgeCategoryApi.all).mockReturnValue(new Promise(r => { settleAll = r }) as any)
    vi.mocked(knowledgeCategoryApi.stats).mockReturnValue(new Promise(r => { settleStats = r }) as any)

    authMock.selectedTenantId = 15
    authMock.selectedTenantCode = 'demo'
    await flushPromises()

    // 页首已经改口成 15 号，此时三张卡若是上一家的数就是认错了人
    expect(knowledgeCategoryApi.all).toHaveBeenLastCalledWith(15)
    expect(alertText()).toContain('编号 #15')
    expect(statValues()).toEqual(['—', '—', '—'])
    expect(rightColumnLine()).toContain('正在读这一家的分类')
    expect(rightColumnLine()).not.toContain('这一家还没有分类')

    settleAll({ records: TREE, total: TREE.length, page: 1, size: 3, emptyReason: null, emptyLine: null })
    settleStats([])
    await flushPromises()
    expect(statValues()).toEqual(['3', '0', '3'])
    wrapper.unmount()
  })
})

describe('新建归到当前选定的那一家（M-P101）', () => {
  it('点新增填名字后确定：create 带的 tenantId 是屏幕上那一家，不是 1 也不是 0', async () => {
    vi.mocked(knowledgeCategoryApi.all).mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      size: 1,
      emptyReason: 'NONE',
      emptyLine: '资料库项目：这一档确实没有行（不是读不到，是真没建过）。'
    } as any)
    vi.mocked(knowledgeCategoryApi.create).mockResolvedValue(node(21, '新分类', null) as any)
    await mountView()

    buttonByText('新增分类')!.click()
    await flushPromises()
    fillInputByPlaceholder('请输入分类名称', '新分类')
    ;(document.querySelector('.modal-ok') as HTMLButtonElement).click()
    await flushPromises()

    expect(knowledgeCategoryApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 558, name: '新分类' })
    )
  })

  it('没选定客户时新建入口压根不摆，也就写不出归属', async () => {
    authMock.selectedTenantId = null
    await mountView()

    expect(buttonByText('新增')).toBeUndefined()
    expect(buttonByText('新增分类')).toBeUndefined()
    expect(knowledgeCategoryApi.create).not.toHaveBeenCalled()
  })
})
