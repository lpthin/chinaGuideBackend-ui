import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import ShowcaseManageView from '../ShowcaseManageView.vue'
import { portalShowcaseApi, resolveMediaIdByUrl, fetchMediaUrl } from '../../../api/portalShowcase'
import { portalSitesApi } from '../../../api/portalSites'
import { MENU_GROUPS, MENU_GROUP_BY_ROUTE } from '../../../navigation/workspaceMenu'
import { routes } from '../../../router'

/**
 * 租户侧「展示内容」页（Spec-D D2）的四条纪律，全部挂真实控件：
 * 1. 七个页签只能来自 GET /kinds——这里故意按后端词表的真实七档回，界面不许自己数；
 * 2. is_demo=1 的行必须带「示意」徽标与「请替换为真实资料」，且只挂在示意的行上；
 * 3. 空列表说「还没有内容」，读失败说读失败——两句话不许互相冒充；
 * 4. 后端拒绝保存时那句中文（认不出的 kind 等）原样上屏，不许吞、不许改写。
 * 菜单归属另钉一条：这一页进「网站内容」（site-content），绝不进任何建站组（键以 build 开头）。
 */

vi.mock('../../../api/portalShowcase', () => ({
  portalShowcaseApi: {
    kinds: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    portalVisible: vi.fn()
  },
  resolveMediaIdByUrl: vi.fn(),
  fetchMediaUrl: vi.fn()
}))

vi.mock('../../../api/portalSites', () => ({
  portalSitesApi: { listMine: vi.fn() }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ tenantId: 15, selectedTenantId: null, isSuperAdmin: false })
}))

// D5-3 交棒链接带着 ?siteId=：照 assemble-job-view 那一档的写法只换 useRoute，给一个可写的 query
const routeQuery = vi.hoisted(() => ({ current: {} as Record<string, string> }))
vi.mock('vue-router', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return { ...actual, useRoute: () => ({ query: routeQuery.current, params: {} }) }
})

/**
 * 真实 Tabs 内部用 ResizeObserver 量页签宽度；全局 setup 里那个 `vi.fn()` 桩在 `new` 之下会炸
 * （vitest 的 mock 实现是箭头函数，构造调用直接被拒）。在本 spec 内换成最小可用的类，
 * 不去动共享 setup——别的用例的桩不归这里改。
 */
;(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

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

// 真实 input：必填槽提示与保存载荷都要靠它把值填进 v-model:value
const INPUT_STUB = {
  name: 'AInput',
  props: ['value', 'placeholder'],
  emits: ['update:value'],
  template: `<input class="a-input-stub" :placeholder="placeholder" :value="value"
    @input="$emit('update:value', $event.target.value)">`
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

const MEDIA_MODAL_STUB = {
  name: 'MediaImageLibraryModal',
  props: ['open'],
  emits: ['update:open', 'pick'],
  template: `<div class="media-modal-stub">
    <button class="stub-pick" @click="$emit('pick', 'https://cdn.test/logo.png', 'logo.png')">挑一张</button>
  </div>`
}

/** 后端 ShowcaseKinds 的真实七档（声明顺序 = 页签顺序），界面必须逐字渲染这一份 */
const KINDS = [
  { key: 'team', label: '团队成员', dataSource: 'teamMembers', sectionKey: 'about' },
  { key: 'milestone', label: '发展历程', dataSource: 'milestones', sectionKey: 'about' },
  { key: 'award', label: '资质荣誉', dataSource: 'awards', sectionKey: 'about' },
  { key: 'client_logo', label: '合作客户', dataSource: 'logoWall', sectionKey: null },
  { key: 'metric', label: '经营指标', dataSource: 'statsBand', sectionKey: null },
  { key: 'testimonial', label: '客户评价', dataSource: 'testimonials', sectionKey: null },
  { key: 'faq', label: '常见问题', dataSource: 'faqs', sectionKey: 'services' }
]

function item(id: number, kind: string, overrides: Record<string, unknown> = {}) {
  return {
    id, siteId: 7, kind, title: `条目 ${id}`, subtitle: null, body: null,
    valueNumber: null, valueSuffix: null, mediaId: null, url: null, industry: null,
    sortOrder: 0, enabled: true, isDemo: false, ...overrides
  }
}

async function mountView(rows: unknown[] = []) {
  const wrapper = mount(ShowcaseManageView, {
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
        'a-select': { name: 'ASelect', props: ['value', 'options'], emits: ['update:value', 'change'], template: '<div class="a-select-stub" />' },
        'a-table': TABLE_STUB,
        'a-modal': MODAL_STUB,
        'a-alert': ALERT_STUB,
        'a-empty': { name: 'AEmpty', props: ['description'], template: '<div class="a-empty-stub">{{ description }}</div>' },
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-input': INPUT_STUB,
        'a-textarea': { name: 'ATextarea', props: ['value'], emits: ['update:value'], template: '<textarea class="a-input-stub" :value="value" @input="$emit(\'update:value\', $event.target.value)"></textarea>' },
        'a-switch': { name: 'ASwitch', props: ['checked'], emits: ['update:checked'], template: '<button class="a-switch-stub" @click="$emit(\'update:checked\', !checked)" />' },
        'a-popconfirm': { name: 'APopconfirm', emits: ['confirm'], template: '<span><slot /><button class="pop-yes" @click="$emit(\'confirm\')">删</button></span>' },
        MediaImageLibraryModal: MEDIA_MODAL_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function buttonByText(wrapper: Awaited<ReturnType<typeof mountView>>, text: string) {
  const found = wrapper.findAll('button').filter(node => (node.text() || '').trim() === text)
  if (!found.length) {
    throw new Error(`找不到文案为「${text}」的按钮`)
  }
  return found[0]
}

function inputByPlaceholder(wrapper: Awaited<ReturnType<typeof mountView>>, prefix: string) {
  const node = wrapper.find(`input.a-input-stub[placeholder^="${prefix}"]`)
  if (!node.exists()) {
    throw new Error(`找不到 placeholder 以「${prefix}」开头的输入框`)
  }
  return node
}

async function clickTab(wrapper: Awaited<ReturnType<typeof mountView>>, label: string) {
  const tab = wrapper.findAll('button[role="tab"]').find(node => node.text() === label)
  if (!tab) {
    throw new Error(`找不到文案为「${label}」的页签按钮`)
  }
  await tab.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  routeQuery.current = {}
  vi.mocked(portalShowcaseApi.kinds).mockResolvedValue(KINDS as any)
  vi.mocked(portalShowcaseApi.list).mockResolvedValue(rowsFixture() as any)
  vi.mocked(portalSitesApi.listMine).mockResolvedValue([{ id: 7, name: '测试站' }] as any)
  vi.mocked(fetchMediaUrl).mockResolvedValue('https://cdn.test/seeded.png')
})

function rowsFixture() {
  return [
    item(1, 'team', { title: '张示意', isDemo: true }),
    item(2, 'team', { title: '李真实' }),
    item(3, 'metric', { title: '客户数', valueNumber: 120, valueSuffix: '+' })
  ]
}

describe('ShowcaseManageView 的页签与列表', () => {
  it('七个页签逐一来自 /kinds：标签与顺序都照后端词表渲染', async () => {
    const wrapper = await mountView()
    const tabs = wrapper.findAll('button[role="tab"]')
    expect(tabs).toHaveLength(7)
    expect(tabs.map(tab => tab.text())).toEqual(KINDS.map(kind => kind.label))
  })

  it('点真实页签切类别：列表按 kind 过滤，不是整表换文案', async () => {
    const wrapper = await mountView()
    expect(wrapper.html()).toContain('张示意')
    await clickTab(wrapper, '经营指标')
    const rows = wrapper.findAll('.row')
    expect(rows.every(row => row.text().includes('客户数'))).toBe(true)
    expect(document.body.textContent).not.toContain('张示意')
    expect(document.body.textContent).toContain('共 1 条')
  })

  it('is_demo=1 的行带「示意」徽标与「请替换为真实资料」，真实行一个都不挂', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('.row')
    const demo = rows.find(row => row.text().includes('张示意'))
    const real = rows.find(row => row.text().includes('李真实'))
    expect(demo!.text()).toContain('示意')
    expect(demo!.text()).toContain('请替换为真实资料')
    expect(real!.text()).not.toContain('示意')
    expect(real!.text()).not.toContain('请替换为真实资料')
  })

  it('空的一类说「还没有内容」，不冒充加载失败', async () => {
    const wrapper = await mountView()
    await clickTab(wrapper, '常见问题')
    const empty = wrapper.find('.a-empty-stub')
    expect(empty.text()).toBe('「常见问题」这一类还没有内容：点「新增条目」填第一条真实资料')
    expect(wrapper.find('.alert-stub[data-type="error"]').exists()).toBe(false)
  })

  it('读取失败报的是后端那句中文，且不把失败演成空列表', async () => {
    vi.mocked(portalShowcaseApi.list).mockRejectedValue(new Error('展示内容读取失败：服务开小差了'))
    const wrapper = await mountView()
    const errors = wrapper.findAll('.alert-stub[data-type="error"]')
    expect(errors.map(node => node.text()).join('|')).toContain('展示内容读取失败：服务开小差了')
    expect(wrapper.find('.a-empty-stub').exists()).toBe(false)
  })

  it('库里有词表没认识的 kind 时如实报数，不静默丢行', async () => {
    vi.mocked(portalShowcaseApi.list).mockResolvedValue([item(9, 'roadmap')] as any)
    const wrapper = await mountView()
    expect(document.body.textContent).toContain('词表里没有的类别（roadmap）')
  })
})

describe('ShowcaseManageView 的表单与后端报错', () => {
  it('缺必填槽只出即时提示、不发请求；补全后载荷按当前页签与站点拼', async () => {
    vi.mocked(portalShowcaseApi.create).mockResolvedValue(item(10, 'milestone') as any)
    const wrapper = await mountView()
    await clickTab(wrapper, '发展历程')
    buttonByText(wrapper, '新增条目').trigger('click')
    await flushPromises()
    buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(portalShowcaseApi.create).not.toHaveBeenCalled()
    const hints = wrapper.findAll('.slot-hint').map(node => node.text())
    expect(hints.some(text => text.includes('标题'))).toBe(true)
    expect(hints.some(text => text.includes('副标题'))).toBe(true)
    await inputByPlaceholder(wrapper, '这条展示内容叫什么').setValue('公司成立')
    await inputByPlaceholder(wrapper, '可选；发展历程').setValue('2016年3月')
    buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(portalShowcaseApi.create).toHaveBeenCalledTimes(1)
    expect(portalShowcaseApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 7, kind: 'milestone', title: '公司成立', subtitle: '2016年3月' })
    )
  })

  it('经营指标缺数值时当场提示，服务端仍是最终判据', async () => {
    const wrapper = await mountView()
    await clickTab(wrapper, '经营指标')
    buttonByText(wrapper, '新增条目').trigger('click')
    await flushPromises()
    await inputByPlaceholder(wrapper, '这条展示内容叫什么').setValue('服务客户')
    buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(portalShowcaseApi.create).not.toHaveBeenCalled()
    expect(wrapper.find('.slot-hint').text()).toContain('数值')
    // 数值字段只在 metric 页签的表单里出现：按原样字符串交回后端（尾零有意义）
    expect(wrapper.find('input[placeholder^="如 12.50"]').exists()).toBe(true)
  })

  it('后端拒绝（认不出的 kind）时那句中文原样上屏，不吞不改写', async () => {
    const rejection = '没有「blog」这一类展示内容，可选：team、milestone、award、client_logo、metric、testimonial、faq'
    vi.mocked(portalShowcaseApi.create).mockRejectedValue(new Error(rejection))
    const wrapper = await mountView()
    buttonByText(wrapper, '新增条目').trigger('click')
    await flushPromises()
    await inputByPlaceholder(wrapper, '这条展示内容叫什么').setValue('某成员')
    // 团队成员的必填槽是头像：先走图位把槽补齐，让请求真发出去
    vi.mocked(resolveMediaIdByUrl).mockResolvedValue(77)
    buttonByText(wrapper, '从素材库选图').trigger('click')
    await flushPromises()
    wrapper.findComponent(MEDIA_MODAL_STUB).vm.$emit('pick', 'https://cdn.test/logo.png', 'logo.png')
    await flushPromises()
    expect(portalShowcaseApi.create).not.toHaveBeenCalled()
    buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(resolveMediaIdByUrl).toHaveBeenCalledWith('https://cdn.test/logo.png', 15)
    const modalError = wrapper.findAll('.alert-stub[data-type="error"]').map(node => node.text())
    expect(modalError.join('|')).toContain(rejection)
  })

  it('图位只认素材库：挑中的图按地址回查成 mediaId 再随表单交回', async () => {
    vi.mocked(resolveMediaIdByUrl).mockResolvedValue(77)
    vi.mocked(portalShowcaseApi.create).mockResolvedValue(item(11, 'team') as any)
    const wrapper = await mountView()
    buttonByText(wrapper, '新增条目').trigger('click')
    await flushPromises()
    await inputByPlaceholder(wrapper, '这条展示内容叫什么').setValue('王芳')
    buttonByText(wrapper, '从素材库选图').trigger('click')
    await flushPromises()
    expect(wrapper.find('.media-modal-stub').exists()).toBe(true)
    wrapper.findComponent(MEDIA_MODAL_STUB).vm.$emit('pick', 'https://cdn.test/logo.png', 'logo.png')
    await flushPromises()
    buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(portalShowcaseApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'team', mediaId: 77 })
    )
  })
})

describe('展示内容页的菜单归属（Spec-C §2.1 纪律）', () => {
  it('路由挂「网站内容」组（tenant 域），绝不进建站组（Spec-H 后组名收短、键名去掉连字符，判据同步收紧）', () => {
    expect(MENU_GROUP_BY_ROUTE['workspace-portal-showcase']).toBe('site-content')
    const group = MENU_GROUPS.find(entry => entry.key === MENU_GROUP_BY_ROUTE['workspace-portal-showcase'])
    expect(group?.label).toBe('网站内容')
    expect(group?.domain).toBe('tenant')
    // 以前的判据是 `!key.startsWith('build-')`；Spec-H 把建站那组改名成键 `build`，
    // 那条前缀判据就漏了它自己，所以这里改成「任何 build 开头的组都不许进」。
    expect(group?.key).not.toMatch(/^build/)
    const workspace = routes.find(route => route.name === 'workspace')
    const showcase = workspace?.children?.find(child => child.name === 'workspace-portal-showcase')
    expect(showcase?.path).toBe('portal/showcase')
    // 菜单显隐、路由守卫、后端 @RequirePermission 三处必须是同一个码
    expect((showcase?.meta as any)?.requiredPermission).toBe('portal:siteinfo:manage')
  })
})

describe('交棒链接的站点定位（D5-3 那条 ?siteId=）', () => {
  it('query 带的 siteId 在可选清单里：取数取的是它指的那个站，不回落 sites[0]', async () => {
    routeQuery.current = { siteId: '8' }
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([{ id: 7, name: '甲站' }, { id: 8, name: '乙站' }] as any)
    const wrapper = await mountView()
    expect(portalShowcaseApi.list).toHaveBeenLastCalledWith(8)
    wrapper.unmount()
  })

  it('query 带的 siteId 不在清单里：回落既有默认，绝不拿一个幽灵 id 去读写', async () => {
    routeQuery.current = { siteId: '99' }
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([{ id: 7, name: '甲站' }, { id: 8, name: '乙站' }] as any)
    const wrapper = await mountView()
    expect(portalShowcaseApi.list).toHaveBeenLastCalledWith(null)
    wrapper.unmount()
  })

  it('没带 query 且只有一个站：维持既有的自动选中', async () => {
    const wrapper = await mountView()
    expect(portalShowcaseApi.list).toHaveBeenLastCalledWith(7)
    wrapper.unmount()
  })
})

describe('站点下拉走的是租户侧自己的口（Q-3）', () => {
  it('下拉的站点来自 /portal/sites，不再打建设域那个 /admin/sites', async () => {
    const wrapper = await mountView()
    expect(portalSitesApi.listMine).toHaveBeenCalled()
    // a-select 桩把 options 当 prop 收，不渲染成文字，所以这里读 prop
    expect(wrapper.findComponent({ name: 'ASelect' }).props('options')).toEqual([{ value: 7, label: '测试站' }])
    wrapper.unmount()
  })

  it('站点口读失败只说站点读失败，内容表格照旧渲染', async () => {
    vi.mocked(portalSitesApi.listMine).mockRejectedValue(new Error('缺少权限: portal:build:manage'))
    const wrapper = await mountView()
    // 页首那条 info 说明与这条 error 共用同一个类名，所以按「有没有这一句」判而不是取第一条
    const notices = wrapper.findAll('.showcase-manage-page__notice').map(node => node.text())
    expect(notices.join(' ')).toContain('缺少权限: portal:build:manage')
    // 站点没选成时列表按「全部站点」取，行数是桩里那三条还是子集不重要——重要的是这一页没有整页报死
    expect(wrapper.findAll('.row').length).toBeGreaterThan(0)
    wrapper.unmount()
  })
})
