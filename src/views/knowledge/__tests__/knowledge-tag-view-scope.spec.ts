import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import KnowledgeTagView from '../KnowledgeTagView.vue'
import { knowledgeTagApi } from '../../../api/knowledge'

/**
 * M-P101：知识标签屏「这一屏的数属于谁」。
 *
 * 改前两处叠在一起：
 * 1. 界面取数用的是 `authStore.selectedTenantId || authStore.tenantId || 1`
 *    （`authStore.tenantId` 自己就是 `user?.tenantId || 1`，stores/auth.ts:66）；
 * 2. 后端 `GET /knowledge/tags` 那时只认请求头，签名里没有 `tenantId`，界面发什么都不改得动它。
 * 合起来是：超管没选客户时这一屏摆的是所有家放在一起的标签，同屏那一句「共 N 条」也按那份数念。
 *
 * 这份用例钉九件：
 * 1. 选定了客户：请求带的就是那一家，页首写明看的是谁，「共 N 条」按读回来的行数念；
 * 2. 租户管理员按登录信息里那一家，不再永远拿 1；
 * 3. 没选定客户：一发都不发，「共 N 条」改成「条数没读到」，表里念「这一发没发出去」，「新建标签」不摆；
 * 4. 读失败说的是读失败，不是「这家没有标签」；
 * 5. 关键字没命中时说的是「在已读到的 N 个里找的」，不是空表；
 * 6. 新建的标签归到当前选定的那一家（写进去的 tenantId 不是 1、不是 0）；
 * 7. 后端答「真的没有」：逐字念它那一句，并在空表那一格摆新建入口（M-P101-5b）；
 * 8. 后端答「这一档读不到」：念读不到那一句，那一格不摆新建入口（同一形两种空，改前分不开）；
 * 9. 后端没答是哪一种空：界面用自己那句兜底，不替它挑一种。
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
  knowledgeTagApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'bordered', 'count'],
  template: `<div class="${name}-stub"><slot /><slot name="icon" /><slot name="actions" /></div>`
})

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

// 翻页条那一行「共 N 条」由界面那份 showTotal 现算：直接调它，才测得到显示那一头
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    pagination: { type: Object, default: null }
  },
  template: `<div class="table-stub">
    <div class="total-line">{{ pagination && pagination.showTotal ? pagination.showTotal(pagination.total) : '' }}</div>
    <div v-if="!dataSource.length" class="empty-slot"><slot name="emptyText" /></div>
    <div v-for="record in dataSource" :key="record.id" class="row">
      <template v-for="column in columns" :key="column.key">
        <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
      </template>
    </div>
  </div>`
}

// 两屏的输入框都用 `v-model:value`（prop 是 value、事件是 update:value），写成 modelValue 会静默填不进去
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

function tag(id: number, name: string, tenantId = 558) {
  return { id, tenantId, name, color: 'blue', useCount: id % 7, createdAt: '2026-10-30T09:00:00' }
}

/** 后端这一口现在回的是不分页的全量读：行在 records 里，为什么空由 emptyReason/emptyLine 答 */
function pageOf(rows: any[], cause: Record<string, any> = {}) {
  return {
    records: rows,
    total: rows.length,
    page: 1,
    size: Math.max(rows.length, 1),
    pages: 1,
    emptyReason: null,
    emptyLine: null,
    ...cause
  }
}

// 那两句的唯一的出处是后端 EmptyResultReasons.sentence（主语是 KnowledgeTagController.EMPTY_WHAT）：
// 界面只逐字念，不改写、不合并，所以这里抄的是它真发出去的那一串
const NONE_LINE = '标签：这一档查过了，一条都没有。'
const NOT_VISIBLE_LINE =
  '标签：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'

async function mountView() {
  const wrapper = mount(KnowledgeTagView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-button': BUTTON_STUB,
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-badge': PASS_THROUGH('ABadge'),
        'a-alert': ALERT_STUB,
        'a-table': TABLE_STUB,
        'a-input': INPUT_STUB,
        'a-input-search': {
          name: 'AInputSearch',
          props: ['value'],
          emits: ['update:value', 'search'],
          template: `<input class="search-stub" :value="value"
            @input="$emit('update:value', $event.target.value)"
            @keyup.enter="$emit('search', $event.target.value)" />`
        },
        'a-radio-group': { name: 'ARadioGroup', template: '<div class="radio-group-stub"><slot /></div>' },
        'a-radio': { name: 'ARadio', template: '<label><slot /></label>' },
        'a-form': { name: 'AForm', template: '<form><slot /></form>' },
        'a-form-item': { name: 'AFormItem', template: '<div class="form-item-stub"><slot /></div>' },
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-modal': MODAL_STUB,
        'a-empty': {
          name: 'AEmpty',
          props: ['description'],
          template: '<div class="empty-stub">{{ description }}<slot /></div>'
        },
        'filter-bar': { name: 'FilterBar', template: '<div class="filter-bar-stub"><slot /><slot name="actions" /></div>' }
      }
    }
  })
  await flushPromises()
  return wrapper
}

function totalLine(): string {
  return (document.querySelector('.total-line')?.textContent || '').trim()
}

function alertText(): string {
  return [...document.querySelectorAll('.alert-msg')].map(n => n.textContent).join(' | ')
}

// 只把连续空白压成一个空格：「网关 502」里那个空格是原文的一部分，全删掉会造出假红
function hintLine(): string {
  return (document.querySelector('.empty-line')?.textContent || '').replace(/\s+/g, ' ').trim()
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === text) as
    HTMLButtonElement | undefined
}

/** 空表那一格里摆出来的新建入口（与筛选栏上那颗一直存在的「新建标签」不是一处，只认这一格里的） */
function createButtonInEmptyCell(): HTMLButtonElement | undefined {
  // querySelector 找不到回的是 null，这一支的返回类型写的是 undefined：不补这一下，
  // 「不摆新建入口」那两句 `toBeUndefined()` 会永远红（红在测的壳上，不在产品上）
  return (document.querySelector('.empty-line .create-on-empty') ?? undefined) as HTMLButtonElement | undefined
}

function fillInputByPlaceholder(placeholder: string, value: string) {
  const el = [...document.querySelectorAll('.input-stub')].find(
    n => n.getAttribute('data-placeholder') === placeholder
  ) as HTMLInputElement | undefined
  if (!el) throw new Error(`找不到 placeholder 为「${placeholder}」的输入框`)
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
  vi.mocked(knowledgeTagApi.list).mockResolvedValue(pageOf([tag(1, '攻略'), tag(2, '美食')]) as any)
})

describe('这一屏的数属于谁（M-P101）', () => {
  it('选定了客户：请求带的是那一家，页首写明看的是谁，条数按读回来的行数念', async () => {
    await mountView()

    expect(knowledgeTagApi.list).toHaveBeenCalledWith({ tenantId: 558 })
    expect(alertText()).toContain('客户「blueshan」（编号 #558）')
    expect(totalLine()).toBe('共 2 条')
    expect(document.querySelectorAll('.row').length).toBe(2)
  })

  it('租户管理员按自己那一家取数，不再永远拿 1', async () => {
    authMock.isSuperAdmin = false
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null
    authMock.user = { tenantId: 558 }

    await mountView()

    expect(knowledgeTagApi.list).toHaveBeenCalledWith({ tenantId: 558 })
    expect(alertText()).toContain('你所在客户（编号 #558）')
  })

  it('超管还没选定客户：一发都不发，条数说没读到，表里说这一发没发出去', async () => {
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null

    await mountView()

    expect(knowledgeTagApi.list).not.toHaveBeenCalled()
    expect(alertText()).toContain('当前没有选定客户')
    expect(totalLine()).toBe('条数没读到')
    expect(hintLine()).toContain('这一发没发出去')
    expect(hintLine()).not.toContain('这一家还没有标签')
    expect(buttonByText('新建标签')).toBeUndefined()
  })

  it('读失败：念读失败，不说成「这一家没有标签」', async () => {
    vi.mocked(knowledgeTagApi.list).mockRejectedValue(
      new Error('后端服务不可用（网关 502），请确认服务已启动')
    )

    await mountView()

    expect(hintLine()).toContain('这一发读失败：后端服务不可用（网关 502）')
    expect(totalLine()).toBe('条数没读到')
    // 读失败时新建入口照旧摆：那一格属于哪一家是清楚的，缺的只是没读回来
    expect(buttonByText('新建标签')).toBeDefined()
  })

  it('换一家客户要重取，上一家的标签不能留着当这一家的', async () => {
    const wrapper = await mountView()
    expect(totalLine()).toBe('共 2 条')

    authMock.selectedTenantId = 15
    authMock.selectedTenantCode = 'demo'
    vi.mocked(knowledgeTagApi.list).mockResolvedValue(pageOf([]) as any)
    await flushPromises()

    expect(knowledgeTagApi.list).toHaveBeenLastCalledWith({ tenantId: 15 })
    expect(totalLine()).toBe('共 0 条')
    wrapper.unmount()
  })

  it('关键字没命中：说清是在已读到的几个里找的', async () => {
    const wrapper = await mountView()
    const search = document.querySelector('.search-stub') as HTMLInputElement
    search.value = '住宿'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    const emptyStub = document.querySelector('.empty-stub')
    expect(emptyStub?.textContent).toContain('没找到名字里带「住宿」的标签')
    expect(emptyStub?.textContent).toContain('是在这一屏已读到的 2 个标签里找的')
    wrapper.unmount()
  })
})

describe('新建归到当前选定的那一家（M-P101）', () => {
  it('点新建填名字后确定：create 带的 tenantId 是屏幕上那一家，不是 1 也不是 0', async () => {
    vi.mocked(knowledgeTagApi.create).mockResolvedValue(tag(3, '新标签') as any)
    await mountView()

    buttonByText('新建标签')!.click()
    await flushPromises()
    fillInputByPlaceholder('请输入标签名称', '新标签')
    ;(document.querySelector('.modal-ok') as HTMLButtonElement).click()
    await flushPromises()

    expect(knowledgeTagApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 558, name: '新标签' })
    )
  })

  it('编辑已有的标签：归属跟着那一行走，不跟着屏幕上没选定时兜出来的数走', async () => {
    vi.mocked(knowledgeTagApi.list).mockResolvedValue(pageOf([tag(9, '老标签', 15)]) as any)
    authMock.isSuperAdmin = false
    authMock.user = { tenantId: 15 }
    await mountView()

    const edit = buttonByText('编辑')!
    edit.click()
    await flushPromises()
    vi.mocked(knowledgeTagApi.update).mockResolvedValue(tag(9, '改了名', 15) as any)
    ;(document.querySelector('.modal-ok') as HTMLButtonElement).click()
    await flushPromises()

    expect(knowledgeTagApi.update).toHaveBeenCalledWith(9, expect.objectContaining({ tenantId: 15 }))
  })
})

describe('这一档为什么空，只念后端答的那一句（M-P101-5b）', () => {
  it('后端答「真的没有」：逐字念它那一句，并在空表那一格摆新建入口', async () => {
    vi.mocked(knowledgeTagApi.list).mockResolvedValue(
      pageOf([], { emptyReason: 'NONE', emptyLine: NONE_LINE }) as any
    )
    await mountView()

    expect(hintLine()).toContain(NONE_LINE)
    expect(hintLine()).not.toContain('后端没回是哪一种空')
    const create = createButtonInEmptyCell()
    expect(create?.textContent?.trim()).toBe('新建标签')
    // 挂真实控件点一遍：那一格里的新建入口要真能把新建弹窗打开，不是只摆着一颗按钮
    create!.click()
    await flushPromises()
    expect(document.querySelector('.modal-stub')).toBeTruthy()
  })

  it('后端答「这一档读不到」：念读不到那一句，且不摆新建入口', async () => {
    vi.mocked(knowledgeTagApi.list).mockResolvedValue(
      pageOf([], { emptyReason: 'NOT_VISIBLE', emptyLine: NOT_VISIBLE_LINE }) as any
    )
    await mountView()

    expect(hintLine()).toContain('这一档读不到')
    expect(hintLine()).toContain('所以这里不能说「没有」')
    // 「这一家真没建标签」与「那一家读不到」以前回包逐字节相同，界面分不开；现在这两句必须各摆各的
    expect(hintLine()).not.toContain(NONE_LINE)
    expect(createButtonInEmptyCell()).toBeUndefined()
  })

  it('后端没答是哪一种空：界面用自己那句兜底，不替它挑一种', async () => {
    vi.mocked(knowledgeTagApi.list).mockResolvedValue(pageOf([]) as any)
    await mountView()

    expect(hintLine()).toContain('后端没回是哪一种空')
    expect(createButtonInEmptyCell()).toBeUndefined()
  })
})
