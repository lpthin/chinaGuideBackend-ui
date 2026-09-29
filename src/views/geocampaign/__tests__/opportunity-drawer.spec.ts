import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import GeoOpportunityDrawer from '../GeoOpportunityDrawer.vue'
import { geoCampaignApi } from '../../../api/geoCampaign'
import type { GeoOpportunity, GeoOpportunityStateLog, GeoVocabulary } from '../../../api/geoCampaign'

/**
 * 一条机会的留痕抽屉（Spec-F §11.5 第一条）。
 *
 * 摆这一屏唯一的理由：<b>「这条机会为什么在这里」要能被追问到</b>。所以用例钉的是：
 * 1. 换一个对象必须重读——复用上一条的留痕等于把别人的决定挂在你身上；
 * 2. 状态名一律念接口给的 label，这里不许有第二份词表；
 * 3. 谁搬的要说清：`actor=system` 是「系统读出」，其余是「人：xxx」，
 *    没有 fromState 的那一格是「第一次算出来」而不是「(空) → xxx」；
 * 4. 放弃理由、「未验证」、产出对象三句都要原样到手。
 *
 * 抽屉/时间线用替件：这里要测的是内容，不是 antd 的挂载动画（真抽屉在测试环境里要靠
 * `getContainer={false}` 才渲染得出，替件更稳且不改变断言）。
 */

vi.mock('../../../api/geoCampaign', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/geoCampaign')>()
  return {
    ...actual,
    geoCampaignApi: { ...actual.geoCampaignApi, opportunityStateLog: vi.fn() },
  }
})

const DRAWER_STUB = {
  name: 'ADrawer',
  props: ['open', 'title'],
  template: '<div class="drawer-stub"><slot /></div>',
}

const TIMELINE_STUB = {
  name: 'ATimeline',
  template: '<div class="timeline-stub"><slot /></div>',
}

const TIMELINE_ITEM_STUB = {
  name: 'ATimelineItem',
  props: ['color'],
  template: '<div class="tl-item" :data-color="color"><slot /></div>',
}

const TAG_STUB = {
  name: 'ATag',
  props: ['color'],
  template: '<span class="tag-stub" :data-color="color"><slot /></span>',
}

const VOCABULARY = {
  opportunityStates: { OPEN: '词表状态名', DRAFTED: '词表已出草稿' },
  opportunityActions: { PAGE: '词表动作名' },
} as unknown as GeoVocabulary

function row(overrides: Partial<GeoOpportunity> = {}): GeoOpportunity {
  return {
    id: 7, runId: 88, campaignId: 12, questionId: 41, coreWord: '种植牙',
    questionText: '种植牙要多少钱', kind: 'MENTION', gapType: 'NOT_COVERED',
    gapTypeLabel: '接口缺口名', gapDefinition: '接口缺口判据',
    actionType: 'PAGE', actionLabel: '接口动作名', evidenceNumerator: 1, evidenceDenominator: 3,
    draftRef: null, state: 'OPEN', stateLabel: '接口状态名', dismissedReason: null,
    verifiedRunId: null, verifiedGapType: null, verifiedAt: null, verificationNote: null,
    createdAt: null, updatedAt: null, ...overrides,
  }
}

function log(overrides: Partial<GeoOpportunityStateLog> = {}): GeoOpportunityStateLog {
  return {
    id: 1, fromState: null, fromStateLabel: null, toState: 'OPEN', toStateLabel: '接口起始格',
    actionType: null, actionLabel: null, draftRef: null, actor: 'system', reason: null,
    createdAt: '2026-09-29T10:00:00', ...overrides,
  }
}

/** `logs` 传 null ⇒ 不碰 mock（用例自己已经设好了返回或抛出） */
function mountDrawer(opportunity: GeoOpportunity | null, logs: GeoOpportunityStateLog[] | null) {
  if (logs) vi.mocked(geoCampaignApi.opportunityStateLog).mockResolvedValue(logs as never)
  const wrapper = mount(GeoOpportunityDrawer, {
    props: { open: true, opportunity, vocabulary: VOCABULARY },
    global: {
      stubs: {
        'a-drawer': DRAWER_STUB,
        'a-timeline': TIMELINE_STUB,
        'a-timeline-item': TIMELINE_ITEM_STUB,
        'a-tag': TAG_STUB,
      },
    },
  })
  return flushPromises().then(() => wrapper)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('留痕读取', () => {
  it('打开就把这一条的 id 报给接口读一次', async () => {
    await mountDrawer(row(), [log()])
    expect(geoCampaignApi.opportunityStateLog).toHaveBeenCalledWith(7)
  })

  it('换一个对象重读，不把上一条的留痕留在屏幕上', async () => {
    const wrapper = await mountDrawer(row(), [log()])
    expect(wrapper.text()).toContain('接口起始格')

    vi.mocked(geoCampaignApi.opportunityStateLog).mockResolvedValue(
      [log({ id: 2, toStateLabel: '换一条之后的留痕' })] as never,
    )
    await wrapper.setProps({ opportunity: row({ id: 8, questionText: '别的题' }) })
    await flushPromises()

    expect(geoCampaignApi.opportunityStateLog).toHaveBeenLastCalledWith(8)
    expect(wrapper.text()).toContain('换一条之后的留痕')
    expect(wrapper.text()).not.toContain('接口起始格')
  })

  it('一次搬迁都没有时说明「刚算出来没人点过」，不摆空时间线', async () => {
    const wrapper = await mountDrawer(row(), [])
    expect(wrapper.text()).toContain('这一条还没有一次搬迁')
    expect(wrapper.find('.timeline-stub').exists()).toBe(false)
  })

  it('读失败时把后端那句原因摆在留痕那一格，不假装「还没有留痕」', async () => {
    vi.mocked(geoCampaignApi.opportunityStateLog).mockRejectedValue(new Error('没有权限看这一条'))
    const wrapper = await mountDrawer(row(), null)
    expect(wrapper.text()).toContain('没有权限看这一条')
    expect(wrapper.text()).not.toContain('这一条还没有一次搬迁')
    expect(wrapper.find('.timeline-stub').exists()).toBe(false)
  })
})

describe('时间线内容', () => {
  const moved = [
    log(),
    log({
      id: 2, fromState: 'OPEN', fromStateLabel: '接口起始格', toState: 'DRAFTED',
      toStateLabel: '接口已出草稿', actionType: 'PAGE', actionLabel: '接口动作名',
      draftRef: 'page:33', actor: 'admin', reason: '按了一键成内容',
      createdAt: '2026-09-29T11:00:00',
    }),
    log({
      id: 3, fromState: 'DRAFTED', fromStateLabel: '接口已出草稿', toState: 'PUBLISHED',
      toStateLabel: '接口已发布', actor: 'system', reason: null,
    }),
  ]

  it('状态名念接口给的 label，TS 里没有第二份词表', async () => {
    const wrapper = await mountDrawer(row(), moved)
    expect(wrapper.text()).toContain('接口起始格 → 接口已出草稿')
    expect(wrapper.text()).toContain('接口已出草稿 → 接口已发布')
    expect(wrapper.text()).not.toContain('词表状态名')
    expect(wrapper.text()).not.toContain('已放弃')
  })

  it('第一格没有 fromState ⇒ 念「算成「…」」，不是「(空) → …」', async () => {
    const wrapper = await mountDrawer(row(), moved)
    const first = wrapper.findAll('.tl-item')[0]
    expect(first.text()).toContain('算成「接口起始格」')
    expect(first.text()).not.toContain('→')
  })

  it('谁搬的说得清：系统读出的与人手点的分开，并把动作与产出对象挂上', async () => {
    const wrapper = await mountDrawer(row(), moved)
    const texts = wrapper.findAll('.tl-item').map((item: any) => item.text())
    expect(texts[1]).toContain('人：admin')
    expect(texts[1]).toContain('动作：接口动作名')
    expect(texts[1]).toContain('挂在 page:33')
    expect(texts[1]).toContain('按了一键成内容')
    expect(texts[2]).toContain('系统读出')
    // 系统读出的那一格不假装有人
    expect(texts[2]).not.toContain('人：')
  })

  it('点数只认 statusTokens 那一份：已发布是绿的，已出草稿不是灰的', async () => {
    const wrapper = await mountDrawer(row(), moved)
    const colors = wrapper.findAll('.tl-item').map((item: any) => item.attributes('data-color'))
    expect(colors[2]).toBe('green')
    expect(colors[1]).toBe('blue')
    expect(colors[0]).toBe('gray')
  })

  it('「共 N 条，其中 M 条是系统读出来的」这一句把两类各数一遍', async () => {
    const wrapper = await mountDrawer(row(), moved)
    expect(wrapper.find('.geo-opp-trace__summary').text()).toContain('共 3 条留痕')
    expect(wrapper.find('.geo-opp-trace__summary').text()).toContain('2 条是系统读出来的')
  })
})

describe('头部那一格', () => {
  it('观测、判据、建议动作都念行上那一份，并点明有几条回答引用到我们站', async () => {
    const wrapper = await mountDrawer(row({ draftRef: 'page:33' }), [log()])
    expect(wrapper.text()).toContain('1 / 3 条回答引用到我们站')
    expect(wrapper.text()).toContain('接口缺口判据')
    expect(wrapper.text()).toContain('建议动作：接口动作名')
    expect(wrapper.text()).toContain('产出对象：page:33（接口动作名）')
  })

  it('未验证与放弃理由各是各的话，不合成一句「完成」', async () => {
    const wrapper = await mountDrawer(row({
      state: 'DISMISSED',
      verificationNote: '未验证：这一轮没跑到这道题。',
      dismissedReason: '这道题不是我们的客户会问的',
    }), [log()])
    expect(wrapper.find('.geo-opp-trace__unverified').text()).toContain('未验证：这一轮没跑到这道题')
    expect(wrapper.find('.geo-opp-trace__dismissed').text()).toContain('这道题不是我们的客户会问的')
  })

  it('没选过动作、也没产出对象时念「—」，不编一个出来', async () => {
    const wrapper = await mountDrawer(row({ actionLabel: null, actionType: null, gapDefinition: null }), [log()])
    expect(wrapper.find('.geo-opp-trace__definition').text()).toBe('—')
    expect(wrapper.text()).not.toContain('建议动作：')
  })
})
