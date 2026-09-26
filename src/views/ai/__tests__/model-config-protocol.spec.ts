import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber, Select, notification } from 'ant-design-vue'
import ModelConfigView from '../ModelConfigView.vue'
import { modelConfigApi, usageApi } from '../../../api/ai-model'
import type { ModelConfig } from '../../../types/ai-model'

/**
 * 模型配置页的协议与出图入口（V129 那一支的前端半边）。
 *
 * 三条不许回退的规矩，都出自真实事故：
 * 1. 图像行不给「测试连接」——对话式探测打的是聊天端点，测不到生图，
 *    绿标就是这么来的（库里那行 image 模型曾被它标成通过）；图像行只认「试出一张图」。
 * 2. 「试出一张图」会真花钱，所以必须两段式：点按钮不算数，气泡确认才发。
 * 3. 协议只有后端那三个值加「留空＝自动」，前端不自己判断地址该走哪种协议——
 *    抄一份推断，早晚和后端分叉。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    notification: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), open: vi.fn() },
  }
})

vi.mock('../../../api/ai-model', () => ({
  modelConfigApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setDefault: vi.fn(),
    toggleStatus: vi.fn(),
    test: vi.fn(),
    testNew: vi.fn(),
    imageProbe: vi.fn(),
    checkAllHealth: vi.fn(),
  },
  usageApi: { today: vi.fn() },
}))

/** 真 a-table 在这环境渲不出表体；dataIndex 那几列也得补上，否则连「哪一行」都认不出来 */
const TABLE_STUB = {
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  template: `
    <div class="table-stub">
      <div v-for="(record, rowIndex) in dataSource" :key="rowIndex" class="row">
        <template v-for="column in columns" :key="column.key">
          <span v-if="column.dataIndex" class="cell">{{ record[column.dataIndex] }}</span>
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`,
}

/** 弹层里的确认按钮单独可点：要钉的是「没确认之前一次请求都不发」 */
const POPCONFIRM_STUB = {
  name: 'APopconfirm',
  props: { title: { type: String, default: '' }, disabled: { type: Boolean, default: false } },
  emits: ['confirm'],
  template: '<span class="popconfirm-stub"><span class="popconfirm-title">{{ title }}</span>'
    + '<button class="popconfirm-ok" :disabled="disabled" @click="$emit(\'confirm\')">出 1 张</button><slot /></span>',
}

const MODAL_STUB = {
  name: 'AModal',
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' } },
  emits: ['update:open', 'ok'],
  template: '<div v-if="open" class="modal-stub"><div class="modal-title">{{ title }}</div>'
    + '<slot /><button class="modal-ok" @click="$emit(\'ok\')">保存</button></div>',
}

/** 标签要渲染出来，否则「协议下拉在哪一栏」这种话在测试里就成了凭索引猜 */
const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'spinning', 'open', 'extra'],
  template: `<div class="${name}-stub"><span class="${name}-label">{{ label }}</span>`
    + '<span>{{ title }}{{ message }}{{ description }}{{ extra }}</span><slot name="title" /><slot /></div>',
})

function row(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 4,
    modelId: 0,
    name: '通义千问-文章生成',
    tenantId: 1,
    apiKey: 'sk-****',
    isActive: true,
    isDefault: false,
    priority: 3,
    provider: 'dashscope',
    modelName: 'qwen-plus',
    modelType: 'chat',
    apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiProtocol: '',
    healthStatus: 'passed',
    createdAt: '2026-09-01T10:00:00',
    updatedAt: '2026-09-01T10:00:00',
    ...overrides,
  } as ModelConfig
}

const CHAT_ROW = row()
const ANTHROPIC_ROW = row({
  id: 9,
  name: 'Coding Plan-Anthropic',
  modelName: 'qwen3.7-plus',
  apiEndpoint: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
  apiProtocol: 'anthropic',
})
const IMAGE_ROW = row({
  id: 12,
  name: '百炼生图',
  modelName: 'qwen-image-plus',
  modelType: 'image',
  apiEndpoint: 'https://dashscope.aliyuncs.com/api/v1',
  apiProtocol: 'dashscope',
  healthStatus: 'unknown',
})

async function mountView(records: ModelConfig[] = [CHAT_ROW, ANTHROPIC_ROW, IMAGE_ROW]) {
  vi.mocked(modelConfigApi.list).mockResolvedValue({ records, total: records.length } as any)
  vi.mocked(usageApi.today).mockResolvedValue({} as any)
  const wrapper = mount(ModelConfigView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-select': Select,
        'a-input': Input,
        'a-input-password': (Input as any).Password,
        'a-input-number': InputNumber,
        'a-badge': PASS_THROUGH('ABadge'),
        'a-table': TABLE_STUB,
        'a-popconfirm': POPCONFIRM_STUB,
        'a-modal': MODAL_STUB,
        'a-card': PASS_THROUGH('ACard'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-tooltip': PASS_THROUGH('ATooltip'),
        // 栅格也得放行：setup.ts 把 a-row / a-col 桩成「不渲染插槽」，
        // 整个表单就藏在它们里面，桩错一次等于测了个空弹窗
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-divider': PASS_THROUGH('ADivider'),
        'a-slider': PASS_THROUGH('ASlider'),
      },
    },
  })
  await flushPromises()
  return wrapper
}

function click(node: Element | null | undefined) {
  expect(node, '要点的控件没渲染出来').toBeTruthy()
  node!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function buttonsIn(scope: ParentNode, text: string) {
  return [...scope.querySelectorAll('button')].filter(node => (node.textContent || '').includes(text))
}

/** 表格按数据顺序：第 0 行聊天、第 1 行 Anthropic、第 2 行图像 */
function rows() {
  return [...document.querySelectorAll('.table-stub .row')]
}

function rowByLabel(text: string) {
  const found = rows().find(node => (node.textContent || '').includes(text))
  expect(found, `表格里应有一行含「${text}」`).toBeTruthy()
  return found!
}

function formItem(label: string) {
  const found = [...document.querySelectorAll('.AFormItem-stub')]
    .find(node => (node.querySelector('.AFormItem-label')?.textContent || '') === label)
  expect(found, `表单里应有「${label}」这一栏`).toBeTruthy()
  return found!
}

function selectIn(scope: ParentNode) {
  const wrapper = currentWrapper
  const found = wrapper!.findAllComponents(Select).find((c: any) => scope.contains(c.element as Node))
  expect(found, '这一栏里应有个下拉').toBeTruthy()
  return found!
}

let currentWrapper: any = null

function notificationLines() {
  const calls = [
    ...(vi.mocked(notification.success).mock.calls as unknown as unknown[][]),
    ...(vi.mocked(notification.error).mock.calls as unknown as unknown[][]),
  ]
  return calls.map(call => JSON.stringify(call[0]))
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  currentWrapper = null
})

describe('模型配置页 · 协议与出图入口', () => {
  it('图像行只给「试出一张图」，不再给那个会假绿的「测试」', async () => {
    currentWrapper = await mountView()
    const imageRow = rowByLabel('百炼生图')
    expect(buttonsIn(imageRow, '试出一张图')).toHaveLength(1)
    expect(buttonsIn(imageRow, '测试')).toHaveLength(0)

    const chatRow = rowByLabel('通义千问-文章生成')
    expect(buttonsIn(chatRow, '测试')).toHaveLength(1)
    expect(buttonsIn(chatRow, '试出一张图')).toHaveLength(0)
  })

  it('点按钮不算数：气泡里确认过一次，才向 image-probe 发一个请求', async () => {
    currentWrapper = await mountView()
    vi.mocked(modelConfigApi.imageProbe).mockResolvedValue({
      protocol: 'dashscope', protocolName: 'DashScope 原生',
      endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      model: 'qwen-image-plus', success: true, bytes: 1024, mimeType: 'image/png',
      elapsedMs: 3210, message: '出了一张图：image/png、1024 字节（这张只用来验证配置，没有入库）',
    } as any)

    const imageRow = rowByLabel('百炼生图')
    click(buttonsIn(imageRow, '试出一张图')[0])
    await flushPromises()
    expect(modelConfigApi.imageProbe).not.toHaveBeenCalled()

    click(imageRow.querySelector('.popconfirm-ok'))
    await flushPromises()
    expect(modelConfigApi.imageProbe).toHaveBeenCalledTimes(1)
    expect(vi.mocked(modelConfigApi.imageProbe).mock.calls[0][0]).toBe(12)
    // 花钱的动作要在点之前就写在气泡上，而不是事后解释
    expect((imageRow.querySelector('.popconfirm-title')?.textContent || '')).toContain('费用')
  })

  it('出图失败时把协议名、实际地址和后端原话一并摊开（就是靠这两样才查出错在哪）', async () => {
    currentWrapper = await mountView()
    vi.mocked(modelConfigApi.imageProbe).mockResolvedValue({
      protocol: 'openai', protocolName: 'OpenAI 兼容',
      endpoint: 'https://coding.dashscope.aliyuncs.com/v1/images/generations',
      model: 'qwen-image-plus', success: false, elapsedMs: 880,
      message: 'HTTP 404：这个地址上没有图像生成接口（协议 OpenAI 兼容 · 地址 ...）',
    } as any)

    click(rowByLabel('百炼生图').querySelector('.popconfirm-ok'))
    await flushPromises()

    const dumped = notificationLines().join('\n')
    expect(dumped).toContain('OpenAI 兼容')
    expect(dumped).toContain('https://coding.dashscope.aliyuncs.com/v1/images/generations')
    expect(dumped).toContain('HTTP 404')
    // 假成功比失败更贵：这一条绝不能报「通过」
    expect(vi.mocked(notification.success)).not.toHaveBeenCalled()
  })

  it('开关没开时后端会直接拒，这句话要原样给超管看（不是一句「请求失败」）', async () => {
    currentWrapper = await mountView()
    vi.mocked(modelConfigApi.imageProbe).mockRejectedValue(
      new Error('图片生成开关没开（app.ai.image.enabled=false）：这一次不会出图、也不会花钱'),
    )

    click(rowByLabel('百炼生图').querySelector('.popconfirm-ok'))
    await flushPromises()

    const dumped = notificationLines().join('\n')
    expect(dumped).toContain('app.ai.image.enabled=false')
    expect(dumped).toContain('不会花钱')
  })

  it('协议列：显式填过的显示中文名，留空的显示自动并说明由后端判断', async () => {
    currentWrapper = await mountView()
    expect(rowByLabel('Coding Plan-Anthropic').textContent).toContain('Anthropic 兼容')
    expect(rowByLabel('百炼生图').textContent).toContain('DashScope 原生')

    const chatRow = rowByLabel('通义千问-文章生成')
    expect(chatRow.textContent).toContain('自动')
    expect(chatRow.textContent).toContain('由后端按接口地址判断')
  })

  it('刚失败过的图像行不许继续只挂一个绿标（报警阈值之内的失败也要看得见）', async () => {
    currentWrapper = await mountView([
      row({ id: 12, name: '百炼生图', modelType: 'image', apiProtocol: 'dashscope',
        healthStatus: 'passed', healthConsecutiveFailures: 1,
        lastHealthError: '图像模型返回 HTTP 404：这个地址上没有图像生成接口' }),
    ])
    const text = rows()[0].textContent || ''
    expect(text).toContain('次真实出图都没成功')
    expect(text).toContain('HTTP 404')
  })

  it('表单里那一栏只有后端那三个值加自动，前端不另起说法', async () => {
    currentWrapper = await mountView()
    click(buttonsIn(rowByLabel('Coding Plan-Anthropic'), '编辑')[0])
    await flushPromises()

    const options = selectIn(formItem('接口协议')).props('options') as Array<{ value: string; label: string }>
    expect(options.map(option => `${option.value || '（留空）'}=${option.label}`)).toEqual([
      '（留空）=自动（按接口地址推断）',
      'openai=OpenAI 兼容',
      'anthropic=Anthropic 兼容',
      'dashscope=DashScope 原生',
    ])
  })

  it('编辑时带回原值，换回「自动」要提交空串（否则那栏永远清不掉）', async () => {
    currentWrapper = await mountView()
    vi.mocked(modelConfigApi.update).mockResolvedValue(ANTHROPIC_ROW as any)

    click(buttonsIn(rowByLabel('Coding Plan-Anthropic'), '编辑')[0])
    await flushPromises()
    const protocol = selectIn(formItem('接口协议'))
    expect(protocol.props('value')).toBe('anthropic')

    protocol.vm.$emit('update:value', '')
    await flushPromises()
    click(document.querySelector('.modal-ok'))
    await flushPromises()

    expect(modelConfigApi.update).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(modelConfigApi.update).mock.calls[0][1] as Record<string, any>
    expect(payload.apiProtocol).toBe('')
  })

  it('新增时这一栏也带上，默认自动；换成 OpenAI 兼容就提交 openai', async () => {
    currentWrapper = await mountView([])
    vi.mocked(modelConfigApi.create).mockResolvedValue({ id: 21 } as any)

    click(buttonsIn(document, '添加配置')[0])
    await flushPromises()

    const protocol = selectIn(formItem('接口协议'))
    expect(protocol.props('value')).toBe('')
    protocol.vm.$emit('update:value', 'openai')

    for (const [label, value] of [
      ['配置名称', '新聊天配置'],
      ['模型名称', 'qwen-plus'],
      ['API Base URL', 'https://x.test/v1'],
      ['API Key', 'sk-test'],
    ] as const) {
      const input = formItem(label).querySelector('input')
      expect(input, `表单里应有「${label}」输入框`).toBeTruthy()
      await currentWrapper!.vm.$nextTick()
      input!.value = value
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    }
    selectIn(formItem('模型提供商')).vm.$emit('update:value', 'dashscope')
    await flushPromises()

    click(document.querySelector('.modal-ok'))
    await flushPromises()

    expect(modelConfigApi.create).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(modelConfigApi.create).mock.calls[0][1] as Record<string, any>
    expect(payload.apiProtocol).toBe('openai')
    expect(payload.apiKey).toBe('sk-test')
  })
})
