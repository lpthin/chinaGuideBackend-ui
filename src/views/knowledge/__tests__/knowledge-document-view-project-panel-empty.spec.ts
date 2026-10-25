import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Col, RadioButton, RadioGroup, Row, message } from 'ant-design-vue'
import KnowledgeDocumentView from '../KnowledgeDocumentView.vue'
import { knowledgeCategoryApi, knowledgeDocumentApi, knowledgeTagApi } from '../../../api/knowledge'

/**
 * 资料库左边的项目面板（M-P75）：这一格空会被读成「这一家没建过项目」，
 * 而「这一家读不到」与「真的没有」是两件完全不同的事，只能由后端答、界面逐字念。
 *
 * 换之前这里硬编码了一句「暂无项目，点击新建项目创建」——租户选到一家读不到的时候，
 * 界面照样念这一句，等于把「读不到」说成「没有」，还顺手催人去新建。
 *
 * 钉四件：
 * 1. 后端回 NONE 时逐字念那一句，并在下面摆一颗「新建项目」（这一屏本来就有这个动作）；
 * 2. 后端回 NOT_VISIBLE（认不出这一家）时念「读不到」那一句，且不摆新建；
 * 3. 后端没答成因时界面不替它猜，也不许蒙成「一条都没有」；
 * 4. 这一发读失败说的是读失败，不是「这一档没有」；有项目时根本不渲那一句。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/knowledge', () => ({
  knowledgeDocumentApi: { list: vi.fn() },
  knowledgeCategoryApi: { all: vi.fn(), create: vi.fn() },
  knowledgeTagApi: { list: vi.fn() },
  knowledgeCardApi: { list: vi.fn() },
  flattenCategories: (list: any[]) => list ?? []
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    selectedTenantId: 7,
    accessToken: 'token-for-test',
    user: { id: 1 },
    isSuperAdmin: false,
    hasPermission: () => true
  })
}))

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="title" /><slot name="description" /></${tag}>`
})

const STUBS = {
  'a-button': Button,
  'a-row': Row,
  'a-col': Col,
  'a-spin': PASS_THROUGH('ASpin'),
  'a-card': PASS_THROUGH('ACard'),
  'a-card-meta': {
    name: 'ACardMeta',
    props: ['title'],
    template: '<div class="card-meta-stub"><span class="meta-title">{{ title }}</span><slot name="description" /></div>'
  },
  'a-modal': PASS_THROUGH('AModal'),
  'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
  'a-select': { name: 'ASelect', template: '<select class="select-stub"></select>' },
  'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
  'a-space': PASS_THROUGH('ASpace'),
  'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
  'a-table': { name: 'ATable', template: '<div class="table-stub" />' },
  'a-empty': PASS_THROUGH('AEmpty'),
  'a-tooltip': PASS_THROUGH('ATooltip'),
  'a-popconfirm': PASS_THROUGH('APopconfirm'),
  'a-upload': PASS_THROUGH('AUpload'),
  'a-form': PASS_THROUGH('AForm'),
  'a-form-item': PASS_THROUGH('AFormItem'),
  'a-alert': { name: 'AAlert', template: '<div class="alert-stub"><slot name="message" /><slot name="description" /></div>' },
  'a-typography-paragraph': {
    name: 'ATypographyParagraph',
    props: ['content'],
    template: '<p class="typography-stub">{{ content }}<slot /></p>'
  },
  'a-radio-group': RadioGroup,
  'a-radio-button': RadioButton
}

type PanelShape = {
  records: any[]
  total: number
  page?: number
  size?: number
  pages?: number
  emptyReason?: string | null
  emptyLine?: string | null
}

async function mountPanel(panel: PanelShape | Error) {
  if (panel instanceof Error) {
    vi.mocked(knowledgeCategoryApi.all).mockRejectedValue(panel)
  } else {
    vi.mocked(knowledgeCategoryApi.all).mockResolvedValue(
      { page: 1, size: Math.max(panel.records.length, 1), pages: 1, ...panel } as any
    )
  }
  // 「未归类」那张卡读的是另一发（unclassified=true）；这里固定回 0，卡撤下，界面上只剩项目面板那一格
  vi.mocked(knowledgeDocumentApi.list).mockResolvedValue({ records: [], total: 0 } as any)
  vi.mocked(knowledgeTagApi.list).mockResolvedValue([] as any)

  const wrapper = mount(KnowledgeDocumentView, { attachTo: document.body, global: { stubs: STUBS } })
  await flushPromises()
  return wrapper
}

const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

/** 面板那一发的入参：项目面板读的是不分页的 /all，租户要跟着选中的那一家走 */
const panelCall = () => vi.mocked(knowledgeCategoryApi.all).mock.calls[0] as any

describe('KnowledgeDocumentView 项目面板的空态成因（资料库项目，M-P75）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('后端回 NONE：逐字念「查过了，一条都没有」，并在下面摆一颗新建项目', async () => {
    const line = '资料库项目：这一档查过了，一条都没有。'
    const wrapper = await mountPanel({ records: [], total: 0, emptyReason: 'NONE', emptyLine: line })

    expect(hintText(wrapper)).toBe(line)
    const createButton = wrapper.find('.create-on-empty')
    expect(createButton.exists()).toBe(true)
    expect(createButton.text()).toBe('新建项目')
    expect(panelCall()[0]).toBe(7)
    // 换之前这一格是界面自己写死的一个 a-empty，现在这一句只从后端来
    expect(wrapper.find('.aempty-stub').exists()).toBe(false)
  })

  it('后端回 NOT_VISIBLE（认不出这一家）：念「不能说没有」那一句，且不摆新建项目', async () => {
    const line = '资料库项目：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    const wrapper = await mountPanel({ records: [], total: 0, emptyReason: 'NOT_VISIBLE', emptyLine: line })

    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
    // 读不到不是「这一发失败了」：后端正常回了话，界面不该弹错误框
    expect(message.error).not.toHaveBeenCalled()
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「一条都没有」', async () => {
    const wrapper = await mountPanel({ records: [], total: 0, emptyReason: null, emptyLine: null })

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('这一发读失败说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountPanel(new Error('项目读口断了'))

    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：项目读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
    expect(message.error).toHaveBeenCalledWith('加载项目失败')
  })

  it('有项目时根本不渲那一句，卡片按后端回的行摆出来', async () => {
    const wrapper = await mountPanel({
      records: [{ id: 7, name: '企业资料' }, { id: 8, name: '产品手册' }],
      total: 2,
      emptyReason: null,
      emptyLine: null
    })

    expect(wrapper.find('.empty-line').exists()).toBe(false)
    const titles = wrapper.findAll('.meta-title').map((node: any) => node.text())
    expect(titles).toEqual(['企业资料', '产品手册'])
    expect(message.error).not.toHaveBeenCalled()
  })
})
