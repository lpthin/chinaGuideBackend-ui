import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { Button, Input, Select, Tag, message } from 'ant-design-vue'
import SiteBriefsView from '../SiteBriefsView.vue'
import { siteBriefsApi, vocabularyApi } from '../../../api/siteBriefs'
import { tenantApi } from '../../../api/workspace'

/**
 * 前采需求单列表（任务 P1）。用例钉四点：
 * 1. 行的每一格只报接口给的东西——状态中文读后端词表的 statusLabels（唯一真相），
 *    词表取不到该码时显示「状态未知（原码 xxx）」把码带出来，绝不前端自己编第二份映射（I-1）；
 *    租户名去租户列表查，演示档位中文只取词表 demoContentModes.label；
 * 2. 词表取不到只影响档位/状态那两格：露码或「状态未知」，不自己编一套中文；
 * 3. 过滤参数与列表接口一一对应（切租户立刻重拉，状态要按回车才带过去）；
 * 4. 空态那句话只承诺今天真存在的一步（录前采），不摆 P3/P4 的死按钮。
 *
 * 真 a-table 在这环境里渲不出表体（内部还要 Spin 与测量那一层），换成按
 * columns × dataSource 逐格走 bodyCell 插槽的壳——格子里的判断仍是视图自己的代码。
 */

const pushSpy = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy })
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/siteBriefs', () => ({
  siteBriefsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), summaryPreview: vi.fn() },
  vocabularyApi: { adminVocabulary: vi.fn(), portalVocabulary: vi.fn() }
}))

vi.mock('../../../api/workspace', () => ({
  tenantApi: { list: vi.fn() }
}))

const TABLE_STUB = defineComponent({
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  setup(props: any, { slots }: any) {
    return () => {
      if (!props.dataSource.length) {
        return h('div', { class: 'table-stub table-stub--empty' }, slots.emptyText ? slots.emptyText() : null)
      }
      return h(
        'div',
        { class: 'table-stub' },
        props.dataSource.flatMap((record: any) =>
          props.columns.map((column: any) => (slots.bodyCell ? slots.bodyCell({ column, record }) : null))
        )
      )
    }
  }
})

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description'],
  template: `<div class="${name}-stub"><slot /><slot name="message" /><slot name="description" /></div>`
})

function brief(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    tenantId: 15,
    siteId: null,
    status: 'draft',
    candidateCount: 2,
    demoContentMode: 'full',
    industry: null,
    subIndustry: null,
    audiences: [],
    primaryGoal: null,
    mustHave: [],
    tone: null,
    languages: [],
    scale: null,
    avoid: [],
    channels: [],
    businessModel: null,
    brandColor: null,
    referenceUrls: [],
    notes: null,
    requirementsSummary: null,
    createdBy: 'admin',
    createdAt: '2026-09-28T10:00:00',
    updatedAt: '2026-09-28T10:00:00',
    ...overrides
  }
}

const VOCAB = {
  questions: [],
  siteProfile: [],
  candidateMaxCount: 3,
  demoContentModes: [
    { value: 'full', label: '整套演示', articleCount: 8, caseCount: 4 },
    { value: 'lite', label: '少量演示', articleCount: 3, caseCount: 1 }
  ],
  statusLabels: { draft: '草稿', ready: '待出方案' }
}

async function mountView(options: { briefs?: any[]; listError?: string; vocabError?: string } = {}) {
  vi.mocked(tenantApi.list).mockResolvedValue([{ id: 15, code: 't-a', name: '甲租户' }] as any)
  if (options.vocabError) {
    vi.mocked(vocabularyApi.adminVocabulary).mockRejectedValueOnce(new Error(options.vocabError))
  } else {
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue(VOCAB as any)
  }
  if (options.listError) {
    vi.mocked(siteBriefsApi.list).mockRejectedValueOnce(new Error(options.listError))
  } else {
    vi.mocked(siteBriefsApi.list).mockResolvedValue(options.briefs ?? [] as any)
  }
  const wrapper = mount(SiteBriefsView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-select': Select,
        'a-input': Input,
        'a-tag': Tag,
        'a-table': TABLE_STUB,
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-empty': PASS_THROUGH('AEmpty')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '') === text
  )
}

function click(node: Element) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('列表行只报接口给的东西', () => {
  it('一进来按无过滤拉一次：状态读词表 statusLabels 的中文，租户名与档位中文各取各的源', async () => {
    const wrapper = await mountView({ briefs: [brief()] })
    expect(siteBriefsApi.list).toHaveBeenCalledWith({ tenantId: null, status: null })
    const text = wrapper.text()
    // 状态中文只来自后端词表 statusLabels：draft→草稿，前端不写第二份映射（I-1）
    expect(text).toContain('草稿')
    expect(text).toContain('甲租户')
    // 档位中文只来自词表 demoContentModes.label
    expect(text).toContain('整套演示')
    expect(text).toContain('2')
    click(byText('录入/编辑')[0])
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-intake', params: { id: '5' } })
    wrapper.unmount()
  })

  it('statusLabels 里没有这个码：显示「状态未知（原码 xxx）」，不猜一个中文', async () => {
    const wrapper = await mountView({ briefs: [brief({ status: 'promoted_x' })] })
    expect(wrapper.text()).toContain('状态未知（原码 promoted_x）')
    wrapper.unmount()
  })

  it('词表取不到只影响档位那一格：露 code，不编中文，也不跟着报错', async () => {
    const wrapper = await mountView({ briefs: [brief()], vocabError: '词表接口 500' })
    const text = wrapper.text()
    expect(text).toContain('full')
    expect(text).not.toContain('整套演示')
    expect(wrapper.find('.site-briefs__error').exists()).toBe(false)
    wrapper.unmount()
  })

  it('租户列表查不到这个 id：报「租户 #n」而不是消失', async () => {
    const wrapper = await mountView({ briefs: [brief({ tenantId: 99 })] })
    expect(wrapper.text()).toContain('租户 #99')
    wrapper.unmount()
  })
})

describe('过滤与错误各说各的', () => {
  it('切租户立刻重拉带租户号；状态打完字要按回车才带过去', async () => {
    const wrapper = await mountView({ briefs: [brief()] })
    wrapper.findAllComponents(Select)[0].vm.$emit('update:value', 15)
    await flushPromises()
    expect(siteBriefsApi.list).toHaveBeenLastCalledWith({ tenantId: 15, status: null })

    const statusInput = wrapper
      .findAllComponents(Input)
      .find(node => node.props('placeholder') === '按状态代码过滤，如 draft / ready')
    statusInput!.vm.$emit('update:value', 'ready')
    await flushPromises()
    expect(siteBriefsApi.list).toHaveBeenLastCalledWith({ tenantId: 15, status: null }) // 还没回车
    statusInput!.vm.$emit('pressEnter')
    await flushPromises()
    expect(siteBriefsApi.list).toHaveBeenLastCalledWith({ tenantId: 15, status: 'ready' })
    wrapper.unmount()
  })

  it('列表读失败：后端那句中文原样挂在提示条上，空态话术不冒充「一单都没有」', async () => {
    const wrapper = await mountView({ listError: '这个账号没有看需求单的资格' })
    expect(wrapper.find('.site-briefs__error').text()).toContain('这个账号没有看需求单的资格')
    expect(wrapper.text()).not.toContain('还没有需求单。下一步') // 失败不等于空
    expect(wrapper.text()).toContain('列表没取到')
    expect(wrapper.text()).not.toContain('draft')
    expect(vi.mocked(message.error).mock.calls.flat().join()).toContain('这个账号没有看需求单的资格')
    wrapper.unmount()
  })
})

describe('空态与新入口', () => {
  it('一单都没有：话只说今天真存在的下一步「录前采」，出方案/预览一个字不提入口', async () => {
    const wrapper = await mountView({ briefs: [] })
    const text = wrapper.text()
    expect(text).toContain('下一步是录一份前采需求单')
    expect(text).toContain('今天这里不摆点了没反应的按钮')
    const labels = [...document.querySelectorAll('button')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    expect(labels.filter(label => /生成|出方案|预估|估算/.test(label))).toEqual([])
    click(byText('现在就去录一份')[0])
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-new' })
    wrapper.unmount()
  })

  it('「新建需求单」与空态按钮去同一个录入页', async () => {
    const wrapper = await mountView({ briefs: [brief()] })
    click(byText('新建需求单')[0])
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-new' })
    wrapper.unmount()
  })
})
