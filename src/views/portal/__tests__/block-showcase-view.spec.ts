import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, Select } from 'ant-design-vue'
import BlockShowcaseView from '../BlockShowcaseView.vue'
import { portalPagesApi, type PortalBlockMeta } from '../../../api/portalPages'

/**
 * 区块画廊（Spec §7.2 / Q2）。
 *
 * 这一页要钉住的是「什么都来自元数据」：
 * 1. 区块清单与显示名只能来自 `/api/portal/blocks`——用例故意喂两个前端从没听说过的
 *    blockKey 与中文显示名，页面上出现它们才算真的没有第二份清单；
 * 2. 演示 props 由 dataSchema 推导（字符串槽给样例文案、列表槽给演示集合、
 *    enum/integer/boolean 给白名单内的合法值），不是一张 blockKey → props 的对照表；
 * 3. 渲染器没登记的区块要说清「为什么只能看名字」，而不是默默空一格；
 * 4. 「未接线 · 需要数据源」那一格只认接口回的 `notWired`（判据是后端
 *    `PortalBlockCatalogue.UNWIRED_BLOCKS` 那一份）——用例专门喂一条 key 长得像空壳区块、
 *    但 `notWired:false` 的数据：界面要是自己抄了一份清单，这条数据当场就被打标签。
 */

vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: { blocks: vi.fn() }
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'dataSource', 'columns', 'spinning'],
  template: `<div class="${name}-stub"><span>{{ message }}{{ description }}</span>`
    + '<slot name="title" /><slot name="message" /><slot /></div>'
})

/** 后端真实形状：字面分支是 {type:'string',maxLength}，绑定分支是 {properties:{$data}} */
const BINDABLE = (maxLength: number) => ({
  oneOf: [
    { type: 'string', maxLength },
    { type: 'object', additionalProperties: false, required: ['$data'], properties: { $data: { type: 'string' } } }
  ]
})

const LIST_ONLY = {
  type: 'object',
  additionalProperties: false,
  required: ['$data'],
  properties: { $data: { type: 'string', minLength: 1, maxLength: 60 } }
}

/**
 * 真渲染框换成一个把 props 原样吐出来的壳：
 * 这里要断言的是「画廊喂给渲染器的那份演示 props 对不对」，
 * 而区块组件本身已由 block-registry.spec.ts 与访客端用例覆盖，没必要在这里再渲 17 遍。
 */
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

function meta(overrides: Partial<PortalBlockMeta>): PortalBlockMeta {
  return {
    blockKey: 'zeta-block',
    name: '平台改过的区块名',
    category: '内容',
    maxInstances: 2,
    rendererKey: 'hero',
    dataSchema: { type: 'object', properties: { heading: BINDABLE(200) } },
    bindingSchema: { allowedSources: [] },
    themeSlots: [],
    // 后端逐行现算的这一格永远有值（PortalBlockControllerTest 钉的就是 allSatisfy isNotNull）
    notWired: false,
    ...overrides
  } as PortalBlockMeta
}

/** 气泡的内容走 title 属性：默认那份 PASS_THROUGH 不渲染它，这里单独给一个看得见说明的壳 */
const TOOLTIP_STUB = {
  name: 'ATooltip',
  props: ['title'],
  template: '<span class="tooltip-stub"><span class="tooltip-title">{{ title }}</span><slot /></span>'
}

async function mountView(blocks: PortalBlockMeta[] | Error) {
  if (blocks instanceof Error) {
    vi.mocked(portalPagesApi.blocks).mockRejectedValue(blocks)
  } else {
    vi.mocked(portalPagesApi.blocks).mockResolvedValue(blocks)
  }
  const wrapper = mount(BlockShowcaseView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-input': Input,
        'a-select': Select,
        'a-card': PASS_THROUGH('ACard'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-tooltip': TOOLTIP_STUB,
        'a-empty': PASS_THROUGH('AEmpty'),
        PortalViewportPreview: PREVIEW_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function previewProps(index = 0): Record<string, unknown> {
  const node = document.querySelectorAll('.preview-stub')[index]
  expect(node, `第 ${index + 1} 格预览框应挂在真实渲染框上`).toBeTruthy()
  return JSON.parse(node.querySelector('.preview-props')!.textContent || 'null')
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('清单与显示名只有一处来源', () => {
  it('格子和名字就是接口回的那几套，一个 key 都不写死', async () => {
    const wrapper = await mountView([
      meta({ blockKey: 'brand-new-block', name: '刚加的区块', rendererKey: 'hero' }),
      meta({ blockKey: 'another-one', name: '另一个区块', rendererKey: 'statsBand' })
    ])
    expect(portalPagesApi.blocks).toHaveBeenCalledTimes(1)
    const stubs = wrapper.findAllComponents(PREVIEW_STUB)
    expect(stubs).toHaveLength(2)
    expect(document.querySelectorAll('.preview-stub')[0].getAttribute('data-block')).toBe('brand-new-block')
    expect(wrapper.text()).toContain('刚加的区块')
    expect(wrapper.text()).toContain('另一个区块')
    expect(wrapper.text()).toContain('another-one')
  })

  it('分类与上限也照接口回的样子显示', async () => {
    await mountView([meta({ category: 'commerce', maxInstances: 4 })])
    const text = document.body.textContent || ''
    expect(text).toContain('commerce')
    expect(text).toContain('单页最多 4 个')
  })

  it('渲染器没登记时说清原因，而不是留一格空白', async () => {
    const wrapper = await mountView([meta({ rendererKey: 'nopeRenderer' })])
    expect(wrapper.findAllComponents(PREVIEW_STUB)).toHaveLength(0)
    expect(wrapper.text()).toContain('没在前端登记')
    expect(wrapper.text()).toContain('nopeRenderer')
  })

  it('元数据为空时说明「只有一处来源」，不兜底造清单', async () => {
    const wrapper = await mountView([])
    expect(wrapper.text()).toContain('服务端没有返回任何区块元数据')
  })

  it('读不到元数据时把后端的中文原因透出来', async () => {
    const wrapper = await mountView(new Error('没有权限执行该操作'))
    expect(wrapper.text()).toContain('没有权限执行该操作')
    expect(wrapper.findAllComponents(PREVIEW_STUB)).toHaveLength(0)
    expect(wrapper.text()).not.toContain('服务端没有返回任何区块元数据')
  })
})

describe('演示 props 由 dataSchema 推导', () => {
  it('字符串槽按长度分档给样例，列表槽给演示集合，enum/数字/开关给白名单内的值', async () => {
    await mountView([meta({
      dataSchema: {
        type: 'object',
        properties: {
          heading: BINDABLE(200),
          body: BINDABLE(20000),
          primaryLink: BINDABLE(500),
          logoUrl: BINDABLE(500),
          items: LIST_ONLY,
          limit: { type: 'integer', minimum: 1, maximum: 24 },
          columns: { type: 'integer', enum: [2, 3, 4] },
          showSummary: { type: 'boolean' },
          mystery: { type: 'array' }
        }
      }
    })])
    const props = previewProps(0)
    expect(typeof props.heading).toBe('string')
    expect((props.heading as string).length).toBeLessThanOrEqual(200)
    expect((props.body as string).length).toBeGreaterThan(20)
    expect(String(props.primaryLink).startsWith('/demo-page-')).toBe(true)
    // 名字长得像图片位的链接槽给内联占位图，画廊里不该出现裂图
    expect(String(props.logoUrl)).toContain('data:image/svg+xml')
    expect(Array.isArray(props.items)).toBe(true)
    expect((props.items as unknown[]).length).toBe(3)
    expect(props.limit).toBe(3)
    expect(props.columns).toBe(3)
    expect(props.showSummary).toBe(true)
    // 认不出的形状一律不填：猜出来的值后端校验必然不认
    expect('mystery' in props).toBe(false)
  })

  it('演示数据那一份 JSON 默认收起，点一下才展开', async () => {
    const wrapper = await mountView([meta({})])
    expect(document.querySelector('.block-showcase__props')).toBeFalsy()
    const toggle = [...document.querySelectorAll('button')].find(node => (node.textContent || '').includes('看演示数据'))
    expect(toggle, '工具条上应有「看演示数据」').toBeTruthy()
    toggle!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    const panel = document.querySelector('.block-showcase__props')
    expect(panel, '点开后应看到推导出来的演示 props').toBeTruthy()
    expect(panel!.textContent || '').toContain('heading')
    expect(wrapper.text()).toContain('收起演示数据')
  })
})

describe('过滤只是少显示', () => {
  it('关键字命不中时说明原因，不会多出一个不存在的区块', async () => {
    const wrapper = await mountView([meta({ blockKey: 'brand-new-block', name: '刚加的区块' })])
    const input = wrapper.findAllComponents(Input)[0]
    input.vm.$emit('update:value', '根本不存在的关键字')
    await flushPromises()
    expect(wrapper.findAllComponents(PREVIEW_STUB)).toHaveLength(0)
    expect(wrapper.text()).toContain('没有区块匹配这个关键字')
  })
})

describe('未接线那一格只认接口回的那个布尔', () => {
  const LABEL = '未接线 · 需要数据源'

  it('后端打了标的格子才有标签与气泡说明，没打标的那格一个都不带', async () => {
    await mountView([
      meta({ blockKey: 'team-grid', name: '团队', rendererKey: 'teamGrid', notWired: true }),
      meta({ blockKey: 'hero', name: '主视觉', rendererKey: 'hero', notWired: false })
    ])
    const cards = [...document.querySelectorAll('.ACard-stub')]
    expect(cards).toHaveLength(2)
    expect(cards[0].textContent).toContain(LABEL)
    expect(cards[1].textContent).not.toContain(LABEL)
    // 光有三个字没人看得懂：气泡要说清「渲得出结构但里面是空的」，并交代判据在后端
    const tips = [...document.querySelectorAll('.tooltip-title')]
    expect(tips).toHaveLength(1)
    expect(tips[0].textContent).toContain('后端没有任何数据源')
    expect(tips[0].textContent).toContain('不是前端抄')
  })

  /**
   * 反方向的那一钉：key 就叫 team-grid / stats-band（后端那份 UNWIRED_BLOCKS 里的名字），
   * 而接口这回说它不是空壳。界面要是自己抄了一份清单，这一条数据当场被补上标签——
   * 那份清单不会跟着 Java 变，迟早变成假话（I 系列的老教训）。
   */
  it('key 正是后端那份清单里的名字、接口却没打标：界面不自己补一个标签', async () => {
    const wrapper = await mountView([
      meta({ blockKey: 'team-grid', rendererKey: 'teamGrid', notWired: false }),
      meta({ blockKey: 'stats-band', rendererKey: 'statsBand', notWired: false })
    ])
    expect(wrapper.text()).not.toContain(LABEL)
    expect(document.querySelectorAll('.tooltip-stub')).toHaveLength(0)
  })

  it('顶上的计数按每一格现算：三格空壳就说三格，不多不少', async () => {
    const wrapper = await mountView([
      meta({ blockKey: 'team-grid', notWired: true }),
      meta({ blockKey: 'stats-band', notWired: true }),
      meta({ blockKey: 'logo-wall', notWired: true }),
      meta({ blockKey: 'hero', notWired: false })
    ])
    expect(wrapper.text()).toContain('这份清单里有 3 格')
  })

  it('后端没回这一格（接口比前端旧）时不打标也不报错，格子照常渲', async () => {
    const legacy: any = meta({})
    delete legacy.notWired
    const wrapper = await mountView([legacy])
    expect(wrapper.text()).not.toContain(LABEL)
    expect(wrapper.text()).not.toContain('这份清单里有')
    expect(wrapper.findAllComponents(PREVIEW_STUB)).toHaveLength(1)
  })
})
