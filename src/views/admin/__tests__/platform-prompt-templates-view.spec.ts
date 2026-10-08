import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import PromptTemplatesView from '../PromptTemplatesView.vue'
import { platformPromptApi, type PlatformPromptDetail, type PlatformPromptSummary } from '../../../api/platformPrompts'

/**
 * 平台默认提示词页（Spec-M D2 / P1）钉的六件事：
 *
 * 1. 进页面只发列表那一条 GET：正文与覆盖行都等人点了那一份才读；
 * 2. 没有 prompt:template:manage 时一条请求都不发，也不许演成「读失败」或「一份都没有」；
 * 3. 库里缺那一行时，缺的原因用后端原话挂出来，且不摆编辑器（免得把「没迁移」演成「空正文」）；
 * 4. 变量清单只用后端回的那一份：回两个就摆两个，前端不抄建站那一族的清单；
 * 5. 保存前必问一次（这一发影响所有租户），一个字都没改时那颗按钮是灭的；
 * 6. 四道闸的后端原话整条挂出来，正文留在眼前不丢。
 *
 * 挂真实控件：真 Button（读 DOM 的 disabled）、真 textarea（读 DOM 的 value 与 disabled）。
 */

vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

const authState = vi.hoisted(() => ({
  permissions: ['prompt:template:manage'] as string[],
  superAdmin: true
}))
vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    hasPermission: (code: string) => authState.permissions.includes(code),
    isSuperAdmin: authState.superAdmin
  })
}))

vi.mock('../../../api/platformPrompts', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/platformPrompts')>()
  return { ...actual, platformPromptApi: { list: vi.fn(), detail: vi.fn(), save: vi.fn(), overrides: vi.fn() } }
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

const PURPOSES = ['site_spec_draft_v1', 'site_brief_section_advice_v1', 'site_brief_plan_v1',
  'site_brief_copy_v1', 'site_brief_seo_v1', 'site_brief_copy_fix_v1',
  'site_showcase_v1', 'site_brief_image_v1']

function summary(purpose: string, overrides: Partial<PlatformPromptSummary> = {}): PlatformPromptSummary {
  return {
    id: 11,
    purpose,
    title: `后端给的标题 ${purpose}`,
    stage: '出方案第 4 步',
    name: '逐页文案',
    version: 'v1',
    enabled: true,
    isSystem: true,
    updatedAt: '2026-10-09T02:00:00',
    charCount: 7,
    placeholders: ['requirementsSummary', 'nonsense'],
    unknownPlaceholders: ['nonsense'],
    ...overrides
  }
}

function detail(purpose: string, overrides: Partial<PlatformPromptDetail> = {}): PlatformPromptDetail {
  const summaryRow = overrides.summary ?? summary(purpose)
  return {
    templateText: '这一份的正文',
    variables: { requirementsSummary: '需求单那段中文摘要' },
    note: '每页一次。输出契约由后端念。',
    notices: [],
    ...overrides,
    summary: summaryRow
  }
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'label', 'message', 'type', 'description', 'spinning', 'column', 'size', 'gutter', 'span'],
  template: `<div class="${name}-stub"><slot name="title" /><slot name="label" /><slot name="message" /><slot name="description" /><slot /></div>`
})

const TEXTAREA_STUB = {
  name: 'a-textarea',
  props: ['value', 'rows', 'placeholder', 'disabled'],
  emits: ['update:value'],
  template: '<textarea :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)"></textarea>'
}

/** 表格只摆后端回的那些行；#bodyCell 要真跑，否则「站点行读不到」那一格就永远测不到 */
const TABLE_STUB = {
  name: 'a-table',
  props: ['dataSource', 'columns', 'rowKey', 'size', 'pagination'],
  template: `<div class="a-table-stub">
    <div v-for="(record, index) in (dataSource || [])" :key="index" class="table-row">
      <template v-for="column in (columns || [])" :key="column.key">
        <slot name="bodyCell" :column="column" :record="record">{{ record[column.dataIndex] }}</slot>
      </template>
    </div>
  </div>`
}

const SWITCH_STUB = {
  name: 'a-switch',
  props: ['checked', 'disabled'],
  emits: ['change'],
  template: '<button type="button" class="switch-stub" :disabled="disabled" @click="$emit(\'change\', !checked)"></button>'
}

const INPUT_STUB = {
  name: 'a-input',
  props: ['value', 'disabled', 'size', 'placeholder'],
  emits: ['update:value'],
  template: '<input :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)">'
}

function mounted() {
  return mount(PromptTemplatesView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-card': PASS_THROUGH('a-card'),
        'a-alert': PASS_THROUGH('a-alert'),
        'a-spin': PASS_THROUGH('a-spin'),
        'a-tag': PASS_THROUGH('a-tag'),
        'a-descriptions': PASS_THROUGH('a-descriptions'),
        'a-descriptions-item': PASS_THROUGH('a-descriptions-item'),
        'a-row': PASS_THROUGH('a-row'),
        'a-col': PASS_THROUGH('a-col'),
        'a-button': Button,
        'a-textarea': TEXTAREA_STUB,
        'a-table': TABLE_STUB,
        'a-switch': SWITCH_STUB,
        'a-input': INPUT_STUB
      }
    }
  })
}

function buttons(scope: ParentNode = document.body) {
  return [...scope.querySelectorAll('button')] as HTMLButtonElement[]
}

function buttonThat(text: string) {
  return buttons().find(node => (node.textContent || '').includes(text))
}

async function click(node: HTMLButtonElement | undefined) {
  expect(node, `界面上应有点得到「${'…'}」的那颗`).toBeTruthy()
  node!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

function bodyText() {
  return document.body.textContent || ''
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  authState.permissions = ['prompt:template:manage']
  authState.superAdmin = true
  vi.mocked(platformPromptApi.list).mockResolvedValue(PURPOSES.map(purpose => summary(purpose)))
  vi.mocked(platformPromptApi.detail).mockImplementation(async purpose => detail(purpose))
  vi.mocked(platformPromptApi.overrides).mockResolvedValue([])
  vi.mocked(platformPromptApi.save).mockImplementation(async purpose => detail(purpose))
})

describe('进页面只读列表，正文等人点', () => {
  it('挂载只发那一条 GET，一份正文都不读', async () => {
    mounted()
    await flushPromises()

    expect(platformPromptApi.list).toHaveBeenCalledTimes(1)
    expect(platformPromptApi.detail).not.toHaveBeenCalled()
    expect(platformPromptApi.overrides).not.toHaveBeenCalled()
    expect(platformPromptApi.save).not.toHaveBeenCalled()
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
    expect(bodyText()).toContain('左栏点一份')
  })

  it('八份按后端回的顺序与标题摆出来，界面上一个 purpose 都不自己编', async () => {
    mounted()
    await flushPromises()

    for (const purpose of PURPOSES) {
      expect(bodyText()).toContain(`后端给的标题 ${purpose}`)
    }
    expect(buttons().filter(node => (node.textContent || '').includes('后端给的标题'))).toHaveLength(8)
  })

  it('点了某一份才读它的正文与覆盖行，两处各一次', async () => {
    mounted()
    await flushPromises()

    await click(buttons().find(node => (node.textContent || '').includes(PURPOSES[3])))

    expect(platformPromptApi.detail).toHaveBeenCalledTimes(1)
    expect(platformPromptApi.detail).toHaveBeenCalledWith(PURPOSES[3])
    expect(platformPromptApi.overrides).toHaveBeenCalledWith(PURPOSES[3])
    expect(document.querySelectorAll('textarea')).toHaveLength(1)
  })

  it('没有 prompt:template:manage 时一条请求都不发，也不说成「读失败」或「一份都没有」', async () => {
    authState.permissions = []

    mounted()
    await flushPromises()

    expect(platformPromptApi.list).not.toHaveBeenCalled()
    expect(bodyText()).toContain('没有 prompt:template:manage')
    expect(bodyText()).not.toContain('清单没读到')
    expect(bodyText()).not.toContain('左栏点一份')
  })
})

describe('库里缺这一行：念缺，不演空正文', () => {
  it('列表行标出「库里没有这一行」，点进去摆的是后端原话而不是编辑器', async () => {
    vi.mocked(platformPromptApi.list).mockResolvedValue([
      summary('site_brief_image_v1', { id: null, enabled: false, charCount: 0 })
    ])
    vi.mocked(platformPromptApi.detail).mockRejectedValue(new Error(
      '配图提示词（purpose=site_brief_image_v1）在提示词表里没有全局默认行：这一步现在读的是系统内置的默认措辞，界面上要补这一份得先走迁移'
    ))

    mounted()
    await flushPromises()
    expect(bodyText()).toContain('库里没有这一行')

    await click(buttons().find(node => (node.textContent || '').includes('site_brief_image_v1')))

    expect(bodyText()).toContain('在提示词表里没有全局默认行')
    expect(bodyText()).toContain('先走迁移')
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
    expect(buttonThat('保存这一份')).toBeUndefined()
  })

  it('停用与填不上的位在列表与详情里都点名，两处读的是同一份回包', async () => {
    vi.mocked(platformPromptApi.list).mockResolvedValue([
      summary('site_brief_plan_v1', { enabled: false, unknownPlaceholders: ['brandColorX'] })
    ])
    vi.mocked(platformPromptApi.detail).mockResolvedValue(detail('site_brief_plan_v1', {
      summary: summary('site_brief_plan_v1', { enabled: false, unknownPlaceholders: ['brandColorX'] }),
      notices: ['这一行是停用状态。生成时 render 只读启用的行，所以这一步实际读的不是它']
    }))

    mounted()
    await flushPromises()
    expect(bodyText()).toContain('停用')
    expect(bodyText()).toContain('1 个位填不上')

    await click(buttons().find(node => (node.textContent || '').includes('site_brief_plan_v1')))
    expect(bodyText()).toContain('生成时 render 只读启用的行')
  })
})

describe('变量清单只用后端那一份', () => {
  it('后端回两个位就摆两个，前端不把自己记得那份塞进去', async () => {
    vi.mocked(platformPromptApi.detail).mockResolvedValue(detail('site_brief_copy_v1', {
      variables: { requirementsSummary: '需求单那段中文摘要', candidateNo: '第几套（1~3）' }
    }))

    mounted()
    await flushPromises()
    await click(buttons().find(node => (node.textContent || '').includes('site_brief_copy_v1')))

    const variableRows = [...document.querySelectorAll('.a-table-stub')][0].querySelectorAll('.table-row')
    expect(variableRows).toHaveLength(2)
    expect(bodyText()).toContain('第几套（1~3）')
    expect(variableRows[0].textContent).toContain('{{requirementsSummary}}')
  })

  it('占着的位里，系统不会填那几个标红；说明来自后端那份 unknownPlaceholders', async () => {
    mounted()
    await flushPromises()
    await click(buttons().find(node => (node.textContent || '').includes(PURPOSES[0])))

    expect(bodyText()).toContain('nonsense')
    expect(bodyText()).toContain('requirementsSummary')
  })
})

describe('保存：改的是全局，先问一次', () => {
  it('一个字都没改时那颗按钮是灭的', async () => {
    mounted()
    await flushPromises()
    await click(buttons().find(node => (node.textContent || '').includes(PURPOSES[0])))

    expect(buttonThat('保存这一份')!.disabled).toBe(true)
  })

  it('改正文后先弹「影响所有租户」那一句，点了确定才发 PUT', async () => {
    const wrapper = mounted()
    await flushPromises()
    await click(buttons().find(node => (node.textContent || '').includes(PURPOSES[0])))

    await wrapper.find('textarea').setValue('  改后的正文（首尾空格留着）  ')
    const save = buttonThat('保存这一份')
    expect(save!.disabled).toBe(false)
    await click(save)

    expect(modalConfirm).toHaveBeenCalledTimes(1)
    expect(modalConfirm.mock.calls[0][0].content).toContain('每一个租户')
    expect(platformPromptApi.save).not.toHaveBeenCalled()

    await modalConfirm.mock.calls[0][0].onOk()
    await flushPromises()
    expect(platformPromptApi.save).toHaveBeenCalledWith(PURPOSES[0], {
      name: '逐页文案',
      version: 'v1',
      templateText: '  改后的正文（首尾空格留着）  ',
      enabled: true
    })
    expect(buttonThat('保存这一份')!.disabled).toBe(true)
  })

  it('非超管能读不能写：正文框是灭的，保存按不下去，页面上写着为什么', async () => {
    authState.superAdmin = false

    mounted()
    await flushPromises()
    await click(buttons().find(node => (node.textContent || '').includes(PURPOSES[0])))

    expect((document.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true)
    expect(buttonThat('保存这一份')!.disabled).toBe(true)
    expect(bodyText()).toContain('不是超级管理员')
    expect(platformPromptApi.save).not.toHaveBeenCalled()
  })

  it('四道闸拦下来时后端原话整条挂出来，正文一个字都不丢', async () => {
    vi.mocked(platformPromptApi.save).mockRejectedValue(new Error(
      '定方案里有系统不会填的占位符：brandColorX。发出去模型看到的就是这串字面量。'
    ))
    const wrapper = mounted()
    await flushPromises()
    await click(buttons().find(node => (node.textContent || '').includes(PURPOSES[0])))

    await wrapper.find('textarea').setValue('带一个 {{brandColorX}} 的正文')
    await click(buttonThat('保存这一份'))
    await modalConfirm.mock.calls[0][0].onOk()
    await flushPromises()

    const { message } = await import('ant-design-vue')
    const shown = vi.mocked(message.error).mock.calls.map(call => String(call[0])).join('\n')
    expect(shown).toContain('没存进去')
    expect(shown).toContain('系统不会填的占位符：brandColorX')
    expect(shown).not.toContain('保存失败')
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('带一个 {{brandColorX}} 的正文')
  })
})

describe('各站盖着这一份的行（只读）', () => {
  it('摆站点名与「填不上的位」，并说明这里只给看', async () => {
    vi.mocked(platformPromptApi.overrides).mockResolvedValue([
      {
        id: 30, siteId: 7, siteName: '纳欣广告', name: '文案覆盖', version: 'v2',
        enabled: true, updatedAt: '2026-10-01', charCount: 120, unknownPlaceholders: ['brandColorX']
      },
      {
        id: 31, siteId: 9, siteName: null, name: '覆盖', version: 'v1',
        enabled: true, updatedAt: null, charCount: 40, unknownPlaceholders: []
      }
    ])

    mounted()
    await flushPromises()
    await click(buttons().find(node => (node.textContent || '').includes(PURPOSES[0])))

    const overrideTable = [...document.querySelectorAll('.a-table-stub')][1]
    expect([...overrideTable.querySelectorAll('.table-row')]).toHaveLength(2)
    expect(bodyText()).toContain('纳欣广告')
    expect(bodyText()).toContain('站点 #9（站点行读不到）')
    expect(bodyText()).toContain('这里只给看')
    expect(overrideTable.querySelectorAll('input, textarea')).toHaveLength(0)
  })

  it('一家都没盖时说的是「每一家读的都是全局这一份」', async () => {
    mounted()
    await flushPromises()
    await click(buttons().find(node => (node.textContent || '').includes(PURPOSES[0])))

    expect(bodyText()).toContain('还没有任何站点覆盖这一份')
  })

  it('覆盖行读不到时挂后端原话，不演成「一家都没盖」', async () => {
    vi.mocked(platformPromptApi.overrides).mockRejectedValue(new Error('这一页不管这个 purpose'))

    mounted()
    await flushPromises()
    await click(buttons().find(node => (node.textContent || '').includes(PURPOSES[0])))

    expect(bodyText()).toContain('覆盖行没读到')
    expect(bodyText()).not.toContain('还没有任何站点覆盖这一份')
  })
})
