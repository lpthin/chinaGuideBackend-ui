import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber, Select, message } from 'ant-design-vue'
import ModelConfigView from '../ModelConfigView.vue'
import { modelConfigApi, usageApi } from '../../../api/ai-model'
import type { ModelConfig } from '../../../types/ai-model'

/**
 * 模型配置页的「单价」那一格（P9-A 价目表的前端半边）。
 *
 * 三条不许回退的规矩：
 * 1. 留空（未定价）与 0（真免费）必须是两个样子。把它们并成一个 0，等于在账上写「这笔不要钱」，
 *    而真相是「这一笔没统计过」——同一类错在 cost_estimate 那列上犯过一次（Q-P7-6a）。
 * 2. 清空就是清空：要把 null 发给后端，不能顺手兜成 0（那条 PUT 走 updateById，0 会真的写进 SET，
 *    而 null 清不掉，所以这一格只走 setPrice 那个专用口）。
 * 3. 没改就不发请求；发失败了那一格要还原成库里的值，不许留一个只有界面认得的假单价。
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
    setPrice: vi.fn(),
  },
  usageApi: { today: vi.fn() },
}))

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

/** 没定价：库里这一列就是 NULL */
const UNPRICED = row({ id: 4, name: '通义千问-没定价', modelName: 'qwen-plus' })
/** 定过价 */
const PRICED = row({ id: 7, name: 'DeepSeek-已定价', provider: 'deepseek', modelName: 'deepseek-v4-pro',
  pricePer1kTokens: 0.008 })
/** 真免费（本地跑的模型） */
const FREE = row({ id: 9, name: 'Ollama-本地', provider: 'ollama', modelName: 'qwen2.5:7b',
  pricePer1kTokens: 0 })

let currentWrapper: any = null

async function mountView(records: ModelConfig[] = [UNPRICED, PRICED, FREE]) {
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
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-modal': PASS_THROUGH('AModal'),
        'a-card': PASS_THROUGH('ACard'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-divider': PASS_THROUGH('ADivider'),
        'a-slider': PASS_THROUGH('ASlider'),
        'a-switch': PASS_THROUGH('ASwitch'),
      },
    },
  })
  await flushPromises()
  return wrapper
}

function rows() {
  return [...document.querySelectorAll('.table-stub .row')]
}

function rowByLabel(text: string) {
  const found = rows().find(node => (node.textContent || '').includes(text))
  expect(found, `表格里应有一行含「${text}」`).toBeTruthy()
  return found!
}

/** 真实控件：单价那一格就是表格里那一个 a-input-number，不靠索引猜 */
function priceInputIn(scope: ParentNode) {
  const found = currentWrapper!.findAllComponents(InputNumber)
    .find((c: any) => scope.contains(c.element as Node))
  expect(found, '单价那一栏应有个数字输入框').toBeTruthy()
  return found!
}

/** 改价 → 失焦，就是用户在界面上的那两下 */
async function editPrice(scope: ParentNode, value: number | null) {
  const cell = priceInputIn(scope)
  cell.vm.$emit('update:value', value)
  await flushPromises()
  cell.vm.$emit('blur')
  await flushPromises()
}

function priceCalls() {
  return vi.mocked(modelConfigApi.setPrice).mock.calls as unknown as [number, number | null][]
}

/** 成功提示可能带字符串也可能带 config 对象，统一 stringify 再判，别按第一种形状猜 */
function successLines() {
  return vi.mocked(message.success).mock.calls.map(call => JSON.stringify(call[0]))
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  currentWrapper = null
})

describe('模型配置页 · 单价那一格', () => {
  it('未定价不写 0：空框加「未定价」，说明里点破这两种不是一回事', async () => {
    currentWrapper = await mountView()

    const unpriced = priceInputIn(rowByLabel('通义千问-没定价'))
    expect(unpriced.props('value') ?? null).toBeNull()
    expect((unpriced.element as HTMLElement).querySelector('input')!.value).toBe('')
    expect(unpriced.props('placeholder')).toBe('未定价')
    expect(rowByLabel('通义千问-没定价').textContent).toContain('不是 0')

    // 已定价的那行照数念出来
    expect(priceInputIn(rowByLabel('DeepSeek-已定价')).props('value')).toBe(0.008)
  })

  it('0 是「真免费」不是「没统计」：这一行要念得出来', async () => {
    currentWrapper = await mountView()
    const freeRow = rowByLabel('Ollama-本地')
    expect(priceInputIn(freeRow).props('value')).toBe(0)
    // 关键不是字符串长什么样（antd 会按步补零），而是这一格有数、不是「空白＝未定价」
    const shown = (priceInputIn(freeRow).element as HTMLElement).querySelector('input')!.value
    expect(shown).not.toBe('')
    expect(Number(shown)).toBe(0)
    expect(freeRow.textContent).toContain('真免费')
    // 「未定价」那一整句不许出现在已定价的行上（那一行的说明里提一句「清空＝回到未定价」是另一回事）
    expect(freeRow.textContent).not.toContain('未定价：这一台模型的外呼不算费用')
  })

  it('填一个数并移开焦点：单价就按这个数落库', async () => {
    currentWrapper = await mountView()
    vi.mocked(modelConfigApi.setPrice).mockResolvedValue({ ...PRICED, pricePer1kTokens: 0.0024 } as any)

    await editPrice(rowByLabel('通义千问-没定价'), 0.0024)

    expect(modelConfigApi.setPrice).toHaveBeenCalledTimes(1)
    expect(priceCalls()[0]).toEqual([4, 0.0024])
    // 以接口回的那个数为准，界面不自留一份
    expect(priceInputIn(rowByLabel('通义千问-没定价')).props('value')).toBe(0.0024)
    expect(successLines().join('\n')).toContain('0.0024')
  })

  it('清空就是清成未定价：发的是 null，不是 0', async () => {
    currentWrapper = await mountView()
    vi.mocked(modelConfigApi.setPrice).mockResolvedValue({ ...PRICED, pricePer1kTokens: null } as any)

    await editPrice(rowByLabel('DeepSeek-已定价'), null)

    expect(priceCalls()[0]).toEqual([7, null])
    expect(priceCalls()[0][1]).toBeNull()
    expect(successLines().join('\n')).toContain('未定价')
  })

  it('没改过就不发请求：把焦点移开不等于改了一次价', async () => {
    currentWrapper = await mountView()

    await editPrice(rowByLabel('DeepSeek-已定价'), 0.008)

    expect(modelConfigApi.setPrice).not.toHaveBeenCalled()
  })

  it('存失败了那一格要还原成库里的值，不许留一个只有界面认得的单价', async () => {
    currentWrapper = await mountView()
    vi.mocked(modelConfigApi.setPrice).mockRejectedValue(new Error('只有超级管理员可以设置模型单价'))

    await editPrice(rowByLabel('DeepSeek-已定价'), 9.99)

    expect(priceInputIn(rowByLabel('DeepSeek-已定价')).props('value')).toBe(0.008)
    expect(vi.mocked(message.error)).toHaveBeenCalled()
  })
})
