import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button } from 'ant-design-vue'
import ClusterPanel from '../ClusterPanel.vue'
import { clusterApi, suggestionApi } from '../../../api'

/**
 * 聚类那一屏的空态成因（M-P77）。
 *
 * 这一屏以前有三处会把人说错：
 * 1. 空表那一格写死一句「暂无聚类数据，点击上方「一键智能蒸馏」开始」，
 *    于是「这一档读不到」「这一页翻过了头」「这一发读失败」念出来都是同一句「这一家没蒸馏过」；
 * 2. 两发读捆在一个 `Promise.all` 里，任何一发挂了就把另一发已经读回来的行一起抹掉，
 *    屏上也说不出是哪一发没读回来；
 * 3. 顶部四格统计在没读回来时照样摆 0（0 的意思是「查过了，一家都没有」）。
 *
 * 钉这几件：
 * 1. 三种空各念各的，逐字比后端原文，屏上不许再出现那句硬编码；
 * 2. 后端没答成因时界面不替它猜；
 * 3. 读失败说的是读失败，且只清那一发自己的那一格，另一发的行留着；
 * 4. 「真的没有」才摆「一键智能蒸馏」那颗按钮，点它真的打得开蒸馏抽屉；读不到不摆；
 * 5. 读不到 / 读失败那两档，四格统计摆「—」而不是 0；真的没有才摆 0；
 * 6. 有行时不渲空态那一句，且「聚类总数」认后端那份总条数，不是本页行数。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<Record<string, any>>('vue-router')
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

// 这一屏有两张 echarts 图，组件在挂载 100ms 后会真去拿实例；图不是这一份用例要钉的东西
vi.mock('echarts', () => {
  const stubInstance = () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn() })
  return { init: stubInstance, getInstanceByDom: () => null }
})

vi.mock('../../../api', () => ({
  clusterApi: {
    list: vi.fn(),
    distill: vi.fn(),
    confirm: vi.fn(),
    get: vi.fn(),
    batchDelete: vi.fn(),
    generateSuggestions: vi.fn()
  },
  suggestionApi: {
    list: vi.fn(),
    update: vi.fn()
  }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    selectedTenantId: 1,
    tenantId: 1,
    user: { id: 1 },
    isSuperAdmin: true,
    hasPermission: () => true
  })
}))

const ROW = { id: 3, tenantId: 1, name: '种植牙价格', priority: 88, keywordCount: 4, keywords: ['种植牙价格'] }

/** 空表那一句只认 `#emptyText`：这一层就是钉「句子是谁摆的」 */
const TABLE_STUB = {
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] } },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = props.dataSource as any[]
      const children: any[] = []
      if (rows.length > 0) {
        children.push(...rows.map((record) =>
          h('div', { class: 'row', 'data-row': record.id }, String(record.name ?? record.id))))
      } else if (slots.emptyText) {
        children.push(h('div', { class: 'empty' }, slots.emptyText({})))
      } else {
        children.push(h('div', { class: 'empty' }, '暂无数据'))
      }
      return h('div', { class: 'table-stub' }, children)
    }
  }
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="actions" /><slot name="title" /><slot name="extra" /><slot name="footer" /></${tag}>`
})

type PageShape = {
  records: any[]
  total: number
  page?: number
  size?: number
  pages?: number
  emptyReason?: string | null
  emptyLine?: string | null
}

async function mountView(
  clusters: Partial<PageShape> & { failWith?: Error } = {},
  suggestions: Partial<PageShape> & { failWith?: Error } = {}
) {
  if (clusters.failWith) {
    vi.mocked(clusterApi.list).mockRejectedValue(clusters.failWith)
  } else {
    const { failWith: _ignored, ...rest } = clusters
    vi.mocked(clusterApi.list).mockResolvedValue({ records: [], total: 0, ...rest } as any)
  }
  if (suggestions.failWith) {
    vi.mocked(suggestionApi.list).mockRejectedValue(suggestions.failWith)
  } else {
    const { failWith: _ignored, ...rest } = suggestions
    vi.mocked(suggestionApi.list).mockResolvedValue({ records: [], total: 0, ...rest } as any)
  }
  vi.mocked(clusterApi.distill).mockResolvedValue({ clusterCount: 0, clusters: [] } as any)

  const wrapper = mount(ClusterPanel, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-alert': PASS_THROUGH('AAlert'),
        'a-button': Button,
        'a-col': PASS_THROUGH('ACol'),
        'a-drawer': {
          name: 'ADrawer',
          props: { open: { type: Boolean, default: false } },
          template: '<div v-if="open" class="drawer-open-stub"><slot /></div>'
        },
        'a-dropdown': PASS_THROUGH('ADropdown'),
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-menu': PASS_THROUGH('AMenu'),
        'a-menu-item': PASS_THROUGH('AMenuItem'),
        'a-modal': {
          name: 'AModal',
          props: { open: { type: Boolean, default: false } },
          template: '<div v-if="open" class="modal-open-stub"><slot /><slot name="footer" /></div>'
        },
        'a-pagination': PASS_THROUGH('APagination'),
        'a-progress': PASS_THROUGH('AProgress'),
        'a-row': PASS_THROUGH('ARow'),
        'a-select': { name: 'ASelect', template: '<select class="select-stub"></select>' },
        'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
        'a-space': PASS_THROUGH('ASpace'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-table': TABLE_STUB,
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-textarea': { name: 'ATextarea', template: '<textarea class="textarea-stub"></textarea>' },
        'a-tooltip': PASS_THROUGH('ATooltip')
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 后端那一句（「真的没有」那一档下面多摆的那颗按钮比句子时摘掉） */
const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

/** 四格统计念出来的值，按 key 取 */
function statValue(wrapper: any, label: string): string {
  const card = wrapper.findAll('.stat-card').find((c: any) => c.text().includes(label))
  expect(card, `屏上没有「${label}」那一格`).toBeDefined()
  return (card!.find('.stat-card__value').text() || '').trim()
}

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '聚类：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '聚类：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '聚类：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

describe('ClusterPanel 的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it.each(THREE_EMPTIES)('后端答 %s 时界面逐字念那一句，不摆「暂无聚类数据」', async (reason, line) => {
    const wrapper = await mountView({ records: [], total: 0, emptyReason: reason, emptyLine: line })
    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.text()).not.toContain('暂无聚类数据')
    expect(wrapper.text()).not.toContain('暂无数据')
  })

  it('后端没答是哪一种空时界面念自己那句兜底，不替它猜', async () => {
    const wrapper = await mountView({ records: [], total: 0 })
    expect(hintText(wrapper)).toContain('后端没回是哪一种空，界面不替它猜')
  })

  it('「真的没有」那一档才摆「一键智能蒸馏」，点它真的打得开蒸馏抽屉', async () => {
    const wrapper = await mountView({
      records: [], total: 0, emptyReason: 'NONE',
      emptyLine: '聚类：这一档查过了，一条都没有。'
    })
    // 只认空那一格里的那颗：工具栏本来就有一颗同名的，点它证明不了这一格接上了
    const button = wrapper.find('.empty .create-on-empty')
    expect(button.exists(), '「真的没有」那一档，空那格里没摆出按钮').toBe(true)
    expect(button.text()).toContain('一键智能蒸馏')
    expect(wrapper.find('.drawer-open-stub').exists()).toBe(false)
    await button!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.drawer-open-stub').exists()).toBe(true)
    expect(vi.mocked(clusterApi.distill)).toHaveBeenCalled()
  })

  it('「这一档读不到」那一档不摆蒸馏按钮，也不说「没有」', async () => {
    const wrapper = await mountView({
      records: [], total: 0, emptyReason: 'NOT_VISIBLE',
      emptyLine: '聚类：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    })
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
    expect(hintText(wrapper)).toContain('读不到')
  })

  it('聚类那一发读失败：说的是读失败，且不是「这一档没有」', async () => {
    const wrapper = await mountView({ failWith: new Error('gateway 502') })
    expect(hintText(wrapper)).toContain('这一发读失败')
    expect(hintText(wrapper)).toContain('读失败不是「这一档没有」')
    expect(wrapper.text()).not.toContain('一条都没有')
  })

  it('只有一读失败时不清另一读读回来的行（两发分开认）', async () => {
    const wrapper = await mountView(
      { records: [ROW], total: 1 },
      { failWith: new Error('gateway 502') }
    )
    expect(wrapper.find('.row').text()).toContain('种植牙价格')
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    // 「已生成建议」那一格读不到 ⇒ 摆「—」，不许摆 0
    expect(statValue(wrapper, '已生成建议')).toBe('—')
    // 聚类那一发读回来了 ⇒ 数字照摆
    expect(statValue(wrapper, '聚类总数')).toBe('1')
  })

  it('四格统计：读不到与读失败两档摆「—」，真的没有才摆 0', async () => {
    const unreadable = await mountView(
      {
        records: [], total: 0, emptyReason: 'NOT_VISIBLE',
        emptyLine: '聚类：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
      },
      {
        records: [], total: 0, emptyReason: 'NOT_VISIBLE',
        emptyLine: '内容建议：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
      }
    )
    for (const label of ['聚类总数', '高优先级', '已生成建议', '待蒸馏']) {
      expect(statValue(unreadable, label), label).toBe('—')
    }

    const none = await mountView(
      { records: [], total: 0, emptyReason: 'NONE', emptyLine: '聚类：这一档查过了，一条都没有。' },
      { records: [], total: 0, emptyReason: 'NONE', emptyLine: '内容建议：这一档查过了，一条都没有。' }
    )
    for (const label of ['聚类总数', '高优先级', '已生成建议', '待蒸馏']) {
      expect(statValue(none, label), label).toBe('0')
    }

    const failed = await mountView({ failWith: new Error('gateway 502') }, { failWith: new Error('gateway 502') })
    for (const label of ['聚类总数', '高优先级', '已生成建议', '待蒸馏']) {
      expect(statValue(failed, label), label).toBe('—')
    }
  })

  it('有行时不渲空态那一句，且「聚类总数」认后端那份总条数不是本页行数', async () => {
    // 这一发只回 1 行、后端说这一档共 25 条：以前界面上的「聚类总数」念的是本页行数 1
    const wrapper = await mountView({ records: [ROW], total: 25, page: 1, size: 20, pages: 2 })
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(statValue(wrapper, '聚类总数')).toBe('25')
  })

  it('内容建议那一发答「读不到」时，界面上不出现「一条都没有」那句', async () => {
    const wrapper = await mountView(
      { records: [ROW], total: 1 },
      {
        records: [], total: 0, emptyReason: 'NOT_VISIBLE',
        emptyLine: '内容建议：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
      }
    )
    expect(wrapper.text()).not.toContain('内容建议：这一档查过了')
    expect(statValue(wrapper, '已生成建议')).toBe('—')
  })
})
