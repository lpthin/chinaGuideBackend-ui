import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import SiteValidationStrip from '../SiteValidationStrip.vue'
import { portalValidationApi } from '../../../api/portalValidation'
import type { ValidationReaskResult, ValidationRun } from '../../../api/portalValidation'

/**
 * 「交付前自检」摘要条的渲染契约（设计文档 §6 层 2）。
 *
 * 这一屏最要紧的一件事是**不许谎报**，所以各分支全部挂真组件、读真 DOM 文本：
 * 1. 后端回 null 时念「这个站还没跑过自检」，而且那句里一个数字都不许有（跑都没跑，
 *    「0 条拦项」就是编出来的）；
 * 2. pass / blocked / error 三档各念各的句子，error 那一档不许念成「没查出问题」；
 * 3. 没选站点时一条请求都不发、一颗按钮都不给；
 * 4. 「现在重查一遍」只发 POST /portal/validation/scan，摘要跟着回执那一行走——
 *    自己拼一份「看起来查过了」的状态就是第二个真相；
 * 5. 「交给模型重问」是本屏唯一一颗会改页面、会花模型钱的按钮，所以它三件事要钉住：
 *    上一次那一跑没有拦项时它不出现（不摆一个点了必被拒的按钮）、点之前那句确认不许省、
 *    跑完之后那几句过程说明念的是后端原话，界面不归纳成「成功/失败」。
 */

vi.mock('../../../api/portalValidation', async () => {
  const actual = await vi.importActual<Record<string, any>>('../../../api/portalValidation')
  return {
    ...actual,
    portalValidationApi: { latest: vi.fn(), runs: vi.fn(), options: vi.fn(), scan: vi.fn(), reask: vi.fn() }
  }
})

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['size', 'disabled', 'loading'],
  template: `<div class="${name}-stub"><slot /></div>`
})

const POPCONFIRM_STUB = {
  name: 'APopconfirm',
  props: ['title', 'disabled', 'okButtonProps'],
  emits: ['confirm'],
  template:
    '<span class="popconfirm-stub" :data-title="title"><slot /><button class="popconfirm-ok" :disabled="disabled" @click="$emit(\'confirm\')">确定</button></span>'
}

function run(over: Partial<ValidationRun> = {}): ValidationRun {
  return {
    id: 41,
    tenantId: 15,
    siteId: 3,
    candidateId: 8,
    briefId: 12,
    round: 3,
    triggerSource: 'manual',
    checkerVersion: 'v1',
    pagesScanned: 12,
    blockerCount: 0,
    warnCount: 1,
    verdict: 'pass',
    createdAt: '2026-10-22T09:00:00',
    finishedAt: '2026-10-22T09:00:02',
    ...over
  }
}

function reaskResult(over: Partial<ValidationReaskResult> = {}): ValidationReaskResult {
  return {
    blockersBefore: 2,
    slotsAligned: 0,
    roundsRun: 1,
    blockersAfter: 0,
    verdict: 'pass',
    runIdBefore: 88,
    runIdAfter: 90,
    notices: ['第 1 轮重问后复核（运行账第 9 跑）：0 条拦项。这一发的 token 已进外呼账，由平台承担还是记到这一家，看这一家的交付状态'],
    ...over
  }
}

async function mountStrip(siteId: number | null = 3) {
  const wrapper = mount(SiteValidationStrip, {
    attachTo: document.body,
    props: { siteId },
    global: {
      stubs: {
        'a-button': Button,
        'a-space': PASS_THROUGH('a-space'),
        'a-popconfirm': POPCONFIRM_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function bodyText() {
  return document.body.textContent || ''
}

function buttonThat(text: string) {
  return [...document.querySelectorAll('button')].find(node => (node.textContent || '').includes(text)) as
    | HTMLButtonElement
    | undefined
}

/** 只点 popconfirm 里那颗真确认钮，点外层按钮不算确认（这跟巡检那一屏的口径一样） */
async function confirmPop(at = 0) {
  const node = document.querySelectorAll('.popconfirm-ok')[at] as HTMLButtonElement | undefined
  if (!node) throw new Error(`第 ${at} 颗确认钮不在 DOM 里`)
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

/** 第 at 个 popconfirm 上那句确认话（只读 DOM 属性，不进 bodyText，免得污染别的用例的 not.toContain） */
function popTitle(at = 0) {
  return document.querySelectorAll('.popconfirm-stub')[at]?.getAttribute('data-title') ?? ''
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  vi.mocked(portalValidationApi.latest).mockResolvedValue(null as any)
  vi.mocked(portalValidationApi.scan).mockResolvedValue({ run: run(), findings: [] } as any)
  vi.mocked(portalValidationApi.reask).mockResolvedValue(reaskResult() as any)
})

describe('摘要那一句跟着后端回的那一行走', () => {
  it('pass：念「通过，读了 12 页，0 条拦项（第 3 跑）」', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(run({ verdict: 'pass' }) as any)
    await mountStrip()
    expect(portalValidationApi.latest).toHaveBeenCalledTimes(1)
    expect(portalValidationApi.latest).toHaveBeenCalledWith(3)
    expect(bodyText()).toContain('交付前自检')
    expect(bodyText()).toContain('上次自检：通过，读了 12 页，0 条拦项（第 3 跑）')
  })

  it('blocked：念拦项数，并说修完才能交付', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(
      run({ verdict: 'blocked', blockerCount: 4, round: 2, pagesScanned: 9 }) as any
    )
    await mountStrip()
    expect(bodyText()).toContain('上次自检：这一套有 4 条拦项，修完才能交付（第 2 跑，读了 9 页）')
    expect(bodyText()).not.toContain('通过')
  })

  it('error：念「没能看全，不能算通过」，不许溜成「没查出问题」', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(
      run({ verdict: 'error', blockerCount: 0, round: 5, pagesScanned: 7 }) as any
    )
    await mountStrip()
    expect(bodyText()).toContain('上次自检：有页面读不动，这一跑没能看全，不能算通过（第 5 跑，读了 7 页）')
    expect(bodyText()).not.toContain('0 条拦项')
    expect(bodyText()).not.toContain('没有拦项')
  })

  /** 这一条是整个模块存在的理由：跑都没跑，界面上就不许出现任何计数 */
  it('后端回 null：只念「这个站还没跑过自检」，一个数字都不带', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(null as any)
    await mountStrip()
    expect(bodyText()).toContain('这个站还没跑过自检')
    expect(bodyText()).not.toContain('0 条拦项')
    expect(bodyText()).not.toContain('上次自检')
  })

  it('读口失败：挂后端原话，不演成「没跑过」也不演成「通过」', async () => {
    vi.mocked(portalValidationApi.latest).mockRejectedValue(new Error('没有权限执行该操作'))
    await mountStrip()
    expect(bodyText()).toContain('自检结论没读到（后端原话：没有权限执行该操作）')
    expect(bodyText()).not.toContain('这个站还没跑过自检')
    expect(bodyText()).not.toContain('上次自检')
  })

  it('词表外的结论原样念码，不替后端编一句中文', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(run({ verdict: 'unknown_state' }) as any)
    await mountStrip()
    expect(bodyText()).toContain('结论是「unknown_state」')
    expect(bodyText()).not.toContain('上次自检：通过')
  })
})

describe('没选站点时不发请求、不给按钮', () => {
  it('siteId=null：两个口都不打，念的是「还没选定站点」，也不演「没跑过自检」', async () => {
    await mountStrip(null)
    expect(portalValidationApi.latest).not.toHaveBeenCalled()
    expect(bodyText()).toContain('还没选定站点')
    expect(bodyText()).not.toContain('这个站还没跑过自检')
    expect(buttonThat('现在重查一遍')!.disabled).toBe(true)
    expect(buttonThat('重新读一次')!.disabled).toBe(true)
  })

  it('换了站点就把上一家的结论撤下来重读：界面上不许同时留着两句话', async () => {
    vi.mocked(portalValidationApi.latest)
      .mockResolvedValueOnce(run({ verdict: 'blocked', blockerCount: 4 }) as any)
      .mockResolvedValueOnce(run({ verdict: 'pass', round: 6, pagesScanned: 20 }) as any)
    const wrapper = await mountStrip(3)
    expect(bodyText()).toContain('这一套有 4 条拦项')

    await wrapper.setProps({ siteId: 7 })
    await flushPromises()
    expect(portalValidationApi.latest).toHaveBeenLastCalledWith(7)
    expect(bodyText()).toContain('上次自检：通过，读了 20 页，0 条拦项（第 6 跑）')
    expect(bodyText()).not.toContain('这一套有 4 条拦项')
  })
})

describe('现在重查一遍', () => {
  it('确认后才发那一发 POST，且 siteId 只在查询串上、没有请求体', async () => {
    await mountStrip()
    const outer = buttonThat('现在重查一遍')!
    outer.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalValidationApi.scan).not.toHaveBeenCalled()

    await confirmPop()
    expect(portalValidationApi.scan).toHaveBeenCalledTimes(1)
    expect(portalValidationApi.scan).toHaveBeenCalledWith(3)
  })

  /** 这一条盯的是那个「推进 reactive 数组/对象的更新不生效」的老坑：摘要必须真的换掉 */
  it('摘要跟着回执那一行更新，并把这一跑交回挂载方去重拉清单', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(
      run({ verdict: 'blocked', blockerCount: 4, round: 2 }) as any
    )
    vi.mocked(portalValidationApi.scan).mockResolvedValue({
      run: run({ id: 42, verdict: 'pass', blockerCount: 0, warnCount: 0, round: 3, pagesScanned: 12 }),
      findings: [{ id: 1 }, { id: 2 }] as any
    } as any)
    const wrapper = await mountStrip()
    expect(bodyText()).toContain('这一套有 4 条拦项')

    await confirmPop()
    expect(bodyText()).toContain('上次自检：通过，读了 12 页，0 条拦项（第 3 跑）')
    expect(bodyText()).not.toContain('这一套有 4 条拦项')
    expect(bodyText()).toContain('刚刚那一跑已经落账（2 条待处理问题记在下面的清单里）')
    const emitted = wrapper.emitted('scanned')
    expect(emitted).toHaveLength(1)
    expect((emitted![0][0] as ValidationRun).id).toBe(42)
    // 读口不再打一次：这一跑的账就在回执里，重读一遍反而可能读到别人的跑
    expect(portalValidationApi.latest).toHaveBeenCalledTimes(1)
  })

  it('重查被后端拒：那句结论仍是上一次落账的那一跑，中文原话挂出来', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(run({ verdict: 'pass' }) as any)
    vi.mocked(portalValidationApi.scan).mockRejectedValue(new Error('这一站点下有页面正在改版，请先收口'))
    const wrapper = await mountStrip()
    await confirmPop()
    expect(bodyText()).toContain('这次重查没走通（后端原话：这一站点下有页面正在改版，请先收口）')
    expect(bodyText()).toContain('上次自检：通过，读了 12 页，0 条拦项（第 3 跑）')
    expect(wrapper.emitted('scanned')).toBeUndefined()
  })

  it('连点两次只发一次：正在跑的时候那颗确认钮不再发第二跑', async () => {
    let release: (value: any) => void = () => {}
    vi.mocked(portalValidationApi.scan).mockImplementation(
      () => new Promise(resolve => {
        release = resolve
      })
    )
    await mountStrip()
    await confirmPop()
    expect(portalValidationApi.scan).toHaveBeenCalledTimes(1)
    await confirmPop()
    expect(portalValidationApi.scan).toHaveBeenCalledTimes(1)
    release({ run: run(), findings: [] })
    await flushPromises()
    expect(portalValidationApi.scan).toHaveBeenCalledTimes(1)
  })
})

describe('交给模型重问', () => {
  /** 这颗按钮的存在条件就是上一次那一跑真拦了人：没拦、以及「有页读不动」都不给（改文字修不了读不动） */
  it('上一次没有拦项（pass 与 error 两档）时这颗按钮根本不存在', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(run({ verdict: 'pass', blockerCount: 0 }) as any)
    await mountStrip()
    expect(buttonThat('交给模型重问')).toBeUndefined()

    document.body.innerHTML = ''
    vi.mocked(portalValidationApi.latest).mockResolvedValue(run({ verdict: 'error', blockerCount: 0 }) as any)
    await mountStrip()
    expect(buttonThat('交给模型重问')).toBeUndefined()
    expect(portalValidationApi.reask).not.toHaveBeenCalled()
  })

  it('blocked 且有拦项时才给，确认那一句说清会花模型钱、每一页能退回去', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(
      run({ verdict: 'blocked', blockerCount: 3, round: 7 }) as any
    )
    await mountStrip()
    expect(buttonThat('交给模型重问')).toBeDefined()
    const title = popTitle(1)
    expect(title).toContain('3 条')
    expect(title).toContain('模型')
    expect(title).toContain('费用')
    expect(title).toContain('版本历史')
    expect(portalValidationApi.reask).not.toHaveBeenCalled()
  })

  it('点了按钮本体不算确认：只有 popconfirm 里那颗确认钮才发那一发 POST', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(
      run({ verdict: 'blocked', blockerCount: 2 }) as any
    )
    await mountStrip()
    buttonThat('交给模型重问')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(portalValidationApi.reask).not.toHaveBeenCalled()

    await confirmPop(1)
    expect(portalValidationApi.reask).toHaveBeenCalledTimes(1)
    expect(portalValidationApi.reask).toHaveBeenCalledWith(3)
  })

  it('跑完：后端那几句过程说明逐条原样念出来，摘要改读新落账的那一行并把这一跑交回挂载方', async () => {
    vi.mocked(portalValidationApi.latest)
      .mockResolvedValueOnce(run({ verdict: 'blocked', blockerCount: 2, round: 8, id: 88 }) as any)
      .mockResolvedValue(run({ verdict: 'pass', blockerCount: 0, round: 9, id: 90 }) as any)
    vi.mocked(portalValidationApi.reask).mockResolvedValue(
      reaskResult({
        notices: [
          '这一页的页头标志图与全站那一张不同',
          '第 1 轮重问后复核（运行账第 9 跑）：0 条拦项。这一发的 token 已进外呼账，由平台承担还是记到这一家，看这一家的交付状态'
        ]
      }) as any
    )
    const wrapper = await mountStrip()
    await confirmPop(1)

    expect(bodyText()).toContain('上次自检：通过，读了 12 页，0 条拦项（第 9 跑）')
    expect(bodyText()).not.toContain('这一套有 2 条拦项')
    expect(bodyText()).toContain('这一页的页头标志图与全站那一张不同')
    expect(bodyText()).toContain('运行账第 9 跑')
    // 重问的回执里没有「那一跑的整行」，只有落账 id：摘要必须靠重读 latest 拿，界面不许自己拼
    expect(portalValidationApi.latest).toHaveBeenCalledTimes(2)
    const emitted = wrapper.emitted('scanned')
    expect(emitted).toHaveLength(1)
    expect((emitted![0][0] as ValidationRun).id).toBe(90)
  })

  it('被后端拒：中文原话挂出来，摘要一个字都不改，也不喊「已经落账」', async () => {
    vi.mocked(portalValidationApi.latest).mockResolvedValue(
      run({ verdict: 'blocked', blockerCount: 2, round: 8 }) as any
    )
    vi.mocked(portalValidationApi.reask).mockRejectedValue(
      new Error('这一套还在生成中，等它跑完再重问：现在两边改的是同一批页，会撞在页面版本上')
    )
    const wrapper = await mountStrip()
    await confirmPop(1)

    expect(bodyText()).toContain('这一次交给模型重问没走通（后端原话：这一套还在生成中')
    expect(bodyText()).toContain('上次自检：这一套有 2 条拦项，修完才能交付（第 8 跑，读了 12 页）')
    expect(wrapper.emitted('scanned')).toBeUndefined()
    expect(portalValidationApi.latest).toHaveBeenCalledTimes(1)
  })

  it('连点两次只发一发，跑的时候界面上那句「先别关」是给的（这一发是同步的，几十秒到几分钟都正常）', async () => {
    let release: (value: ValidationReaskResult) => void = () => {}
    vi.mocked(portalValidationApi.latest).mockResolvedValue(
      run({ verdict: 'blocked', blockerCount: 1 }) as any
    )
    vi.mocked(portalValidationApi.reask).mockImplementation(
      () => new Promise(resolve => {
        release = resolve
      })
    )
    await mountStrip()
    await confirmPop(1)
    expect(portalValidationApi.reask).toHaveBeenCalledTimes(1)
    expect(bodyText()).toContain('正在重问，这一页先别关')
    await confirmPop(1)
    expect(portalValidationApi.reask).toHaveBeenCalledTimes(1)

    release(reaskResult())
    await flushPromises()
    expect(bodyText()).not.toContain('正在重问，这一页先别关')
    expect(portalValidationApi.reask).toHaveBeenCalledTimes(1)
  })
})
