import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { Button } from 'ant-design-vue'
import ArticleDetailView from '../ArticleDetailView.vue'
import { articleManageApi } from '../../../api/article'

/**
 * 文章详情这一屏的两条边界（M-P108）：
 *
 * 1. 平台档（超管没选客户）能读、能看出这一篇属于哪家，但编辑/删除置灰并写明原因；
 * 2. 读失败与「文章已被删除」分开念——失败时不许摆成后者，也不许给可点的写按钮。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/article', () => ({
  articleManageApi: {
    get: vi.fn(),
    list: vi.fn(),
    versions: vi.fn(),
    knowledgeSources: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../../api/http', () => ({
  describeHttpError: () => 'HTTP 500'
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
  isSuperAdmin: true,
  user: { id: 1, tenantId: 1 } as any
})

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authState
}))

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="extra" /><slot name="title" /></div>`
})

const STUBS = {
  'a-alert': {
    name: 'AAlert',
    props: ['message', 'description', 'type', 'showIcon'],
    template: '<div class="alert-stub"><div class="alert-message">{{ message }}</div><div class="alert-description">{{ description }}</div><slot name="message" /><slot name="description" /></div>'
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
  'a-space': PASS_THROUGH('ASpace'),
  'a-tag': PASS_THROUGH('ATag'),
  'a-divider': PASS_THROUGH('ADivider'),
  'a-empty': { name: 'AEmpty', props: ['description'], template: '<div class="empty-stub">{{ description }}</div>' },
  'a-list': PASS_THROUGH('AList'),
  'a-list-item': PASS_THROUGH('AListItem'),
  'a-popconfirm': PASS_THROUGH('APopconfirm'),
  'a-input': { name: 'AInput', props: ['value'], template: '<input class="input-stub" />' },
  'a-textarea': { name: 'ATextarea', props: ['value'], template: '<textarea class="textarea-stub"></textarea>' },
  'a-button': Button
}

function mountView() {
  return mount(ArticleDetailView, { global: { stubs: STUBS } })
}

function findButton(wrapper: any, text: string) {
  // Ant Design 会把两个汉字的按钮念成「编 辑」，比对前先去空白
  const compact = (value: string) => value.replace(/\s+/g, '')
  return wrapper.findAll('button').find((node: any) => compact(node.text()).includes(text))
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.isSuperAdmin = true
  authState.selectedTenantId = null
  vi.mocked(articleManageApi.get).mockResolvedValue({
    id: 12,
    tenantId: 558,
    tenantName: '演示客户甲',
    title: '某一篇',
    summary: '摘要',
    content: '正文内容',
    source: '企业官网',
    keywords: '出海上线',
    viewCount: 3,
    likeCount: 1,
    status: 'published'
  } as any)
  vi.mocked(articleManageApi.list).mockResolvedValue({ records: [], total: 0 } as any)
  vi.mocked(articleManageApi.versions).mockResolvedValue([] as any)
  vi.mocked(articleManageApi.knowledgeSources).mockResolvedValue([] as any)
})

describe('文章详情 · 平台档与读失败两档', () => {
  it('平台档：详情照读，摆出归属客户，编辑/删除置灰并写明去哪儿选客户', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(articleManageApi.get).toHaveBeenCalledWith(12)
    expect(wrapper.text()).toContain('归属客户：演示客户甲')
    expect(wrapper.text()).toContain('当前没有选定客户，这一屏只读')

    expect(findButton(wrapper, '编辑').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, '编辑文章').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, '删除文章').attributes('disabled')).toBeDefined()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('读失败：常驻提示说「没读到」，空态不说成「已被删除」，编辑仍灰', async () => {
    vi.mocked(articleManageApi.get).mockRejectedValue(new Error('boom'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('这一篇没读到：HTTP 500')
    expect(wrapper.text()).toContain('这一篇没读到，不代表文章已被删除')
    expect(wrapper.text()).not.toContain('文章不存在或已被删除')
    expect(findButton(wrapper, '编辑').attributes('disabled')).toBeDefined()
  })

  it('选了客户 558：读回来的详情正常摆，编辑按钮放开', async () => {
    authState.selectedTenantId = 558

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('某一篇')
    expect(findButton(wrapper, '编辑').attributes('disabled')).toBeUndefined()
    expect(findButton(wrapper, '编辑文章').attributes('disabled')).toBeUndefined()
  })
})
