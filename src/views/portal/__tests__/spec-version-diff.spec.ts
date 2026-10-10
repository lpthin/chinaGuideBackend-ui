import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import SpecVersionDiff from '../SpecVersionDiff.vue'
import { siteSpecApi, type SpecDiffView, type SpecVersionsView } from '../../../api/siteSpec'

/**
 * 说明书版本对比（Spec-M P5 缺口 B）钉的四件事：
 *
 * 1. 打开这一屏只读存档目录那一条 GET；差异要有两份原文才成立，
 *    所以**一份存档都没有时不许发 diff**，也不许演「七段逐字一致」那种看起来像结论的空话；
 * 2. 「现在这一版」是一次不带 to 的 diff，界面上必须明说右边读的是主表全文（含没签字的改动）；
 * 3. 段名、顺序、哪段变了、两侧字数全部来自后端回包：这里不抄段清单，也不自己数；
 * 4. 读失败时把后端原话整条挂出来（「存档里没有第 5 版（存档里只有 第1版、第2版）」这类话
 *    和「比对失败」是完全不同的下一步）。
 */

vi.mock('../../../api/siteSpec', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/siteSpec')>()
  return {
    ...actual,
    siteSpecApi: { versions: vi.fn(), diff: vi.fn() }
  }
})

const KEYS = ['overview', 'strategy', 'pages', 'scope', 'outOfScope', 'data', 'requirements']
const LABELS = ['1 项目概述', '2 战略分析', '3 页面结构', '4 本期实现', '5 本期不实现', '6 数据集成', '7 特殊要求']

function versionsView(rows: number[], notices: string[] = []): SpecVersionsView {
  return {
    specId: 900,
    currentVersion: rows.length ? rows[rows.length - 1] : 0,
    status: 'CONFIRMED',
    statusLabel: '已确认（生成以这一版为准）',
    versions: rows.map((version, index) => ({
      specVersion: version,
      confirmedBy: `超管${index + 1}`,
      confirmedAt: `2026-10-0${index + 1}T09:0${index}:00`,
      filledSections: 7,
      totalChars: 1200 + index * 312,
      current: index === rows.length - 1
    })),
    latestDraft: {
      specVersion: 0,
      confirmedBy: '超管',
      confirmedAt: '2026-10-09T09:00:00',
      filledSections: 7,
      totalChars: 2000,
      current: true
    },
    notices,
  } as SpecVersionsView
}

function diffView(overrides: Partial<SpecDiffView> = {}): SpecDiffView {
  return {
    specId: 900,
    briefId: 12,
    fromVersion: 2,
    fromLabel: '第 2 版（已签字）',
    fromConfirmedAt: '2026-10-09T09:00:00',
    toVersion: null,
    toLabel: '现在这一版',
    toConfirmedAt: '2026-10-09T09:00:00',
    changedSections: 1,
    sections: KEYS.map((key, index) => ({
      key,
      title: LABELS[index],
      order: index + 1,
      changed: index === 2,
      charCountFrom: index === 2 ? 488 : 200,
      charCountTo: index === 2 ? 800 : 200,
      contentFrom: index === 2 ? '旧的一页要讲三件事' : `第 ${index + 1} 段原文`,
      contentTo: index === 2 ? '新的一页要讲四件事' : `第 ${index + 1} 段原文`
    })),
    notices: ['右边这一栏读的是主表当前全文：已确认，含还没签字的改动', '七段里有 1 段变了'],
    ...overrides
  } as SpecDiffView
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'label', 'message', 'type', 'open', 'spinning', 'column', 'size', 'dataSource', 'columns'],
  template: `<div class="${name}-stub"><slot name="title" /><slot name="message" /><slot /></div>`
})

/** a-table 在 jsdom 里要真渲染才有意义：这里换成把每行版本号与字数吐出来的桩，读的是行数据不是像素 */
const TABLE_STUB = {
  name: 'a-table',
  props: ['dataSource', 'columns', 'rowKey', 'size', 'pagination'],
  template: `<div class="table-stub"><span v-for="row in dataSource" :key="row.specVersion">
    第 {{ row.specVersion }} 版 / {{ row.confirmedBy }} / {{ row.totalChars }} 字
    <slot name="bodyCell" :column="{ key: 'specVersion' }" :record="row" />
  </span></div>`
}

/** select 要能真的改值：点这里验的是「不带 to」这一形状，不能用桩演 */
const SELECT_STUB = {
  name: 'a-select',
  props: ['value', 'options', 'placeholder'],
  emits: ['update:value'],
  // 真 a-select 吐回的是 option 自己那个值（这里是 number 或 null），原生 select 只会给字符串，
  // 所以桩里把 'null' 还原成 null、其余转成数字，否则测出来的是桩的形状而不是产品的形状
  template: `<select :value="value" @change="$emit('update:value', $event.target.value === 'null' ? null : Number($event.target.value))">
    <option v-for="opt in options" :key="String(opt.value)" :value="String(opt.value)">{{ opt.label }}</option>
  </select>`
}

function mounted() {
  return mount(SpecVersionDiff, {
    attachTo: document.body,
    props: { briefId: 12 },
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('a-spin'),
        'a-alert': PASS_THROUGH('a-alert'),
        'a-descriptions': PASS_THROUGH('a-descriptions'),
        'a-descriptions-item': PASS_THROUGH('a-descriptions-item'),
        'a-tag': PASS_THROUGH('a-tag'),
        'a-select': SELECT_STUB,
        'a-table': TABLE_STUB,
        'a-button': {
          name: 'a-button',
          props: ['loading', 'disabled', 'type'],
          template: '<button :disabled="disabled || loading"><slot /></button>'
        }
      }
    }
  })
}

function bodyText() {
  return document.body.textContent || ''
}

function buttonThat(text: string) {
  return [...document.querySelectorAll('button')].find(node => (node.textContent || '').includes(text)) as
    | HTMLButtonElement
    | undefined
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  vi.mocked(siteSpecApi.versions).mockResolvedValue(versionsView([1, 2]))
  vi.mocked(siteSpecApi.diff).mockResolvedValue(diffView())
})

describe('打开这一屏只读目录，差异由目录决定能不能发', () => {
  it('有存档时：目录那一条 GET 加默认那一对的 diff，各发一次', async () => {
    mounted()
    await flushPromises()

    expect(siteSpecApi.versions).toHaveBeenCalledTimes(1)
    expect(siteSpecApi.versions).toHaveBeenCalledWith(12)
    expect(siteSpecApi.diff).toHaveBeenCalledTimes(1)
  })

  it('默认看的是「最近一版 → 现在这一版」，所以那一次 diff 不带 to', async () => {
    mounted()
    await flushPromises()

    expect(siteSpecApi.diff).toHaveBeenCalledWith(12, 2, null)
  })

  it('一份存档都没有时不发 diff，也不演「逐字一致」', async () => {
    vi.mocked(siteSpecApi.versions).mockResolvedValue(versionsView([], [
      '这一份还没有任何版本快照：确认一次才存一份，这一单还没确认过'
    ]))

    mounted()
    await flushPromises()

    expect(siteSpecApi.diff).not.toHaveBeenCalled()
    expect(bodyText()).toContain('这一份还没有任何版本快照')
    expect(bodyText()).toContain('存档里一份都没有')
    expect(bodyText()).not.toContain('七段逐字一致')
    expect(buttonThat('比对')).toBeUndefined()
  })

  it('目录读失败时挂后端原话，不发 diff', async () => {
    vi.mocked(siteSpecApi.versions).mockRejectedValue(
      new Error('需求单 12 还没有说明书：没有版本可查，先写七段或点「AI 出初稿」')
    )

    mounted()
    await flushPromises()

    expect(siteSpecApi.diff).not.toHaveBeenCalled()
    expect(bodyText()).toContain('版本目录没读到')
    expect(bodyText()).toContain('还没有说明书')
  })
})

describe('差异那一屏说的话全部来自后端', () => {
  it('七段按后端顺序与标题摆出，改了的那段两侧原文并排，字数读后端那两个数', async () => {
    mounted()
    await flushPromises()

    for (const label of LABELS) {
      expect(bodyText()).toContain(label)
    }
    expect(bodyText()).toContain('旧的一页要讲三件事')
    expect(bodyText()).toContain('新的一页要讲四件事')
    expect(bodyText()).toContain('488 字')
    expect(bodyText()).toContain('800 字')
    expect(bodyText()).toContain('+312 字')
    expect(bodyText()).toContain('七段里有 1 段变了')
  })

  it('「现在这一版」这一句明说右边是主表全文、含没签字的改动', async () => {
    mounted()
    await flushPromises()

    expect(bodyText()).toContain('右边这一栏读的是主表当前全文')
    expect(bodyText()).toContain('含还没签字的改动')
  })

  it('换了起止两版再点比对，那一发带上 to', async () => {
    const wrapper = mounted()
    await flushPromises()
    vi.mocked(siteSpecApi.diff).mockClear()

    const selects = wrapper.findAll('select')
    await selects[0].setValue('1')
    await selects[1].setValue('2')
    buttonThat('比对')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(siteSpecApi.diff).toHaveBeenCalledWith(12, 1, 2)
  })

  it('后端点名「存档里没有第几版」时原话挂出来，不改成「比对失败」', async () => {
    vi.mocked(siteSpecApi.diff).mockRejectedValue(
      new Error('存档里没有第 5 版（存档里只有 第1版、第2版）：只有确认过的版本才留正文，草稿的中间态不存')
    )

    mounted()
    await flushPromises()

    expect(bodyText()).toContain('没比对出来')
    expect(bodyText()).toContain('存档里没有第 5 版')
    expect(bodyText()).toContain('草稿的中间态不存')
  })

  it('两边一样时念后端那句「七段逐字一致」，界面上一个自己算的字都不报', async () => {
    vi.mocked(siteSpecApi.diff).mockResolvedValue(diffView({
      changedSections: 0,
      notices: ['七段逐字一致：这两版之间没有任何一段被改过'],
      sections: KEYS.map((key, index) => ({
        key,
        title: LABELS[index],
        order: index + 1,
        changed: false,
        charCountFrom: 200,
        charCountTo: 200,
        contentFrom: `第 ${index + 1} 段原文`,
        contentTo: `第 ${index + 1} 段原文`
      }))
    }))

    mounted()
    await flushPromises()

    expect(bodyText()).toContain('七段逐字一致')
    expect(bodyText()).not.toContain('+0 字')
    expect(bodyText()).toContain('字数没变')
  })
})
