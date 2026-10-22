import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber } from 'ant-design-vue'
import ModelConfigView from '../ModelConfigView.vue'
import { modelConfigApi, usageApi } from '../../../api/ai-model'
import {
  MODEL_TYPE_OPTIONS,
  describeModelTypes,
  hasModelType,
  isChatCapableType,
  isImageGeneratingType,
  joinModelTypes,
  splitModelTypes,
} from '../../../types/ai-model'
import type { ModelConfig, PurposeScopeOption } from '../../../types/ai-model'

/**
 * 2026-10-22 拍板：「我们的模型类型可以多选，因为千问 3.8 max 支持看图模型」。
 *
 * 改之前那一格是单选，于是一台既能对话又能看图的模型只能标成 `chat`——「找能看图的模型」那条路
 * 查不到这一行，素材图片分析当场报「分析失败」：界面上那一格填错的代价是运行时一条能力整个消失。
 * 现在库里 `model_type` 存的是逗号分隔的多个能力词（`chat,vision`），前端这几处都要跟着改口径：
 * 1. 弹窗那一格是多选框，提交时把数组收成逗号串、回填时拆回数组（同一份勾选只能存成一个串）；
 * 2. 列表那一格筛选从「全等于」改成「拆词后包含」，否则勾了两个能力的行再也筛不出来；
 * 3. 念类型名的地方要能念多值（`聊天 + 视觉`），词表与中文名前端只 types/ai-model 那一份；
 * 4. 「试出一张图」按拆词判（含 image 那一族词才算），vision 不再连坐掉同一行的生图能力。
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

const SCOPES: PurposeScopeOption[] = [
  { code: 'reference_block_mapping', label: '参考站区块映射（对面版面映射到我们的区块白名单）' },
]

/** 千问 3.8 max 这一类：既能对话又能看图，两个词都勾上 */
const MULTIMODAL_ROW = {
  id: 4,
  name: '通义千问-多模态',
  tenantId: 1,
  provider: 'dashscope',
  modelName: 'qwen3.8-max',
  modelType: 'chat,vision',
  apiKey: '******',
  apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  isActive: true,
  sortOrder: 1,
  createdAt: '2026-10-01T10:00:00',
  updatedAt: '2026-10-01T10:00:00',
} as unknown as ModelConfig

/** 只看图、不能对话的那一行（旧数据里 vision 单写） */
const VISION_ONLY_ROW = {
  ...MULTIMODAL_ROW,
  id: 7,
  name: '通义千问-看图',
  modelType: 'vision',
} as unknown as ModelConfig

/** 一台既能看图又能生图的：两个判定都算数（以前「含 vision 就否」会把生图那一侧压掉） */
const BOTH_IMAGE_ROW = {
  ...MULTIMODAL_ROW,
  id: 8,
  name: '统一-看图又生图',
  modelType: 'vision,image',
} as unknown as ModelConfig

/** 单选时代留下的脏值：不在词表里，读的时候要原样带回来，不悄悄改写 */
const LEGACY_ROW = {
  ...MULTIMODAL_ROW,
  id: 12,
  name: '老的那一行',
  modelType: 'qwen',
} as unknown as ModelConfig

const TABLE_STUB = {
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  template: `
    <div class="table-stub">
      <div v-for="(record, rowIndex) in dataSource" :key="rowIndex" class="row">
        <slot v-if="$slots.bodyCell" name="bodyCell" :column="{ key: 'purposeScope' }" :record="record" />
        <slot v-if="$slots.bodyCell" name="bodyCell" :column="{ key: 'actions' }" :record="record" />
        <span class="row-name">{{ record.name }}</span>
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

/** 与限定用途那一轮同形的桩：`data-value` 就是当前绑定值，数组进 DOM 会念成逗号串 */
const SELECT_STUB = {
  name: 'ASelectStub',
  props: ['value', 'options', 'mode', 'disabled', 'placeholder'],
  emits: ['update:value'],
  template: `<div class="select-stub" :data-mode="mode" :data-value="value === '' ? '(空串)' : value"
    :data-placeholder="placeholder">
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

async function mountView(records: ModelConfig[]) {
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

function selectByPlaceholder(wrapper: ReturnType<typeof mount>, placeholder: string) {
  const found = wrapper.findAllComponents(SELECT_STUB).find(node => node.props('placeholder') === placeholder)
  expect(found, `应找得到占位是「${placeholder}」的下拉`).toBeTruthy()
  return found!
}

/** 弹窗里「模型类型」那一格：多选框，绑的是数组 */
function typeSelectNode(wrapper: ReturnType<typeof mount>) {
  return selectByPlaceholder(wrapper, '至少勾一个能力词')
}

function typeSelectValue(wrapper: ReturnType<typeof mount>) {
  return typeSelectNode(wrapper).element.getAttribute('data-value')
}

function rowByLabel(text: string) {
  const found = [...document.querySelectorAll('.table-stub .row')]
    .find(node => (node.textContent || '').includes(text))
  expect(found, `表格里应有一行含「${text}」`).toBeTruthy()
  return found!
}

function rowButtons(rowLabel: string) {
  return [...rowByLabel(rowLabel).querySelectorAll('button')].map(node => node.textContent?.trim())
}

async function clickRowButton(rowLabel: string, buttonLabel: string) {
  const button = [...rowByLabel(rowLabel).querySelectorAll('button')]
    .find(node => node.textContent?.trim() === buttonLabel)
  expect(button, `行「${rowLabel}」上应有「${buttonLabel}」按钮`).toBeTruthy()
  button!.click()
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(modelConfigApi.purposeScopeOptions).mockResolvedValue(SCOPES)
  vi.mocked(modelConfigApi.create).mockResolvedValue({} as any)
  vi.mocked(modelConfigApi.update).mockResolvedValue({} as any)
  document.body.innerHTML = ''
})

describe('模型配置页 · 「模型类型」改成多选（2026-10-22 拍板）', () => {
  it('词表只有一份：弹窗那一格读的就是 types/ai-model 里那一个 map', async () => {
    const wrapper = await mountView([MULTIMODAL_ROW])

    // 以前这里模板手写五个 a-select-option、脚本里再抄一份 getModelTypeName 的 map，
    // 加一个词要改两处；现在整份选项是同一个引用，界面念的与后端认的对不上时当场就红
    expect(typeSelectNode(wrapper).props('options')).toEqual(MODEL_TYPE_OPTIONS)
    expect(typeSelectNode(wrapper).props('mode')).toBe('multiple')
  })

  it('多选框回填拆得开、提交收得拢：勾了 chat 与 vision 的那一行保存出去还是同一个串', async () => {
    const wrapper = await mountView([MULTIMODAL_ROW])
    await clickRowButton('通义千问-多模态', '编辑')

    expect(typeSelectValue(wrapper)).toBe('chat,vision')

    await document.querySelector<HTMLButtonElement>('.modal-ok')!.click()
    await flushPromises()

    const payload = vi.mocked(modelConfigApi.update).mock.calls[0][1] as Record<string, any>
    expect(payload.modelType).toBe('chat,vision')
  })

  it('同一份勾选只存成一个串：库里那行是倒着写的，保存回去也照词表顺序', async () => {
    const reversed = { ...MULTIMODAL_ROW, modelType: 'vision,chat' } as unknown as ModelConfig
    const wrapper = await mountView([reversed])
    await clickRowButton('通义千问-多模态', '编辑')

    expect(typeSelectValue(wrapper)).toBe('vision,chat')
    await document.querySelector<HTMLButtonElement>('.modal-ok')!.click()
    await flushPromises()

    const payload = vi.mocked(modelConfigApi.update).mock.calls[0][1] as Record<string, any>
    expect(payload.modelType).toBe('chat,vision')
  })

  it('多选框里再勾一个词：发出去的是两个词的串，不是一个数组', async () => {
    const wrapper = await mountView([VISION_ONLY_ROW])
    await clickRowButton('通义千问-看图', '编辑')
    expect(typeSelectValue(wrapper)).toBe('vision')

    typeSelectNode(wrapper).vm.$emit('update:value', ['vision', 'chat'])
    await flushPromises()
    await document.querySelector<HTMLButtonElement>('.modal-ok')!.click()
    await flushPromises()

    const payload = vi.mocked(modelConfigApi.update).mock.calls[0][1] as Record<string, any>
    expect(typeof payload.modelType).toBe('string')
    expect(payload.modelType).toBe('chat,vision')
  })

  it('一个词都不勾也照样发得出去：空串是「未标类型」，后端的闸允许它', async () => {
    const wrapper = await mountView([VISION_ONLY_ROW])
    await clickRowButton('通义千问-看图', '编辑')

    typeSelectNode(wrapper).vm.$emit('update:value', [])
    await flushPromises()
    await document.querySelector<HTMLButtonElement>('.modal-ok')!.click()
    await flushPromises()

    const payload = vi.mocked(modelConfigApi.update).mock.calls[0][1] as Record<string, any>
    expect(Object.keys(payload)).toContain('modelType')
    expect(payload.modelType).toBe('')
  })

  it('筛选从「全等于」改成「包含」：勾了两个能力的行按任一个都筛得出来', async () => {
    const wrapper = await mountView([MULTIMODAL_ROW, VISION_ONLY_ROW])
    const filter = selectByPlaceholder(wrapper, '按模型类型筛选')

    filter.vm.$emit('update:value', 'vision')
    await flushPromises()
    expect(document.querySelectorAll('.table-stub .row')).toHaveLength(2)

    filter.vm.$emit('update:value', 'chat')
    await flushPromises()
    expect(document.querySelectorAll('.table-stub .row')).toHaveLength(1)
    expect(document.querySelector('.table-stub .row')?.textContent).toContain('通义千问-多模态')

    filter.vm.$emit('update:value', null)
    await flushPromises()
    expect(document.querySelectorAll('.table-stub .row')).toHaveLength(2)
  })

  it('念类型要念得出多值：两个词念「聊天 + 视觉」，一个词念全名', async () => {
    const wrapper = await mountView([BOTH_IMAGE_ROW, LEGACY_ROW])

    // 生图那一路不看 purpose_scope，那一格的 tooltip 会把勾了的词整份念出来
    await flushPromises()
    const scopeItem = rowByLabel('统一-看图又生图').querySelector('.purpose-scope-tag')
    expect(scopeItem?.textContent).toBe('不适用')
    expect(rowByLabel('统一-看图又生图').textContent).toContain('这一行是「视觉 + 图像」')

    // 脏值念原值，不显示成空白：看着像没填的那一格没人会去改
    expect(rowByLabel('老的那一行').textContent).toContain('这一行是「qwen」')
    await clickRowButton('老的那一行', '编辑')
    expect(typeSelectValue(wrapper)).toBe('qwen')
  })

  it('「试出一张图」按拆词判：同时勾了看图与生图的那一行两件事都算数', async () => {
    await mountView([BOTH_IMAGE_ROW, VISION_ONLY_ROW, MULTIMODAL_ROW])

    // 以前 isImageGenerating 里那条「整串含 vision 就否」会把这一行的生图能力连坐掉
    expect(rowButtons('统一-看图又生图')).toContain('试出一张图')
    // 只勾看图的、只勾对话的都没有那颗要花钱的按钮
    expect(rowButtons('通义千问-看图')).toContain('测试')
    expect(rowButtons('通义千问-多模态')).toContain('测试')
  })

  it('新建那一发从「聊天模型」一个词出发，不带着上一次编辑的勾选', async () => {
    const wrapper = await mountView([MULTIMODAL_ROW])
    await clickRowButton('通义千问-多模态', '编辑')
    expect(typeSelectValue(wrapper)).toBe('chat,vision')

    const addButton = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === '添加配置')
    expect(addButton, '筛选栏上应有「添加配置」按钮').toBeTruthy()
    addButton!.click()
    await flushPromises()

    expect(typeSelectValue(wrapper)).toBe('chat')
    expect(document.querySelector('.modal-title')?.textContent?.trim()).toBe('添加模型配置')
    await wrapper.unmount()
  })
})

describe('types/ai-model · 「模型类型」那一份词表与判定', () => {
  it('拆词把空白与小写收掉，重复的词只留一个', () => {
    expect(splitModelTypes(' Chat , vision ,chat')).toEqual(['chat', 'vision'])
    expect(splitModelTypes('')).toEqual([])
    expect(splitModelTypes(null)).toEqual([])
    expect(splitModelTypes(undefined)).toEqual([])
  })

  it('收成串时按词表顺序，词表外的脏词排在后面原样带回去', () => {
    expect(joinModelTypes(['vision', 'chat'])).toBe('chat,vision')
    expect(joinModelTypes(['gpt', 'embedding'])).toBe('embedding,gpt')
    expect(joinModelTypes([])).toBe('')
    expect(joinModelTypes(null)).toBe('')
  })

  it('多值念「聊天 + 视觉」，单值念全名，空值说清是未标类型', () => {
    expect(describeModelTypes('chat,vision')).toBe('聊天 + 视觉')
    expect(describeModelTypes('vision')).toBe('视觉模型')
    expect(describeModelTypes('chat,image,audio')).toBe('聊天 + 图像 + 语音')
    expect(describeModelTypes('gpt')).toBe('gpt')
    expect(describeModelTypes('')).toBe('未标类型')
  })

  it('包含式筛选：勾了两个词的行按任一个都算命中', () => {
    expect(hasModelType('chat,vision', 'vision')).toBe(true)
    expect(hasModelType('chat,vision', 'chat')).toBe(true)
    expect(hasModelType('vision', 'chat')).toBe(false)
    expect(hasModelType(null, 'chat')).toBe(false)
  })

  it('判据与后端 AiModelTypes 同口径：带 embedding 的词不算能力，vision 与 image 互不顶替也互不否决', () => {
    expect(isImageGeneratingType('vision,image')).toBe(true)
    expect(isImageGeneratingType('image')).toBe(true)
    expect(isImageGeneratingType('text-to-image')).toBe(true)
    expect(isImageGeneratingType('image-embedding')).toBe(false)
    expect(isImageGeneratingType('chat,vision')).toBe(false)

    expect(isChatCapableType('chat,vision')).toBe(true)
    expect(isChatCapableType('text')).toBe(true)
    // text-embedding-v3 既含 text 又是向量模型，按整串 contains 判会冒充成聊天模型
    expect(isChatCapableType('text-embedding-v3')).toBe(false)
    expect(isChatCapableType('chat,text-to-image')).toBe(true)
    expect(isChatCapableType('vision')).toBe(false)
  })

  it('词表与后端那一处对得上：五个能力词，一个不多一个不少', () => {
    expect(MODEL_TYPE_OPTIONS.map(option => option.value)).toEqual(['chat', 'vision', 'embedding', 'image', 'audio'])
    expect(MODEL_TYPE_OPTIONS.every(option => option.label.endsWith('模型'))).toBe(true)
  })
})
