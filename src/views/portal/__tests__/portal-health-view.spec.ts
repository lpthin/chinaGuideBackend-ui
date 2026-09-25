import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Checkbox, Input, Textarea, message } from 'ant-design-vue'
import PortalHealthView from '../PortalHealthView.vue'
import { portalHealthApi } from '../../../api/portalHealth'
import { portalPagesApi } from '../../../api/portalPages'
import { portalTicketsApi } from '../../../api/portalTickets'
import { siteApi } from '../../../api/workspace'
import { useAuthStore } from '../../../stores/auth'

/**
 * 巡检视图的交互契约（Spec §8.2）。
 *
 * 这一页最要紧的一件事：AI 那个按钮的语义是后端给的，不是前端按类型猜的。
 * #90 那轮的教训就是前端把「哪类能出手」抄了一份，后端改了口径而按钮还亮着。
 * 所以这里的用例都从 /options 的 aiFixMode 出发，并且专门有一条「换掉后端标签，界面跟着变」。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

/**
 * 词表与那两个纯函数用真实现（importActual），只把发请求的 api 换成桩。
 * 上一版在这里手写了一份 `seoSuggestionOf: () => null`，于是「建议正文怎么渲染」
 * 这一整块在测试里根本没跑过——界面测了空气。
 */
vi.mock('../../../api/portalHealth', async () => {
  const actual = await vi.importActual<Record<string, any>>('../../../api/portalHealth')
  return {
    ...actual,
    portalHealthApi: {
      options: vi.fn(),
      findings: vi.fn(),
      finding: vi.fn(),
      scan: vi.fn(),
      dismiss: vi.fn(),
      reopen: vi.fn(),
      estimate: vi.fn(),
      aiFix: vi.fn(),
      applySuggestion: vi.fn(),
      undoApply: vi.fn()
    }
  }
})
vi.mock('../../../api/portalPages', () => ({ portalPagesApi: { list: vi.fn() } }))
vi.mock('../../../api/workspace', () => ({ siteApi: { list: vi.fn() } }))
vi.mock('../../../api/portalTickets', () => ({
  portalTicketsApi: { draft: vi.fn(), apply: vi.fn(), discard: vi.fn() }
}))

const MODAL_STUB = {
  name: 'AModal',
  props: ['open', 'title', 'confirmLoading', 'okText'],
  emits: ['update:open', 'ok'],
  template:
    '<div v-if="open" class="modal-stub" :data-title="title"><slot /><button class="modal-ok" @click="$emit(\'ok\')">确 定</button></div>'
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label'],
  template: `<div class="${name}-stub"><slot /><slot name="message" /></div>`
})

const POPCONFIRM_STUB = {
  name: 'APopconfirm',
  props: ['title', 'disabled'],
  emits: ['confirm'],
  template:
    '<span class="popconfirm-stub"><slot /><button class="popconfirm-ok" :disabled="disabled" @click="$emit(\'confirm\')">确定</button></span>'
}

/**
 * 每列都走视图自己的 bodyCell，行内按钮与标签才是真实代码。
 * expandedRowKeys 也如实传进来：展开行是建议正文和草稿卡唯一的落脚点，
 * 桩件要是不渲染它，「没有权限时为什么看不到」那条用例就只是在测空气。
 */
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    expandedRowKeys: { type: Array, default: () => [] }
  },
  template: `
    <div class="table-stub">
      <div v-for="record in dataSource" :key="record.id" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
        <div v-if="$props.expandedRowKeys.includes(record.id)" class="expanded-row">
          <slot name="expandedRowRender" :record="record" />
        </div>
      </div>
    </div>`
}

const OPTIONS = {
  types: {
    seo_missing: { key: 'seo_missing', label: 'SEO 描述缺失', aiFixMode: 'suggestion', hint: '让 AI 读页面文字给一段描述' },
    content_stale: { key: 'content_stale', label: '内容过期迹象', aiFixMode: 'draft', hint: '出改版草稿' },
    link_dead: { key: 'link_dead', label: '站内死链', aiFixMode: 'none', hint: '只能人工改链接' }
  },
  statuses: { open: '待处理', resolved: '已消失', dismissed: '已忽略' }
}

function finding(id: number, findingType: string, status = 'open') {
  return {
    id,
    tenantId: 15,
    siteId: 1,
    pageId: 43,
    findingType,
    dedupKey: `${findingType}:1:43`,
    message: `第 ${id} 条问题`,
    status,
    firstSeenAt: '2026-09-20T10:00:00',
    lastSeenAt: '2026-09-24T10:00:00',
    resolvedAt: null,
    dismissReason: null,
    draftId: null,
    suggestionJson: null,
    createdAt: null,
    updatedAt: null
  }
}

function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(node => (node.textContent || '').trim() === text)
}

/** 提示语只按「后端回了什么」来断言，所以从这里取每一次调用的第一个参数 */
function linesOf(spy: any): string[] {
  return (spy.mock.calls as any[]).map((call: any[]) => String(call[0]))
}

async function mountView(permissionCodes: string[]) {
  const auth = useAuthStore()
  auth.user = { id: 1, username: 'tester', roles: ['SITE_ADMIN'], permissions: permissionCodes } as any
  const wrapper = mount(PortalHealthView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-input': Input,
        'a-textarea': Textarea,
        'a-checkbox': Checkbox,
        'a-table': TABLE_STUB,
        'a-modal': MODAL_STUB,
        'a-popconfirm': POPCONFIRM_STUB,
        'a-select': { name: 'ASelect', props: ['value', 'options'], template: '<select />' },
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-divider': PASS_THROUGH('ADivider'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-spin': PASS_THROUGH('ASpin')
      }
    }
  })
  await flushPromises()
  return wrapper
}

describe('PortalHealthView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    vi.mocked(portalHealthApi.options).mockResolvedValue(OPTIONS as any)
    vi.mocked(portalHealthApi.findings).mockResolvedValue([
      finding(1, 'seo_missing'),
      finding(2, 'content_stale'),
      finding(3, 'link_dead')
    ] as any)
    vi.mocked(portalPagesApi.list).mockResolvedValue([{ id: 43, title: '联系我们', slug: 'contact' }] as any)
    vi.mocked(siteApi.list).mockResolvedValue([{ id: 1, name: '小山口腔' }] as any)
  })

  it('AI 按钮只按后端给的 aiFixMode 出现，不认类型的第三份副本', async () => {
    const wrapper = await mountView(['portal:build:health'])
    expect(byText('让 AI 出 SEO 建议').length).toBe(1)
    expect(byText('让 AI 出改版草稿').length).toBe(1)
    // link_dead 是 aiFixMode=none：这一行只该有「忽略」，不该出现任何 AI 入口
    expect(byText('让 AI 处理').length).toBe(0)
    expect(byText('忽略').length).toBe(3)
    wrapper.unmount()
  })

  /** 与后端 aiFix 的「一条 finding 只出手一次」对上：入口收了，产出必须还点得开 */
  it('出过产出的那一条不再给第二次 AI 入口，只给已有的产出', async () => {
    vi.mocked(portalHealthApi.findings).mockResolvedValue([
      { ...finding(1, 'seo_missing'), suggestionJson: '{"seoTitle":"上一轮出的"}' },
      { ...finding(2, 'content_stale'), draftId: 880 },
      finding(3, 'link_dead')
    ] as any)
    const wrapper = await mountView(['portal:build:health', 'portal:build:review'])
    expect(byText('让 AI 出 SEO 建议').length).toBe(0)
    expect(byText('让 AI 出改版草稿').length).toBe(0)
    expect(byText('查看建议').length).toBe(1)
    expect(byText('草稿 #880').length).toBe(1)
    expect(byText('忽略').length).toBe(3)
    wrapper.unmount()
  })

  it('中文类型名与状态名用的是接口回传的那一份', async () => {
    vi.mocked(portalHealthApi.options).mockResolvedValue({
      types: { seo_missing: { key: 'seo_missing', label: '后端改过的名字', aiFixMode: 'suggestion', hint: 'x' } },
      statuses: { open: '还没看' }
    } as any)
    const wrapper = await mountView(['portal:build:health'])
    const html = document.body.textContent || ''
    expect(html).toContain('后端改过的名字')
    expect(html).toContain('还没看')
    expect(html).not.toContain('SEO 描述缺失')
    wrapper.unmount()
  })

  it('先估算才谈钱；没勾确认不会发出会扣配额的那一次调用', async () => {
    vi.mocked(portalHealthApi.estimate).mockResolvedValue({
      findingId: 1,
      findingType: 'seo_missing',
      aiFixMode: 'suggestion',
      estimatedTokens: 900,
      remainingTokens: 9000,
      aiFixEnabled: true,
      notice: null
    } as any)
    const wrapper = await mountView(['portal:build:health'])

    byText('让 AI 出 SEO 建议')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalHealthApi.estimate).toHaveBeenCalledWith(1)

    const modal = document.querySelector('.modal-stub') as HTMLElement
    expect(modal.dataset.title).toBe('让 AI 出 SEO 建议')
    vi.mocked(portalHealthApi.aiFix).mockClear()
    modal.querySelector('.modal-ok')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTickish()
    expect(portalHealthApi.aiFix).not.toHaveBeenCalled()

    wrapper.findAllComponents(Checkbox)[0].vm.$emit('update:checked', true)
    await nextTickish()
    modal.querySelector('.modal-ok')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTickish()
    expect(portalHealthApi.aiFix).toHaveBeenCalledWith(1, true)
    wrapper.unmount()
  })

  it('忽略必须写理由，理由 trim 后交给后端', async () => {
    const wrapper = await mountView(['portal:build:health'])
    byText('忽略')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTickish()
    const modal = document.querySelector('.modal-stub') as HTMLElement

    vi.mocked(portalHealthApi.dismiss).mockClear()
    modal.querySelector('.modal-ok')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTickish()
    expect(portalHealthApi.dismiss).not.toHaveBeenCalled()

    wrapper
      .findAllComponents(Textarea)
      .find(node => String(node.props('placeholder') ?? '').includes('为什么不处理'))!
      .vm.$emit('update:value', '  下周整体改版  ')
    await nextTickish()
    modal.querySelector('.modal-ok')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTickish()
    expect(portalHealthApi.dismiss).toHaveBeenCalledWith(1, '下周整体改版')
    wrapper.unmount()
  })

  it('扫描后的提示只用后端返回的计数，且不说「已修复」', async () => {
    vi.mocked(portalHealthApi.scan).mockResolvedValue({
      siteId: 1,
      siteName: '小山口腔',
      pagesScanned: 18,
      opened: 2,
      reconfirmed: 1,
      resolved: 3,
      dismissed: 4,
      scannedAt: '2026-09-24T10:00:00'
    } as any)
    const wrapper = await mountView(['portal:build:health'])

    ;(document.querySelector('.popconfirm-ok') as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    const successLines = linesOf(message.success)
    expect(successLines.some(line => line.includes('扫了 18 个页面') && line.includes('新增 2 条'))).toBe(true)
    expect(successLines.some(line => line.includes('已修复'))).toBe(false)
    wrapper.unmount()
  })

  it('没有 portal:build:review 时不去取草稿正文，只说明为什么看不到', async () => {
    vi.mocked(portalHealthApi.findings).mockResolvedValue([
      { ...finding(4, 'content_stale'), draftId: 880 }
    ] as any)
    const wrapper = await mountView(['portal:build:health'])

    // 展开这一行（视图里的「草稿 #880」那个链接）
    byText('草稿 #880')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalTicketsApi.draft).not.toHaveBeenCalled()
    expect((document.body.textContent || '').indexOf('portal:build:review')).toBeGreaterThan(-1)
    wrapper.unmount()
  })

  // ---------------- 把 SEO 建议写进页面（Q5：零复制粘贴） ----------------

  const SEO_SUGGESTION =
    '{"seoTitle":"小山口腔 · 种植牙与正畸","seoDescription":"一段够长的描述，讲清项目与预约方式。","seoKeywords":"种植牙,正畸"}'
  const APPLIED_SUGGESTION =
    '{"seoTitle":"小山口腔 · 种植牙与正畸","seoDescription":"一段够长的描述，讲清项目与预约方式。","seoKeywords":"种植牙,正畸",' +
    '"applied":{"before":{"seoTitle":"关于我们","seoDescription":"","seoKeywords":""},"at":"2026-09-25T10:00:00","by":"admin"}}'

  /** 展开某一行并返回它的内容区；不展开的话建议那一块在 DOM 里根本不存在 */
  async function expandRow() {
    byText('查看建议')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    return document.querySelector('.expanded-row') as HTMLElement
  }

  it('有建议又管得到页面时，展开就能看到「应用到页面」，点它是后端那一条端点', async () => {
    vi.mocked(portalHealthApi.findings).mockResolvedValue([
      { ...finding(1, 'seo_missing'), suggestionJson: SEO_SUGGESTION }
    ] as any)
    vi.mocked(portalHealthApi.applySuggestion).mockResolvedValue({} as any)
    const wrapper = await mountView(['portal:build:health', 'portal:build:manage'])

    const row = await expandRow()
    // 按钮就在 popconfirm 里，但直接点它不算确认
    byText('应用到页面')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalHealthApi.applySuggestion).not.toHaveBeenCalled()

    ;(row.querySelector('.popconfirm-ok') as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(portalHealthApi.applySuggestion).toHaveBeenCalledWith(1, true)
    // 应用完重新拉一次列表：这一行的 applied 节点是后端写完才挂的，界面不自己拼状态
    expect(portalHealthApi.findings).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('已经应用过的那一条只给「撤销应用」，并把覆盖前的那份说清楚', async () => {
    vi.mocked(portalHealthApi.findings).mockResolvedValue([
      { ...finding(1, 'seo_missing'), suggestionJson: APPLIED_SUGGESTION }
    ] as any)
    vi.mocked(portalHealthApi.undoApply).mockResolvedValue({} as any)
    const wrapper = await mountView(['portal:build:health', 'portal:build:manage'])

    const row = await expandRow()
    const text = row.textContent || ''
    expect(text).toContain('已于')
    expect(text).toContain('admin')
    expect(byText('应用到页面').length).toBe(0)
    expect(byText('撤销应用').length).toBe(1)

    ;(row.querySelector('.popconfirm-ok') as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalHealthApi.undoApply).toHaveBeenCalledWith(1, true)
    wrapper.unmount()
  })

  /** 权限不够时这一页退化回「复制」，但仍然说清缺的是哪个码，而不是让人猜按钮为什么不在 */
  it('没有 portal:build:manage 时不给写入按钮，只给手工贴回的说明', async () => {
    vi.mocked(portalHealthApi.findings).mockResolvedValue([
      { ...finding(1, 'seo_missing'), suggestionJson: SEO_SUGGESTION }
    ] as any)
    const wrapper = await mountView(['portal:build:health'])

    const row = await expandRow()
    expect(byText('应用到页面').length).toBe(0)
    expect(byText('撤销应用').length).toBe(0)
    expect(portalHealthApi.applySuggestion).not.toHaveBeenCalled()
    expect(row.textContent ?? '').toContain('portal:build:manage')
    wrapper.unmount()
  })
})

/** 这个环境里 rAF 不会跑（应用内标签页被隐藏），所以用微任务队列等渲染 */
function nextTickish() {
  return new Promise(resolve => setTimeout(resolve, 0))
}
