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

import { siteBriefsApi, vocabularyApi, findProfileQuestion, type SiteBriefForm, type SiteBriefVocabulary } from '../siteBriefs'

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
