import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import StoreManageView from '../StoreManageView.vue'
import { portalStoreApi } from '../../../api/portalStores'
import { MENU_GROUPS, MENU_GROUP_BY_ROUTE, menuIcon } from '../../../navigation/workspaceMenu'
import { routes } from '../../../router'

/**
 * 租户侧「门店」录入页（Spec-D 最后一格：门户「联系我们」的地图有渲染口、没有写入口）。
 * 这一页要钉住的不是好不好看，是四句谎报：
 * 1. 状态三档的中文、哪一档会上地图、地图点位上限——全部只从 GET /options 读，
 *    界面抄一份「1=营业中」就是哪天后端改判据时这里在骗人（上限那个数也一样）；
 * 2. 「这一家为什么在地图上找不到」要给得出原因，而原因只在界面与门户同序时才敢点名上限；
 * 3. 空列表说「还没有录过门店」，读失败说读失败，词表读不到只降级成一句提醒；
 * 4. 后端那句中文拒绝原因（坐标只填一半、名称超长）原样上屏，界面不另立一套判据。
 * 菜单归属另钉一条：这一页进「网站内容维护」，绝不进任何 build-* 组。
 */

vi.mock('../../../api/portalStores', () => ({
  portalStoreApi: {
    options: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}))

const PASS_THROUGH = (name: string, extraSlots: string[] = []) => ({
  name,
  props: ['title', 'subTitle', 'bordered', 'hoverable'],
  template: `<div class="${name}-stub">${
    extraSlots.includes('title') ? '<slot name="title" />' : ''
  }<slot /></div>`
})

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] }
  },
  template: `
    <div class="table-stub">
      <div v-if="!dataSource.length" class="empty-slot"><slot name="emptyText" /></div>
      <div v-for="record in dataSource" :key="record.id" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

// 真实 input：筛选关键词与保存载荷都要靠它把值填进 v-model:value
const INPUT_STUB = {
  name: 'AInput',
  props: ['value', 'placeholder'],
  emits: ['update:value'],
  template: `<input class="a-input-stub" :placeholder="placeholder" :value="value"
    @input="$emit('update:value', $event.target.value)">`
}

// 能点到的下拉：状态中文必须是 /options 那一份渲染出来的，只渲染文案不算挂上控件
const SELECT_STUB = {
  name: 'ASelect',
  props: ['value', 'options', 'placeholder'],
  emits: ['update:value'],
  template: `<div class="a-select-stub">
    <button v-for="opt in options" :key="opt.value" class="select-option" type="button"
      @click="$emit('update:value', opt.value)">{{ opt.label }}</button>
  </div>`
}

const MODAL_STUB = {
  name: 'AModal',
  props: ['title', 'open', 'confirmLoading'],
  emits: ['update:open', 'ok'],
  template: `<div class="a-modal-stub">
    <h1 class="modal-title">{{ title }}</h1>
    <slot />
    <button class="modal-ok" @click="$emit('ok')">保存</button>
  </div>`
}

const ALERT_STUB = {
  name: 'AAlert',
  props: ['type', 'message', 'showIcon'],
  template: `<div class="alert-stub" :data-type="type">
    <span class="alert-message">{{ message }}</span><slot name="message" /></div>`
}

/** 词表 fixture：上限故意给 3，与后端真实的 24 不同——界面写死任何一个数都过不了这条 */
const OPTIONS = {
  statuses: [
    { code: 0, label: '停业', visibleOnPortal: false },
    { code: 1, label: '营业中', visibleOnPortal: true },
    { code: 2, label: '装修中', visibleOnPortal: false }
  ],
  portalRowLimit: 3
}

function store(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 15,
    name: `门店 ${id}`,
    address: `杭州市滨江区江虹路 ${id} 号`,
    phone: null,
    longitude: 120.15,
    latitude: 30.25,
    businessHours: null,
    status: 1,
    sortOrder: id,
    createdAt: '2026-09-01T10:00:00',
    updatedAt: '2026-09-20T10:00:00',
    createBy: 'tenant15_admin',
    updateBy: 'tenant15_admin',
    ...overrides
  }
}

// 四家营业中 + 一家装修中：上限 3 时第四家该被点名超上限，第五家走状态那条原因
const ROWS = [store(1), store(2), store(3), store(4), store(5, { status: 2 })]

async function mountView() {
  const wrapper = mount(StoreManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-page-header': PASS_THROUGH('APageHeader'),
        'a-card': PASS_THROUGH('ACard', ['title']),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-input': INPUT_STUB,
        'a-input-number': {
          name: 'AInputNumber',
          props: ['value', 'min'],
          emits: ['update:value'],
          template: `<input class="a-number-stub" :value="value"
            @input="$emit('update:value', Number($event.target.value))">`
        },
        'a-select': SELECT_STUB,
        'a-table': TABLE_STUB,
        'a-modal': MODAL_STUB,
        'a-alert': ALERT_STUB,
        'a-empty': {
          name: 'AEmpty',
          props: ['description'],
          template: '<div class="a-empty-stub">{{ description }}</div>'
        },
        'a-popconfirm': {
          name: 'APopconfirm',
          props: ['title'],
          emits: ['confirm'],
          template: '<span><slot /><button class="pop-yes" @click="$emit(\'confirm\')">确认删除</button></span>'
        }
      }
    }
  })
  await flushPromises()
  return wrapper
}

/**
 * 作用域取控件。弹窗那条 a-modal 是 stub、常驻 DOM，所以全页第一个 input 是筛选框不是表单框——
 * 涉及表单的断言一律先拿到作用域（整页 / 某一行 / 弹窗）再取控件。
 */
function scopeOf(node: any) {
  const findButton = (text: string) => {
    const found = node.findAll('button').filter((item: any) => (item.text() || '').trim() === text)
    if (!found.length) {
      throw new Error(`作用域内找不到文案为「${text}」的按钮`)
    }
    return found[0]
  }
  return {
    node,
    button: findButton,
    inputByPlaceholder(placeholder: string) {
      const found = node.find(`input.a-input-stub[placeholder^="${placeholder}"]`)
      if (!found.exists()) {
        throw new Error(`找不到 placeholder 以「${placeholder}」开头的输入框`)
      }
      return found
    },
    statusOptionLabels(): string[] {
      return node.findAll('.select-option').map((item: any) => item.text())
    },
    clickStatusOption(label: string) {
      const found = node.findAll('.select-option').find((item: any) => item.text() === label)
      if (!found) {
        throw new Error(`找不到文案为「${label}」的状态选项`)
      }
      return found.trigger('click')
    }
  }
}

const page = (wrapper: any) => scopeOf(wrapper)
const modal = (wrapper: any) => scopeOf(wrapper.findComponent({ name: 'AModal' }))
const filterBar = (wrapper: any) => scopeOf(wrapper.find('.store-manage-page__filter'))
const row = (wrapper: any, text: string) => {
  const found = wrapper.findAll('.row').find((item: any) => item.text().includes(text))
  if (!found) {
    throw new Error(`找不到包含「${text}」的表格行`)
  }
  return scopeOf(found)
}

function alerts(wrapper: any, type: string) {
  return wrapper.findAll(`.alert-stub[data-type="${type}"]`).map((node: any) => node.text())
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  vi.mocked(portalStoreApi.options).mockResolvedValue(OPTIONS as any)
  vi.mocked(portalStoreApi.list).mockResolvedValue(ROWS as any)
  vi.mocked(portalStoreApi.count).mockResolvedValue(ROWS.length as any)
})

describe('StoreManageView 消费词表（不许界面抄一份状态语义）', () => {
  it('筛选下拉的中文逐档来自 /options：三档都在，一档不多一档不少', async () => {
    const wrapper = await mountView()
    expect(filterBar(wrapper).statusOptionLabels()).toEqual(['停业', '营业中', '装修中'])
  })

  it('状态标签用词表那份中文：营业中那一档与装修中那一档各说各的', async () => {
    const wrapper = await mountView()
    expect(row(wrapper, '门店 1').node.text()).toContain('营业中')
    expect(row(wrapper, '门店 5').node.text()).toContain('装修中')
  })

  it('上限那句提醒里的数字是 /options 给的那个（3），不是界面写死的 24', async () => {
    const wrapper = await mountView()
    const info = alerts(wrapper, 'info').join('|')
    expect(info).toContain('一次最多摆 3 个')
    expect(info).not.toContain('24')
    expect(wrapper.text()).toContain('其中 3 家会出现在门户地图上（上限 3 个点位')
  })

  it('词表读不到只降级成一句提醒：列表照样翻，不演成「门店功能坏了」', async () => {
    vi.mocked(portalStoreApi.options).mockRejectedValue(new Error('词表接口 500'))
    const wrapper = await mountView()
    expect(alerts(wrapper, 'warning').join('|')).toContain('词表接口 500')
    expect(wrapper.findAll('.row')).toHaveLength(ROWS.length)
    expect(wrapper.find('.a-empty-stub').exists()).toBe(false)
    // 没有词表就念不出中文：这一格只报后端给的码，不编一个标签冒充词表
    expect(row(wrapper, '门店 1').node.text()).toContain('状态 1')
    expect(filterBar(wrapper).statusOptionLabels()).toEqual([])
  })
})

describe('StoreManageView 的「这一家为什么在地图上找不到」', () => {
  it('营业中的第 4 家被点名超上限，前 3 家不挂这条话', async () => {
    const wrapper = await mountView()
    expect(row(wrapper, '门店 4').node.text())
      .toContain('营业中的第 4 家，超出地图一次摆 3 个点位，不会显示')
    expect(row(wrapper, '门店 1').node.text()).not.toContain('超出地图')
    expect(row(wrapper, '门店 3').node.text()).not.toContain('超出地图')
  })

  it('不是「营业中」的那一家给的是状态那条原因', async () => {
    const wrapper = await mountView()
    expect(row(wrapper, '门店 5').node.text()).toContain('「装修中」不在门户地图上')
  })

  it('带筛选条件时不许点名上限：筛过的顺序不是门户的顺序，宁可不说话', async () => {
    const wrapper = await mountView()
    await filterBar(wrapper).inputByPlaceholder('按名字筛').setValue('滨江')
    expect(wrapper.findAll('.row').length).toBeGreaterThan(0)
    expect(wrapper.text()).not.toContain('超出地图一次摆')
    expect(wrapper.text()).not.toContain('家会出现在门户地图上')
  })

  it('既没地址也没经纬度的行当场标出指不出位置；只有地址的行说清跳转按地址搜', async () => {
    vi.mocked(portalStoreApi.list).mockResolvedValue([
      store(6, { name: '盲点门店', address: null, longitude: null, latitude: null }),
      store(7, { name: '只有地址', longitude: null, latitude: null })
    ] as any)
    vi.mocked(portalStoreApi.count).mockResolvedValue(2 as any)
    const wrapper = await mountView()
    expect(row(wrapper, '盲点门店').node.text()).toContain('既没地址也没经纬度：门户地图上指不出这一家')
    expect(row(wrapper, '只有地址').node.text()).toContain('没有经纬度：跳转按地址搜')
  })

  it('门店按公司归属：这一页没有任何「选站点」的控件与说法', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('门店是按公司归属的')
    expect(wrapper.text()).not.toContain('选择站点')
    expect(portalStoreApi.list).toHaveBeenCalledWith('', undefined)
  })
})

describe('StoreManageView 的空态与读失败（两句话不许互相冒充）', () => {
  it('一家都没录过时说「还没有录过门店」，不冒读取失败', async () => {
    vi.mocked(portalStoreApi.list).mockResolvedValue([] as any)
    vi.mocked(portalStoreApi.count).mockResolvedValue(0 as any)
    const wrapper = await mountView()
    expect(wrapper.find('.a-empty-stub').text()).toContain('还没有录过门店')
    expect(alerts(wrapper, 'error')).toHaveLength(0)
  })

  it('读取失败报的是后端那句中文，且整张表退场不摆空态', async () => {
    vi.mocked(portalStoreApi.list).mockRejectedValue(new Error('门店列表读取失败：服务开小差了'))
    const wrapper = await mountView()
    expect(alerts(wrapper, 'error').join('|')).toContain('门店列表读取失败：服务开小差了')
    expect(wrapper.find('.a-empty-stub').exists()).toBe(false)
  })
})

describe('StoreManageView 的写入：判据在后端，界面不另立一套', () => {
  it('新建的载荷只有后端白名单那八个键，坐标按填的原样交回去', async () => {
    vi.mocked(portalStoreApi.create).mockResolvedValue(store(8) as any)
    const wrapper = await mountView()
    page(wrapper).button('新增门店').trigger('click')
    await flushPromises()
    const form = modal(wrapper)
    await form.inputByPlaceholder('访客要在地图上认出的那个名字').setValue('滨江分公司')
    await form.inputByPlaceholder('填到能被找到的程度').setValue('杭州市滨江区江虹路 1 号')
    await form.inputByPlaceholder('如 120.15000000').setValue('120.15000000')
    await form.inputByPlaceholder('如 30.25000000').setValue('30.25000000')
    form.button('保存').trigger('click')
    await flushPromises()
    expect(portalStoreApi.create).toHaveBeenCalledTimes(1)
    expect(portalStoreApi.create).toHaveBeenCalledWith({
      name: '滨江分公司',
      address: '杭州市滨江区江虹路 1 号',
      phone: null,
      longitude: '120.15000000',
      latitude: '30.25000000',
      businessHours: null,
      status: 1,
      sortOrder: 0
    })
  })

  it('坐标只填一半：界面不自己判，交给后端那句中文原样上屏', async () => {
    const rejection = '经度与纬度必须一起填：只填其中一个，地图上落不下这个点'
    vi.mocked(portalStoreApi.create).mockRejectedValue(new Error(rejection))
    const wrapper = await mountView()
    page(wrapper).button('新增门店').trigger('click')
    await flushPromises()
    const form = modal(wrapper)
    await form.inputByPlaceholder('访客要在地图上认出的那个名字').setValue('只填了经度')
    await form.inputByPlaceholder('如 120.15000000').setValue('120.15')
    form.button('保存').trigger('click')
    await flushPromises()
    expect(portalStoreApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ longitude: '120.15', latitude: null })
    )
    expect(alerts(wrapper, 'error').join('|')).toContain(rejection)
  })

  it('编辑走这一行的 id 并回填已有值，保存不再新建第二条', async () => {
    vi.mocked(portalStoreApi.update).mockResolvedValue(store(3) as any)
    const wrapper = await mountView()
    row(wrapper, '门店 3').button('编辑').trigger('click')
    await flushPromises()
    const form = modal(wrapper)
    const nameInput = form.inputByPlaceholder('访客要在地图上认出的那个名字')
    expect((nameInput.element as HTMLInputElement).value).toBe('门店 3')
    form.button('保存').trigger('click')
    await flushPromises()
    expect(portalStoreApi.update).toHaveBeenCalledTimes(1)
    expect(portalStoreApi.update).toHaveBeenCalledWith(3, expect.objectContaining({ name: '门店 3' }))
    expect(portalStoreApi.create).not.toHaveBeenCalled()
  })

  it('删除点确认后打的是后端软删口，列表跟着重读一次', async () => {
    vi.mocked(portalStoreApi.remove).mockResolvedValue(undefined as any)
    const wrapper = await mountView()
    row(wrapper, '门店 2').button('确认删除').trigger('click')
    await flushPromises()
    expect(portalStoreApi.remove).toHaveBeenCalledWith(2)
    expect(portalStoreApi.list).toHaveBeenCalledTimes(2)
  })

  it('表单里的「营业状态」也来自词表，选了不在门户那一档就说清不会上地图', async () => {
    const wrapper = await mountView()
    page(wrapper).button('新增门店').trigger('click')
    await flushPromises()
    const form = modal(wrapper)
    expect(form.statusOptionLabels()).toEqual(['停业', '营业中', '装修中'])
    await form.clickStatusOption('装修中')
    expect(form.node.text()).toContain('这一档不会出现在门户地图上')
  })
})

describe('门店页的菜单归属（Spec-C §2.1 纪律）', () => {
  it('路由挂「网站内容」组（tenant 域），绝不进建站组', () => {
    const routeName = 'workspace-portal-stores'
    expect(MENU_GROUP_BY_ROUTE[routeName]).toBe('site-content')
    const group = MENU_GROUPS.find(entry => entry.key === MENU_GROUP_BY_ROUTE[routeName])
    expect(group?.label).toBe('网站内容')
    expect(group?.domain).toBe('tenant')
    // Spec-H 把建站那组的键从 build-* 收成 `build`，原来的 `startsWith('build-')` 会漏掉它，判据跟着收紧
    expect(group?.key).not.toMatch(/^build/)
  })

  it('菜单显隐、路由守卫、后端 @RequirePermission 三处是同一个码，图标也已登记', () => {
    const workspace = routes.find(route => route.name === 'workspace')
    const stores = workspace?.children?.find(child => child.name === 'workspace-portal-stores')
    expect(stores?.path).toBe('portal/stores')
    expect((stores?.meta as any)?.requiredPermission).toBe('portal:siteinfo:manage')
    expect((stores?.meta as any)?.title).toBe('门店')
    expect(menuIcon((stores?.meta as any)?.icon)).not.toBeNull()
  })
})
