import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ReferenceTaskDrawer from '../ReferenceTaskDrawer.vue'
import ReferencePagesTab from '../reference/ReferencePagesTab.vue'
import ReferenceMappingsTab from '../reference/ReferenceMappingsTab.vue'
import ReferenceUnmatchedTab from '../reference/ReferenceUnmatchedTab.vue'
import ReferencePackageTab from '../reference/ReferencePackageTab.vue'
import { portalReferenceApi } from '../../../api/referenceSites'

/**
 * SPEC-UI-6 M4：抽屉把四个 Tab 的 `:retry` 接对函数。
 *
 * 静态闸门只能查「绑没绑 :retry」，查不出「绑到了别人那一发」——
 * 点完没反应、或者只重读了一半（「暂未对上」那一栏尤其容易被接到只读映射的那一口）都看不出来。
 * 这一例从抽屉那一层按每一栏的重试，看它到底发了哪几个请求。
 */

vi.mock('../../../api/referenceSites', async () => {
  const actual = await vi.importActual<Record<string, any>>('../../../api/referenceSites')
  return {
    ...actual,
    portalReferenceApi: {
      get: vi.fn(),
      pages: vi.fn(),
      mappings: vi.fn(),
      unmatchedGroups: vi.fn(),
      templatePackage: vi.fn(),
      shotMedia: vi.fn(),
      statusLabels: vi.fn(),
      vocabularies: vi.fn()
    }
  }
})

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }
})

const SLOT_RENDER = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /></div>`
})

const ATableStub = {
  name: 'ATable',
  props: ['dataSource', 'loading', 'rowKey', 'pagination', 'scroll'],
  template: '<div class="table-stub"><slot /></div>'
}

const AButtonStub = {
  name: 'AButton',
  emits: ['click'],
  template: '<button class="btn-stub" @click="$emit(\'click\')"><slot /></button>'
}

const STUBS = {
  'a-drawer': SLOT_RENDER('ADrawer'),
  'a-spin': SLOT_RENDER('ASpin'),
  // 四栏都渲染出来：真实 a-tabs 只渲活跃那一栏，这里要一次看四栏的接线
  'a-tabs': SLOT_RENDER('ATabs'),
  'a-tab-pane': SLOT_RENDER('ATabPane'),
  'a-modal': SLOT_RENDER('AModal'),
  'a-form': SLOT_RENDER('AForm'),
  'a-form-item': SLOT_RENDER('AFormItem'),
  'a-descriptions': SLOT_RENDER('ADescriptions'),
  'a-descriptions-item': SLOT_RENDER('ADescriptionsItem'),
  'a-space': SLOT_RENDER('ASpace'),
  'a-table': ATableStub,
  'a-button': AButtonStub
}

const TASK = { id: 7, status: 'done', mode: 'url', sourceUrl: 'https://example.com', pagesCrawled: 1 }

function tabOf(wrapper: any, component: any, index = 0) {
  return wrapper.findAllComponents(component)[index]
}

async function mountDrawer() {
  const wrapper = mount(ReferenceTaskDrawer, {
    props: {
      open: true,
      statusLabels: {},
      vocabularies: null,
      vocabError: null,
      blocks: [],
      sites: []
    },
    global: { stubs: STUBS }
  })
  await flushPromises()
  ;(wrapper.vm as any).open(7)
  await flushPromises()
  return wrapper
}

describe('ReferenceTaskDrawer 的四栏重试接线', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(portalReferenceApi.get).mockResolvedValue(TASK as any)
    vi.mocked(portalReferenceApi.pages).mockRejectedValue(new Error('页面列表加载失败'))
    vi.mocked(portalReferenceApi.mappings).mockRejectedValue(new Error('映射列表加载失败'))
    vi.mocked(portalReferenceApi.unmatchedGroups).mockRejectedValue(new Error('映射列表加载失败'))
    vi.mocked(portalReferenceApi.templatePackage).mockRejectedValue(new Error('模板包载入失败'))
    vi.mocked(portalReferenceApi.shotMedia).mockResolvedValue({ records: [] } as any)
  })

  it('四栏的「重试」各自回到自己那一发：路由清单只重读页面，两栏映射重读映射，模板证据重读模板包', async () => {
    const wrapper = await mountDrawer()

    // 打开抽屉时每一栏各读过一次（映射与「暂未对上」共用 loadMappings，所以各一次）
    expect(portalReferenceApi.pages).toHaveBeenCalledTimes(1)
    expect(portalReferenceApi.mappings).toHaveBeenCalledTimes(1)
    expect(portalReferenceApi.unmatchedGroups).toHaveBeenCalledTimes(1)

    // 模板证据不随抽屉打开自动载入，先按一次「载入模板包」把失败那一发造出来
    tabOf(wrapper, ReferencePackageTab).vm.$emit('load')
    await flushPromises()

    // 失败期间四栏都看得见重试（模板证据在没有 pkg 时也要有，M4 补的那一档）
    for (const tabClass of [ReferencePagesTab, ReferenceMappingsTab, ReferenceUnmatchedTab, ReferencePackageTab]) {
      const tab = tabOf(wrapper, tabClass)
      expect(tab.text()).toContain('重试')
    }

    // 恢复：下一次读成功
    vi.mocked(portalReferenceApi.pages).mockResolvedValue([{ id: 3, routePath: '/home' }] as any)
    vi.mocked(portalReferenceApi.mappings).mockResolvedValue([{ id: 11, observedBlock: 'hero' }] as any)
    vi.mocked(portalReferenceApi.unmatchedGroups).mockResolvedValue([] as any)
    vi.mocked(portalReferenceApi.templatePackage).mockResolvedValue({
      pages: [], slotShapes: [], vocabularies: [], interactionHints: []
    } as any)

    // 1）路由清单
    await tabOf(wrapper, ReferencePagesTab).props('retry')()
    await flushPromises()
    expect(portalReferenceApi.pages).toHaveBeenCalledTimes(2)
    expect(tabOf(wrapper, ReferencePagesTab).props('error')).toBeNull()
    expect(tabOf(wrapper, ReferencePagesTab).props('pages')).toHaveLength(1)

    // 2）区块映射
    await tabOf(wrapper, ReferenceMappingsTab).props('retry')()
    await flushPromises()
    expect(portalReferenceApi.mappings).toHaveBeenCalledTimes(2)
    expect(tabOf(wrapper, ReferenceMappingsTab).props('error')).toBeNull()
    expect(tabOf(wrapper, ReferenceMappingsTab).props('mappings')).toHaveLength(1)

    // 3）暂未对上：这一栏的重试必须重读它自己那一口，不能只重读区块映射
    // （两栏共用 loadMappings，所以映射也跟着重读一次——但「少读它自己那一口」就会被这一例抓住）
    await tabOf(wrapper, ReferenceUnmatchedTab).props('retry')()
    await flushPromises()
    expect(portalReferenceApi.unmatchedGroups).toHaveBeenCalledTimes(3)
    expect(portalReferenceApi.mappings).toHaveBeenCalledTimes(3)
    expect(tabOf(wrapper, ReferenceUnmatchedTab).props('error')).toBeNull()

    // 4）模板证据
    await tabOf(wrapper, ReferencePackageTab).props('retry')()
    await flushPromises()
    expect(portalReferenceApi.templatePackage).toHaveBeenCalledTimes(2)
    expect(tabOf(wrapper, ReferencePackageTab).props('error')).toBeNull()
  })
})

