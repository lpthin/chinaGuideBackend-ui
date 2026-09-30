import { describe, it, expect } from 'vitest'
import type { CrawlabilityItem, CrawlabilitySnapshot, CrawlabilityVocabulary } from '../../../api/geoCrawlability'
import {
  NEVER_RUN_TITLE,
  NO_TENANT_NEXT,
  NO_TENANT_TITLE,
  displayRows,
  evidenceLines,
  fractionText,
  headline,
  howMeasuredOf,
  measuredAtText,
  passCriterionOf,
  reasonText,
  verdictCounts,
  verdictDefinitionOf,
  verdictLabelOf,
  verdictOf,
  whyItMattersOf,
} from '../geoCrawlabilityModel'
import { PH_DASH, PH_NOT_RUN } from '../../../utils/display'

/**
 * 可抓取性体检页的显示判据（Spec-F §8 / §11.6）。
 *
 * 钉的是这一屏最容易复发的四种滑坡：
 * 1. 六项少画一项（库里缺行 ⇒ 界面上那一项不存在）；
 * 2. 「不按分子分母测」被画成 0/0，与「测出来是 0」混成一格（§9.6）；
 * 3. 前端抄一份中文——所以这里的词表与行上的值全是【假句子】，界面念出的必须是假句子；
 * 4. 四档结论被合并成一个数（§5 禁令 1）。
 */

const CHECKS = ['ai_search_group', 'training_group', 'llms_txt', 'ssr_first_packet', 'schema_coverage', 'sitemap']

/** 也是假句子：SSR 那一格的因果只允许从后端随行走，界面这边连抄都不抄 */
const SSR_CAUSAL = '假因果句：首包注入这一层没有注册，本期只承认它、不修它'

const VOCABULARY = {
  checks: CHECKS,
  checkLabels: {
    ai_search_group: '假项名·答案族',
    training_group: '假项名·训练族',
    llms_txt: '假项名·llms',
    ssr_first_packet: '假项名·首包',
    schema_coverage: '假项名·结构化',
    sitemap: '假项名·地图',
  },
  checkGroups: {},
  howMeasured: { ai_search_group: '假取数句·答案族' },
  passCriteria: { ai_search_group: '假判据句·答案族' },
  whyItMatters: { ai_search_group: '假用途句·答案族' },
  verdicts: { PASS: '假绿灯', WARN: '假黄灯', FAIL: '假红灯', NOT_MEASURED: '假未测量' },
  verdictDefinitions: { FAIL: '假红灯口径' },
  aiSearchUserAgents: [],
  trainingUserAgents: [],
} as unknown as CrawlabilityVocabulary

function item(overrides: Partial<CrawlabilityItem> = {}): CrawlabilityItem {
  return {
    id: 1,
    siteId: 3,
    checkKey: 'ai_search_group',
    label: '行上的项名',
    groupCode: 'AI_SEARCH_CRAWLER',
    verdict: 'PASS',
    verdictLabel: '行上的绿灯名',
    verdictDefinition: null,
    observedValue: '行上的观测值',
    numerator: null,
    denominator: null,
    measuredAt: '2026-09-29T10:00:00',
    detail: null,
    howMeasured: null,
    passCriterion: null,
    whyItMatters: null,
    ...overrides,
  }
}

function snapshot(items: CrawlabilityItem[], overrides: Partial<CrawlabilitySnapshot> = {}): CrawlabilitySnapshot {
  return {
    items,
    measuredAt: items.length ? (items[0].measuredAt ?? null) : null,
    siteId: items.length ? (items[0].siteId ?? null) : null,
    neverRun: items.length === 0,
    ...overrides,
  }
}

describe('displayRows：六项恒占六格', () => {
  it('按词表顺序排，即使 items 是乱序的', () => {
    const rows = displayRows(VOCABULARY, snapshot([
      item({ checkKey: 'sitemap' }),
      item({ checkKey: 'ai_search_group' }),
    ]))
    expect(rows.map(row => row.checkKey)).toEqual(CHECKS)
  })

  it('库里缺的那几项补成 absent 行而不是少一行', () => {
    const rows = displayRows(VOCABULARY, snapshot([item()]))
    expect(rows).toHaveLength(6)
    expect(rows.filter(row => row.kind === 'absent')).toHaveLength(5)
  })

  it('词表数不到的行也摆出来（库里那一行不是界面的一部分就是谎报）', () => {
    const rows = displayRows(VOCABULARY, snapshot([item(), item({ checkKey: 'robots_v2', id: 9 })]))
    expect(rows.map(row => row.checkKey)).toContain('robots_v2')
  })

  it('同键两行只留第一行，界面不替库里两个真相各画一格', () => {
    const rows = displayRows(VOCABULARY, snapshot([item({ id: 1 }), item({ id: 2 })]))
    expect(rows.filter(row => row.checkKey === 'ai_search_group')).toHaveLength(1)
  })

  it('词表还没到手时按 items 自己的顺序排，不空转', () => {
    const rows = displayRows(null, snapshot([item({ checkKey: 'sitemap' }), item({ checkKey: 'llms_txt' })]))
    expect(rows.map(row => row.checkKey)).toEqual(['sitemap', 'llms_txt'])
  })
})

describe('中文名与判据句子：只念接口发回来的那一份', () => {
  it('行上的名字优先于词表', () => {
    const [row] = displayRows(VOCABULARY, snapshot([item()]))
    expect(row.label).toBe('行上的项名')
  })

  it('absent 行用词表的项名，且结论一格念的是「未跑过」而不是绿灯或红灯', () => {
    const rows = displayRows(VOCABULARY, snapshot([item()]))
    const absent = rows.find(row => row.kind === 'absent')!
    expect(absent.label).toBe('假项名·训练族')
    expect(verdictOf(absent)).toBeNull()
    expect(verdictLabelOf(VOCABULARY, absent)).toBe(PH_NOT_RUN)
  })

  it('结论名：行自带时念行的，缺了回落词表，两处都没有才原样显示状态码', () => {
    const onRow = displayRows(VOCABULARY, snapshot([item()]))[0]
    expect(verdictLabelOf(VOCABULARY, onRow)).toBe('行上的绿灯名')
    const onVocabulary = displayRows(VOCABULARY, snapshot([item({ verdictLabel: null })]))[0]
    expect(verdictLabelOf(VOCABULARY, onVocabulary)).toBe('假绿灯')
    const nowhere = displayRows(VOCABULARY, snapshot([item({ verdictLabel: null, verdict: 'WEIRD' })]))[0]
    expect(verdictLabelOf(VOCABULARY, nowhere)).toBe('WEIRD')
  })

  it('三句判据：行上带了念行的，没带就回落词表（跑之前也要读得到）', () => {
    const withRow = displayRows(VOCABULARY, snapshot([
      item({ howMeasured: '行上的取数句', passCriterion: '行上的判据句', whyItMatters: '行上的用途句' }),
    ]))[0]
    expect(howMeasuredOf(VOCABULARY, withRow)).toBe('行上的取数句')
    expect(passCriterionOf(VOCABULARY, withRow)).toBe('行上的判据句')
    expect(whyItMattersOf(VOCABULARY, withRow)).toBe('行上的用途句')

    const fallback = displayRows(VOCABULARY, snapshot([item()]))[0]
    expect(howMeasuredOf(VOCABULARY, fallback)).toBe('假取数句·答案族')
    expect(passCriterionOf(VOCABULARY, fallback)).toBe('假判据句·答案族')
    expect(whyItMattersOf(VOCABULARY, fallback)).toBe('假用途句·答案族')

    const absent = displayRows(VOCABULARY, snapshot([item()])).find(row => row.kind === 'absent')!
    expect(whyItMattersOf(VOCABULARY, absent)).toBeNull()
  })

  it('四档口径：行上没有时从词表按 verdict 取', () => {
    const row = displayRows(VOCABULARY, snapshot([item({ verdict: 'FAIL', verdictDefinition: null })]))[0]
    expect(verdictDefinitionOf(VOCABULARY, row)).toBe('假红灯口径')
  })
})

describe('分子分母：不按比例测的项不画成 0/0', () => {
  it('denominator 为 null（这一项不按分子分母测）时不渲染这一串', () => {
    expect(fractionText(item())).toBeNull()
  })

  it('denominator 为 0 时照原样画出来（分母 0 是真读数，不是不适用）', () => {
    expect(fractionText(item({ numerator: 0, denominator: 0 }))).toBe('0 / 0')
  })

  it('分子缺值而分母有值时分子位用横杠占位，不冒充 0', () => {
    expect(fractionText(item({ numerator: null, denominator: 6 }))).toBe('— / 6')
  })

  it('absent 行没有 item，也就没有任何数', () => {
    const absent = displayRows(VOCABULARY, snapshot([item()])).find(row => row.kind === 'absent')!
    expect(fractionText(null)).toBeNull()
    expect(absent.kind).toBe('absent')
  })
})

describe('证据：reason 单独摆，其余原样摊开', () => {
  it('reason 从证据列表里摘出去（它是那一行的因果，不是第 N 条读数）', () => {
    const row = displayRows(VOCABULARY, snapshot([
      item({ detail: { reason: '假因果句', groups: [{ userAgents: ['GPTBot'] }], llmsLinkCount: 4 } }),
    ]))[0]
    if (row.kind !== 'item') throw new Error('这一行应该是真行')
    expect(reasonText(row.item)).toBe('假因果句')
    const keys = evidenceLines(row.item).map(line => line.key)
    expect(keys).toEqual(['groups', 'llmsLinkCount'])
    expect(keys).not.toContain('reason')
  })

  it('对象与数组原样字符串化，界面不解释键名（解释一份就是再抄一份判据）', () => {
    const row = displayRows(VOCABULARY, snapshot([
      item({ detail: { recentWindowDays: 90, hasRecentUpdate: false, newestLastmod: '' } }),
    ]))[0]
    if (row.kind !== 'item') throw new Error('这一行应该是真行')
    const lines = evidenceLines(row.item)
    expect(lines.find(l => l.key === 'recentWindowDays')!.value).toBe('90')
    expect(lines.find(l => l.key === 'hasRecentUpdate')!.value).toBe('false')
    expect(lines.find(l => l.key === 'newestLastmod')!.value).toBe('')
  })

  it('没有 detail 时证据那一格整个不摆，而不是摆一条空读数', () => {
    const row = displayRows(VOCABULARY, snapshot([item()]))[0]
    if (row.kind !== 'item') throw new Error('这一行应该是真行')
    expect(evidenceLines(row.item)).toEqual([])
    expect(reasonText(row.item)).toBeNull()
  })
})

describe('计数与头部：四档各报各的，不合并', () => {
  it('四档分开数，absent 另记一档，界面上没有把它们加权的那一步', () => {
    const rows = displayRows(VOCABULARY, snapshot([
      item({ checkKey: 'ai_search_group', verdict: 'PASS' }),
      item({ checkKey: 'training_group', verdict: 'WARN' }),
      item({ checkKey: 'llms_txt', verdict: 'FAIL' }),
    ]))
    expect(verdictCounts(rows)).toEqual({ PASS: 1, WARN: 1, FAIL: 1, NOT_MEASURED: 0, ABSENT: 3 })
  })

  it('有站时头部说清「什么时候测的、测的是哪一套站」', () => {
    const text = headline(snapshot([item({ siteId: 12, measuredAt: '2026-09-29T10:00:00' })]))
    expect(text).toContain('2026-09-29 10:00')
    expect(text).toContain('站点 #12')
  })

  // P6-C 浏览器现场挖出来的：这一条以前钉的是原样 ISO 串（2026-09-29T10:00:00），
  // 等于把 `utils/format.ts` 自己那句注释「后端 LocalDateTime 直出的 ISO 串不能直接渲染」钉成了反例。
  it('时间只走单源格式化：页面上不出现后端那串 ISO', () => {
    expect(headline(snapshot([item({ measuredAt: '2026-09-29T10:00:00' })]))).not.toMatch(/T\d{2}:\d{2}/)
    expect(measuredAtText(item({ measuredAt: '2026-09-29T10:00:00' }))).toBe('2026-09-29 10:00')
    // 读不出时间是读不出：念单元格空占位符那一处（PH_DASH），不冒充一个 1970 也不是留空白
    expect(measuredAtText(item({ measuredAt: null }))).toBe(PH_DASH)
    expect(measuredAtText(null)).toBe(PH_DASH)
  })

  it('超管没选定租户那一态说清「读不出」与出路，不把它写成一次读取失败', () => {
    expect(NO_TENANT_TITLE).toContain('按租户留痕')
    expect(NO_TENANT_NEXT).toContain('选定一个租户')
    // 「不读也不跑」要说出口：这一态下按钮也是压住的，别让人以为按了会跑
    expect(NO_TENANT_NEXT).toContain('既不读也不跑')
  })

  it('没有可测站点时不替客户总结成一句失败，只说这一租户没有对公众开着的站', () => {
    const text = headline(snapshot([item({ siteId: null })]))
    expect(text).toContain('没有对公众开着的站点')
    expect(text).not.toContain('站点 #')
  })

  it('SSR 那一行不享有任何特殊分支：它和别的行一样出结论、一样带因果', () => {
    const rows = displayRows(VOCABULARY, snapshot([
      item({
        checkKey: 'ssr_first_packet',
        verdict: 'FAIL',
        verdictLabel: null,
        detail: { reason: SSR_CAUSAL },
      }),
    ]))
    const ssr = rows.find(row => row.checkKey === 'ssr_first_packet')
    expect(ssr).toBeDefined()
    // 不许把它灰掉（verdictOf 给 null 就是灰掉）、也不许改成「未测量」冒充读不到
    expect(verdictOf(ssr!)).toBe('FAIL')
    expect(verdictLabelOf(VOCABULARY, ssr!)).toBe('假红灯')
    expect(reasonText(ssr!.kind === 'item' ? ssr!.item : null)).toBe(SSR_CAUSAL)
  })

  it('「还没跑过」是一句话而不是一个数：这句话不许被写成 0 分或未通过', () => {
    expect(NEVER_RUN_TITLE).toContain('没有跑过体检')
    expect(NEVER_RUN_TITLE).not.toMatch(/0|分|不通过/)
  })
})
