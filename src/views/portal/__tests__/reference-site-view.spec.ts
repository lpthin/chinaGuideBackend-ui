import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import ReferenceSiteView from '../ReferenceSiteView.vue'
import http from '../../../api/http'
import { portalReferenceApi, REFERENCE_MAX_PAGES_LIMIT, type PromotedBlock } from '../../../api/referenceSites'
import { portalPagesApi } from '../../../api/portalPages'
import { siteApi } from '../../../api/workspace'
import { useAuthStore } from '../../../stores/auth'

/**
 * 参考站摄取页的「路由清单两步走 + 取证可视化」（Spec-E T2/T3/T5 的界面那一半）。
 *
 * 这一页最容易骗人的三个地方，本文件逐条钉住：
 * 1. **词表**：版面/抓取状态/来源/槽位类型那几套中文只从 GET /vocabularies 读。
 *    后端写了个新值而界面显示空白，会被读成「这一格没值」——所以认不出时必须原样显示后端原文；
 * 2. **两步走**：「只列路由清单」不改任务状态，所以界面不能替它宣布「发现完成」；
 *    勾选框在不能重抓的任务上要整排收掉，勾得动、按下去报红的入口比没有入口更糟；
 * 3. **两个数不许互相冒充**：清单里的路由条数与「有版面的路由」是两件事，
 *    站级 token 与段级证据是两件事（后者永不上身，拍板 P-9）。
 * 顺带钉住模板包是只读的：点它不产生任何 POST。
 *
 * 以及「一键沉淀」（Spec-M §8 第 4 步）那一栏：它给的是一条<em>草稿</em>组件，
 * 所以成功那句话不许写成「已可用于搭建」；而判据⑤（重复沉淀直接拒）要看得见，
 * 于是已沉淀的那一行是「按钮留着但按不动 + 一句回指」，不是把按钮藏掉、也不是把后端那句拒绝改写成界面自己编的话。
 */

vi.mock('../../../api/referenceSites', async () => {
  const actual = (await vi.importActual('../../../api/referenceSites')) as Record<string, unknown>
  const fn = () => vi.fn().mockResolvedValue(null)
  return {
    ...actual,
    portalReferenceApi: {
      statusLabels: fn(),
      vocabularies: fn(),
      list: fn(),
      get: fn(),
      create: fn(),
      crawl: fn(),
      discoverRoutes: fn(),
      addRoute: fn(),
      pages: fn(),
      mappings: fn(),
      unmatchedGroups: fn(),
      promote: fn(),
      templatePackage: fn(),
      analyzeEstimate: fn(),
      analyze: fn(),
      verify: fn(),
      apply: fn(),
      capabilities: fn(),
      uploadShot: fn(),
      shotMedia: fn()
    }
  }
})

vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: { blocks: vi.fn().mockResolvedValue([]) }
}))

vi.mock('../../../api/workspace', () => ({
  siteApi: { list: vi.fn().mockResolvedValue([]) }
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'type', 'description', 'message', 'spinning', 'width', 'column', 'size'],
  template: `<div class="${name.toLowerCase()}-stub"><slot name="title" /><slot name="message" /><slot name="extra" /><slot /></div>`
})

/**
 * 真能勾的表格：勾选框只在传了 rowSelection 时画出来，点一下就把这一行的 key 累加进选中集。
 *
 * 「勾得动吗」是本页最要紧的一条交互，用全局 stub 演一遍等于没测。
 */
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    rowSelection: { type: Object, default: undefined },
    scroll: { type: Object, default: undefined }
  },
  template: `
    <div class="table-stub" :data-selectable="rowSelection ? 'yes' : 'no'">
      <div v-if="!dataSource.length" class="empty-slot"><slot name="emptyText" /></div>
      <div v-for="record in dataSource" :key="record.id" class="row">
        <label v-if="rowSelection" class="row-check">
          <input
            type="checkbox"
            :checked="rowSelection.selectedRowKeys.includes(record.id)"
            @change="
              rowSelection.onChange(
                rowSelection.selectedRowKeys.includes(record.id)
                  ? rowSelection.selectedRowKeys.filter(key => key !== record.id)
                  : [...rowSelection.selectedRowKeys, record.id]
              )
            "
          >
        </label>
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

const INPUT_STUB = {
  name: 'AInput',
  props: ['value', 'placeholder', 'maxlength'],
  emits: ['update:value'],
  template: `<input class="a-input-stub" :placeholder="placeholder" :value="value"
    @input="$emit('update:value', $event.target.value)">`
}

const NUMBER_STUB = {
  name: 'AInputNumber',
  props: ['value', 'min', 'max'],
  emits: ['update:value'],
  template: `<input class="a-number-stub" type="number" :min="min" :max="max" :value="value"
    @input="$emit('update:value', Number($event.target.value))">`
}

const SELECT_STUB = {
  name: 'ASelect',
  props: ['value', 'options', 'placeholder'],
  emits: ['update:value'],
  template: `<div class="a-select-stub">
    <button v-for="opt in options" :key="String(opt.value)" class="select-option" type="button"
      @click="$emit('update:value', opt.value)">{{ opt.label }}</button>
  </div>`
}

const MODAL_STUB = {
  name: 'AModal',
  props: ['title', 'open', 'okText', 'confirmLoading'],
  emits: ['update:open', 'ok'],
  template: `<div class="a-modal-stub">
    <h1 class="modal-title">{{ title }}</h1>
    <slot />
    <button class="modal-ok" @click="$emit('ok')">{{ okText || '确定' }}</button>
  </div>`
}

const ALERT_STUB = {
  name: 'AAlert',
  props: ['type', 'message', 'description', 'showIcon'],
  template: `<div class="alert-stub" :data-type="type">
    <span class="alert-message">{{ message }}</span>
    <span class="alert-description">{{ description }}</span>
    <slot name="message" />
  </div>`
}

/** tab 全部常驻渲染：断言按文案找控件，不需要模拟切页 */
const TAB_PANE_STUB = {
  name: 'ATabPane',
  props: ['tab'],
  template: `<div class="tab-pane-stub" :data-tab="tab"><slot /></div>`
}

const TAG_STUB = {
  name: 'ATag',
  props: ['color'],
  template: '<span class="tag-stub"><slot /></span>'
}

/**
 * 提示气泡把 title 也画出来：这一页有好几句「为什么这个按钮是死的」只写在 tooltip 里，
 * 画不出来就等于测不到——而那些话正是界面不许谎报的地方。
 */
const TOOLTIP_STUB = {
  name: 'ATooltip',
  props: ['title'],
  template: '<div class="a-tooltip-stub"><span class="tooltip-title">{{ title }}</span><slot /></div>'
}

async function mountView() {
  const wrapper = mount(ReferenceSiteView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-drawer': PASS_THROUGH('ADrawer'),
        'a-tabs': PASS_THROUGH('ATabs'),
        'a-tab-pane': TAB_PANE_STUB,
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
        'a-divider': PASS_THROUGH('ADivider'),
        'a-tooltip': TOOLTIP_STUB,
        'a-tag': TAG_STUB,
        'a-progress': { name: 'AProgress', props: ['percent'], template: '<i class="progress-stub" />' },
        'a-image': { name: 'AImage', props: ['src', 'width'], template: '<img class="img-stub" :src="src">' },
        'a-upload': PASS_THROUGH('AUpload'),
        'a-switch': { name: 'ASwitch', props: ['checked'], emits: ['update:checked'], template: '<i />' },
        'a-radio-group': PASS_THROUGH('ARadioGroup'),
        'a-radio': PASS_THROUGH('ARadio'),
        'a-checkbox': PASS_THROUGH('ACheckbox'),
        'a-textarea': PASS_THROUGH('ATextarea'),
        'a-input': INPUT_STUB,
        'a-input-number': NUMBER_STUB,
        'a-select': SELECT_STUB,
        'a-table': TABLE_STUB,
        'a-modal': MODAL_STUB,
        'a-alert': ALERT_STUB,
        'a-empty': {
          name: 'AEmpty',
          props: ['description'],
          template: '<div class="a-empty-stub">{{ description }}</div>'
        },
        LoadingOutlined: { name: 'LoadingOutlined', template: '<i />' }
      }
    }
  })
  await flushPromises()
  return wrapper
}

function task(status = 'pending', overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    tenantId: 1,
    sourceUrl: 'https://template.example.com',
    mode: 'url',
    status,
    maxPages: 12,
    obeyRobots: true,
    pagesCrawled: 0,
    errorMessage: null,
    createdBy: 'admin',
    createdAt: '2026-09-27T10:00:00',
    finishedAt: null,
    ...overrides
  }
}

/**
 * 三行清单：一条只发现没抓、一条抓开且是 SPA 渲染后的版面、一条是死链。
 *
 * 第二行的 token 是分层后的形状；第三行是 T3 之前的扁平老行——两行必须在界面上说法不同。
 */
function pages() {
  return [
    {
      id: 11,
      referenceId: 7,
      url: 'https://template.example.com/services',
      routePath: '/services',
      pageName: '服务项目',
      renderMode: 'hydrated',
      crawlState: 'discovered',
      linkSource: 'rendered_dom',
      depth: 1,
      shotDesktopId: null,
      shotTabletId: null,
      shotMobileId: null,
      domSummaryJson: null,
      designTokensJson: null,
      observedSectionsJson: null,
      robotsAllowed: null,
      fetchedAt: null
    },
    {
      id: 12,
      referenceId: 7,
      url: 'https://template.example.com/',
      routePath: '/',
      pageName: null,
      renderMode: 'hydrated',
      crawlState: 'ok',
      linkSource: 'raw_html',
      depth: 0,
      shotDesktopId: null,
      shotTabletId: null,
      shotMobileId: null,
      domSummaryJson: '{"sections":[{"name":"hero"},{"name":"footer"}]}',
      designTokensJson:
        '{"site":{"colorPrimary":"#111111","radius":"12px"},"sectionHints":[{"tag":"section","tokens":{"heading":["#222222"]}}]}',
      observedSectionsJson: '{"sections":[{"role":"主视觉"},{"role":"页脚"}]}',
      robotsAllowed: true,
      fetchedAt: '2026-09-27T10:05:00'
    },
    {
      id: 13,
      referenceId: 7,
      url: 'https://template.example.com/contact',
      routePath: '/contact',
      pageName: null,
      renderMode: 'static',
      crawlState: 'not_found',
      linkSource: 'raw_html',
      depth: 1,
      shotDesktopId: null,
      shotTabletId: null,
      shotMobileId: null,
      domSummaryJson: null,
      designTokensJson: '{"colorPrimary":"#333333","spacingScale":1.2}',
      observedSectionsJson: null,
      robotsAllowed: null,
      fetchedAt: null
    }
  ]
}

const VOCABULARIES = {
  renderMode: { static: '原文里有版面', hydrated: '原文只是壳，结构取自浏览器渲染后的版面' },
  crawlState: {
    discovered: '已发现，还没抓',
    ok: '已抓到',
    not_found: '打不开（404 或路由不存在）',
    blocked: '被限制挡住（robots 或地址闸）',
    offsite: '跳到站外，不抓'
  },
  linkSource: { raw_html: '来自页面原文', rendered_dom: '来自渲染后的版面', manual: '人工补录' },
  requiredSignal: { 'label-star': '只有 label 上写了星号（DOM 属性里读不出来）' },
  slotKind: { text: '一行文本', richtext: '一段正文', image: '一张图' },
  contentSlot: { heading: '这一格有一个标题' },
  interaction: { 'sticky-header': '页头滚动时吸顶', 'hover-lift': '卡片悬停时抬起或加阴影' }
}

function templatePackage() {
  return {
    referenceSiteId: 7,
    sourceUrl: 'https://template.example.com',
    status: 'needs_human',
    family: 'wxz_tailwind_spa',
    routeCount: 3,
    crawledCount: 1,
    routes: [{ path: '/services', renderMode: 'hydrated', crawlState: 'discovered', linkSource: 'rendered_dom' }],
    pages: [
      {
        path: '/',
        roles: ['主视觉', '页脚'],
        slotShapes: [
          {
            order: 0,
            tag: 'section',
            route: '/',
            slots: [
              { key: 'heading', kind: 'text', isArray: false },
              { key: 'image', kind: 'image', isArray: false, imageSpec: { count: 1, w: 400, h: 225, prompt: 'clinic-interior' } },
              { key: 'visit-date', kind: 'date', isArray: false, requiredSignal: 'label-star' }
            ]
          }
        ]
      }
    ],
    vocabulary: [
      { key: 'service', source: 'select', items: [{ slug: 'checkup', label: '基础诊疗' }], seenOn: ['/', '/services'] }
    ],
    tokens: { colorPrimary: '#111111', radius: '12px' },
    tokenVariedKeys: ['radius'],
    interactionHints: [{ kind: 'sticky-header', seenOn: ['/'] }],
    unmatched: [{ path: '/', observedBlock: '预约表单', note: '白名单里没有能长出业务表单的区块', confidence: 0.2 }]
  }
}

/**
 * 打开某一个任务的抽屉。
 *
 * rows 必须由调用方传：这里默认会重新挂一遍 pages fixture，任何在调用前 mockResolvedValue 过的
 * 行数据都会被抹掉——那等于测试改了自己的前提。积压清单同理，所以它也是参数。
 */
async function openDrawer(
  wrapper: any,
  site = task(),
  rowsOverride?: Array<Record<string, unknown>>,
  backlog: Array<Record<string, unknown>> = []
) {
  vi.mocked(portalReferenceApi.get).mockResolvedValue(site as any)
  vi.mocked(portalReferenceApi.pages).mockResolvedValue((rowsOverride ?? pages()) as any)
  vi.mocked(portalReferenceApi.mappings).mockResolvedValue([])
  vi.mocked(portalReferenceApi.unmatchedGroups).mockResolvedValue(backlog as any)
  const review = wrapper.findAll('button').filter((item: any) => item.text() === '审阅')
  await review[0].trigger('click')
  await flushPromises()
}

function routeRows(wrapper: any) {
  return wrapper.findAll('.reference-site-page__routes .row')
}

function rowText(wrapper: any, needle: string) {
  const found = routeRows(wrapper).find((item: any) => item.text().includes(needle))
  if (!found) {
    throw new Error(`找不到包含「${needle}」的路由清单行`)
  }
  return found.text()
}

/** 按路径精确取行：'/' 是任何一条路由的子串，包含匹配会第一行就命中 */
function routeText(wrapper: any, path: string) {
  const found = routeRows(wrapper).find((item: any) => {
    const cell = item.find('.reference-site-page__route')
    return cell.exists() && cell.text() === path
  })
  if (!found) {
    throw new Error(`找不到路由为「${path}」的清单行`)
  }
  return found.text()
}

/** 模板证据那一栏的作用域：整页找 .a-empty-stub 会先撞上「区块映射」的空态 */
function packagePane(wrapper: any) {
  const pane = wrapper
    .findAll('.tab-pane-stub')
    .find((node: any) => (node.attributes('data-tab') || '').includes('模板证据'))
  if (!pane) {
    throw new Error('找不到「拆出来的模板证据」标签页')
  }
  return pane
}

function buttons(wrapper: any, text: string) {
  return wrapper.findAll('button').filter((item: any) => (item.text() || '').trim() === text)
}

function alerts(wrapper: any, type: string) {
  return wrapper.findAll(`.alert-stub[data-type="${type}"]`).map((node: any) => node.text())
}

/** 按 placeholder 取控件，取不到就点名：拿 undefined 往下 trigger 只会报成「读属性失败」 */
function inputByPlaceholder(wrapper: any, placeholder: string) {
  const found = wrapper
    .findAll('input.a-input-stub')
    .find((node: any) => node.attributes('placeholder') === placeholder)
  if (!found) {
    throw new Error(`找不到 placeholder 为「${placeholder}」的输入框`)
  }
  return found
}

function tables(wrapper: any) {
  return wrapper.findAll('.table-stub').map((table: any) => table.attributes('data-selectable'))
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  // 这一页的路由门是 portal:build:reference，但区块/站点两个下拉走的是 portal:build:manage；
  // 默认两码都给（= 超管那一份），缺码的样子单独有用例钉。
  useAuthStore().user = {
    id: 1,
    username: 'tester',
    roles: ['SUPER_ADMIN'],
    permissions: ['portal:build:reference', 'portal:build:manage']
  } as any
  vi.mocked(portalReferenceApi.statusLabels).mockResolvedValue({
    pending: '排队中',
    crawling: '抓取中',
    analyzing: '结构归纳中',
    mapping: '映射整理中',
    needs_human: '需人工处理',
    done: '已完成',
    failed: '失败'
  })
  vi.mocked(portalReferenceApi.vocabularies).mockResolvedValue(VOCABULARIES as any)
  vi.mocked(portalReferenceApi.list).mockResolvedValue([task('done', { pagesCrawled: 1 })] as any)
  vi.mocked(portalReferenceApi.templatePackage).mockResolvedValue(templatePackage() as any)
})

describe('ReferenceSiteView 消费词表（不抄第二份）', () => {
  it('路由清单每一行的版面/来源/抓取状态念的是 /vocabularies 那份中文', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    expect(portalReferenceApi.vocabularies).toHaveBeenCalled()
    const route = rowText(wrapper, '/services')
    expect(route).toContain('已发现，还没抓')
    expect(route).toContain('来自渲染后的版面')
    expect(rowText(wrapper, '/contact')).toContain('打不开（404 或路由不存在）')
  })

  it('后端写了一个词表里没有的新值：原样显示，不留空白', async () => {
    const drifted = pages().map(page => ({ ...page, crawlState: 'rendered_pending_review' }))
    const wrapper = await mountView()
    await openDrawer(wrapper, task(), drifted)
    // 端点整体没回来时也一样：认不出就念原文，不把整张表变成空白
    expect(rowText(wrapper, '/services')).toContain('rendered_pending_review')
    expect(rowText(wrapper, '/services')).not.toContain('已发现，还没抓')
  })

  it('词表接口挂了只降级成一句提醒，清单照样翻', async () => {
    vi.mocked(portalReferenceApi.vocabularies).mockRejectedValue(new Error('词表接口 500'))
    const wrapper = await mountView()
    await openDrawer(wrapper)
    const warning = alerts(wrapper, 'warning').join('|')
    expect(warning).toContain('词表接口 500')
    expect(warning).toContain('显示的是后端原值而不是中文标签')
    expect(routeRows(wrapper).length).toBe(3)
    // 退回原值不是退回空白
    expect(rowText(wrapper, '/services')).toContain('discovered')
  })
})

describe('两步走：先列清单，勾完再抓', () => {
  /** 「开始抓取」走的是 pending → crawling，跑过的任务按下去只会被后端拒——所以整排勾选框收掉 */
  it('任务能抓的时候才给勾选框；跑过之后勾选框与抓取按钮一起退场', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    expect(tables(wrapper)).toContain('yes')

    await openDrawer(wrapper, task('done', { pagesCrawled: 1 }))
    expect(tables(wrapper)).toContain('no')
    expect(buttons(wrapper, '开始抓取')).toHaveLength(0)
    expect(buttons(wrapper, '抓取勾中的 2 页')).toHaveLength(0)
    // 只列路由清单不改状态，跑完的任务仍然可以再列一次（清单会变长，状态不动）
    expect(buttons(wrapper, '只列路由清单')).toHaveLength(1)
  })

  /** 商用 #108：失败的任务不必新建一个重做——已抓的页面与截图都还在旧任务里 */
  it('停在「失败」的任务仍然给抓取按钮', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper, task('failed', { errorMessage: '截图服务没起：连接被拒', finishedAt: '2026-09-28T11:00:00' }))

    expect(buttons(wrapper, '开始抓取')).toHaveLength(1)
    expect(wrapper.text()).toContain('不用新建一个重做')
    // 失败是终态，上一趟的结束时间在这一格是有意义的（描述项的标签不在测试桩的文本里，认时间值）
    expect(wrapper.text()).toContain('2026-09-28 11:00')
  })

  /** 重跑一趟时后端不清上一趟的结束时间；还在跑却显示着它，等于界面自己谎报「这趟结束了」 */
  it('任务还在跑的时候不显示结束时间', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper, task('crawling', { pagesCrawled: 1, finishedAt: '2026-09-27T18:00:00' }))

    expect(wrapper.text()).not.toContain('2026-09-27 18:00')
  })

  it('勾选后按钮点名勾了几条，点下去交的是 pageIds 而不是整站重抓', async () => {    const wrapper = await mountView()
    await openDrawer(wrapper)
    const boxes = wrapper.findAll('input[type="checkbox"]')
    await boxes[0].trigger('change')
    await boxes[1].trigger('change')
    const crawlButton = buttons(wrapper, '抓取勾中的 2 页')
    expect(crawlButton).toHaveLength(1)
    await crawlButton[0].trigger('click')
    await flushPromises()
    expect(portalReferenceApi.crawl).toHaveBeenCalledWith(7, [11, 12])
  })

  it('一条都没勾就是老行为：按钮仍叫「开始抓取」，pageIds 交空', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    await buttons(wrapper, '开始抓取')[0].trigger('click')
    await flushPromises()
    expect(portalReferenceApi.crawl).toHaveBeenCalledWith(7, [])
  })

  /** 这一步不改任务状态，所以「受理」之后界面不许出现任何「已完成/发现完成」的口径 */
  it('只列路由清单受理完不宣布结果，也不顺手抓一页', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    await buttons(wrapper, '只列路由清单')[0].trigger('click')
    await flushPromises()
    expect(portalReferenceApi.discoverRoutes).toHaveBeenCalledWith(7)
    expect(portalReferenceApi.crawl).not.toHaveBeenCalled()
    expect(portalReferenceApi.analyze).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('路由发现完成')
    // 受理回执里状态还是排队中：界面不许自己把它推成别的
    expect(wrapper.text()).toContain('排队中')
    wrapper.unmount()
  })

  it('补录一条路由只往清单里加一行，不带抓取', async () => {
    vi.mocked(portalReferenceApi.addRoute).mockResolvedValue({ id: 14, routePath: '/appointment' } as any)
    const wrapper = await mountView()
    await openDrawer(wrapper)
    await buttons(wrapper, '补录一条路由')[0].trigger('click')
    await flushPromises()
    const pathInput = inputByPlaceholder(wrapper, '/appointment')
    await pathInput.setValue('/appointment')
    await buttons(wrapper, '加进清单')[0].trigger('click')
    await flushPromises()
    expect(portalReferenceApi.addRoute).toHaveBeenCalledWith(7, { path: '/appointment', pageName: null })
    expect(portalReferenceApi.crawl).not.toHaveBeenCalled()
  })

  it('路径没写斜杠时界面先拦住：后端那句中文判据不在这里重复实现，但要省一次往返', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    await buttons(wrapper, '补录一条路由')[0].trigger('click')
    await flushPromises()
    const pathInput = inputByPlaceholder(wrapper, '/appointment')
    await pathInput.setValue('appointment')
    await buttons(wrapper, '加进清单')[0].trigger('click')
    await flushPromises()
    expect(portalReferenceApi.addRoute).not.toHaveBeenCalled()
  })
})

describe('路由清单的诚实口径', () => {
  it('标签页点名「有版面 / 清单里」两个数，不把 3 条路由说成抓到 3 页', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    const tabs = wrapper.findAll('.tab-pane-stub').map((node: any) => node.attributes('data-tab'))
    expect(tabs.some(tab => (tab || '').includes('路由清单（1 / 3）'))).toBe(true)
  })

  it('SPA 那一族给一条说明，且只在真的出现过渲染后版面时说', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    expect(alerts(wrapper, 'info').join('|')).toContain('JS 渲染出来')
    const staticOnly = pages().map(page => ({ ...page, renderMode: 'static' }))
    const clean = await mountView()
    await openDrawer(clean, task('done', { pagesCrawled: 1 }), staticOnly)
    expect(alerts(clean, 'info').join('|')).not.toContain('JS 渲染出来')
  })

  it('死链单独说一句：留在清单里但不算抓到的页', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    const warning = alerts(wrapper, 'warning').join('|')
    expect(warning).toContain('1 条路由在清单里但抓不开')
    expect(warning).not.toContain('抓取失败')
  })

  it('还没抓的那一行不说「被对方限制」也不说「允许」：robots 是抓的时候才判的', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    expect(rowText(wrapper, '/services')).toContain('还没抓，没判过')
    expect(rowText(wrapper, '/services')).not.toContain('允许')
  })

  /** T3 分层之后，Object.keys 一跑了事会把「两个包装键」报成「2 组取值」 */
  it('站级 token 与段级证据分开数，分层之前的老行不冒充分过层', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    const layered = routeText(wrapper, '/')
    expect(layered).toContain('站级 2 项')
    expect(layered).toContain('段级提示 1 格')
    expect(layered).not.toContain('token 采样：2 组')
    const legacy = routeText(wrapper, '/contact')
    expect(legacy).toContain('2 项（分层之前的老行')
    expect(legacy).not.toContain('段级提示')
  })
})

describe('「暂未对上现有区块」那一栏按「类」报数，且不替人决定要不要新增区块', () => {
  /**
   * 2026-09-28 第二家参考站的真实形状：11 页把页脚重复声明了 11 次，真缺口只有一类。
   *
   * 后两列是「一键沉淀」（Spec-M §8 第 4 步）要的：mappingId 是这一族第一条映射的 id（按钮的去处），
   * promotedBlockKey 非空就是这一族已经有一个组件了。页脚那一行按「已经沉淀过」的样子写，
   * 这样同一份 fixture 既能测按钮，也能测回指。
   */
  function backlog() {
    return [
      {
        observedBlock: '文章列表筛选',
        capabilityKnown: false,
        rowCount: 3,
        paths: ['/', '/articles', '/about'],
        note: '白名单里没有能长出筛选 tabs 的区块',
        mappingId: 9,
        promotedBlockKey: null
      },
      {
        observedBlock: '页脚',
        capabilityKnown: true,
        rowCount: 11,
        paths: ['/', '/articles'],
        note: '重复的页脚，无需映射',
        mappingId: 12,
        promotedBlockKey: 'card-21fa426f'
      }
    ]
  }

  function backlogTab(wrapper: any) {
    const found = wrapper
      .findAll('.tab-pane-stub')
      .find((node: any) => (node.attributes('data-tab') || '').startsWith('暂未对上现有区块'))
    if (!found) {
      throw new Error('找不到「暂未对上现有区块」那一栏')
    }
    return found
  }

  it('标签页上的数字是真缺口类数：14 行对不上不等于缺 14 类', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper, task('needs_human'), undefined, backlog())
    expect(backlogTab(wrapper).attributes('data-tab')).toBe('暂未对上现有区块（1）')
  })

  /**
   * 2026-09-28 第三家参考站（任务 49）把这一栏的名字喊破了：清单里唯一一类是「全站菜单导航列表」，
   * 而导航在区块白名单里已有四块。这一栏说的必须是「模型这一趟没对上」这件库外可查的事实，
   * 不是「要新增区块」那个还没人做的决定。
   */
  it('这一栏只说「没对上」，不替人写下「需要新区块」那个决定', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper, task('needs_human'), undefined, backlog())
    expect(backlogTab(wrapper).attributes('data-tab')).not.toContain('需要新区块')
    expect(alerts(wrapper, 'info').join('|')).not.toContain('需要新区块')
    expect(wrapper.text()).not.toContain('需要新区块')
  })

  it('归并后的总类数与真缺口分开说，逐条处置指回「区块映射」那一栏', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper, task('needs_human'), undefined, backlog())
    const message = alerts(wrapper, 'info').join('|')
    expect(message).toContain('归并后 2 类')
    expect(message).toContain('其中 1 类这一趟没对上任何区块')
    expect(message).toContain('这一趟没再映射')
    expect(message).toContain('归并成 2 类')
    expect(message).toContain('说成「缺 14 类」')
    expect(message).toContain('逐条改映射在「区块映射」那一栏')
  })

  it('每一行点名它是哪一种、出现在哪几页、按页重复了几次', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper, task('needs_human'), undefined, backlog())
    const texts = backlogTab(wrapper)
      .findAll('.row')
      .map((row: any) => row.text())
      .join('|')
    expect(texts).toContain('这一趟没有区块对上')
    expect(texts).toContain('已有能力，这一趟重复声明')
    expect(texts).toContain('/、/articles、/about（3 页 / 3 条）')
    expect(texts).toContain('2 页 / 11 条')
    // 这一栏不再逐行给「改成映射到…」：一行现在代表十几条，一次点击改不完，反而会看着像改完了
    expect(texts).not.toContain('改成映射到')
  })
})

/**
 * 「一键沉淀」（Spec-M §8 第 4 步）：积压清单从「看完就完了」变成「看完能留下一条草稿」。
 *
 * <p>钉住四件事，每一件都是这一栏容易说谎的地方：
 * ① 按钮打的是这一族<em>第一条</em>映射的 id，界面上不自己挑另一行；
 * ② 已沉淀的那一行给回指、按钮留着但按不动——判据⑤要的就是「重复沉淀直接拒」这件看得见的事，
 *    把按钮藏掉等于把那条拒绝规则也一起藏了；
 * ③ 后端那四句中文拒绝理由原样念（清单是缓存的，界面这一侧永远可能已经过期）；
 * ④ 成功只说「存成了草稿」，启用是组件库里的第二个动作，这一口什么都没启用。</p>
 */
describe('暂未对上那一栏的「沉淀为组件」', () => {
  /** 三种形状各一行：按得动的、已经沉淀过的、后端没给 mappingId 的 */
  function backlog() {
    return [
      {
        observedBlock: '文章列表筛选',
        capabilityKnown: false,
        rowCount: 3,
        paths: ['/', '/articles'],
        note: '白名单里没有能长出筛选 tabs 的区块',
        mappingId: 9,
        promotedBlockKey: null
      },
      {
        observedBlock: '全站菜单导航列表',
        capabilityKnown: false,
        rowCount: 2,
        paths: ['/'],
        note: '整页菜单这一形对不到',
        mappingId: null,
        promotedBlockKey: null
      },
      {
        observedBlock: '页脚',
        capabilityKnown: true,
        rowCount: 11,
        paths: ['/', '/articles'],
        note: '重复的页脚，无需映射',
        mappingId: 12,
        promotedBlockKey: 'card-21fa426f'
      }
    ]
  }

  /** 三行的抓手（见 rowOf 为什么不能用区块名）：按得动的那一形、没 id 的那一形、已经沉淀过的那一形 */
  const GAP_ROW = '白名单里没有能长出筛选 tabs 的区块'
  const NO_ID_ROW = '整页菜单这一形对不到'
  const PROMOTED_ROW = '重复的页脚，无需映射'

  /** 任务的 id 就是沉淀那一口的路径参数，所以清单里那一行也得是 3 号任务 */
  async function openBacklog() {
    vi.mocked(portalReferenceApi.list).mockResolvedValue([task('needs_human', { id: 3 })] as any)
    const wrapper = await mountView()
    await openDrawer(wrapper, task('needs_human', { id: 3 }), undefined, backlog())
    return wrapper
  }

  function pane(wrapper: any) {
    const found = wrapper
      .findAll('.tab-pane-stub')
      .find((node: any) => (node.attributes('data-tab') || '').startsWith('暂未对上现有区块'))
    if (!found) {
      throw new Error('找不到「暂未对上现有区块」那一栏')
    }
    return found
  }

  /**
   * 按「为什么对不上」那一格的文字取行。
   *
   * <p>不能用区块名：那一列是 dataIndex，测试桩只把 bodyCell 的内容画出来，没写的列就是空的。
   * 这三句笔记在 fixture 里各不重复，认得出是哪一行。</p>
   */
  function rowOf(wrapper: any, note: string) {
    const found = pane(wrapper).findAll('.row').find((node: any) => node.text().includes(note))
    if (!found) {
      throw new Error(`找不到「${note}」那一行`)
    }
    return found
  }

  function promoteButton(row: any) {
    const found = row.findAll('button').filter((node: any) => (node.text() || '').trim() === '沉淀为组件')
    if (!found.length) {
      throw new Error('那一行没有「沉淀为组件」按钮')
    }
    return found[0]
  }

  it('按下去打的是这一族第一条映射的 id：界面不自己挑另一行，也不多带一份 body', async () => {
    vi.mocked(portalReferenceApi.promote).mockResolvedValue({
      blockDefId: 51, blockKey: 'card-9bb2c1', name: '文章列表筛选', observedBlock: '文章列表筛选'
    } as any)
    const wrapper = await openBacklog()

    expect(rowOf(wrapper, GAP_ROW).text()).toContain('沉淀为组件')
    await promoteButton(rowOf(wrapper, GAP_ROW)).trigger('click')
    await flushPromises()

    expect(portalReferenceApi.promote).toHaveBeenCalledWith(3, 9)
    // 两个参数就是全部：这一口没有请求体（那条口子与组件库新建抽屉重复，还会绕过那边校验）
    expect(vi.mocked(portalReferenceApi.promote).mock.calls[0]).toHaveLength(2)
    wrapper.unmount()
  })

  it('地址写的就是「这个任务的这一行」，且真的不带请求体', async () => {
    const actual = await vi.importActual<typeof import('../../../api/referenceSites')>('../../../api/referenceSites')
    const post = vi.spyOn(http, 'post').mockResolvedValue({ blockKey: 'card-9bb2c1' } as any)
    await actual.portalReferenceApi.promote(3, 9)
    expect(post).toHaveBeenCalledWith('/portal/reference-sites/3/mappings/9/promote')
    expect(post.mock.calls[0]).toHaveLength(1)
    post.mockRestore()
  })

  /** 判据⑤：回指而不是藏按钮——那一句「已经沉淀成 X」才是这一行现在的真相 */
  it('已沉淀的那一行摆出回指（含那个 key），按钮还在但按不动', async () => {
    const wrapper = await openBacklog()
    const row = rowOf(wrapper, PROMOTED_ROW)

    expect(row.text()).toContain('已沉淀成 card-21fa426f')
    expect(row.text()).toContain('沉淀为组件')
    expect(promoteButton(row).attributes('disabled')).toBeDefined()
    await promoteButton(row).trigger('click')
    await flushPromises()
    expect(portalReferenceApi.promote).not.toHaveBeenCalled()
  })

  it('后端没给 mappingId 的那一行按下去也没有去处：按钮是死的，并说清为什么是死的', async () => {
    const wrapper = await openBacklog()
    const row = rowOf(wrapper, NO_ID_ROW)

    expect(promoteButton(row).attributes('disabled')).toBeDefined()
    expect(row.text()).toContain('这一行没有可沉淀的映射记录')
  })

  /** 清单是缓存的，界面这一侧永远可能已经过期——所以拒绝来了要念原话，念不出就是少了一格证据 */
  it('后端回「已经沉淀过了」时界面原样念它那一句，不自己编一句，也不报成成功', async () => {
    vi.mocked(portalReferenceApi.promote).mockRejectedValue(
      new Error('这一行已经沉淀成组件「card-21fa426f」了，去组件库看它，别再建一个同形的')
    )
    const errored = vi.spyOn(message, 'error').mockImplementation(() => ({ key: 'toast' } as any))
    const succeeded = vi.spyOn(message, 'success').mockImplementation(() => ({ key: 'toast' } as any))
    const wrapper = await openBacklog()

    await promoteButton(rowOf(wrapper, GAP_ROW)).trigger('click')
    await flushPromises()

    expect(errored.mock.calls.map(call => String(call[0]))).toContain(
      '这一行已经沉淀成组件「card-21fa426f」了，去组件库看它，别再建一个同形的'
    )
    expect(succeeded).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('成功那句只说「草稿」，不替人宣布它能用了；说完重拉一次清单，让那一行自己变成回指', async () => {
    vi.mocked(portalReferenceApi.promote).mockResolvedValue({
      blockDefId: 51, blockKey: 'card-9bb2c1', name: '文章列表筛选', observedBlock: '文章列表筛选'
    } as any)
    const succeeded = vi.spyOn(message, 'success').mockImplementation(() => ({ key: 'toast' } as any))
    const wrapper = await openBacklog()
    expect(portalReferenceApi.unmatchedGroups).toHaveBeenCalledTimes(1)

    await promoteButton(rowOf(wrapper, GAP_ROW)).trigger('click')
    await flushPromises()

    const toast = succeeded.mock.calls.map(call => String(call[0])).join('|')
    expect(toast).toContain('已存为组件库草稿 card-9bb2c1，启用后才会进搭建器面板与提示词')
    expect(toast).not.toContain('已可用于搭建')
    // 回指来自后端那一列，不是界面在这儿自己记一笔：所以点完必须重读清单
    expect(portalReferenceApi.unmatchedGroups).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('一行按下去只发一次：还没回来之前那一行的按钮先转圈，不给人连点出两个同形组件', async () => {
    let release: (value: PromotedBlock) => void = () => {}
    vi.mocked(portalReferenceApi.promote).mockImplementation(
      () => new Promise<PromotedBlock>(resolve => { release = resolve })
    )
    const wrapper = await openBacklog()
    const button = promoteButton(rowOf(wrapper, GAP_ROW))

    await button.trigger('click')
    await button.trigger('click')
    await flushPromises()
    expect(portalReferenceApi.promote).toHaveBeenCalledTimes(1)

    release({ blockKey: 'card-9bb2c1' })
    await flushPromises()
    wrapper.unmount()
  })
})

describe('模板包：只读取证快照', () => {
  it('载入模板包不产生任何写请求，槽位形状/词表/交互都念词表那份中文', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    await buttons(wrapper, '载入模板包')[0].trigger('click')
    await flushPromises()
    expect(portalReferenceApi.templatePackage).toHaveBeenCalledWith(7)
    expect(portalReferenceApi.analyze).not.toHaveBeenCalled()
    expect(portalReferenceApi.crawl).not.toHaveBeenCalled()
    const text = wrapper.text()
    expect(text).toContain('一行文本')
    expect(text).toContain('一张图')
    expect(text).toContain('图位约 400×225')
    expect(text).toContain('clinic-interior')
    expect(text).toContain('只有 label 上写了星号（DOM 属性里读不出来）')
    expect(text).toContain('页头滚动时吸顶')
    expect(text).toContain('基础诊疗')
  })

  it('必填那一行说的是「从哪路看出来的」，不是「这个字段必须填」', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    await buttons(wrapper, '载入模板包')[0].trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('必填：是')
    expect(wrapper.text()).toContain('它最终的去处是前采里问客户的一道题')
  })

  it('段级取值不一致与站级取值各说各的：只有站级那层会上身', async () => {
    const wrapper = await mountView()
    await openDrawer(wrapper)
    await buttons(wrapper, '载入模板包')[0].trigger('click')
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('2 项（只有这一层会上身成站点样式）')
    expect(text).toContain('1 项各格不一致：radius')
    expect(alerts(wrapper, 'info').join('|')).toContain('段级那一半只是证据，不会变成站点样式')
  })

  it('没认出的家族与没载入的包各说各的，不拿空壳充数', async () => {
    const bare = { ...templatePackage(), family: undefined, pages: [], vocabulary: [], interactionHints: [] }
    vi.mocked(portalReferenceApi.templatePackage).mockResolvedValue(bare as any)
    const wrapper = await mountView()
    await openDrawer(wrapper)
    expect(packagePane(wrapper).find('.a-empty-stub').text()).toContain('还没载入')
    await buttons(wrapper, '载入模板包')[0].trigger('click')
    await flushPromises()
    const loaded = packagePane(wrapper).text()
    expect(loaded).toContain('没认出固定家族（按通用判据处理，这一路同样能出结构）')
    expect(loaded).toContain('没有记到任何交互形状')
    // 包是空的时候不许出现槽位/词表两张空表充数
    expect(loaded).toContain('没有认出成组的枚举')
  })
})

describe('页数上限（Spec-E §4 把 6 放宽到 12）', () => {
  it('新建任务里输入框的上限就是那个常量，提示文字里的数字与它同源', async () => {
    const wrapper = await mountView()
    await buttons(wrapper, '新建摄取任务')[0].trigger('click')
    await flushPromises()
    const number = wrapper.find('input.a-number-stub')
    expect(number.attributes('max')).toBe(String(REFERENCE_MAX_PAGES_LIMIT))
    expect(REFERENCE_MAX_PAGES_LIMIT).toBe(12)
    expect(wrapper.text()).toContain(`1–${REFERENCE_MAX_PAGES_LIMIT}`)
  })
})

/**
 * 成本闸（#107）的界面那一半：后端给了拒绝理由就必须看得见，而不是等按下确认再吃一个报错。
 *
 * <p>这条测试守的是「预估弹窗只念数字不念闸」那种假通：租户看到「预计 42 万 token，平台承担」，
 * 旁边没有任何一句「这一轮不会受理」，他会认为按下去就能跑。</p>
 */
describe('成本闸的拒绝理由要念给看预估的那个人', () => {
  it('超预算的预估用 warning 色，确认框里照原文再念一遍', async () => {
    vi.mocked(portalReferenceApi.analyzeEstimate).mockResolvedValue({
      referenceId: 7,
      estimatedTokens: 210_000,
      remainingTokens: 900_000,
      aiEnabled: true,
      notice: '这个任务按预估一轮要烧 420000 token，超过了单任务上限 120000 token'
        + '（app.portal.reference.max-tokens-per-task），这一轮不会受理。少喂几页再跑。'
    } as any)
    const wrapper = await mountView()
    await openDrawer(wrapper, task('analyzing'))
    await buttons(wrapper, '先估算消耗')[0].trigger('click')
    await flushPromises()

    expect(alerts(wrapper, 'warning').join(' ')).toContain('超过了单任务上限')

    await buttons(wrapper, '开始 AI 摄取')[0].trigger('click')
    await flushPromises()
    // 按下去也只会得到一个报错的按钮，不如把它写成不可点：按钮文案自己说清为什么是死的。
    // 这里找的是所有弹窗的确定按钮——只有摄取那一个的 ok-text 会跟着 notice 变
    expect(wrapper.findAll('.modal-ok').map((node: any) => node.text())).toContain('这一轮不会受理')
    expect(portalReferenceApi.analyze).not.toHaveBeenCalled()
  })

  it('没给理由时预估还是 info：warning 只留给真的拦住了的那一次', async () => {
    vi.mocked(portalReferenceApi.analyzeEstimate).mockResolvedValue({
      referenceId: 7,
      estimatedTokens: 12_000,
      remainingTokens: 900_000,
      aiEnabled: true,
      notice: null
    } as any)
    const wrapper = await mountView()
    await openDrawer(wrapper, task('analyzing'))
    await buttons(wrapper, '先估算消耗')[0].trigger('click')
    await flushPromises()

    expect(alerts(wrapper, 'info').join(' ')).toContain('预计 12000 token')
    expect(alerts(wrapper, 'warning').join(' ')).not.toContain('超过了单任务上限')
  })
})

describe('底数据按码取：缺 manage 就不发那两个口', () => {
  it('只有 reference 码时一条 manage 请求都不发，缺码那句写在明处，任务列表照常', async () => {
    useAuthStore().user = {
      id: 2,
      username: 'reviewer',
      roles: ['CONTENT_EDITOR'],
      permissions: ['portal:build:reference']
    } as any
    const wrapper = await mountView()
    expect(portalPagesApi.blocks).not.toHaveBeenCalled()
    expect(siteApi.list).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('这个账号没有 portal:build:manage')
    // 缺码只影响那两个下拉：任务列表这一半该照常拉，且一个 error 提示都不该弹出来
    expect(portalReferenceApi.list).toHaveBeenCalledTimes(1)
    expect(alerts(wrapper, 'error')).toHaveLength(0)
    wrapper.unmount()
  })
})

/**
 * 拆出去的那几份组件：setup 里的名字不许和 prop 同名。
 *
 * <p>这一条是现场真跑逼出来的。抽屉壳写 `:open="open"` 传 prop，内部又有一个用来打开任务的
 * `function open(id)`——`<script setup>` 的模板解析先看 setup 再看 props，于是 `:open` 绑上的是那个
 * 函数（恒真），抽屉一挂上就永远开着，把列表页那颗「新建摄取任务」整个盖住。单测全绿、vue-tsc 也绿：
 * 全局桩件把 a-drawer 换成了一个不带 open 语义的 div，这类只影响真 DOM 的遮蔽它查不出来。</p>
 */
describe('抽屉与四栏的 prop 名不许被同名函数/变量盖掉', () => {
  it('每份组件的 defineProps 键名，与它 setup 顶层声明的名字，一个都不许重叠', () => {
    // import.meta.glob 的参数必须是字面量，所以两处各写一次
    const drawer = import.meta.glob('../ReferenceTaskDrawer.vue', {
      eager: true,
      query: '?raw',
      import: 'default'
    }) as Record<string, string>
    const tabs = import.meta.glob('../reference/*.vue', {
      eager: true,
      query: '?raw',
      import: 'default'
    }) as Record<string, string>
    const sources = { ...drawer, ...tabs }
    expect(Object.keys(sources)).toHaveLength(5)

    for (const [file, source] of Object.entries(sources)) {
      const propsBlock = source.match(/defineProps<\{([\s\S]*?)\n\}>\(\)/)
      if (!propsBlock) continue
      const propNames = [...propsBlock[1].matchAll(/^\s{2}(\w+)\??\s*:/gm)].map(m => m[1])
      expect(propNames.length).toBeGreaterThan(0)
      const script = source.slice(source.indexOf('<script setup'))
      const declared = [...script.matchAll(/^(?:async )?function (\w+)|^(?:const|let) (\w+)\s*[=:(]/gm)].map(
        m => m[1] || m[2]
      )
      const collisions = propNames.filter(name => declared.includes(name))
      expect(collisions, `${file}：${collisions.join('、')} 与 prop 同名，模板里那个名字会绑到 setup 这一份`).toEqual([])
    }
  })
})
