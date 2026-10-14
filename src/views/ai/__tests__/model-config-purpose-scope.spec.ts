import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber } from 'ant-design-vue'
import ModelConfigView from '../ModelConfigView.vue'
import { modelConfigApi, usageApi } from '../../../api/ai-model'
import type { ModelConfig, PurposeScopeOption } from '../../../types/ai-model'

/**
 * M-P23 拍板①（V182 的 `ai_model_config.purpose_scope`）在前端那一头。
 *
 * 这一列存在的理由在现场（Spec-M §10.32~§10.33）：同一行配置、同一把 key、同一份提示词，
 * 只把 `model_name` 换掉，参考站区块映射那一腿就从 4/4 成变成 0/4 成。改之前「给一个用途换一台」
 * 只能去动全局默认那一行的名字，连带把文章生成、SEO、GEO 全换掉。这一列把「只换一个用途」
 * 变成写得出来的事实，而界面要是不摆它，它就是一根没人能扳的杠杆。
 *
 * 五条规矩：
 * 1. 能填哪些用途由后端 `purpose-scope-options` 给，前端不抄词表——抄一份就会在加第三个用途时
 *    变成「界面摆着一个选了没用的选项」（M-P21-A 那轮假杠杆普查点名的形状）；
 * 2. 专用行只对那一支外呼优先，别的用途选不到它——表格那一格当场把规则念全；
 * 3. 只有聊天/文本那一路按这一列挑行（后端 `DynamicAiClient.pickChatModel`），非聊天行不许假装有；
 * 4. 留空与「没带这一键」是两件事：保存永远带 `purposeScope`，空串才是清回通用行；
 * 5. 清单没读到就禁用那一格并说清为什么，不摆一个只有「通用」的假下拉。
 */

const MAPPING = 'reference_block_mapping'
const INDUCTION = 'reference_structure_induction'

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
    toggleStatus: vi.fn(),
    test: vi.fn(),
    testNew: vi.fn(),
    imageProbe: vi.fn(),
    checkAllHealth: vi.fn(),
    setPrice: vi.fn(),
    purposeScopeOptions: vi.fn(),
  },
  usageApi: { today: vi.fn() },
}))

const OPTIONS: PurposeScopeOption[] = [
  { code: MAPPING, label: '参考站区块映射（对面版面映射到我们的区块白名单）' },
  { code: INDUCTION, label: '参考站结构归纳（把抓到的页面摘要归纳成版面结构）' },
]

const GENERAL_CHAT = {
  id: 4,
  name: '通义千问-文章生成',
  tenantId: 1,
  provider: 'dashscope',
  modelName: 'qwen3.8-max',
  modelType: 'chat',
  apiKey: '******',
  apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiProtocol: 'openai',
  isActive: true,
  sortOrder: 1,
  healthStatus: 'passed',
  createdAt: '2026-10-01T10:00:00',
  updatedAt: '2026-10-01T10:00:00',
} as unknown as ModelConfig

const DEDICATED_CHAT = {
  ...GENERAL_CHAT,
  id: 11,
  name: '通义千问-映射专用',
  modelName: 'qwen3.7-plus',
  sortOrder: 5,
  purposeScope: MAPPING,
} as unknown as ModelConfig

const IMAGE_ROW = {
  ...GENERAL_CHAT,
  id: 9,
  name: '百炼-出图',
  modelType: 'image',
  modelName: 'qwen-image',
} as unknown as ModelConfig

const TABLE_STUB = {
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  template: `
    <div class="table-stub">
      <div class="table-head">
        <span v-for="column in columns" :key="column.key" class="col-title">{{ column.title }}</span>
      </div>
      <div v-for="(record, rowIndex) in dataSource" :key="rowIndex" class="row">
        <template v-for="column in columns" :key="column.key">
          <span v-if="column.dataIndex" class="cell">{{ record[column.dataIndex] }}</span>
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`,
}

const MODAL_STUB = {
  name: 'AModal',
  props: ['title', 'open', 'width', 'confirmLoading'],
  emits: ['ok', 'update:open'],
  template: `<div class="modal-stub">
    <div class="modal-title">{{ title }}</div>
    <slot />
    <button class="modal-ok" @click="$emit('ok')">确 定</button>
  </div>`,
}

/**
 * select 用真值挂上去的桩：`data-value` 就是 v-model 当前那个值，选项原样摆出来。
 * 不用 antd 真 Select 是因为它的选项只在展开时才进 DOM，改值要的是那个「当前绑定」，
 * 而这里要钉的正是绑定与发出去的 payload——按钮照按，值照改。
 */
const SELECT_STUB = {
  name: 'ASelectStub',
  props: ['value', 'options', 'disabled', 'placeholder'],
  emits: ['update:value'],
  template: `<div class="select-stub" :data-value="value === '' ? '(空串)' : value" :data-disabled="disabled ? '1' : '0'">
    <span v-for="option in options" :key="option.value" class="option" :data-value="option.value">{{ option.label }}</span>
  </div>`,
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'extra', 'size', 'spinning', 'open', 'required'],
  template: `<div class="${name}-stub"><span class="${name}-label">{{ label }}</span>`
    + `<span class="${name}-extra">{{ extra }}</span>`
    + '<span>{{ title }}{{ message }}{{ description }}{{ required }}</span><slot name="title" /><slot /></div>',
})

async function mountView(records: ModelConfig[] = [GENERAL_CHAT, DEDICATED_CHAT, IMAGE_ROW]) {
  vi.mocked(modelConfigApi.list).mockResolvedValue({ records, total: records.length } as any)
  vi.mocked(usageApi.today).mockResolvedValue({} as any)
  const wrapper = mount(ModelConfigView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-select': SELECT_STUB,
        'a-input': Input,
        'a-input-password': (Input as any).Password,
        'a-input-number': InputNumber,
        'a-badge': PASS_THROUGH('ABadge'),
        'a-table': TABLE_STUB,
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-modal': MODAL_STUB,
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

function rowByLabel(text: string) {
  const found = [...document.querySelectorAll('.table-stub .row')]
    .find(node => (node.textContent || '').includes(text))
  expect(found, `表格里应有一行含「${text}」`).toBeTruthy()
  return found!
}

/** 表单项按 label 找，不按顺序猜 */
function formItem(label: string) {
  return [...document.querySelectorAll('.AFormItem-stub')]
    .find(node => node.querySelector('.AFormItem-label')?.textContent?.trim() === label)
}

function scopeSelect() {
  const item = formItem('限定用途')
  expect(item, '弹窗表单里应有「限定用途」这一项').toBeTruthy()
  const select = item!.querySelector('.select-stub')
  expect(select, '「限定用途」那一项里应有一个下拉').toBeTruthy()
  return select!
}

function scopeOptionValues() {
  return [...scopeSelect().querySelectorAll('.option')].map(node => node.getAttribute('data-value'))
}

/** 那一格里那块牌子本身念什么（tooltip 的整句在牌子外面，不算这一格的字） */
function scopeTagOf(rowLabel: string) {
  return rowByLabel(rowLabel).querySelector('.purpose-scope-tag')?.textContent?.trim()
}

async function clickRowButton(rowLabel: string, buttonLabel: string) {
  const button = [...rowByLabel(rowLabel).querySelectorAll('button')]
    .find(node => node.textContent?.trim() === buttonLabel)
  expect(button, `行「${rowLabel}」上应有「${buttonLabel}」按钮`).toBeTruthy()
  button!.click()
  await flushPromises()
}

/** 那个装着的清单里有区块映射的下拉就是「限定用途」那一格（其余下拉装的是提供商/类型/协议/优先级） */
function pickSelectComponent(wrapper: ReturnType<typeof mount>) {
  const nodes = wrapper.findAllComponents(SELECT_STUB)
  const scoped = nodes.find(node => (node.props('options') as any[])?.some(option => option.value === MAPPING))
  expect(scoped, '应找得到那个装着的清单里有区块映射的下拉').toBeTruthy()
  return scoped!
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(modelConfigApi.purposeScopeOptions).mockResolvedValue(OPTIONS)
  vi.mocked(modelConfigApi.create).mockResolvedValue({} as any)
  vi.mocked(modelConfigApi.update).mockResolvedValue({} as any)
  document.body.innerHTML = ''
})

describe('模型配置页 · 「限定用途」这一列（V182 / 拍板①）', () => {
  it('表格里有「限定用途」那一列：通用行、专用行、非聊天行三个样子各不相同', async () => {
    await mountView()

    const titles = [...document.querySelectorAll('.col-title')].map(node => node.textContent?.trim())
    expect(titles).toContain('限定用途')

    // 通用行：库里没带这一列（历史行）也念「通用」
    expect(scopeTagOf('通义千问-文章生成')).toBe('通用')
    expect(rowByLabel('通义千问-文章生成').textContent).toContain('所有用途都选得到')

    // 专用行：短名进那一格，整句（带解释）在 tooltip 里，不在格子里堆一堵墙
    expect(scopeTagOf('通义千问-映射专用')).toBe('参考站区块映射')
    const dedicatedRow = rowByLabel('通义千问-映射专用')
    expect(dedicatedRow.textContent).toContain('这一支外呼会优先用它')
    expect(dedicatedRow.textContent).toContain('其它用途选不到这一行')

    // 非聊天行：这一列对它不被任何选路读到，不许假装有
    expect(scopeTagOf('百炼-出图')).toBe('不适用')
    expect(rowByLabel('百炼-出图').textContent).toContain('按用途挑行读不到它')
  })

  it('下拉那份清单是从后端那一支口读的，前端没有自己抄词表', async () => {
    const wrapper = await mountView()

    expect(modelConfigApi.purposeScopeOptions).toHaveBeenCalledTimes(1)
    const values = scopeOptionValues()
    expect(values).toEqual(['', MAPPING, INDUCTION])
    expect([...scopeSelect().querySelectorAll('.option')].map(node => node.textContent?.trim()))
      .toEqual([
        '通用（所有用途都选得到这一行）',
        '参考站区块映射（对面版面映射到我们的区块白名单）',
        '参考站结构归纳（把抓到的页面摘要归纳成版面结构）',
      ])
    expect(pickSelectComponent(wrapper).props('disabled')).toBe(false)
  })

  it('编辑专用行把库里那个限定带回来；留空发的是空串，不是不带这一键', async () => {
    const wrapper = await mountView()
    await clickRowButton('通义千问-映射专用', '编辑')

    expect(scopeSelect().getAttribute('data-value')).toBe(MAPPING)

    pickSelectComponent(wrapper).vm.$emit('update:value', '')
    await flushPromises()
    await document.querySelector<HTMLButtonElement>('.modal-ok')!.click()
    await flushPromises()

    const payload = vi.mocked(modelConfigApi.update).mock.calls[0][1] as Record<string, any>
    expect(Object.keys(payload)).toContain('purposeScope')
    expect(payload.purposeScope).toBe('')
  })

  it('给通用行单开一个用途：保存发出去的就是那个用途的码', async () => {
    const wrapper = await mountView()
    await clickRowButton('通义千问-文章生成', '编辑')

    expect(scopeSelect().getAttribute('data-value')).toBe('(空串)')
    pickSelectComponent(wrapper).vm.$emit('update:value', INDUCTION)
    await flushPromises()
    await document.querySelector<HTMLButtonElement>('.modal-ok')!.click()
    await flushPromises()

    const payload = vi.mocked(modelConfigApi.update).mock.calls[0][1] as Record<string, any>
    expect(payload.purposeScope).toBe(INDUCTION)
  })

  it('点「添加配置」不带着上一次编辑的那一行：新建那一发的限定是空的', async () => {
    const wrapper = await mountView()
    await clickRowButton('通义千问-映射专用', '编辑')
    expect(scopeSelect().getAttribute('data-value')).toBe(MAPPING)

    const addButton = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === '添加配置')
    expect(addButton, '筛选栏上应有「添加配置」按钮').toBeTruthy()
    addButton!.click()
    await flushPromises()

    expect(document.querySelector('.modal-title')?.textContent?.trim()).toBe('添加模型配置')
    expect(scopeSelect().getAttribute('data-value')).toBe('(空串)')
    expect(formItem('配置名称')?.textContent).not.toContain('通义千问-映射专用')
    await wrapper.unmount()
  })

  it('库里那一行带着一个后端已不认识的用途时原样念出来，不在保存时顺手抹掉', async () => {
    const legacy = { ...GENERAL_CHAT, id: 12, name: '老的那一行', purposeScope: 'seo_meta_write' } as unknown as ModelConfig
    const wrapper = await mountView([legacy])

    expect(rowByLabel('老的那一行').textContent).toContain('限定给「seo_meta_write」')

    await clickRowButton('老的那一行', '编辑')
    expect(scopeSelect().getAttribute('data-value')).toBe('seo_meta_write')
    // 下拉里必须真有这一项，而且念的是人话：少了它，展开后这一格看着像「没选」，
    // 界面上就分不清「库里记着一个后端已不认识的用途」和「这是一个通用行」。
    expect(scopeOptionValues()).toContain('seo_meta_write')
    expect(scopeSelect().querySelector('.option[data-value="seo_meta_write"]')?.textContent)
      .toContain('不在当前支持的用途清单里')
    await document.querySelector<HTMLButtonElement>('.modal-ok')!.click()
    await flushPromises()

    const payload = vi.mocked(modelConfigApi.update).mock.calls[0][1] as Record<string, any>
    expect(payload.purposeScope).toBe('seo_meta_write')
    await wrapper.unmount()
  })

  it('清单没从后端读到：那一格禁用并说清为什么，不摆一个只有「通用」的假下拉', async () => {
    vi.mocked(modelConfigApi.purposeScopeOptions).mockRejectedValue(new Error('网关不通'))
    await mountView()

    expect(scopeSelect().getAttribute('data-disabled')).toBe('1')
    expect(scopeOptionValues()).toEqual([''])
    expect(formItem('限定用途')?.querySelector('.AFormItem-extra')?.textContent)
      .toContain('没从后端读到')
  })

  it('优先级那一格的规则念全：专用行先于通用行，通用行之间才比优先级', async () => {
    await mountView()

    expect(rowByLabel('通义千问-文章生成').textContent).toContain('先于通用行被选中')
    expect(rowByLabel('通义千问-文章生成').textContent).toContain('优先级最高')
  })
})
