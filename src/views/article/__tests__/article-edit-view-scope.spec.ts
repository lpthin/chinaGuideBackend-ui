import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { Button } from 'ant-design-vue'
import ArticleEditView from '../ArticleEditView.vue'
import { articleApi } from '../../../api/workspace'
import { articleCategoryApi } from '../../../api/article'
import { caseTagApi } from '../../../api/case'

/**
 * 文章编辑这一屏的两种档（M-P106 拍板 Q1 的 B 类）：文章按客户存。
 *
 * 钉两件：
 * 1. 平台档（超管没选客户）一口业务请求都不发——文章详情、分类、热门标签都不读，
 *    保存草稿与提交审核全灰，屏上明说去哪儿选客户；
 * 2. 选了客户之后，读口与写口带的都是那一家选中的编号。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  articleApi: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  publishApi: { publish: vi.fn() },
  reviewApi: { submitForReview: vi.fn() }
}))

vi.mock('../../../api/article', () => ({
  articleCategoryApi: { all: vi.fn() },
  imageLibraryApi: { upload: vi.fn(), list: vi.fn() }
}))

vi.mock('../../../api/case', () => ({
  caseTagApi: { hot: vi.fn() }
}))

vi.mock('../../../api/ai-model', () => ({
  aiGenerateApi: { generateSeo: vi.fn() }
}))

const routerPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>()
  return {
    ...actual,
    useRouter: () => ({ push: routerPush, back: vi.fn() }),
    useRoute: () => ({ params: { id: '12' }, query: {}, meta: {} })
  }
})

const authState = reactive({
  selectedTenantId: null as number | null,
  selectedTenantCode: undefined as string | undefined,
  tenantId: 1 as number | undefined,
  isSuperAdmin: true,
  user: { id: 1, tenantId: 1 } as any
})

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authState
}))

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="extra" /><slot name="title" /><slot name="description" /><slot name="overlay" /><slot name="dot" /></div>`
})

const STUBS = {
  'a-alert': {
    name: 'AAlert',
    props: ['message', 'type', 'showIcon'],
    template: '<div class="alert-stub">{{ message }}<slot name="message" /><slot name="description" /></div>'
  },
  'a-spin': PASS_THROUGH('ASpin'),
  'a-page-header': {
    name: 'APageHeader',
    props: ['title'],
    template: '<div class="page-header-stub"><span class="page-title">{{ title }}</span><slot name="extra" /><slot /></div>'
  },
  'a-row': PASS_THROUGH('ARow'),
  'a-col': PASS_THROUGH('ACol'),
  'a-card': PASS_THROUGH('ACard'),
  'a-form': PASS_THROUGH('AForm'),
  'a-form-item': PASS_THROUGH('AFormItem'),
  'a-space': PASS_THROUGH('ASpace'),
  'a-dropdown': {
    name: 'ADropdown',
    props: ['disabled'],
    template: '<div class="dropdown-stub"><slot /><slot name="overlay" /></div>'
  },
  'a-menu': PASS_THROUGH('AMenu'),
  'a-menu-item': PASS_THROUGH('AMenuItem'),
  'a-menu-divider': PASS_THROUGH('AMenuDivider'),
  'a-input': { name: 'AInput', props: ['value'], template: '<input class="input-stub" />' },
  'a-textarea': { name: 'ATextarea', props: ['value'], template: '<textarea class="textarea-stub"></textarea>' },
  'a-select': { name: 'ASelect', props: ['value'], template: '<select class="select-stub"></select>' },
  'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
  'a-upload': PASS_THROUGH('AUpload'),
  'a-switch': { name: 'ASwitch', template: '<span class="switch-stub"></span>' },
  'a-date-picker': { name: 'ADatePicker', props: ['value'], template: '<input class="date-picker-stub" />' },
  'a-tag': PASS_THROUGH('ATag'),
  'a-steps': PASS_THROUGH('ASteps'),
  'a-step': PASS_THROUGH('AStep'),
  'a-tooltip': PASS_THROUGH('ATooltip'),
  'a-collapse': PASS_THROUGH('ACollapse'),
  'a-collapse-panel': PASS_THROUGH('ACollapsePanel'),
  'a-timeline': PASS_THROUGH('ATimeline'),
  'a-timeline-item': PASS_THROUGH('ATimelineItem'),
  'a-divider': PASS_THROUGH('ADivider'),
  'a-modal': PASS_THROUGH('AModal'),
  'a-button': Button
}

function mountView() {
  return mount(ArticleEditView, { global: { stubs: STUBS } })
}

function findButton(wrapper: any, text: string) {
  return wrapper.findAll('button').find((node: any) => node.text().includes(text))
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.isSuperAdmin = true
  authState.selectedTenantId = null
  authState.selectedTenantCode = undefined
  authState.tenantId = 1
  vi.mocked(articleApi.get).mockResolvedValue({
    id: 12,
    title: '某一篇',
    summary: '摘要',
    content: '正文内容',
    categoryId: 7,
    status: 'draft',
    tags: []
  } as any)
  vi.mocked(articleCategoryApi.all).mockResolvedValue([
    { id: 7, name: '企业动态' }
  ] as any)
  vi.mocked(caseTagApi.hot).mockResolvedValue([
    { name: '出海' }
  ] as any)
  vi.mocked(articleApi.update).mockResolvedValue({} as any)
})

describe('文章编辑 · 平台档与选客户两档', () => {
  it('平台档：文章详情、分类、热门标签都不读，保存与提交审核全灰并明说请先选客户', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(articleApi.get).not.toHaveBeenCalled()
    expect(articleCategoryApi.all).not.toHaveBeenCalled()
    expect(caseTagApi.hot).not.toHaveBeenCalled()

    const text = wrapper.text()
    expect(text).toContain('当前没有选定客户')
    expect(text).toContain('这两发没发出去')

    // 灰到点不动：写口根本走不到，所以这里只钉「灰」与「没发过写口」
    expect(findButton(wrapper, '保存草稿').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, '提交审核').attributes('disabled')).toBeDefined()
    expect(articleApi.update).not.toHaveBeenCalled()
  })

  it('选客户 558 后：详情、分类、热门标签与保存都带 558，保存按钮放开', async () => {
    authState.selectedTenantId = 558
    const wrapper = mountView()
    await flushPromises()

    expect(articleApi.get).toHaveBeenLastCalledWith(12, 558)
    expect(articleCategoryApi.all).toHaveBeenLastCalledWith(558)
    expect(caseTagApi.hot).toHaveBeenLastCalledWith(558, 10)
    expect(wrapper.text()).toContain('编号 558 的客户')

    const save = findButton(wrapper, '保存草稿')
    expect(save.attributes('disabled')).toBeUndefined()
    await save.trigger('click')
    await flushPromises()

    const calls = vi.mocked(articleApi.update).mock.calls
    const [articleId, , tenantId] = calls[calls.length - 1] as any
    expect(articleId).toBe(12)
    expect(tenantId).toBe(558)
  })
})
