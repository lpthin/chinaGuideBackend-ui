import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber, Select, Textarea } from 'ant-design-vue'
import BlockShowcaseView from '../BlockShowcaseView.vue'
import { blockDefsApi, type BlockDefRow } from '../../../api/blockDefs'

/**
 * 组件库（Spec-M §7「区块画廊升级为可写」+ §8 第 4 步，D4/D5）。
 *
 * 这一页要钉住的四件事：
 * 1. 清单、显示名、两族之分（source）、启用状态、分类、可选渲染器、默认字段结构——**只有接口一处来源**。
 *    用例故意喂两个前端从没听说过的 blockKey 与中文显示名，页面上出现它们才算真的没有第二份清单；
 * 2. 写动作只给界面那一族：代码族的行没有启用/改结构/删除，只有一颗「只读」和那句「要动它得发版」；
 * 3. 启用是第二个动作：新建提交完不会自动变已启用，被后端拒时界面上念的是后端原话；
 * 4. 演示 props 由字段结构推导：代码族那套分档不许被人工那一族的兜底改动，人工那一族的裸形状
 *    （裸 string / 裸 array）要能渲出内容，否则「这几格填得出来吗」这条判据在这一页上看不见。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/blockDefs', () => ({
  blockDefsApi: {
    list: vi.fn(),
    categories: vi.fn(),
    rendererOptions: vi.fn(),
    schemaPrefill: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setEnabled: vi.fn(),
    remove: vi.fn()
  },
  default: { blockDefsApi: {} }
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'dataSource', 'columns', 'spinning'],
  template: `<div class="${name}-stub"><span>{{ message }}{{ description }}</span>`
    + '<slot name="title" /><slot name="extra" /><slot name="message" /><slot />'
    + '<slot name="footer" /></div>'
})

/**
 * 抽屉只认 `open`：没打开时里面那一套表单一个都不该在 DOM 上——
 * 否则「启用」这类按文案找按钮的用例会摸到抽屉底部那颗「存为未启用」。
 */
const DRAWER_STUB = {
  name: 'ADrawer',
  props: ['open', 'title'],
  emits: ['update:open'],
  template: '<div v-if="open" class="drawer-stub"><span class="drawer-title">{{ title }}</span>'
    + '<slot /><slot name="footer" /></div>'
}

/** 后端真实形状：字面分支是 {type:'string',maxLength}，绑定分支是 {properties:{$data}} */
const BINDABLE = (maxLength: number, format?: string) => ({
  oneOf: [
    { type: 'string', maxLength, ...(format ? { format } : {}) },
    { type: 'object', additionalProperties: false, required: ['$data'], properties: { $data: { type: 'string' } } }
  ]
})

const LIST_ONLY = {
  type: 'object',
  additionalProperties: false,
  required: ['$data'],
  properties: { $data: { type: 'string', minLength: 1, maxLength: 60 } }
}

/** `oneOf[{$data}]`：代码族「这一格只能绑数据源」的列表槽，界面不许替它猜一个绑法 */
const BINDING_ONLY_ONEOF = { oneOf: [LIST_ONLY] }

/** 人工组件那一族的裸形状（与后端 DEFAULT_PROPS_SCHEMA_JSON 同形，但没有 oneOf） */
const MANUAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    heading: { type: 'string', maxLength: 200 },
    text: { type: 'string', maxLength: 2000 },
    columns: { type: 'integer', enum: [2, 3, 4] },
    items: {
      type: 'array',
      maxItems: 24,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', maxLength: 120 },
          summary: { type: 'string', maxLength: 600 },
          image: { type: 'string', maxLength: 500, format: 'image' },
          link: { type: 'string', maxLength: 500, format: 'uri' }
        }
      }
    }
  }
}

function row(overrides: Partial<BlockDefRow>): BlockDefRow {
  return {
    id: 1,
    blockKey: 'zeta-block',
    name: '平台改过的区块名',
    category: 'content',
    maxInstances: 2,
    rendererKey: 'statsBand',
    dataSchema: { type: 'object', properties: { heading: BINDABLE(200) } },
    bindingSchema: { allowedSources: [] },
    themeSlots: [],
    notWired: false,
    enabled: true,
    source: 'code',
    provenanceUrl: null,
    provenanceNote: null,
    updatedAt: null,
    ...overrides
  } as BlockDefRow
}

/** 渲染框换成把 props 原样吐出来的壳：这里要断言的是「喂给渲染器的那份 props 对不对」 */
const PREVIEW_STUB = {
  name: 'PortalViewportPreview',
  props: ['blocks', 'device', 'theme', 'shell', 'review', 'pagePath'],
  computed: {
    firstBlock(this: any) {
      return this.blocks?.[0] || null
    },
    blockKey(this: any) {
      return this.firstBlock ? this.firstBlock.blockKey : ''
    },
    rendererKey(this: any) {
      return this.firstBlock ? this.firstBlock.rendererKey : ''
    },
    propsText(this: any) {
      return JSON.stringify(this.firstBlock?.props ?? null)
    }
  },
  template: '<div class="preview-stub" :data-block="blockKey" :data-renderer="rendererKey"><pre class="preview-props">{{ propsText }}</pre></div>'
}

/** 气泡把 title 也画出来：那几句「为什么这一格是死的」「为什么只能这一支渲染器」只写在气泡里 */
const TOOLTIP_STUB = {
  name: 'ATooltip',
  props: ['title'],
  template: '<span class="tooltip-stub"><span class="tooltip-title">{{ title }}</span><slot /></span>'
}

/** 确认框直接画出来并给一颗「确定」：删除那一句解释与确认动作都要能被点着 */
const POPCONFIRM_STUB = {
  name: 'APopconfirm',
  props: ['title', 'okText', 'cancelText'],
  emits: ['confirm'],
  template: '<span class="popconfirm-stub"><span class="popconfirm-title">{{ title }}</span>'
    + '<button type="button" class="popconfirm-ok" @click="$emit(\'confirm\')">确定</button><slot /></span>'
}

/** 下拉把 options 的取值画出来：分类与渲染器是不是接口回的那几份，一眼就看得到 */
const SELECT_STUB = {
  name: 'ASelect',
  props: ['value', 'options', 'placeholder', 'disabled'],
  emits: ['update:value'],
  computed: {
    optionText(this: any) {
      return (this.options || []).map((option: any) => String(option?.label ?? option?.value ?? '')).join('|')
    }
  },
  template: '<span class="select-stub" :data-disabled="String(!!disabled)"><span class="select-options">{{ optionText }}</span></span>'
}

const ALERT_STUB = {
  name: 'AAlert',
  props: ['message', 'description', 'type', 'showIcon'],
  template: '<div class="alert-stub"><span class="alert-message">{{ message }}</span>'
    + '<span class="alert-description">{{ description }}</span><slot name="message" /><slot name="description" /></div>'
}

interface MountOptions {
  rows?: BlockDefRow[] | Error
  categories?: string[] | Error
  rendererOptions?: string[] | Error
  schemaPrefill?: string | Error
}

async function mountView(options: MountOptions = {}) {
  const rowsValue = options.rows ?? []
  if (rowsValue instanceof Error) {
    vi.mocked(blockDefsApi.list).mockRejectedValue(rowsValue)
  } else {
    vi.mocked(blockDefsApi.list).mockResolvedValue(rowsValue)
  }
  const put = (name: 'categories' | 'rendererOptions' | 'schemaPrefill', value: any) => {
    const fn = (blockDefsApi as any)[name]
    if (value instanceof Error) fn.mockRejectedValue(value)
    else fn.mockResolvedValue(value)
  }
  put('categories', options.categories ?? ['content', 'layout'])
  put('rendererOptions', options.rendererOptions ?? ['genericCard'])
  put('schemaPrefill', options.schemaPrefill ?? '{"type":"object","properties":{"heading":{"type":"string"}}}')

  const wrapper = mount(BlockShowcaseView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-input': Input,
        'a-input-number': InputNumber,
        'a-select': SELECT_STUB,
        'a-textarea': Textarea,
        'a-card': PASS_THROUGH('ACard'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-tooltip': TOOLTIP_STUB,
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-drawer': DRAWER_STUB,
        'a-popconfirm': POPCONFIRM_STUB,
        'a-alert': ALERT_STUB,
        PortalViewportPreview: PREVIEW_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

/**
 * antd 的按钮会把「正好两个汉字」的标签排成中间带空格的样子（`停 用` / `删 除`），
 * 这是组件自己的排版规矩，不是这个页面的问题——但按文案找控件必须先把空白抹掉，
 * 否则「点停用」会一路摸到抽屉底部那颗「存为未启用」，测出来的红是假的。
 */
const flat = (node: Element | null | undefined) => (node?.textContent || '').replace(/\s+/g, '')

function clickButton(label: string) {
  const needle = label.replace(/\s+/g, '')
  const node = [...document.querySelectorAll('button')].find(button => flat(button).includes(needle))
  expect(node, `界面上应有一颗「${label}」`).toBeTruthy()
  node!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function previewProps(index = 0): Record<string, unknown> {
  const node = document.querySelectorAll('.preview-stub')[index]
  expect(node, `第 ${index + 1} 格预览框应挂在真实渲染框上`).toBeTruthy()
  return JSON.parse(node.querySelector('.preview-props')!.textContent || 'null')
}

function cards(): Element[] {
  return [...document.querySelectorAll('.ACard-stub')]
}

function cardOf(blockKey: string): Element {
  const hit = cards().find(card => flat(card).includes(blockKey))
  expect(hit, `界面上应有「${blockKey}」那一格`).toBeTruthy()
  return hit!
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('清单、两族与启用状态只有一处来源', () => {
  it('两族都摆出来，格子和名字就是接口回的那几套，一个 key 都不写死', async () => {
    const wrapper = await mountView({
      rows: [
        row({ id: 1, blockKey: 'brand-new-block', name: '刚加的区块', source: 'code', rendererKey: 'hero' }),
        row({ id: 2, blockKey: 'another-one', name: '另一个区块', source: 'manual', rendererKey: 'genericCard' })
      ]
    })
    expect(blockDefsApi.list).toHaveBeenCalledTimes(1)
    expect(wrapper.findAllComponents(PREVIEW_STUB)).toHaveLength(2)
    expect(document.querySelectorAll('.preview-stub')[0].getAttribute('data-block')).toBe('brand-new-block')
    expect(wrapper.text()).toContain('刚加的区块')
    expect(wrapper.text()).toContain('另一个区块')
    expect(cardOf('brand-new-block').textContent).toContain('代码声明')
    expect(cardOf('another-one').textContent).toContain('界面添加')
  })

  it('未启用那一格照样摆出来并带标记：从列表里消失就等于「我昨天建的那个组件去哪了」', async () => {
    const wrapper = await mountView({
      rows: [row({ id: 7, blockKey: 'quiet-card', name: '安静的那一格', source: 'manual', enabled: false })]
    })
    expect(wrapper.text()).toContain('quiet-card')
    expect(cardOf('quiet-card').textContent).toContain('未启用')
    // 那句「未启用到底意味着什么」只在气泡里说：不看气泡的人会把停用当成删除
    const tips = [...document.querySelectorAll('.tooltip-title')]
    expect(tips.some(tip => (tip.textContent || '').includes('进不了给模型的词表'))).toBe(true)
  })

  it('分类与上限也照接口回的样子显示', async () => {
    await mountView({ rows: [row({ category: 'commerce', maxInstances: 4 })] })
    const text = document.body.textContent || ''
    expect(text).toContain('commerce')
    expect(text).toContain('单页最多 4 个')
  })

  it('渲染器没登记时说清原因，而不是留一格空白', async () => {
    const wrapper = await mountView({ rows: [row({ rendererKey: 'nopeRenderer' })] })
    expect(wrapper.findAllComponents(PREVIEW_STUB)).toHaveLength(0)
    expect(wrapper.text()).toContain('没在前端登记')
    expect(wrapper.text()).toContain('nopeRenderer')
  })

  it('元数据为空时说明「只有一处来源」，不兜底造清单', async () => {
    const wrapper = await mountView({ rows: [] })
    expect(wrapper.text()).toContain('服务端没有返回任何组件元数据')
  })

  it('读不到元数据时把后端的中文原因透出来', async () => {
    const wrapper = await mountView({ rows: new Error('没有权限执行该操作') })
    expect(wrapper.text()).toContain('没有权限执行该操作')
    expect(wrapper.findAllComponents(PREVIEW_STUB)).toHaveLength(0)
    expect(wrapper.text()).not.toContain('服务端没有返回任何组件元数据')
  })

  it('来源标记与筛法只认接口回的那一格：key 长得像代码族也不许自己判', async () => {
    // 后端把这一行标成 manual（名字却叫 hero / site-header 这类代码族的名字）：界面上它是可写的那一族
    await mountView({
      rows: [
        row({ id: 3, blockKey: 'hero', name: '自称主视觉', source: 'manual', rendererKey: 'genericCard' }),
        row({ id: 4, blockKey: 'zzz-manual-looking', name: '自称人工', source: 'code', rendererKey: 'genericCard' })
      ]
    })
    expect(cardOf('hero').textContent).toContain('界面添加')
    expect(cardOf('zzz-manual-looking').textContent).toContain('代码声明')
  })
})

describe('写动作只给界面那一族', () => {
  const CODE_TIP = '发版'

  it('代码族那一格没有启用/改字段结构/删除，只有一颗只读和那句「要动它得发版」', async () => {
    await mountView({ rows: [row({ id: 5, blockKey: 'code-one', source: 'code' })] })
    const card = cardOf('code-one')
    expect(flat(card)).not.toContain('改字段结构')
    expect(flat(card)).not.toContain('删除')
    expect(flat(card)).toContain('只读')
    const tips = [...card.querySelectorAll('.tooltip-title')]
    expect(tips.some(tip => (tip.textContent || '').includes(CODE_TIP))).toBe(true)
  })

  it('人工那一格三颗动作都在，删除前那句解释说明的是软删与 key 不释放', async () => {
    await mountView({ rows: [row({ id: 6, blockKey: 'manual-one', source: 'manual' })] })
    const card = cardOf('manual-one')
    expect(flat(card)).toContain('启用')
    expect(flat(card)).toContain('改字段结构')
    expect(flat(card)).toContain('删除')
    const confirmTitle = card.querySelector('.popconfirm-title')?.textContent || ''
    expect(confirmTitle).toContain('软删')
    expect(confirmTitle).toContain('不会被释放')
  })
})

describe('启用是第二个动作', () => {
  it('点启用打的是那一个布尔，回来的行替换上去、标记跟着变', async () => {
    const before = row({ id: 11, blockKey: 'pending-card', name: '等着启用', source: 'manual', enabled: false })
    const after = { ...before, enabled: true }
    vi.mocked(blockDefsApi.setEnabled).mockResolvedValue(after)
    await mountView({ rows: [before] })
    clickButton('启用')
    await flushPromises()
    expect(blockDefsApi.setEnabled).toHaveBeenCalledWith(11, true)
    expect(flat(cardOf('pending-card'))).toContain('已启用')
    expect(flat(cardOf('pending-card'))).toContain('停用')
  })

  it('启用被后端拒时念后端原话，不改写成一句「操作失败」', async () => {
    vi.mocked(blockDefsApi.setEnabled)
      .mockRejectedValue(new Error('渲染器「genericCard」在前端没有登记，启用后访客端整块不渲染，改了也只会是一块空白'))
    await mountView({ rows: [row({ id: 12, blockKey: 'bad-card', source: 'manual', enabled: false })] })
    clickButton('启用')
    await flushPromises()
    const { message } = await import('ant-design-vue')
    expect((message as any).error).toHaveBeenCalledWith(expect.stringContaining('一块空白'))
    // 没启用成就是没启用成：那一格仍然标着未启用，界面上不许自己点完就当成功了
    expect(flat(cardOf('bad-card'))).toContain('未启用')
  })

  it('已启用的那一格给的是停用，打过去的是 false', async () => {
    vi.mocked(blockDefsApi.setEnabled).mockResolvedValue(row({ id: 13, source: 'manual', enabled: false }))
    await mountView({ rows: [row({ id: 13, blockKey: 'live-card', source: 'manual', enabled: true })] })
    clickButton('停用')
    await flushPromises()
    expect(blockDefsApi.setEnabled).toHaveBeenCalledWith(13, false)
  })
})

describe('删除', () => {
  it('确认后只摘掉那一格，其余照旧', async () => {
    vi.mocked(blockDefsApi.remove).mockResolvedValue(undefined as any)
    await mountView({
      rows: [
        row({ id: 21, blockKey: 'gone-card', source: 'manual' }),
        row({ id: 22, blockKey: 'stays-card', source: 'manual' })
      ]
    })
    const ok = cardOf('gone-card').querySelector('.popconfirm-ok')
    expect(ok).toBeTruthy()
    ok!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(blockDefsApi.remove).toHaveBeenCalledWith(21)
    expect(cards()).toHaveLength(1)
    expect(document.body.textContent).not.toContain('gone-card')
    expect(document.body.textContent).toContain('stays-card')
  })
})

describe('新建抽屉：分类、渲染器与默认字段结构各有各的读口', () => {
  it('三个读口分别落到三个格子上，一个都不写死', async () => {
    const wrapper = await mountView({
      rows: [row({ id: 31, blockKey: 'a-card', source: 'manual' })],
      categories: ['commerce', 'content', 'layout', 'nav', 'social'],
      rendererOptions: ['genericCard'],
      schemaPrefill: '{"type":"object","properties":{"demo":{"type":"string"}}}'
    })
    clickButton('新建组件')
    await flushPromises()
    const selects = wrapper.findAllComponents(SELECT_STUB)
    const category = selects.find(node => (node.props('options') as any[]).some(o => o.value === 'social'))
    const renderer = selects.find(node => (node.props('options') as any[]).some(o => o.value === 'genericCard'))
    expect(category, '分类下拉里应有后端回的那五个').toBeTruthy()
    expect((category!.props('options') as any[]).map(o => o.value))
      .toEqual(['commerce', 'content', 'layout', 'nav', 'social'])
    expect((renderer!.props('options') as any[]).map(o => o.value)).toEqual(['genericCard'])
    const schema = document.querySelector('textarea[placeholder^="这一格的字段清单"]') as HTMLTextAreaElement
    expect(schema.value).toContain('"demo"')
    // 那句「只能走这一支渲染器」是从接口那份清单里现拼的，不是前端写死 genericCard 那句话
    expect(document.body.textContent).toContain('只有服务端回的那几支')
    expect(document.body.textContent).toContain('genericCard')
  })

  it('提交交出去的体里没有 id，也没有那三格禁改的：blockKey 走新建体、渲染器按接口那份给', async () => {
    vi.mocked(blockDefsApi.create).mockResolvedValue(
      row({ id: 99, blockKey: 'fresh-card', name: '新鲜一格', source: 'manual', enabled: false })
    )
    await mountView({ rows: [] })
    clickButton('新建组件')
    await flushPromises()
    const blockKeyInput = document.querySelector('input[placeholder^="小写字母开头"]') as HTMLInputElement
    blockKeyInput.value = '  fresh-card  '
    blockKeyInput.dispatchEvent(new Event('input', { bubbles: true }))
    const nameInput = document.querySelector('input[placeholder^="给人看的那句话"]') as HTMLInputElement
    nameInput.value = '新鲜一格'
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    clickButton('存为未启用')
    await flushPromises()
    expect(blockDefsApi.create).toHaveBeenCalledTimes(1)
    const body = vi.mocked(blockDefsApi.create).mock.calls[0][0]
    expect(body.blockKey).toBe('fresh-card')
    expect(body.rendererKey).toBe('genericCard')
    expect('id' in body).toBe(false)
    expect('enabled' in body).toBe(false)
    expect('source' in body).toBe(false)
    // 新建回来的那一格是未启用：这一页不许顺手把它启用掉
    expect(flat(cardOf('fresh-card'))).toContain('未启用')
  })

  it('保存被后端拒时把原话摆在抽屉里，抽屉不自己关掉', async () => {
    vi.mocked(blockDefsApi.create)
      .mockRejectedValue(new Error('这一格只认 {"$data":…} 绑定：人工组件没有专属数据源，建出来就是填不满的空壳'))
    await mountView({ rows: [] })
    clickButton('新建组件')
    await flushPromises()
    clickButton('存为未启用')
    await flushPromises()
    const alertTexts = [...document.querySelectorAll('.alert-message')].map(node => node.textContent || '')
    expect(alertTexts.some(text => text.includes('填不满的空壳'))).toBe(true)
    expect(document.querySelector('.drawer-stub')).toBeTruthy()
  })

  it('读口没取全时新建按钮按不下去，并说明是哪一个读口坏了', async () => {
    const wrapper = await mountView({ rows: [], categories: new Error('没有权限执行该操作') })
    const create = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('新建组件'))
    expect(create, '新建按钮要还在，只是按下不了').toBeTruthy()
    expect(create!.disabled).toBe(true)
    expect(wrapper.text()).toContain('新建要用到的读口有一个或多个没取到')
    expect(wrapper.text()).toContain('分类词表')
    expect(wrapper.text()).toContain('没有权限执行该操作')
  })
})

describe('改字段结构：接口形状上就收不到那三格', () => {
  it('编辑态只交可改的那几格，blockKey 那一格是死的', async () => {
    vi.mocked(blockDefsApi.update).mockResolvedValue(
      row({ id: 41, blockKey: 'edit-card', name: '改过名字', source: 'manual', dataSchema: MANUAL_SCHEMA })
    )
    await mountView({ rows: [row({ id: 41, blockKey: 'edit-card', name: '旧名字', source: 'manual' })] })
    clickButton('改字段结构')
    await flushPromises()
    const blockKeyInput = document.querySelector('input[placeholder^="小写字母开头"]') as HTMLInputElement
    expect(blockKeyInput.disabled).toBe(true)
    clickButton('保存')
    await flushPromises()
    expect(blockDefsApi.update).toHaveBeenCalledTimes(1)
    expect(blockDefsApi.update).toHaveBeenCalledWith(41, expect.not.objectContaining({ blockKey: expect.anything() }))
    const body = vi.mocked(blockDefsApi.update).mock.calls[0][1]
    expect('blockKey' in body).toBe(false)
    expect('rendererKey' in body).toBe(false)
    expect('source' in body).toBe(false)
    expect(cardOf('edit-card').textContent).toContain('改过名字')
  })
})

describe('演示 props 由字段结构推导', () => {
  it('代码族那一套分档不变：字符串按长度、列表槽给演示集合、enum/数字/开关给白名单内的值', async () => {
    await mountView({
      rows: [row({
        rendererKey: 'serviceCards',
        dataSchema: {
          type: 'object',
          properties: {
            heading: BINDABLE(200),
            body: BINDABLE(20000),
            primaryLink: BINDABLE(500, 'uri'),
            logoUrl: BINDABLE(500, 'image'),
            items: LIST_ONLY,
            limit: { type: 'integer', minimum: 1, maximum: 24 },
            columns: { type: 'integer', enum: [2, 3, 4] },
            showSummary: { type: 'boolean' },
            mystery: { type: 'array' }
          }
        }
      })]
    })
    const props = previewProps(0)
    expect(typeof props.heading).toBe('string')
    expect((props.heading as string).length).toBeLessThanOrEqual(200)
    expect((props.body as string).length).toBeGreaterThan(20)
    expect(String(props.primaryLink).startsWith('/demo-page-')).toBe(true)
    // 名字与 format 都指着图片位的那一格给内联占位图，这一页不该出现裂图
    expect(String(props.logoUrl)).toContain('data:image/svg+xml')
    expect(Array.isArray(props.items)).toBe(true)
    expect((props.items as unknown[]).length).toBe(3)
    expect(props.limit).toBe(3)
    expect(props.columns).toBe(3)
    expect(props.showSummary).toBe(true)
    // 认不出来的裸数组（没有 items 形状可推）一律不填：猜出来的值后端校验必然不认
    expect('mystery' in props).toBe(false)
  })

  it('带 oneOf 但只认绑定的那一格仍然不填：界面不许替代码族猜一个绑法', async () => {
    await mountView({
      rows: [row({ rendererKey: 'breadcrumb', dataSchema: { type: 'object', properties: { items: BINDING_ONLY_ONEOF } } })]
    })
    expect(previewProps(0)).toEqual({})
  })

  it('人工那一族的裸形状要能渲出内容：标题短文案、正文段落、列数取中间一档、条目按声明的字段现推', async () => {
    await mountView({
      rows: [row({ id: 51, blockKey: 'manual-card', source: 'manual', rendererKey: 'genericCard', dataSchema: MANUAL_SCHEMA })]
    })
    const props = previewProps(0)
    expect(typeof props.heading).toBe('string')
    expect((props.heading as string).length).toBeLessThanOrEqual(200)
    // text 是 2000 字的裸串：那一格不是链接槽，给一句 URL 会把「填了正文」演成「填了个地址」
    expect(String(props.text).length).toBeGreaterThan(20)
    expect(String(props.text)).not.toContain('/demo-page-')
    expect(props.columns).toBe(3)
    const items = props.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(3)
    expect(typeof items[0].title).toBe('string')
    expect(String(items[0].summary)).toContain('摘要')
    // 声明成 format=image 的那一格给占位图（这一族的条目并集里没有 image 这一键）
    expect(String(items[0].image)).toContain('data:image/svg+xml')
    expect(String(items[0].link)).toContain('/demo-page-')
  })

  it('字段结构默认收起，点一下才展开', async () => {
    const wrapper = await mountView({ rows: [row({ dataSchema: MANUAL_SCHEMA })] })
    expect(document.querySelector('.block-library__props')).toBeFalsy()
    clickButton('看字段结构')
    await flushPromises()
    const panel = document.querySelector('.block-library__props')
    expect(panel, '点开后应看到接口回的那一份字段结构').toBeTruthy()
    expect(panel!.textContent || '').toContain('maxLength')
    expect(wrapper.text()).toContain('收起字段结构')
  })
})

describe('试填这几格（只改眼前这一格的预览，不写库）', () => {
  it('改完点重渲：预览吃的就是填的那一份；坏 JSON 报错并且不动当前渲染', async () => {
    await mountView({
      rows: [row({ id: 61, blockKey: 'trial-card', source: 'manual', rendererKey: 'genericCard', dataSchema: MANUAL_SCHEMA })]
    })
    clickButton('试填这几格')
    await flushPromises()
    const area = document.querySelector('textarea[placeholder^="这几格按你自己的值填"]') as HTMLTextAreaElement
    expect(area, '试填的那一格里应有输入框').toBeTruthy()
    expect(area.value).toContain('heading')
    area.value = '{"heading":"真的标题","items":[{"title":"一格","summary":"一句说明"}]}'
    area.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    clickButton('按这份重渲')
    await flushPromises()
    const props = previewProps(0)
    expect(props.heading).toBe('真的标题')
    expect((props.items as unknown[])).toHaveLength(1)
    // 写库的口子一次都没被点过：试填不保存
    expect(blockDefsApi.update).not.toHaveBeenCalled()
    expect(blockDefsApi.create).not.toHaveBeenCalled()

    area.value = '{这不是 JSON'
    area.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    clickButton('按这份重渲')
    await flushPromises()
    expect((document.querySelector('.block-library__error')?.textContent || '')).toContain('这份 JSON 读不出来')
    // 报错那一次不许把当前渲染换掉：重渲前的读数要还在
    expect(previewProps(0).heading).toBe('真的标题')

    clickButton('退回推出来的演示值')
    await flushPromises()
    expect(typeof previewProps(0).heading).toBe('string')
    expect(previewProps(0).heading).not.toBe('真的标题')
  })

  it('代码族那一格不给试填：这一页能改的只有界面那一族', async () => {
    await mountView({ rows: [row({ id: 62, blockKey: 'code-card', source: 'code' })] })
    expect([...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('试填'))).toBe(false)
  })
})

describe('过滤只是少显示', () => {
  it('关键字命不中时说明原因，不会多出一个不存在的组件', async () => {
    const wrapper = await mountView({ rows: [row({ blockKey: 'brand-new-block', name: '刚加的区块' })] })
    const input = wrapper.findAllComponents(Input)[0]
    input.vm.$emit('update:value', '根本不存在的关键字')
    await flushPromises()
    expect(wrapper.findAllComponents(PREVIEW_STUB)).toHaveLength(0)
    expect(wrapper.text()).toContain('没有组件匹配这些条件')
  })

  it('来源筛选同样只少显示：只看界面添加时代码族那一格不摆，反向同理', async () => {
    const wrapper = await mountView({
      rows: [
        row({ id: 71, blockKey: 'code-side', source: 'code' }),
        row({ id: 72, blockKey: 'manual-side', source: 'manual' })
      ]
    })
    const filter = wrapper.findAllComponents(SELECT_STUB)[0]
    filter.vm.$emit('update:value', 'manual')
    await flushPromises()
    expect(cards()).toHaveLength(1)
    expect(document.body.textContent).toContain('manual-side')
    expect(document.body.textContent).not.toContain('code-side')
    filter.vm.$emit('update:value', 'code')
    await flushPromises()
    expect(document.body.textContent).toContain('code-side')
    expect(document.body.textContent).not.toContain('manual-side')
  })
})

describe('未接线那一格只认接口回的那个布尔', () => {
  // 界面上那一格写的是「未接线 · 需要数据源」，这里比的是抹掉空白之后的样子（见 flat）
  const LABEL = '未接线·需要数据源'

  it('后端打了标的格子才有标签与气泡说明，没打标的那格一个都不带', async () => {
    await mountView({
      rows: [
        row({ id: 81, blockKey: 'unwired-one', name: '团队', rendererKey: 'teamGrid', notWired: true }),
        row({ id: 82, blockKey: 'wired-other', name: '主视觉', rendererKey: 'hero', notWired: false })
      ]
    })
    expect(cards()).toHaveLength(2)
    expect(flat(cardOf('unwired-one'))).toContain(LABEL)
    expect(flat(cardOf('wired-other'))).not.toContain(LABEL)
    // 光有三个字没人看得懂：气泡要说清「渲得出结构但里面是空的」，并交代判据在后端
    const tips = [...cardOf('unwired-one').querySelectorAll('.tooltip-title')]
    expect(tips.some(tip => (tip.textContent || '').includes('后端没有任何数据源'))).toBe(true)
    expect(tips.some(tip => (tip.textContent || '').includes('不是前端抄'))).toBe(true)
  })

  /**
   * 反方向的那一钉：key 就叫 team-grid / stats-band（后端那份 UNWIRED_BLOCKS 里的名字），
   * 而接口这回说它不是空壳。界面要是自己抄了一份清单，这一条数据当场被补上标签——
   * 那份清单不会跟着 Java 变，迟早变成假话（I 系列的老教训）。
   */
  it('key 正是后端那份清单里的名字、接口却没打标：界面不自己补一个标签', async () => {
    const wrapper = await mountView({
      rows: [
        row({ id: 91, blockKey: 'team-grid', rendererKey: 'teamGrid', notWired: false }),
        row({ id: 92, blockKey: 'stats-band', rendererKey: 'statsBand', notWired: false })
      ]
    })
    expect(flat(document.body)).not.toContain(LABEL)
    // 这一页本来就别处也有气泡（代码族那句「要动它得发版」）：要钉的是没有一句在说「这一格没数据源」
    const tips = [...document.querySelectorAll('.tooltip-title')]
    expect(tips.some(tip => (tip.textContent || '').includes('后端没有任何数据源'))).toBe(false)
    expect(wrapper.text()).not.toContain('这份清单里有')
  })

  it('顶上的计数按每一格现算：三格空壳就说三格，不多不少', async () => {
    const wrapper = await mountView({
      rows: [
        row({ id: 101, blockKey: 'team-grid', notWired: true }),
        row({ id: 102, blockKey: 'stats-band', notWired: true }),
        row({ id: 103, blockKey: 'logo-wall', notWired: true }),
        row({ id: 104, blockKey: 'hero', notWired: false })
      ]
    })
    expect(wrapper.text()).toContain('这份清单里有 3 格')
  })

  it('后端没回这一格（接口比前端旧）时不打标也不报错，格子照常渲', async () => {
    const legacy: any = row({ id: 111 })
    delete legacy.notWired
    const wrapper = await mountView({ rows: [legacy] })
    expect(flat(document.body)).not.toContain(LABEL)
    expect(wrapper.text()).not.toContain('这份清单里有')
    expect(wrapper.findAllComponents(PREVIEW_STUB)).toHaveLength(1)
  })
})
