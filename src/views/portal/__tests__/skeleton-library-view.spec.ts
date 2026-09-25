import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, Select } from 'ant-design-vue'
import SkeletonLibraryView from '../SkeletonLibraryView.vue'
import { portalSkeletonsApi, type SkeletonView } from '../../../api/portalSkeletons'
import { portalPagesApi } from '../../../api/portalPages'
import { siteApi } from '../../../api/workspace'
import { useAuthStore } from '../../../stores/auth'

/**
 * 骨架库（Spec §5.2 / §7.2，Q2）。
 *
 * 三件事必须钉住：
 * 1. 「确认执行」是独立的一次点击：没点它之前一次 confirm=true 的请求都不该发出去（防「假 dry-run」）；
 * 2. 计划表里 willCreate=false 的行显示的是后端给的那句中文原因，前端不替它编；
 * 3. 状态的中文说法来自 /admin/portal/skeletons/statuses——用例把词表换成完全不同的字，
 *    页面上要是还出现「已发布」这类本地常量就会红。
 *
 * 沉淀与审核那一半再钉三条：待审清单只读 /pending（前端不比对状态字面量）、
 * 发布与退役各要一次当场确认（第一颗一颗请求都不发）、沉淀回执里的 stripped/skippedPages
 * 逐条原样列出来——审核证据被归纳成「已清洗」三个字就没有意义了。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/portalSkeletons', () => ({
  portalSkeletonsApi: {
    list: vi.fn(), pages: vi.fn(), statusLabels: vi.fn(), apply: vi.fn(),
    pending: vi.fn(), distill: vi.fn(), publish: vi.fn(), retire: vi.fn()
  }
}))
vi.mock('../../../api/portalPages', () => ({ portalPagesApi: { blocks: vi.fn() } }))
vi.mock('../../../api/workspace', () => ({ siteApi: { list: vi.fn() } }))

/** 按 dataSource 逐行走 bodyCell 插槽的表壳：真 a-table 在这个环境里渲不出表体 */
const TABLE_STUB = {
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  template: `
    <div class="table-stub">
      <div v-for="(record, rowIndex) in dataSource" :key="rowIndex" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'spinning', 'open'],
  template: `<div class="${name}-stub"><span>{{ message }}{{ description }}</span>`
    + '<slot name="title" /><slot name="message" /><slot /></div>'
})

/** 预览框换成记录 props 的壳：这里要钉的是「绑定有没有被解析掉」，区块组件本身另有测试 */
const PREVIEW_STUB = {
  name: 'PortalViewportPreview',
  props: ['blocks', 'device', 'theme', 'shell', 'review', 'pagePath'],
  computed: {
    text(this: any) {
      return JSON.stringify({ blocks: this.blocks, theme: this.theme })
    }
  },
  template: '<div class="preview-stub">{{ text }}</div>'
}

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

function page(overrides: Record<string, unknown> = {}) {
  return {
    pageKey: 'home',
    slug: 'home',
    title: '首页',
    pageType: 'home',
    navSort: 1,
    navVisible: true,
    layoutJson: JSON.stringify({
      blocks: [
        { instanceId: 'b1', blockKey: 'zeta', props: { heading: '页面里写的字面标题', items: { $data: 'whateverList' } } },
        { instanceId: 'b2', blockKey: 'ghost', props: {} }
      ]
    }),
    sectionKey: null,
    ...overrides
  }
}

function skeleton(overrides: Partial<SkeletonView> = {}): SkeletonView {
  return {
    skeletonKey: 'alpha set/../x',
    name: '甲套骨架',
    description: '一套前端从没听说过的骨架',
    origin: 'platform',
    version: 2,
    status: 'published',
    tokensJson: '{"colorPrimary":"#123456","fontScale":1.1}',
    // 故意带一个后端不保证序列化的 pageCount：页数必须按 pages.length 算
    ...overrides,
    pages: overrides.pages ?? [page(), page({ pageKey: 'about', slug: 'about' }), page({ pageKey: 'news' })]
  } as SkeletonView & { pageCount?: number }
}

/**
 * 按钮文本比对先把空白抹掉：正好两个汉字的按钮会被 ant-design-vue 中间塞一个空格（「发 布」），
 * 按原样比对永远查不到，「不该有这个按钮」的断言就会假过。
 */
function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '') === text
  )
}

function buttonContaining(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '').includes(text)
  )
}

/** 后端 pending 回的那一行：和画廊同一套形状，前端不按状态字符串自己筛 */
function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    skeletonKey: 'ref-12',
    name: '从甲站洗出来的一套',
    description: '只带了人工确认过的映射',
    origin: 'reference_ingest',
    version: 1,
    status: 'draft',
    tokensJson: null,
    pages: [{ pageKey: 'home' }, { pageKey: 'about' }],
    ...overrides
  } as any
}

/** 一次沉淀的回执：stripped / skippedPages 全是后端逐页写的中文说明 */
function distilled(overrides: Record<string, unknown> = {}) {
  return {
    skeletonKey: 'ref-12',
    name: '从甲站洗出来的一套',
    pageCount: 2,
    blockCount: 7,
    stripped: [
      '页「home」：字面文案「XX 集团 400-800-1234」换成演示文本',
      '页「about」：指向 https://customer-a.example/doc.pdf 的整槽已删除'
    ],
    skippedPages: ['「https://customer-a.example/case/9」没有人工确认过的映射，整页跳过'],
    ...overrides
  }
}

interface Extra {
  pending?: any[]
  pendingError?: string
  distillReceipt?: ReturnType<typeof distilled> | null
  distillError?: string
  statusLabels?: Record<string, string>
}

async function mountView(
  skeletons: SkeletonView[] = [skeleton()],
  permissions = ['portal:build:preset', 'portal:build:manage'],
  extra: Extra = {}
) {
  const auth = useAuthStore()
  auth.user = { id: 1, username: 'tester', roles: ['SUPER_ADMIN'], permissions } as any
  vi.mocked(portalSkeletonsApi.list).mockResolvedValue(skeletons)
  vi.mocked(portalSkeletonsApi.statusLabels).mockResolvedValue(
    extra.statusLabels ?? { published: '放出去的', draft: '还没定稿', retired: '撤掉了' }
  )
  vi.mocked(portalSkeletonsApi.pages).mockResolvedValue(skeletons[0]?.pages as any ?? [])
  if (extra.pendingError) {
    vi.mocked(portalSkeletonsApi.pending).mockRejectedValueOnce(new Error(extra.pendingError))
  } else {
    vi.mocked(portalSkeletonsApi.pending).mockResolvedValue(extra.pending ?? [])
  }
  if (extra.distillError) {
    vi.mocked(portalSkeletonsApi.distill).mockRejectedValueOnce(new Error(extra.distillError))
  } else {
    vi.mocked(portalSkeletonsApi.distill).mockResolvedValue((extra.distillReceipt ?? null) as any)
  }
  vi.mocked(portalSkeletonsApi.publish).mockResolvedValue({} as any)
  vi.mocked(portalSkeletonsApi.retire).mockResolvedValue({} as any)
  vi.mocked(portalPagesApi.blocks).mockResolvedValue([
    {
      blockKey: 'zeta', name: '泽塔区块', category: 'content', maxInstances: 1, rendererKey: 'hero',
      dataSchema: { type: 'object', properties: { heading: BINDABLE(200), items: LIST_ONLY } },
      bindingSchema: { allowedSources: ['whateverList'] }, themeSlots: []
    }
  ] as any)
  vi.mocked(siteApi.list).mockResolvedValue([
    { id: 3, name: '演示站甲' }, { id: 4, name: '演示站乙' }
  ] as any)
  const wrapper = mount(SkeletonLibraryView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-table': TABLE_STUB,
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
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-tooltip': PASS_THROUGH('ATooltip'),
        PortalViewportPreview: PREVIEW_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function pickSelect(index: number, value: unknown) {
  const select = wrapperSelects()[index]
  expect(select, `页面上应有第 ${index + 1} 个下拉`).toBeTruthy()
  select!.vm.$emit('update:value', value)
  return select!
}

let currentWrapper: any = null

function wrapperSelects() {
  return currentWrapper.findAllComponents(Select)
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  currentWrapper = null
})

describe('清单、页数、状态说法都只有一处来源', () => {
  it('状态中文来自 /statuses：换成别的字页面就跟着换', async () => {
    currentWrapper = await mountView()
    expect(portalSkeletonsApi.statusLabels).toHaveBeenCalled()
    const text = document.body.textContent || ''
    expect(text).toContain('放出去的')
    expect(text).not.toContain('已发布')
    expect(text).not.toContain('草稿')
  })

  it('页数按 pages.length 算，不认后端那个没序列化的 pageCount', async () => {
    currentWrapper = await mountView([skeleton({ pageCount: 99 } as any)])
    const rows = [...document.querySelectorAll('.table-stub')][0].querySelectorAll('.row')
    expect(rows[0].textContent || '').toContain('3')
    expect(rows[0].textContent || '').not.toContain('99')
    expect(rows[0].textContent || '').toContain('甲套骨架')
  })

  it('逐页预览按 key 取清单，绑定被演示数据解析掉后才交给真渲染框', async () => {
    currentWrapper = await mountView()
    buttonContaining('逐页预览')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalSkeletonsApi.pages).toHaveBeenCalledWith('alpha set/../x')
    const stubs = document.querySelectorAll('.preview-stub')
    expect(stubs.length).toBeGreaterThan(0)
    const rendered = JSON.parse(stubs[0].textContent || '{}')
    const blocks = rendered.blocks as Array<{ blockKey: string; rendererKey: string; props: Record<string, unknown> }>
    // ghost 这个 blockKey 不在元数据里：要说清被跳过，而不是悄悄少一格
    expect(blocks.map(block => block.blockKey)).toEqual(['zeta'])
    expect(blocks[0].rendererKey).toBe('hero')
    // 字面文案原样保留，列表绑定换成演示集合
    expect(blocks[0].props.heading).toBe('页面里写的字面标题')
    expect(Array.isArray(blocks[0].props.items)).toBe(true)
    expect(JSON.stringify(blocks[0].props)).not.toContain('$data')
    // 骨架自带的皮肤真的落到渲染框上
    expect(rendered.theme.colorPrimary).toBe('#123456')
    expect(currentWrapper.text()).toContain('这一页有 1 个区块渲不出来')
  })

  it('骨架页清单读失败时透出后端的中文原因', async () => {
    vi.mocked(portalSkeletonsApi.pages).mockRejectedValueOnce(new Error('没有「x」这套骨架'))
    currentWrapper = await mountView()
    buttonContaining('逐页预览')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(currentWrapper.text()).toContain('没有「x」这套骨架')
  })
})

describe('应用到站点：两段式，不许一个按钮二合一', () => {
  it('只点「先看新增计划」时一次 confirm=true 都不发', async () => {
    currentWrapper = await mountView()
    vi.mocked(portalSkeletonsApi.apply).mockResolvedValue({
      skeletonKey: 'alpha set/../x', skeletonName: '甲套骨架', skeletonVersion: 2, dryRun: true,
      items: [
        { pageKey: 'home', slug: 'home', title: '首页', pageType: 'home', navSort: 1, willCreate: true, reason: '本站还没有这一页' },
        { pageKey: 'about', slug: 'about', title: '关于我们', pageType: 'about', navSort: 2, willCreate: false, reason: '已经有页面了，换骨架不动它' }
      ],
      created: 0
    } as any)
    pickSelect(0, 3)
    pickSelect(1, 'alpha set/../x')
    await flushPromises()

    buttonContaining('先看新增计划')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(portalSkeletonsApi.apply).toHaveBeenCalledTimes(1)
    expect(portalSkeletonsApi.apply).toHaveBeenCalledWith(3, 'alpha set/../x', false)
    expect(vi.mocked(portalSkeletonsApi.apply).mock.calls.every(call => call[2] === true)).toBe(false)

    // 计划表里跳过的行显示后端给的那句中文原因
    const planRows = [...document.querySelectorAll('.table-stub')][1].querySelectorAll('.row')
    expect(planRows[1].textContent || '').toContain('已经有页面了，换骨架不动它')
    expect(planRows[1].textContent || '').toContain('跳过')
    expect(planRows[0].textContent || '').toContain('会新建')
    expect(currentWrapper.text()).toContain('共 2 页，其中会新建 1 页')
  })

  it('点了「确认执行」才发 confirm=true，回执显示新建条数', async () => {
    currentWrapper = await mountView()
    vi.mocked(portalSkeletonsApi.apply)
      .mockResolvedValueOnce({
        skeletonKey: 'alpha set/../x', skeletonName: '甲套骨架', skeletonVersion: 2, dryRun: true,
        items: [{ pageKey: 'home', slug: 'home', title: '首页', pageType: 'home', navSort: 1, willCreate: true, reason: '本站还没有这一页' }],
        created: 0
      } as any)
      .mockResolvedValueOnce({
        skeletonKey: 'alpha set/../x', skeletonName: '甲套骨架', skeletonVersion: 2, dryRun: false,
        items: [], created: 5
      } as any)
    pickSelect(0, 3)
    pickSelect(1, 'alpha set/../x')
    await flushPromises()
    buttonContaining('先看新增计划')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const confirm = buttonContaining('确认执行')
    expect(confirm.length).toBeGreaterThan(0)
    confirm[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(portalSkeletonsApi.apply).toHaveBeenLastCalledWith(3, 'alpha set/../x', true)
    expect(document.body.textContent || '').toContain('新建 5 个页面')
  })

  it('换站点或换骨架后旧计划作废，确认执行点不动', async () => {
    currentWrapper = await mountView()
    vi.mocked(portalSkeletonsApi.apply).mockResolvedValue({
      skeletonKey: 'alpha set/../x', skeletonName: '甲套骨架', skeletonVersion: 2, dryRun: true,
      items: [{ pageKey: 'home', slug: 'home', title: '首页', pageType: 'home', navSort: 1, willCreate: true, reason: '本站还没有这一页' }],
      created: 0
    } as any)
    pickSelect(0, 3)
    pickSelect(1, 'alpha set/../x')
    await flushPromises()
    buttonContaining('先看新增计划')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalSkeletonsApi.apply).toHaveBeenCalledTimes(1)

    // 换成另一个站点：计划与这个站点已经对不上了，那张计划表连同它的确认按钮一起撤掉
    pickSelect(0, 4)
    await flushPromises()
    expect(document.querySelectorAll('.table-stub')).toHaveLength(1)
    const confirm = buttonContaining('确认执行')
    expect(confirm).toHaveLength(1)
    expect((confirm[0] as HTMLButtonElement).disabled).toBe(true)
    confirm.forEach(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushPromises()
    expect(portalSkeletonsApi.apply).toHaveBeenCalledTimes(1)
    expect(currentWrapper.text()).toContain('确认执行之前必须先取一次计划')
  })

  it('执行还在路上时反复点确认也只发一次', async () => {
    currentWrapper = await mountView()
    let resolveApply: (value: unknown) => void = () => {}
    vi.mocked(portalSkeletonsApi.apply)
      .mockResolvedValueOnce({
        skeletonKey: 'alpha set/../x', skeletonName: '甲套骨架', skeletonVersion: 2, dryRun: true,
        items: [{ pageKey: 'home', slug: 'home', title: '首页', pageType: 'home', navSort: 1, willCreate: true, reason: '本站还没有这一页' }],
        created: 0
      } as any)
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveApply = resolve
      }) as any)
    pickSelect(0, 3)
    pickSelect(1, 'alpha set/../x')
    await flushPromises()
    buttonContaining('先看新增计划')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    buttonContaining('确认执行').forEach(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushPromises()
    expect(portalSkeletonsApi.apply).toHaveBeenCalledTimes(2)
    // 后端还没回执：这一轮没做完之前一颗都不许再发
    buttonContaining('确认执行').forEach(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushPromises()
    expect(portalSkeletonsApi.apply).toHaveBeenCalledTimes(2)

    resolveApply?.({
      skeletonKey: 'alpha set/../x', skeletonName: '甲套骨架', skeletonVersion: 2, dryRun: false,
      items: [], created: 1
    })
    await flushPromises()
    expect(document.body.textContent || '').toContain('新建 1 个页面')
    // 一轮执行完就得重新取计划，不能再点一次执行
    buttonContaining('确认执行').forEach(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushPromises()
    expect(portalSkeletonsApi.apply).toHaveBeenCalledTimes(2)
  })

  it('没取计划就直接点确认：一次请求都不发', async () => {
    currentWrapper = await mountView()
    pickSelect(0, 3)
    pickSelect(1, 'alpha set/../x')
    await flushPromises()
    const confirm = buttonContaining('确认执行')
    expect(confirm.every(node => (node as HTMLButtonElement).disabled)).toBe(true)
    confirm.forEach(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await flushPromises()
    expect(portalSkeletonsApi.apply).not.toHaveBeenCalled()
  })

  it('没有 portal:build:manage 的账号看不到应用面板', async () => {
    currentWrapper = await mountView([skeleton()], ['portal:build:preset'])
    expect(buttonContaining('先看新增计划')).toHaveLength(0)
    expect(currentWrapper.text()).toContain('能看骨架但不能补页面')
  })
})

describe('待审核的沉淀骨架：清单只有一个来源，发布/退役各要一次确认', () => {
  it('清单读 /pending，状态中文仍然只来自词表（本地一份「草稿」都不许有）', async () => {
    currentWrapper = await mountView([skeleton()], undefined, { pending: [pendingRow()] })
    expect(portalSkeletonsApi.pending).toHaveBeenCalled()
    const text = currentWrapper.text()
    expect(text).toContain('从甲站洗出来的一套')
    expect(text).toContain('ref-12')
    expect(text).toContain('还没定稿')
    expect(text).toContain('2 页')
    expect(text).not.toContain('草稿')
    expect(text).not.toContain('draft')
  })

  it('后端换一套状态说法，页面跟着换：格子不认自己写死的中文', async () => {
    currentWrapper = await mountView([skeleton()], undefined, {
      pending: [pendingRow()],
      statusLabels: { draft: '还没看过', published: '给站点选了' }
    })
    const text = currentWrapper.text()
    expect(text).toContain('还没看过')
    expect(text).not.toContain('还没定稿')
  })

  it('一条待审都没有时明说没有，而不是把画廊那份列表凑数', async () => {
    currentWrapper = await mountView([skeleton()], undefined, { pending: [] })
    expect(currentWrapper.text()).toContain('现在没有待审的沉淀骨架')
    expect(buttonContaining('发布')).toHaveLength(0)
  })

  it('点「发布」只把后果问一遍：一次请求都不发', async () => {
    currentWrapper = await mountView([skeleton()], undefined, { pending: [pendingRow()] })
    byText('发布')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalSkeletonsApi.publish).not.toHaveBeenCalled()
    expect(portalSkeletonsApi.retire).not.toHaveBeenCalled()
    expect(currentWrapper.text()).toContain('再点一次才真的发这一发')
    expect(buttonContaining('确认发布这一套')).toHaveLength(1)
  })

  it('第二颗按钮才发那一发，回执的状态读后端回来的那一行', async () => {
    currentWrapper = await mountView([skeleton()], undefined, { pending: [pendingRow()] })
    byText('发布')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    vi.mocked(portalSkeletonsApi.publish).mockResolvedValue({
      skeletonKey: 'ref-12', name: '从甲站洗出来的一套', status: 'published', approvedBy: 'qa', version: 1
    } as any)
    byText('确认发布这一套')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(portalSkeletonsApi.publish).toHaveBeenCalledTimes(1)
    expect(portalSkeletonsApi.publish).toHaveBeenCalledWith('ref-12')
    // 发布不会自动接一步退役
    expect(portalSkeletonsApi.retire).not.toHaveBeenCalled()
    expect(currentWrapper.text()).toContain('放出去的')
    expect(currentWrapper.text()).toContain('审核人 qa')
    // 走完一轮就退回默认态，确认按钮不再挂着
    expect(buttonContaining('确认发布这一套')).toHaveLength(0)
    expect(buttonContaining('取消')).toHaveLength(0)
  })

  it('退役是另一件事：要自己的一次确认，且不会顺手发布', async () => {
    currentWrapper = await mountView([skeleton()], undefined, { pending: [pendingRow()] })
    byText('退役')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalSkeletonsApi.retire).not.toHaveBeenCalled()
    expect(currentWrapper.text()).toContain('已经按它建出来的页面一行都不动')
    vi.mocked(portalSkeletonsApi.retire).mockResolvedValue({ skeletonKey: 'ref-12', status: 'retired' } as any)
    byText('确认退役这一套')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalSkeletonsApi.retire).toHaveBeenCalledWith('ref-12')
    expect(portalSkeletonsApi.publish).not.toHaveBeenCalled()
    expect(currentWrapper.text()).toContain('撤掉了')
  })

  it('按「取消」不发请求，确认态收回去', async () => {
    currentWrapper = await mountView([skeleton()], undefined, { pending: [pendingRow()] })
    byText('退役')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    byText('取消')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalSkeletonsApi.retire).not.toHaveBeenCalled()
    expect(buttonContaining('取消')).toHaveLength(0)
    expect(buttonContaining('退役')).toHaveLength(1)
  })

  it('待审清单读失败：说清没取到，这一格里一颗按钮都不留', async () => {
    currentWrapper = await mountView([skeleton()], undefined, { pendingError: '这个账号没有 portal:build:preset' })
    expect(currentWrapper.text()).toContain('清单没取到就是没取到')
    expect(currentWrapper.text()).toContain('这个账号没有 portal:build:preset')
    expect(buttonContaining('发布')).toHaveLength(0)
    expect(buttonContaining('退役')).toHaveLength(0)
  })

  it('后端拒了发布：那句中文原样贴出来，确认态留着但不自动重试', async () => {
    currentWrapper = await mountView([skeleton()], undefined, { pending: [pendingRow()] })
    byText('发布')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    vi.mocked(portalSkeletonsApi.publish).mockRejectedValueOnce(
      new Error('这套骨架还不能发布：页「home」：区块 hero 不在白名单里')
    )
    byText('确认发布这一套')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(currentWrapper.text()).toContain('这套骨架还不能发布：页「home」：区块 hero 不在白名单里')
    expect(portalSkeletonsApi.publish).toHaveBeenCalledTimes(1)
    // 没有第二次自动发送
    expect(portalSkeletonsApi.publish).toHaveBeenCalledTimes(1)
  })

  it('没有 preset 权限：沉淀与待审两格都不给', async () => {
    currentWrapper = await mountView([skeleton()], ['portal:build:manage'])
    expect(currentWrapper.text()).toContain('沉淀与审核都做不了')
    expect(buttonContaining('洗成待审骨架')).toHaveLength(0)
    expect(buttonContaining('发布')).toHaveLength(0)
    expect(portalSkeletonsApi.pending).not.toHaveBeenCalled()
  })
})

describe('参考站 → 骨架沉淀：产物只是待审骨架，证据要当场看得到', () => {
  it('任务 ID 不是一个数字之前不给点，也不发请求', async () => {
    currentWrapper = await mountView([skeleton()])
    const distillButton = buttonContaining('洗成待审骨架')
    expect(distillButton).toHaveLength(1)
    expect((distillButton[0] as HTMLButtonElement).disabled).toBe(true)
    await currentWrapper.find('input[placeholder="任务 ID"]').setValue('12x')
    expect((buttonContaining('洗成待审骨架')[0] as HTMLButtonElement).disabled).toBe(true)
    await currentWrapper.find('input[placeholder="任务 ID"]').setValue('-3')
    expect((buttonContaining('洗成待审骨架')[0] as HTMLButtonElement).disabled).toBe(true)
    expect(portalSkeletonsApi.distill).not.toHaveBeenCalled()
  })

  it('填了 ID 才发那一发，可空字段按 null 送过去让后端自己兜', async () => {
    currentWrapper = await mountView([skeleton()])
    await currentWrapper.find('input[placeholder="任务 ID"]').setValue('12')
    await flushPromises()
    buttonContaining('洗成待审骨架')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalSkeletonsApi.distill).toHaveBeenCalledWith(12, {
      skeletonKey: null, name: null, description: null
    })
  })

  it('回执里洗掉了什么、哪几页没带进来，逐条照后端原话列出来', async () => {
    currentWrapper = await mountView([skeleton()], undefined, { distillReceipt: distilled() })
    await currentWrapper.find('input[placeholder="任务 ID"]').setValue('12')
    buttonContaining('洗成待审骨架')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const lines: string[] = currentWrapper.findAll('.skeleton-library__evidence-list li').map(
      (node: any) => node.text()
    )
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('字面文案「XX 集团 400-800-1234」换成演示文本')
    expect(lines[1]).toContain('指向 https://customer-a.example/doc.pdf 的整槽已删除')
    expect(lines[2]).toContain('没有人工确认过的映射，整页跳过')
    expect(currentWrapper.text()).toContain('2 页')
    expect(currentWrapper.text()).toContain('7 块')
    expect(currentWrapper.text()).toContain('洗掉的客户内容 2 处')
    expect(currentWrapper.text()).toContain('没带进来的页 1 条')
    // 沉淀之后要重取待审清单：新那套要能立刻出现在下面那张表里等人审
    expect(portalSkeletonsApi.pending).toHaveBeenCalledTimes(2)
  })

  it('后端一次都没报洗掉时照实说没报，不许写「已清洗」三个字', async () => {
    currentWrapper = await mountView([skeleton()], undefined, {
      distillReceipt: distilled({ stripped: [], skippedPages: [] })
    })
    await currentWrapper.find('input[placeholder="任务 ID"]').setValue('12')
    buttonContaining('洗成待审骨架')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(currentWrapper.findAll('.skeleton-library__evidence-list li')).toHaveLength(0)
    expect(currentWrapper.text()).toContain('后端一条都没报')
    expect(currentWrapper.text()).toContain('后端没报跳过的页')
    expect(currentWrapper.text()).not.toContain('已清洗')
  })

  it('沉淀被后端拒了：原因贴出来，证据一格都不留', async () => {
    currentWrapper = await mountView([skeleton()], undefined, {
      distillError: '参考站任务当前是「结构归纳中」，映射就绪之后才能沉淀骨架'
    })
    await currentWrapper.find('input[placeholder="任务 ID"]').setValue('12')
    buttonContaining('洗成待审骨架')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(currentWrapper.text()).toContain('映射就绪之后才能沉淀骨架')
    expect(currentWrapper.findAll('.skeleton-library__evidence-list li')).toHaveLength(0)
    expect(currentWrapper.text()).not.toContain('刚洗出来的是')
  })
})
