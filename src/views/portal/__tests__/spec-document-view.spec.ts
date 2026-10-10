import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import SpecDocumentView from '../SpecDocumentView.vue'
import { siteSpecApi, type SpecDocumentView as SpecDoc } from '../../../api/siteSpec'

/**
 * 建站说明书页（Spec-M P0）钉的六件事，全是这一族真出过问题的地方：
 *
 * 1. 进页面只发那一条 GET：出初稿（真花钱 + 整份覆盖）与确认（让它成为生成输入）
 *    都只在人明确点按钮时才发得出去；
 * 2. 「还没有说明书」与「说明书是空的」是两句话，不许混成一张空列表；
 * 3. 确认按不动时，理由永远摆在页面上（blockers），不让人猜；
 * 4. 超限只报数不裁剪：字数显示的是真字数，红的是确认闸那一句；
 * 5. 保存提交的是输入框里的原话（含首尾空格），前端一个字节都不加工；
 * 6. 七段有内容时出初稿必须先问一次覆盖，不许静默盖掉超管改过的字。
 *
 * 挂真实控件：真 Button（读 DOM 的 disabled 属性）、真 textarea（读 DOM 的 value），
 * 不用全局 stub 演交互。
 */

vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

const routeState = vi.hoisted(() => ({ params: { brief: '12' } as Record<string, string> }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeState.params, query: {} })
}))

const authState = vi.hoisted(() => ({ permissions: ['site_spec:edit', 'site_spec:confirm'] as string[] }))
vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ hasPermission: (code: string) => authState.permissions.includes(code) })
}))

vi.mock('../../../api/siteSpec', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/siteSpec')>()
  return {
    ...actual,
    siteSpecApi: {
      read: vi.fn(),
      saveSection: vi.fn(),
      draft: vi.fn(),
      confirm: vi.fn(),
      versions: vi.fn(),
      diff: vi.fn()
    }
  }
})

const modalConfirm = vi.hoisted(() => vi.fn())
vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    Modal: { confirm: modalConfirm }
  }
})

const KEYS = ['overview', 'strategy', 'pages', 'scope', 'outOfScope', 'data', 'requirements']
const LABELS = ['1 项目概述', '2 战略分析', '3 页面结构', '4 本期实现', '5 本期不实现', '6 数据集成', '7 特殊要求']

function doc(overrides: Partial<SpecDoc> = {}): SpecDoc {
  const contents = overrides.sections
    ? overrides.sections
    : KEYS.map((key, index) => ({
        key,
        title: LABELS[index],
        order: index + 1,
        content: `第 ${index + 1} 段的正文`,
        charCount: `第 ${index + 1} 段的正文`.length,
        blank: false,
        overLimit: false
      }))
  return {
    specId: 900,
    briefId: 12,
    tenantId: 15,
    exists: true,
    status: 'DRAFT',
    statusLabel: '草稿（人编辑中，未确认）',
    specVersion: 0,
    confirmedBy: null,
    confirmedAt: null,
    aiDraftProvider: null,
    aiDraftModel: null,
    aiDraftAt: null,
    maxSectionChars: 6000,
    sections: contents as any,
    notices: [],
    blockers: [],
    ...overrides,
    // sections 必须在 overrides 之后仍然生效
    ...(overrides.sections ? { sections: overrides.sections } : {})
  } as SpecDoc
}

/** message 槽也要真渲染：拒绝理由、读失败原话、权限不足这三条都写在 a-alert 的 #message 里 */
const PASS_THROUGH = (name: string, extraProps: string[] = []) => ({
  name,
  props: ['title', 'label', 'message', 'type', 'description', 'spinning', 'column', 'size', ...extraProps],
  template: `<div class="${name}-stub"><slot name="title" /><slot name="label" /><slot name="message" /><slot name="description" /><slot /></div>`
})

/** v-model 要真的能双向：这里用原生 textarea 顶掉 a-textarea，好让测试读得到真 value */
const TEXTAREA_STUB = {
  name: 'a-textarea',
  props: ['value', 'rows', 'placeholder'],
  emits: ['update:value'],
  template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)"></textarea>'
}

function mounted() {
  return mount(SpecDocumentView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-card': PASS_THROUGH('a-card'),
        'a-alert': PASS_THROUGH('a-alert'),
        'a-spin': PASS_THROUGH('a-spin'),
        'a-tag': PASS_THROUGH('a-tag'),
        'a-descriptions': PASS_THROUGH('a-descriptions'),
        'a-descriptions-item': PASS_THROUGH('a-descriptions-item'),
        'a-tooltip': PASS_THROUGH('a-tooltip'),
        'a-button': Button,
        'a-drawer': PASS_THROUGH('a-drawer'),
        'a-textarea': TEXTAREA_STUB
      }
    }
  })
}

function buttons(scope: ParentNode) {
  return [...scope.querySelectorAll('button')] as HTMLButtonElement[]
}

function buttonThat(text: string) {
  return buttons(document.body).find(node => (node.textContent || '').includes(text))
}

async function click(node: HTMLButtonElement | undefined) {
  expect(node, `界面上应有「${'…'}」那颗按钮`).toBeTruthy()
  node!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

function bodyText() {
  return document.body.textContent || ''
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  routeState.params = { brief: '12' }
  authState.permissions = ['site_spec:edit', 'site_spec:confirm']
  vi.mocked(siteSpecApi.read).mockResolvedValue(doc())
  vi.mocked(siteSpecApi.saveSection).mockImplementation(async (_id, key, content) => {
    const section = KEYS.indexOf(key)
    return doc({
      sections: KEYS.map((one, index) => ({
        key: one,
        title: LABELS[index],
        order: index + 1,
        content: index === section ? content : `第 ${index + 1} 段的正文`,
        charCount: content.length,
        blank: !content.trim(),
        overLimit: content.length > 6000
      })) as any
    })
  })
  vi.mocked(siteSpecApi.draft).mockResolvedValue(doc())
  vi.mocked(siteSpecApi.confirm).mockResolvedValue(doc({ status: 'CONFIRMED', specVersion: 1 }))
})

describe('进页面只读，写口都由人点', () => {
  it('挂载只发那一条 GET，出初稿与确认一次都不发', async () => {
    mounted()
    await flushPromises()

    expect(siteSpecApi.read).toHaveBeenCalledTimes(1)
    expect(siteSpecApi.read).toHaveBeenCalledWith(12)
    expect(siteSpecApi.draft).not.toHaveBeenCalled()
    expect(siteSpecApi.confirm).not.toHaveBeenCalled()
    expect(siteSpecApi.saveSection).not.toHaveBeenCalled()
  })

  it('七段按后端给的顺序与标题摆出来，界面上一个段名都不自己编', async () => {
    mounted()
    await flushPromises()

    for (const label of LABELS) {
      expect(bodyText()).toContain(label)
    }
    // 段数就是后端回的那七段，不多不少
    expect(document.querySelectorAll('textarea')).toHaveLength(7)
  })

  it('exists=false 时说的是「还没有说明书」，不是一张空的已存在文档', async () => {
    vi.mocked(siteSpecApi.read).mockResolvedValue(doc({
      exists: false,
      specId: null,
      status: null,
      statusLabel: '还没有说明书',
      sections: KEYS.map((key, index) => ({
        key, title: LABELS[index], order: index + 1, content: null, charCount: 0, blank: true, overLimit: false
      })) as any
    }))

    mounted()
    await flushPromises()

    expect(bodyText()).toContain('还没有说明书')
    expect(bodyText()).toContain('可以先点「AI 出初稿」')
  })

  it('读失败时不演任何结论，只把后端原话挂出来', async () => {
    vi.mocked(siteSpecApi.read).mockRejectedValue(new Error('需求单不存在：没有可写说明书的对象'))

    mounted()
    await flushPromises()

    expect(bodyText()).toContain('说明书没读到')
    expect(bodyText()).toContain('需求单不存在')
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('没有 site_spec:edit 时一条请求都不发，也不说成「读失败」或「说明书是空的」', async () => {
    authState.permissions = []

    mounted()
    await flushPromises()

    expect(siteSpecApi.read).not.toHaveBeenCalled()
    expect(bodyText()).toContain('没有 site_spec:edit')
    expect(bodyText()).not.toContain('说明书没读到')
    expect(bodyText()).not.toContain('还没有说明书')
    // 版本对比那颗钮也不摆：它读的是同一族口，缺写码的人连读都不给读
    expect(buttonThat('版本对比')).toBeUndefined()
    expect(siteSpecApi.versions).not.toHaveBeenCalled()
  })

  it('进页面不读版本目录：那是人点「版本对比」才要的那一屏', async () => {
    mounted()
    await flushPromises()

    expect(siteSpecApi.versions).not.toHaveBeenCalled()

    await click(buttonThat('版本对比'))

    expect(siteSpecApi.versions).toHaveBeenCalledTimes(1)
    expect(siteSpecApi.versions).toHaveBeenCalledWith(12)
  })
})

describe('确认闸：拦下的理由必须看得见', () => {
  it('blockers 非空时「确认这一版」是灭的，页面上写着为什么', async () => {
    vi.mocked(siteSpecApi.read).mockResolvedValue(doc({
      blockers: ['还有 2 段是空的：4 本期实现、7 特殊要求']
    }))

    mounted()
    await flushPromises()

    const confirm = buttonThat('确认这一版')
    expect(confirm).toBeTruthy()
    expect(confirm!.disabled).toBe(true)
    expect(bodyText()).toContain('还有 2 段是空的')
    expect(bodyText()).toContain('现在还不能确认')
  })

  it('齐了才点得动：点了先问一次，确认后才发那一条 POST', async () => {
    mounted()
    await flushPromises()

    const confirm = buttonThat('确认这一版')
    expect(confirm!.disabled).toBe(false)
    await click(confirm)
    expect(modalConfirm).toHaveBeenCalledTimes(1)
    expect(siteSpecApi.confirm).not.toHaveBeenCalled()

    await modalConfirm.mock.calls[0][0].onOk()
    await flushPromises()
    expect(siteSpecApi.confirm).toHaveBeenCalledWith(12)
  })
})

describe('逐段保存：提交的是输入框里的原话', () => {
  it('改一段后「保存本段」才可点，PUT 带的是未 trim 的首尾空格', async () => {
    const wrapper = mounted()
    await flushPromises()

    const box = wrapper.findAll('textarea')[2]
    expect(buttonThat('保存本段')!.disabled).toBe(true)

    await box.setValue('  第 3 段：页面清单\n  ')
    await box.trigger('blur')
    const saveButtons = buttons(document.body).filter(node => (node.textContent || '').includes('保存本段'))
    expect(saveButtons[2].disabled).toBe(false)
    saveButtons[2].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(siteSpecApi.saveSection).toHaveBeenCalledWith(12, 'pages', '  第 3 段：页面清单\n  ')
    expect(document.body.innerHTML).not.toContain('未保存')
  })

  it('保存被拒时输入框里的字一个字都不丢', async () => {
    vi.mocked(siteSpecApi.saveSection).mockRejectedValue(new Error('站点不存在'))
    const wrapper = mounted()
    await flushPromises()

    await wrapper.findAll('textarea')[0].setValue('刚写的第 1 段')
    await wrapper.findAll('textarea')[0].trigger('blur')
    const first = buttons(document.body).filter(node => (node.textContent || '').includes('保存本段'))[0]
    first.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect((wrapper.findAll('textarea')[0].element as HTMLTextAreaElement).value).toBe('刚写的第 1 段')
    const { message } = await import('ant-design-vue')
    const shown = vi.mocked(message.error).mock.calls.map(call => String(call[0])).join('\n')
    expect(shown).toContain('没存进去')
    expect(shown).toContain('站点不存在')
  })

  it('超限只报真字数并红着点名，不裁剪：字符数就是输入框里的长度', async () => {
    const long = '字'.repeat(6011)
    vi.mocked(siteSpecApi.read).mockResolvedValue(doc({
      sections: KEYS.map((key, index) => ({
        key,
        title: LABELS[index],
        order: index + 1,
        content: index === 2 ? long : `第 ${index + 1} 段的正文`,
        charCount: index === 2 ? long.length : 8,
        blank: false,
        overLimit: index === 2
      })) as any,
      blockers: ['第 3 段「页面结构」6011 字，超上限 6000 字（系统不会替你截断，请改短）']
    }))

    mounted()
    await flushPromises()

    expect(bodyText()).toContain('6011 / 6000 字')
    expect(bodyText()).toContain('超上限')
    expect(bodyText()).toContain('系统不替你截断')
    expect((document.querySelectorAll('textarea')[2] as HTMLTextAreaElement).value).toBe(long)
  })
})

describe('AI 出初稿：会覆盖人写的字，所以必须先问', () => {
  it('七段有内容时先弹覆盖确认，点确定才带 overwrite=true 发出去', async () => {
    mounted()
    await flushPromises()

    await click(buttonThat('AI 出初稿'))
    expect(modalConfirm).toHaveBeenCalledTimes(1)
    expect(modalConfirm.mock.calls[0][0].content).toContain('整份替换')
    expect(siteSpecApi.draft).not.toHaveBeenCalled()

    await modalConfirm.mock.calls[0][0].onOk()
    await flushPromises()
    expect(siteSpecApi.draft).toHaveBeenCalledWith(12, true)
  })

  it('空说明书不需要问，直接出初稿（overwrite=false）', async () => {
    vi.mocked(siteSpecApi.read).mockResolvedValue(doc({
      sections: KEYS.map((key, index) => ({
        key, title: LABELS[index], order: index + 1, content: null, charCount: 0, blank: true, overLimit: false
      })) as any
    }))

    mounted()
    await flushPromises()

    await click(buttonThat('AI 出初稿'))
    expect(modalConfirm).not.toHaveBeenCalled()
    expect(siteSpecApi.draft).toHaveBeenCalledWith(12, false)
  })

  it('后端把这一发拦在门口时（开关/余额/门禁），中文原话整条挂出来，界面不改成「生成失败」', async () => {
    vi.mocked(siteSpecApi.draft).mockRejectedValue(
      new Error('出初稿没有开启（app.site-spec.draft.enabled=false），本次没有调用任何模型')
    )

    mounted()
    await flushPromises()
    await click(buttonThat('AI 出初稿'))
    if (modalConfirm.mock.calls.length) {
      // 有内容那一趟是先问再发：这里只走确认后那一条路径
      await modalConfirm.mock.calls[0][0].onOk()
      await flushPromises()
    }

    const { message } = await import('ant-design-vue')
    const shown = vi.mocked(message.error).mock.calls.map(call => String(call[0])).join('\n')
    expect(shown).toContain('app.site-spec.draft.enabled=false')
    expect(shown).toContain('初稿没有生成')
    expect(shown).not.toContain('生成失败')
  })
})
