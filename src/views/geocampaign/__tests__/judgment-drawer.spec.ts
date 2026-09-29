import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import GeoJudgmentDrawer from '../GeoJudgmentDrawer.vue'
import { geoCampaignApi } from '../../../api/geoCampaign'
import type { GeoAnswerTrace, GeoJudgment, GeoVocabulary } from '../../../api/geoCampaign'

/**
 * 判定明细与溯源抽屉（Spec-F §11.4 第四条在这一屏的落点）。
 *
 * 这里钉的三件事都是「报告上那个数能不能信」的最后一道：
 * 1. **每一条语义判定都点得开到原文**——判不成的那些也一样列出来，并把后端那句 `notMeasuredReason`
 *    原样念出来；把它们从列表里挑掉，就等于把判据缺口说成一次成功观测；
 * 2. **档位与情感的中文只来自接口**（`prominenceLabel` / `sentimentLabel`，缺了才退到 `/vocabulary`），
 *    TS 里没有第二份词表；「第几项」那一列念的是 `positionLabel`，§5 禁的那个词不许出现在这一屏；
 * 3. **原文不用 v-html**——它是第三方模型产出的内容，界面只能把它当文字渲染（下面那条 XSS 用例钉的正是这个）。
 *
 * `a-drawer` 用替件（真组件把内容 teleport 到 body，`wrapper.text()` 读不到），其余（Button/StateBlock）用真的。
 */

vi.mock('../../../api/geoCampaign', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/geoCampaign')>()
  return {
    ...actual,
    geoCampaignApi: { judgments: vi.fn(), answer: vi.fn() },
  }
})

const DRAWER_STUB = {
  name: 'ADrawer',
  props: ['open', 'title', 'width', 'placement'],
  template: '<div class="drawer-stub" :data-open="open ? \'1\' : \'0\'"><i class="drawer-title">{{ title }}</i><slot /></div>',
}

const VOCABULARY = {
  runStatuses: {},
  metrics: {},
  metricDefinitions: {},
  confirmStates: {},
  judgeStates: { JUDGING: '判定中', DONE: '已判定', FAILED: '判定失败' },
  prominences: { RECOMMENDED: '词表给的档位', MENTIONED: '词表给的另一种' },
  prominenceDefinitions: {},
  positionLabel: '在推荐清单里的第几项',
  sentiments: { POS: '词表给的情感' },
  sentimentDefinitions: {},
  accessChannelNote: '本轮口径=API 问答',
} satisfies GeoVocabulary

function judgment(overrides: Partial<GeoJudgment>): GeoJudgment {
  return {
    id: 501,
    callId: 9001,
    scope: 'BRAND',
    subjectId: 7,
    subject: '纳欣口腔',
    prominence: 'RECOMMENDED',
    prominenceLabel: '接口给的档位',
    positionRank: 2,
    positionLabel: '在推荐清单里的第几项',
    sentiment: 'POS',
    sentimentLabel: '接口给的情感',
    sentimentReason: '原文里说它便宜又正规',
    evidenceQuote: '纳欣口腔价格透明',
    matchedText: '纳欣口腔',
    judgeModelId: 11,
    judgePromptVersion: 'geo-judge-v1',
    notMeasuredReason: null,
    createdAt: '2026-09-29T10:06:30',
    ...overrides,
  }
}

function trace(overrides: Partial<GeoAnswerTrace>): GeoAnswerTrace {
  return {
    callId: 9001,
    modelConfigId: 11,
    modelName: 'qwen3.7-plus',
    provider: '阿里云',
    questionText: '宁波哪家牙科便宜又正规',
    questionKind: 'TRACKED',
    sampleSeq: 2,
    createdAt: '2026-09-29T10:03:00',
    answerText: '在宁波可以看看纳欣口腔，价格透明；同行甲也常被推荐。',
    judgments: [judgment({})],
    ...overrides,
  }
}

async function mountDrawer(props: Record<string, unknown> = {}) {
  const wrapper = mount(GeoJudgmentDrawer, {
    props: { open: true, runId: 88, vocabulary: VOCABULARY, ...props },
    global: { stubs: { 'a-drawer': DRAWER_STUB, 'a-button': Button } },
  })
  await flushPromises()
  return wrapper
}

function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').filter((node: any) => (node.text() || '').trim() === text)
}

function rowTexts(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.geo-trace__table tbody tr').map((row: any) => row.text())
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(geoCampaignApi.judgments).mockResolvedValue([judgment({})] as never)
  vi.mocked(geoCampaignApi.answer).mockResolvedValue(trace({}) as never)
})

describe('抽屉只在打开时读一次判定行', () => {
  it('关着的时候一行都不读：报告页一进来就替每个轮次打开发过贵的读口是浪费', async () => {
    const wrapper = mount(GeoJudgmentDrawer, {
      props: { open: false, runId: 88, vocabulary: VOCABULARY },
      global: { stubs: { 'a-drawer': DRAWER_STUB, 'a-button': Button } },
    })
    await flushPromises()
    expect(geoCampaignApi.judgments).not.toHaveBeenCalled()
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(geoCampaignApi.judgments).toHaveBeenCalledWith(88)
  })

  it('重开不重读：这一族的读口按 runId 查，同一轮判过什么不会自己变', async () => {
    const wrapper = await mountDrawer()
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(geoCampaignApi.judgments).toHaveBeenCalledTimes(1)
  })

  it('没有轮次 id 时不发请求，说的是「还没有读到判定行」而不是空表', async () => {
    const wrapper = await mountDrawer({ runId: null })
    expect(geoCampaignApi.judgments).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('还没有读到判定行')
  })

  it('读判定行失败：原样念后端那句原因，不把「我读不到」说成「这一轮没判过」', async () => {
    vi.mocked(geoCampaignApi.judgments).mockRejectedValue(new Error('这一轮不属于当前租户（GEO_CAMPAIGN_NOT_FOUND）'))
    const wrapper = await mountDrawer()
    expect(wrapper.text()).toContain('这一轮不属于当前租户')
    expect(wrapper.text()).not.toContain('一行判定都没有')
  })
})

describe('列表模式：判成的与判不成的同列，档位情感只念接口给的词', () => {
  it('摘要把「判成几行 / 未测量几行」分开报，并写明缺口不是模型漏报', async () => {
    vi.mocked(geoCampaignApi.judgments).mockResolvedValue([
      judgment({ id: 1 }),
      judgment({ id: 2, callId: 9002, subject: '同行甲', notMeasuredReason: '引句在原文里找不到那段字（第四道校验没过）' }),
    ] as never)
    const wrapper = await mountDrawer()
    const summary = wrapper.find('.geo-trace__summary').text()
    expect(summary).toContain('共 2 行判定')
    expect(summary).toContain('判成 1 行')
    expect(summary).toContain('未测量 1 行')
    expect(summary).toContain('不是模型漏报')
  })

  it('未测量那一行：档位与情感都写「未取到」，并把原因原样列出来（不替它挑一档）', async () => {
    vi.mocked(geoCampaignApi.judgments).mockResolvedValue([
      judgment({
        id: 2, prominence: null, prominenceLabel: null, sentiment: null, sentimentLabel: null,
        positionRank: null, positionLabel: null, evidenceQuote: null, sentimentReason: null,
        notMeasuredReason: '模型给的理由是空的（第二道校验没过）',
      }),
    ] as never)
    const wrapper = await mountDrawer()
    const row = wrapper.find('.geo-trace__table tbody tr')
    expect(row.attributes('data-unmeasured')).toBe('1')
    expect(row.text()).toContain('未取到')
    expect(row.text()).toContain('模型给的理由是空的')
    // 未测量的行不出现任何档位/情感词
    expect(row.text()).not.toContain('接口给的档位')
    expect(row.text()).not.toContain('接口给的情感')
  })

  it('接口没给 label 才退到 /vocabulary，两处都没有就原样显示那个码（TS 里没有第三份词表）', async () => {
    vi.mocked(geoCampaignApi.judgments).mockResolvedValue([
      judgment({ id: 1, prominenceLabel: null }),
      judgment({ id: 2, sentimentLabel: null }),
      judgment({ id: 3, prominenceLabel: null, prominence: 'SOMETHING_NEW', sentimentLabel: null, sentiment: 'OTHER_NEW' }),
    ] as never)
    const wrapper = await mountDrawer()
    const rows = rowTexts(wrapper)
    expect(rows[0]).toContain('词表给的档位')
    expect(rows[1]).toContain('词表给的情感')
    expect(rows[2]).toContain('SOMETHING_NEW')
    expect(rows[2]).toContain('OTHER_NEW')
  })

  it('一行判定都没有：出路是「判定这一轮」，不是再花钱重跑提问', async () => {
    vi.mocked(geoCampaignApi.judgments).mockResolvedValue([] as never)
    const wrapper = await mountDrawer()
    const text = wrapper.text()
    expect(text).toContain('这一轮一行判定都没有')
    expect(text).toContain('不会重跑提问')
  })

  it('§5 禁令：这一屏没有那个词，位置只念词表给的叫法', async () => {
    const wrapper = await mountDrawer()
    expect(wrapper.text()).not.toContain('排名')
  })
})

describe('原文溯源：每个判定都点得到那条回答，点开看得见高亮', () => {
  it('按「看原文」只发 answer(callId) 一发，切到原文模式并念出问题与模型', async () => {
    const wrapper = await mountDrawer()
    await buttonsByText(wrapper, '看原文')[0].trigger('click')
    await flushPromises()
    expect(geoCampaignApi.answer).toHaveBeenCalledWith(9001)
    expect(geoCampaignApi.judgments).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.geo-trace__question').text()).toContain('宁波哪家牙科便宜又正规')
    expect(wrapper.find('.geo-trace__meta').text()).toContain('qwen3.7-plus')
    expect(wrapper.find('.geo-trace__meta').text()).toContain('阿里云')
    expect(wrapper.find('.geo-trace__meta').text()).toContain('第 2 次采样')
    expect(wrapper.find('.geo-trace__meta').text()).toContain('geo-judge-v1')
  })

  it('判定那一行给的是档位、情感与位置，位置那一句用的是接口的 positionLabel', async () => {
    const wrapper = await mountDrawer()
    await buttonsByText(wrapper, '看原文')[0].trigger('click')
    await flushPromises()
    const verdict = wrapper.find('.geo-trace__verdict').text()
    expect(verdict).toContain('纳欣口腔')
    expect(verdict).toContain('接口给的档位')
    expect(verdict).toContain('接口给的情感')
    expect(verdict).toContain('在推荐清单里的第几项：2')
    expect(wrapper.find('.geo-trace__quote').text()).toContain('纳欣口腔价格透明')
    expect(wrapper.find('.geo-trace__reason').text()).toContain('便宜又正规')
  })

  it('高亮走切段不走 v-html：模型产出的标签只当文字出现，不会被解析成元素', async () => {
    vi.mocked(geoCampaignApi.answer).mockResolvedValue(trace({
      answerText: '纳欣口腔不错。<img src=x onerror=alert(1)> 就这家',
    }) as never)
    const wrapper = await mountDrawer()
    await buttonsByText(wrapper, '看原文')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.geo-trace__answer-body img').exists()).toBe(false)
    expect(wrapper.find('.geo-trace__answer-body').text()).toContain('<img src=x onerror=alert(1)>')
    const hits = wrapper.findAll('.geo-trace__hit')
    expect(hits).toHaveLength(1)
    expect(hits[0].text()).toBe('纳欣口腔')
  })

  it('未测量那条点开：念的是那句原因，并且不摆档位与引句', async () => {
    const unmeasured = judgment({
      id: 8, prominence: null, prominenceLabel: null, sentiment: null, sentimentLabel: null,
      positionRank: null, positionLabel: null, evidenceQuote: null, sentimentReason: null,
      notMeasuredReason: '引句不是原文里的连续字（第四道校验没过）',
    })
    vi.mocked(geoCampaignApi.judgments).mockResolvedValue([unmeasured] as never)
    vi.mocked(geoCampaignApi.answer).mockResolvedValue(trace({ judgments: [unmeasured] }) as never)
    const wrapper = await mountDrawer()
    await buttonsByText(wrapper, '看原文')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.geo-trace__unmeasured').text()).toContain('引句不是原文里的连续字')
    expect(wrapper.find('.geo-trace__quote').exists()).toBe(false)
    expect(wrapper.find('.geo-trace__reason').exists()).toBe(false)
    // 没有位置就不摆那一句，界面不替它编一个第几项
    expect(wrapper.find('.geo-trace__verdict').text()).toContain('未取到')
    expect(wrapper.text()).not.toContain('在推荐清单里的第几项：')
  })

  it('同一批主体：这一条回答判出的其它行也列在旁边（SOV 是它们共用一次外呼）', async () => {
    vi.mocked(geoCampaignApi.answer).mockResolvedValue(trace({
      judgments: [
        judgment({ id: 1 }),
        judgment({ id: 2, subject: '同行甲', scope: 'COMPETITOR', sentimentLabel: null, sentiment: null }),
      ],
    }) as never)
    const wrapper = await mountDrawer()
    await buttonsByText(wrapper, '看原文')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.geo-trace__others').text()).toContain('这一条回答同时判出的其它行')
    expect(rowTexts(wrapper)).toHaveLength(2)
    expect(rowTexts(wrapper)[1]).toContain('同行甲')
  })

  it('原文是空的：说「没有可读的原文」，不摆一个看起来像正文的空框', async () => {
    vi.mocked(geoCampaignApi.answer).mockResolvedValue(trace({ answerText: null }) as never)
    const wrapper = await mountDrawer()
    await buttonsByText(wrapper, '看原文')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.geo-trace__empty').text()).toContain('这一条回答没有可读的原文')
  })

  it('取原文失败：抽屉里念后端那句，并且不留在半个判定卡上', async () => {
    vi.mocked(geoCampaignApi.answer).mockRejectedValue(new Error('这条调用已经被清理（GEO_ANSWER_NOT_FOUND）'))
    const wrapper = await mountDrawer()
    await buttonsByText(wrapper, '看原文')[0].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('这条调用已经被清理')
    // 列表还在原地：读一次失败不该把已经拿到的判定行丢掉
    expect(rowTexts(wrapper)).toHaveLength(1)
  })

  it('回到明细列表：不发第二发 judgments，也不带着上一条回答的原文', async () => {
    const wrapper = await mountDrawer()
    await buttonsByText(wrapper, '看原文')[0].trigger('click')
    await flushPromises()
    await buttonsByText(wrapper, '← 回到判定明细')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.geo-trace__question').exists()).toBe(false)
    expect(buttonsByText(wrapper, '看原文')).toHaveLength(1)
    expect(geoCampaignApi.judgments).toHaveBeenCalledTimes(1)
    expect(geoCampaignApi.answer).toHaveBeenCalledTimes(1)
  })

  it('关闭时把 open 发回给外层：外层握着 v-model，抽屉自己不擅自留客', async () => {
    const wrapper = await mountDrawer()
    await wrapper.findComponent(DRAWER_STUB).vm.$emit('close')
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})
