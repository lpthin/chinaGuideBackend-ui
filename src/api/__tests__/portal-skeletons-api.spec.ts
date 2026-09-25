import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 骨架接口（Spec §5.2 / Q2）的两类契约：
 * 1. 请求形状——路径不带 /api、骨架 key 一律 encodeURIComponent、apply 的 confirm 是一个显式参数
 *    （后端把 dry-run 与执行分成两次请求，前端不许一个按钮默默二合一）；
 * 2. I-1 单源——骨架 key 清单、区块 key 清单、状态中文说法都不许在这几个新文件里出现第二份。
 */

const httpMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../http', () => ({ default: httpMock }))

import { portalSkeletonsApi } from '../portalSkeletons'

beforeEach(() => {
  httpMock.get.mockReset()
  httpMock.post.mockReset()
  httpMock.get.mockResolvedValue([])
  httpMock.post.mockResolvedValue({})
})

describe('骨架接口路径与 body', () => {
  it('列表与状态词表都是 /admin 下的只读口，路径不带 /api', async () => {
    await portalSkeletonsApi.list()
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal/skeletons')

    await portalSkeletonsApi.statusLabels()
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal/skeletons/statuses')
  })

  it('逐页清单按 key 取，key 走 URL 编码', async () => {
    await portalSkeletonsApi.pages('corporate base/../x')
    expect(httpMock.get).toHaveBeenLastCalledWith(
      '/admin/portal/skeletons/' + encodeURIComponent('corporate base/../x') + '/pages'
    )
  })

  it('apply 是两段式：body 里的 confirm 就是调用方传进来的那一个布尔值', async () => {
    await portalSkeletonsApi.apply(7, 'corporate-base', false)
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/sites/7/apply-skeleton', {
      skeletonKey: 'corporate-base',
      confirm: false
    })

    await portalSkeletonsApi.apply(7, 'corporate-base', true)
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/sites/7/apply-skeleton', {
      skeletonKey: 'corporate-base',
      confirm: true
    })
    // dry-run 与执行必须是两次调用，谁都没办法一次点完全套流程
    expect(httpMock.post.mock.calls).toHaveLength(2)
  })
})

describe('参考站 → 骨架沉淀与审核', () => {
  it('沉淀打到那一个参考站任务上，入参原样带过去（可空的字段就是 null，不让后端猜）', async () => {
    await portalSkeletonsApi.distill(12, { skeletonKey: null, name: '从乙站洗出来的一套', description: null })
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal/reference-sites/12/distill-skeleton', {
      skeletonKey: null,
      name: '从乙站洗出来的一套',
      description: null
    })

    await portalSkeletonsApi.distill(12, {})
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal/reference-sites/12/distill-skeleton', {})
    // 沉淀这一发不会顺手把骨架发布掉：它只 POST 了 distill-skeleton 这一个地址
    expect(httpMock.post.mock.calls.map(call => call[0])).toEqual([
      '/admin/portal/reference-sites/12/distill-skeleton',
      '/admin/portal/reference-sites/12/distill-skeleton'
    ])
  })

  it('待审清单是后端那一个专用读口，前端不在这里筛状态', async () => {
    await portalSkeletonsApi.pending()
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal/skeletons/pending')
  })

  it('发布与退役是两个端点、key 走编码，且互不自动触发', async () => {
    await portalSkeletonsApi.publish('ref 12/../x')
    expect(httpMock.post).toHaveBeenCalledTimes(1)
    expect(httpMock.post).toHaveBeenLastCalledWith(
      `/admin/portal/skeletons/${encodeURIComponent('ref 12/../x')}/publish`
    )
    // 点发布不会自己接一步退役（退役同样是独立的一次确认、独立的一发）
    expect(httpMock.post.mock.calls[0][0]).not.toContain('/retire')

    await portalSkeletonsApi.retire('ref-12')
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal/skeletons/ref-12/retire')
    expect(httpMock.post.mock.calls).toHaveLength(2)
  })
})

/** Q2 新建的这几个文件：从头到尾只该读接口 */
const scanned = import.meta.glob(
  ['../portalSkeletons.ts', '../../portal/blocks/blockDemo.ts', '../../views/portal/BlockShowcaseView.vue',
    '../../views/portal/SkeletonLibraryView.vue', '../../views/portal/SiteBuildWorkbenchView.vue'],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

const raw = Object.values(scanned).join('\n')

describe('I-1：前端不抄第二份清单与词表', () => {
  it('扫到了文件本身（路径写错会让这条用例静默通过）', () => {
    expect(Object.keys(scanned).length).toBe(5)
  })

  it('没有区块 key / 骨架 key 的键值清单', () => {
    const keys = ['hero', 'news-list', 'site-header', 'site-footer', 'service-cards', 'case-grid', 'case-list',
      'about-rich', 'text-band', 'team-grid', 'stats-band', 'logo-wall', 'cta-band', 'contact-block',
      'banner-carousel', 'job-list', 'inquiry-form', 'corporate-base', 'content-first', 'lead-gen'].join('|')
    // 形如 'hero': / "news-list": 的写法就是第二份清单（渲染器白名单只在前端 registry.ts 里按 rendererKey 登记）
    expect(new RegExp(`['"\`](${keys})['"\`]\\s*:`, 'm').test(raw.replace(/\\'/g, ''))).toBe(false)
  })

  it('没有状态中文常量的第二份来源（中文说法只有 /admin/portal/skeletons/statuses）', () => {
    expect(raw).not.toMatch(/['"]已发布['"]|['"]草稿['"]|['"]已退役['"]/)
  })

  it('也没有拿状态英文值和字面量比对（待审清单是后端筛好的，界面不自己判状态）', () => {
    expect(raw).not.toMatch(/status\s*===?\s*['"](draft|published|retired)['"]/)
  })

  it('请求路径里没有多余的 /api 前缀（axios baseURL 已经带 /api）', () => {
    const skeletonSource = Object.entries(scanned)
      .filter(([path]) => path.endsWith('portalSkeletons.ts'))
      .map(([, text]) => text)
      .join('')
    expect([...skeletonSource.matchAll(/['"`]\/api\/[^'"`]*['"`]/g)].map(match => match[0])).toEqual([])
  })
})
