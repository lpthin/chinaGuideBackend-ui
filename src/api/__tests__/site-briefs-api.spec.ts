import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 需求单与词表接口的路径契约（Spec §5）。
 *
 * 这里钉的是「端点长得对」：需求单的读写全在 /admin 下（超管口），
 * 租户侧只有那一份词表读口（鉴权只到「登录」）；`summary-preview` 只回后端渲染的那段话。
 * 词表单源（I-1）那条由 `views/portal/__tests__/site-brief-vocabulary.spec.ts` 扫源码守，
 * 不重复在这里。
 */

const calls: Array<[string, unknown[], string]> = []

vi.mock('../http', () => ({
  default: {
    get: (...args: unknown[]) => (calls.push(['get', args, ''])),
    post: (...args: unknown[]) => (calls.push(['post', args, ''])),
    put: (...args: unknown[]) => (calls.push(['put', args, '']))
  }
}))

import { siteBriefsApi, vocabularyApi, findProfileQuestion, briefAnswerRows, showcaseBatchLineOf, type SiteBrief, type SiteBriefForm, type SiteBriefVocabulary } from '../siteBriefs'

function lastCall(): { method: string; url: string; rest: unknown[] } {
  const entry = calls[calls.length - 1]
  return { method: entry[0], url: String(entry[1][0]), rest: entry[1].slice(1) }
}

beforeEach(() => {
  calls.length = 0
})

describe('需求单端点形状', () => {
  it('词表两份：超管口喂需求单，/portal/vocabulary 喂站点画像下拉', async () => {
    await vocabularyApi.adminVocabulary()
    expect(lastCall()).toEqual({ method: 'get', url: '/admin/site-briefs/vocabulary', rest: [] })

    await vocabularyApi.portalVocabulary()
    expect(lastCall()).toEqual({ method: 'get', url: '/portal/vocabulary', rest: [] })
  })

  it('列表按租户与状态过滤；空串/空白不往 query 里塞', async () => {
    await siteBriefsApi.list({ tenantId: 3, status: 'draft' })
    expect(lastCall()).toEqual({ method: 'get', url: '/admin/site-briefs', rest: [{ params: { tenantId: 3, status: 'draft' } }] })

    await siteBriefsApi.list({ tenantId: null, status: '  ' })
    expect(lastCall()).toEqual({ method: 'get', url: '/admin/site-briefs', rest: [{ params: { tenantId: undefined, status: undefined } }] })

    await siteBriefsApi.list()
    expect(lastCall()).toEqual({ method: 'get', url: '/admin/site-briefs', rest: [{ params: { tenantId: undefined, status: undefined } }] })
  })

  it('POST 建单、PUT 改单、summary-preview 都打同一份 payload 形状', async () => {
    // 后端 SiteBriefForm 是平铺字段（没有 selections 袋）：三个写口共用同一份形状，接口层原样转发
    const payload: SiteBriefForm = {
      tenantId: 3,
      status: 'draft',
      candidateCount: 2,
      demoContentMode: 'full',
      industry: '入境旅游',
      subIndustry: null,
      audiences: ['采购商'],
      primaryGoal: 'inquiry',
      mustHave: ['cases'],
      tone: 'professional',
      languages: ['zh-CN'],
      scale: 'standard',
      avoid: [],
      channels: [],
      businessModel: null,
      brandColor: null,
      referenceUrls: [],
      notes: null
    }
    await siteBriefsApi.create(payload)
    expect(lastCall()).toEqual({ method: 'post', url: '/admin/site-briefs', rest: [payload] })

    await siteBriefsApi.update(12, payload)
    expect(lastCall()).toEqual({ method: 'put', url: '/admin/site-briefs/12', rest: [payload] })

    await siteBriefsApi.summaryPreview(payload)
    expect(lastCall()).toEqual({ method: 'post', url: '/admin/site-briefs/summary-preview', rest: [payload] })
  })

  it('单条读取走 id 路径', async () => {
    await siteBriefsApi.get(7)
    expect(lastCall()).toEqual({ method: 'get', url: '/admin/site-briefs/7', rest: [] })
  })
})

describe('findProfileQuestion：profile 下拉的取值范围 = questions + siteProfile 两处都查得到', () => {
  const vocabulary = {
    questions: [
      { key: 'industry', label: '行业', select: 'cascade', required: true, options: [{ code: 'a', label: '甲' }] },
      { key: 'audiences', label: '主要客户', select: 'multi', required: false, options: [{ code: 'b', label: '乙' }] },
      { key: 'languages', label: '主语言', select: 'single', required: true, options: [{ code: 'zh-CN', label: '中' }] }
    ],
    siteProfile: [
      { key: 'regions', label: '目标市场', select: 'multi', required: false, options: [{ code: 'cn', label: '中国大陆' }] },
      { key: 'business_models', label: '商业模式', select: 'multi', required: false, options: [{ code: 'saas', label: 'SaaS授权' }] }
    ],
    candidateMaxCount: 3,
    demoContentModes: [],
    statusLabels: {}
  } as unknown as SiteBriefVocabulary

  it('13 题里的题在 questions 命中', () => {
    expect(findProfileQuestion(vocabulary, 'industry')?.select).toBe('cascade')
    expect(findProfileQuestion(vocabulary, 'audiences')).not.toBeNull()
    expect(findProfileQuestion(vocabulary, 'languages')).not.toBeNull()
  })

  it('画像专用词表（regions / business_models）在 siteProfile 命中——只在 questions 找会误报「没这道题」', () => {
    expect(findProfileQuestion(vocabulary, 'regions')).not.toBeNull()
    expect(findProfileQuestion(vocabulary, 'business_models')?.options[0].code).toBe('saas')
    // 反向自验：若只查 questions，这两条一定拿不到
    expect(vocabulary.questions.some(q => q.key === 'regions')).toBe(false)
  })

  it('两处都没有才回 null（调用方据此诚实降级，不编选项）', () => {
    expect(findProfileQuestion(vocabulary, 'nope')).toBeNull()
    expect(findProfileQuestion(null, 'industry')).toBeNull()
  })
})

describe('axios 实例 baseURL 已是 /api', () => {
  it('源码里没有一个请求路径以 /api 开头（写成 /api/xxx 会请求成 /api/api/xxx）', () => {
    const raw = import.meta.glob('../siteBriefs.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    const source = Object.values(raw).join('')
    const offenders = [...source.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])
    expect(offenders).toEqual([])
    // 反向自验：这条正则认得出旧毛病
    expect(/['"]\/api\/[^'"]*['"]/g.test("http.get('/api/admin/site-briefs')")).toBe(true)
  })
})

/**
 * 详情读回那一族（10-16 走查现场）：这四种格子在词表里【没有】选项码，
 * 一旦被扔进「按选项码翻名」那一条路，界面上就是
 * 「[object Object]、[object Object]」和每行尾巴一句「（词表里已经没有这个码了）」——
 * 客户的原话被念坏，还顺手报警说码丢了。
 */
describe('briefAnswerRows：自由文本 / 颜色 / 区块顺序 / 页面清单逐字读回', () => {
  const vocabulary = {
    questions: [
      { key: 'audience_note', label: '目标用户是谁（客户原话）', select: 'textarea', required: false, options: [] },
      { key: 'brand_color', label: '品牌主色', select: 'color', required: false, options: [{ code: 'ai', label: '交给 AI 定' }] },
      { key: 'home_layout', label: '首页区块顺序', select: 'block-order', required: false, options: [] },
      { key: 'page_plan', label: '页面清单（客户点名要哪些页）', select: 'pages', required: false, options: [] },
      { key: 'audiences', label: '主要客户', select: 'multi', required: false, options: [{ code: 'distributor', label: '经销商' }] }
    ],
    siteProfile: [],
    candidateMaxCount: 3,
    demoContentModes: [],
    statusLabels: {}
  } as unknown as SiteBriefVocabulary

  const brief = {
    id: 462,
    tenantId: 326,
    audienceNote: '欧美中小型五金经销商的采购负责人，习惯先查官网再发询盘',
    brandColor: '#1B3A5C',
    homeLayout: ['case-grid', 'cta-band', 'inquiry-form'],
    pagePlan: [
      { key: 'home', slug: 'home', title: '纳欣精密制造 · 精密冲压件出口' },
      { key: 'contact', slug: 'contact', title: '联系我们' },
      { key: 'cases', slug: 'cases', title: '', purpose: '案例页' }
    ],
    audiences: ['distributor']
  } as unknown as SiteBrief

  function row(key: string) {
    return briefAnswerRows(vocabulary, brief).find(item => item.key === key)!
  }

  it('textarea 与 color：库里存什么就念什么，且不报警「码丢了」', () => {
    expect(row('audience_note').value).toBe('欧美中小型五金经销商的采购负责人，习惯先查官网再发询盘')
    expect(row('audience_note').unknown).toBe(false)
    expect(row('brand_color').value).toBe('#1B3A5C')
    expect(row('brand_color').unknown).toBe(false)
  })

  it('block-order：按顺序用箭头连，不查本题选项（区块名不在词表这一格）', () => {
    expect(row('home_layout').value).toBe('case-grid → cta-band → inquiry-form')
    expect(row('home_layout').unknown).toBe(false)
  })

  it('pages：逐页念「标题（/网址段）」，标题空了退回 key，不许冒出 [object Object]', () => {
    const value = row('page_plan').value
    expect(value).toBe('纳欣精密制造 · 精密冲压件出口（/home）、联系我们（/contact）、cases（/cases）')
    expect(value).not.toContain('[object Object]')
    expect(row('page_plan').unknown).toBe(false)
  })

  it('反向自验：勾选题照旧要翻名，没翻到才报警——这条闸不是给所有格子开的', () => {
    expect(row('audiences').value).toBe('经销商')
    expect(row('audiences').unknown).toBe(false)
    const bad = { ...brief, audiences: ['ghost'] } as unknown as SiteBrief
    const rows = briefAnswerRows(vocabulary, bad)
    expect(rows.find(item => item.key === 'audiences')?.unknown).toBe(true)
  })
})

/**
 * 「演示内容这一格里正在写第几批」那一句人话（Spec-M M-P35-2）。
 *
 * 这一句是等待面三处（向导第 3/4 步、候选画廊、总览页）共用的<b>唯一出处</b>——同一趟在两个页面上
 * 一个说「第 3/7 批」一个不说，就等于界面上两句话打架（I-1）。所以这里钉的是形状本身：
 * 后端那四种「不该念」的情况回的是 null，界面拿到 null 就整行不摆，不许兜「第 ? 批」也不许兜 0。
 */
describe('showcaseBatchLineOf：分批那一格只有一份句子，读不到就返回 null', () => {
  it('批号、总批数、类别名、这一批的等待都在：拼成一句带四个读数的话', () => {
    const line = showcaseBatchLineOf({
      showcaseBatchIndex: 3,
      showcaseBatchTotal: 7,
      showcaseBatchLabel: '资质荣誉',
      showcaseBatchWaitMs: 40_000
    })
    expect(line).toBe('这一格里分批在写：第 3/7 批 · 资质荣誉 · 这一批已经等了 约 40 秒')
  })

  it('没回批号就是「这一趟没在分批写」：整句返回 null，界面那一格不摆', () => {
    expect(showcaseBatchLineOf({})).toBeNull()
    // 终态/别的阶段时后端那四格回 null；这里造出「第 ? 批」就是把没在跑说成在跑
    expect(showcaseBatchLineOf({ showcaseBatchIndex: null, showcaseBatchTotal: 7, showcaseBatchLabel: '资质荣誉' })).toBeNull()
    expect(showcaseBatchLineOf({ showcaseBatchTotal: 7 })).toBeNull()
  })

  it('只有批号时其余三格各说各的「没回」，不兜 0 也不留空白', () => {
    const line = showcaseBatchLineOf({ showcaseBatchIndex: 2 }) as string
    expect(line).toContain('第 2/? 批')
    expect(line).toContain('后端这一发没回这一类叫什么')
    expect(line).toContain('后端这一发没回时长读数（不是 0 秒）')
    expect(line).not.toContain('约 0 秒')
  })
})
