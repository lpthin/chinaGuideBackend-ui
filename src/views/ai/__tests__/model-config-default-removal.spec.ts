import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber, Select } from 'ant-design-vue'
import ModelConfigView from '../ModelConfigView.vue'
import { modelConfigApi, usageApi } from '../../../api/ai-model'
import type { ModelConfig } from '../../../types/ai-model'

/**
 * M-P19 缺陷一（拍板 b）：这一页不再摆「默认」。
 *
 * 为什么整块摘掉而不是留着加提示：现场实测（M-P18-9）选路只读 `is_active` + `sort_order`，
 * `is_default` 在运行时没有任何读点——「设为默认」按下去改的是一个没人看的列。
 * 摆着它，等于让管理员以为自己能换掉外呼走哪台模型；那一格的读数从此不再是他能选的东西。
 *
 * 三条不许回退的规矩：
 * 1. 表格与弹窗都不许再出现「默认」这个入口（列、徽章、按钮、开关全算）。
 * 2. 真正的杠杆（已启用 + 优先级）要在这一格当场讲清，不然摘掉按钮只是让人猜。
 * 3. 界面不再拥有的键就不许再发回写口：保存的 payload 里不能出现 isDefault，
 *    也不许顺路打一次 set-default——那会把一个没人读的列写成「看起来被管理过」。
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
    // 这一支留着当探针：视图若还去打它，not.toHaveBeenCalled 那条才抓得住
    setDefault: vi.fn(),
    toggleStatus: vi.fn(),
    test: vi.fn(),
    testNew: vi.fn(),
    imageProbe: vi.fn(),
    checkAllHealth: vi.fn(),
    setPrice: vi.fn(),
    // 「限定用途」那一份清单由后端给（V182）；这里给一条真的，页面才按生产那副样子渲染
    purposeScopeOptions: vi.fn().mockResolvedValue([{ code: 'reference_block_mapping', label: '参考站区块映射' }]),
  },
  usageApi: { today: vi.fn() },
}))

/**
 * 取探针不走 `modelConfigApi.setDefault`：视图侧那一支口已经删了，类型上根本不存在，
 * 硬写会撞 vue-tsc。名字从 mock 的模块对象上按字符串取——真值仍是上面 factory 里那一个，
 * 视图若还偷偷打它，这只 spy 一样会响。
 */
const setDefaultSpy = (modelConfigApi as unknown as Record<string, unknown>)['setDefault'] as
  ReturnType<typeof vi.fn>

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

/** 弹窗要能真的按下「确定」，不然 payload 那条只是在读一个没人按的函数 */
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

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'extra', 'size', 'spinning', 'open', 'required'],
  template: `<div class="${name}-stub"><span class="${name}-label">{{ label }}</span>`
    + `<span class="${name}-extra">{{ extra }}</span>`
    + '<span>{{ title }}{{ message }}{{ description }}{{ required }}</span><slot name="title" /><slot /></div>',
})

const CHAT_ROW = {
  id: 4,
  modelId: 0,
  name: '通义千问-文章生成',
  tenantId: 1,
  apiKey: 'sk-****',
  isActive: true,
  isDefault: false,
  priority: 2,
  provider: 'dashscope',
  modelName: 'qwen-plus',
  modelType: 'chat',
  apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiProtocol: '',
  healthStatus: 'passed',
  createdAt: '2026-10-01T10:00:00',
  updatedAt: '2026-10-01T10:00:00',
} as unknown as ModelConfig

const IMAGE_ROW = {
  ...CHAT_ROW,
  id: 9,
  name: '百炼-出图',
  modelType: 'image',
  modelName: 'qwen-image',
  isDefault: true,
} as unknown as ModelConfig

async function mountView(records: ModelConfig[] = [CHAT_ROW, IMAGE_ROW]) {
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

function columnTitles() {
  return [...document.querySelectorAll('.col-title')].map(node => node.textContent?.trim())
}

function rowByLabel(text: string) {
  const found = [...document.querySelectorAll('.table-stub .row')]
    .find(node => (node.textContent || '').includes(text))
  expect(found, `表格里应有一行含「${text}」`).toBeTruthy()
  return found!
}

/** 表单里的项：按 label 找，不按顺序猜 */
function formItem(label: string) {
  return [...document.querySelectorAll('.AFormItem-stub')]
    .find(node => node.querySelector('.AFormItem-label')?.textContent?.trim() === label)
}

function formLabels() {
  return [...document.querySelectorAll('.AFormItem-label')].map(node => node.textContent?.trim())
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('模型配置页 · 「默认」那一格已摘掉', () => {
  it('表格里没有「默认配置」这一列，也没有「设为默认」按钮', async () => {
    await mountView()

    expect(columnTitles()).not.toContain('默认配置')
    expect(columnTitles()).toContain('优先级')
    // 一行都不许出现：含 isDefault=true 的那一行（图像行）也一样
    expect(document.body.innerHTML).not.toContain('设为默认')
    expect(rowByLabel('百炼-出图').textContent).not.toContain('默认')
  })

  it('弹窗表单里也没有「设为默认」那个开关', async () => {
    await mountView()

    expect(formLabels()).not.toContain('设为默认')
    expect(formLabels()).toContain('优先级')
  })

  it('真杠杆就在这一格讲清：优先级那格说明「取的是已启用里优先级最高的那一行」', async () => {
    await mountView()

    const chatRow = rowByLabel('通义千问-文章生成')
    expect(chatRow.textContent).toContain('P2')
    expect(chatRow.textContent).toContain('已启用')
    expect(chatRow.textContent).toContain('优先级最高')

    // 表单里就地讲一遍：改这一格的人在弹窗里也要看得见规则，不该去猜
    expect(formItem('优先级')?.querySelector('.AFormItem-extra')?.textContent).toContain('已启用')
  })

  it('编辑保存：payload 不带 isDefault，也不顺路打一次 set-default', async () => {
    const wrapper = await mountView()
    vi.mocked(modelConfigApi.update).mockResolvedValue({ ...CHAT_ROW, sortOrder: 1 } as any)

    const editButton = [...rowByLabel('通义千问-文章生成').querySelectorAll('button')]
      .find(node => node.textContent?.trim() === '编辑')
    expect(editButton, '行上应有「编辑」按钮').toBeTruthy()
    editButton!.click()
    await flushPromises()

    expect(formItem('优先级'), '点编辑后弹窗表单应带出这一行的优先级').toBeTruthy()
    await document.querySelector<HTMLButtonElement>('.modal-ok')!.click()
    await flushPromises()

    expect(modelConfigApi.update).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(modelConfigApi.update).mock.calls[0][1] as Record<string, any>
    expect(Object.keys(payload)).not.toContain('isDefault')
    expect(payload.sortOrder).toBe(2)
    expect(setDefaultSpy).not.toHaveBeenCalled()
    expect(wrapper.find('.modal-ok').exists()).toBe(true)
  })
})
