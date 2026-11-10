import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import ModelConfigView from '../ModelConfigView.vue'
import EmbeddingConfigView from '../EmbeddingConfigView.vue'
import { embeddingConfigApi, modelConfigApi, vectorDbApi } from '../../../api/ai-model'
import { useAuthStore } from '../../../stores/auth'
import { ROBOT_PAGE_CARDS } from '../../../copy/robot'
import type { ModelConfig } from '../../../types/ai-model'

/**
 * M-P102（2026-11-01 拍板）：「模型配置」「向量化配置」并成平台自己那一套，取消客户维度。
 *
 * 改前现场取证（scratch/mp102-logs/11-ui-before.txt U2）：这两屏的取数都带 `tenantId`，
 * 而请求里的数来自 `selectedTenantId || tenantId || 1`——超管切进别家客户，这两屏立刻变空，
 * 真在用的那 5 台模型一个字看不到；最后那个 `|| 1` 还会把「没选客户」变成「偷偷去看 1 号家」。
 *
 * 四条不许回退的规矩：
 * 1. 这一族发出去的请求里不许再出现 tenantId——后端那一支查询只认平台那一家。
 * 2. 但这一族必须照发：不许照抄 M-P101 那把「没选客户就一口都不发」的尺。
 *    这一族是平台数据，超管打开就该看见模型池，右上角切客户对它没有任何作用。
 * 3. 屏上要把「这一套归谁」讲到显示那一头：一句说明 + 那两张统计卡写明是全部客户合计。
 * 4. 「可用模型」那一格数的是接口真回得来的 modelName，不是一个没人回的 modelId。
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
  embeddingConfigApi: {
    get: vi.fn(),
    update: vi.fn(),
    stats: vi.fn(),
  },
  vectorDbApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setDefault: vi.fn(),
    toggleStatus: vi.fn(),
    test: vi.fn(),
    testNew: vi.fn(),
  },
  aiGenerateApi: {
    chunkPreview: vi.fn(),
  },
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'extra', 'size', 'spinning', 'open', 'required'],
  template: `<div class="${name}-stub"><span class="${name}-label">{{ label }}</span>`
    + `<span class="${name}-extra">{{ extra }}</span>`
    + '<span>{{ title }}{{ message }}{{ description }}{{ required }}</span><slot name="title" /><slot /></div>',
})

const TABLE_STUB = {
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  template: `<div class="table-stub"><div v-for="(record, rowIndex) in dataSource" :key="rowIndex" class="row"></div></div>`,
}

const STUBS = {
  'a-alert': PASS_THROUGH('AAlert'),
  'a-card': PASS_THROUGH('ACard'),
  'a-col': PASS_THROUGH('ACol'),
  'a-collapse-panel': PASS_THROUGH('ACollapsePanel'),
  'a-divider': PASS_THROUGH('ADivider'),
  'a-form': PASS_THROUGH('AForm'),
  'a-form-item': PASS_THROUGH('AFormItem'),
  'a-row': PASS_THROUGH('ARow'),
  'a-slider': PASS_THROUGH('ASlider'),
  'a-space': PASS_THROUGH('ASpace'),
  'a-spin': PASS_THROUGH('ASpin'),
  'a-switch': PASS_THROUGH('ASwitch'),
  'a-table': TABLE_STUB,
  'a-tag': PASS_THROUGH('ATag'),
  'a-badge': PASS_THROUGH('ABadge'),
  'a-button': Button,
}

const qwenPlus = { id: 3, name: '通义千问-文章生成', provider: 'dashscope', modelName: 'qwen-plus', modelType: 'chat', isActive: true }
const qwenPlusDup = { id: 7, name: '通义千问-页面巡检', provider: 'dashscope', modelName: 'qwen-plus', modelType: 'chat', isActive: false }
const qwenImage = { id: 9, name: '百炼-出图', provider: 'dashscope', modelName: 'qwen-image', modelType: 'image', isActive: true }

/** 四行配置、三个不同的模型名（含那台向量化）；老代码数 modelId（接口根本不回）永远报 1 */
const ROWS = [qwenPlus, qwenPlusDup, qwenImage] as unknown as ModelConfig[]

const EMBEDDING_ROW = {
  id: 12,
  name: '百炼-向量化',
  provider: 'dashscope',
  modelName: 'text-embedding-v3',
  modelType: 'embedding',
  isActive: true,
} as unknown as ModelConfig

function setApiSuccess() {
  vi.mocked(modelConfigApi.list).mockResolvedValue({ records: [...ROWS, EMBEDDING_ROW], total: 4 } as any)
  vi.mocked(modelConfigApi.purposeScopeOptions).mockResolvedValue([] as any)
  vi.mocked(embeddingConfigApi.get).mockResolvedValue({ chunkSize: 512, chunkOverlap: 50 } as any)
  vi.mocked(embeddingConfigApi.stats).mockResolvedValue({ processedDocs: 1234, vectorChunks: 5678 } as any)
  vi.mocked(embeddingConfigApi.update).mockResolvedValue({} as any)
  vi.mocked(vectorDbApi.list).mockResolvedValue([] as any)
  vi.mocked(vectorDbApi.create).mockResolvedValue({} as any)
}

function mountOptions() {
  return { attachTo: document.body, global: { stubs: STUBS } }
}

/** 按卡名找那一格，读出它显示的数字 */
function statValueOfCard(title: string): string | undefined {
  const card = [...document.querySelectorAll('.ACard-stub')].find(node => (node.textContent || '').includes(title))
  expect(card, `应有一张卡写着「${title}」`).toBeTruthy()
  return card?.querySelector('.stat-value')?.textContent?.trim()
}

function alertTexts(): string[] {
  return [...document.querySelectorAll('.AAlert-stub')].map(node => (node.textContent || '').replace(/\s+/g, ''))
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  setApiSuccess()
})

describe('模型配置屏 · 平台一套，没有「哪一家客户」', () => {
  it('进页那一发 list 不带 tenantId，且只有这一发', async () => {
    await mount(ModelConfigView, mountOptions())
    await flushPromises()

    expect(modelConfigApi.list).toHaveBeenCalledTimes(1)
    const args = vi.mocked(modelConfigApi.list).mock.calls[0]
    args.forEach(part => expect(JSON.stringify(part)).not.toContain('tenantId'))
  })

  it('规矩 2：切进别家客户（甚至一家都没选）这一屏照样把模型池问出来', async () => {
    // 这一屏已经不读 auth store 了；这里把 store 拨到「在看 777 号客户」，
    // 是为了让下一位改代码的人一眼看懂：切客户对这两屏没有任何作用，请求不许因此少发。
    useAuthStore().selectedTenantId = 777
    const wrapper = await mount(ModelConfigView, mountOptions())
    await flushPromises()
    expect(modelConfigApi.list).toHaveBeenCalledTimes(1)

    document.body.innerHTML = ''
    useAuthStore().selectedTenantId = null
    await mount(ModelConfigView, mountOptions())
    await flushPromises()
    expect(modelConfigApi.list).toHaveBeenCalledTimes(2)
    expect(wrapper.exists()).toBe(true)
  })

  it('屏上写明这一套归谁：那句话要显示出来', async () => {
    await mount(ModelConfigView, mountOptions())
    await flushPromises()

    // 「这一套归谁」已交给页头机器人（copy/robot.ts），屏上不再留常驻色块
    const shown = ROBOT_PAGE_CARDS['ai.models.pool'].text + ROBOT_PAGE_CARDS['ai.models.pool'].detail
    expect(shown).toContain('平台共用一套模型')
    expect(shown).toContain('右上角切客户对这一页没有作用')
    // 用量那一屏才是按家数的，指过去，别让人在这一格里找
    expect(shown).toContain('某一家客户用了多少')
  })

  it('规矩 4：「可用模型」数的是接口真回得来的模型名（四行三台 → 3）', async () => {
    await mount(ModelConfigView, mountOptions())
    await flushPromises()

    expect(statValueOfCard('可用模型')).toBe('3')
    expect(statValueOfCard('配置总数')).toBe('4')
  })
})

describe('向量化配置屏 · 平台一份，两个数字是全部客户合计', () => {
  it('四发出问都不带 tenantId，向量库那一族也不带', async () => {
    await mount(EmbeddingConfigView, mountOptions())
    await flushPromises()

    expect(embeddingConfigApi.get).toHaveBeenCalledTimes(1)
    expect(vectorDbApi.list).toHaveBeenCalledTimes(1)
    expect(modelConfigApi.list).toHaveBeenCalledTimes(1)
    // 无参那三支：调用参数就得是空的
    expect(vi.mocked(embeddingConfigApi.get).mock.calls[0]).toEqual([])
    expect(vi.mocked(embeddingConfigApi.stats).mock.calls[0]).toEqual([])
    expect(vi.mocked(vectorDbApi.list).mock.calls[0]).toEqual([])
    vi.mocked(modelConfigApi.list).mock.calls[0].forEach(part => {
      expect(JSON.stringify(part)).not.toContain('tenantId')
    })
  })

  it('切进别家客户（甚至一家都没选）这一屏照样把那一套问出来', async () => {
    useAuthStore().selectedTenantId = 777
    await mount(EmbeddingConfigView, mountOptions())
    await flushPromises()
    expect(embeddingConfigApi.get).toHaveBeenCalledTimes(1)
    expect(embeddingConfigApi.stats).toHaveBeenCalledTimes(1)
    expect(vectorDbApi.list).toHaveBeenCalledTimes(1)
    expect(modelConfigApi.list).toHaveBeenCalledTimes(1)

    document.body.innerHTML = ''
    useAuthStore().selectedTenantId = null
    await mount(EmbeddingConfigView, mountOptions())
    await flushPromises()
    expect(embeddingConfigApi.get).toHaveBeenCalledTimes(2)
    expect(modelConfigApi.list).toHaveBeenCalledTimes(2)
  })

  it('那两张统计卡写明「全部客户合计」，数字来自后端那一口', async () => {
    await mount(EmbeddingConfigView, mountOptions())
    await flushPromises()

    expect(statValueOfCard('已向量化文档（全部客户合计）')).toBe('1234')
    expect(statValueOfCard('向量分片数（全部客户合计）')).toBe('5678')
    // 「这一套归谁」已交给页头机器人（copy/robot.ts），屏上不再留常驻色块
    const shown = ROBOT_PAGE_CARDS['ai.embedding.pool'].text + ROBOT_PAGE_CARDS['ai.embedding.pool'].detail
    expect(shown).toContain('平台共用一套向量化配置')
    expect(shown).toContain('右上角切客户对这一页没有作用')
  })

  it('按「保存配置」：那一发只有一个参数（配置本体），里面没有 tenantId', async () => {
    const wrapper = await mount(EmbeddingConfigView, mountOptions())
    await flushPromises()

    const save = [...wrapper.findAll('button')].find(node => node.text() === '保存配置')
    expect(save, '屏上应有「保存配置」那一个把手').toBeTruthy()
    save!.trigger('click')
    await flushPromises()

    expect(embeddingConfigApi.update).toHaveBeenCalledTimes(1)
    const call = vi.mocked(embeddingConfigApi.update).mock.calls[0]
    expect(call.length).toBe(1)
    expect(JSON.stringify(call[0])).not.toContain('tenantId')
  })
})
