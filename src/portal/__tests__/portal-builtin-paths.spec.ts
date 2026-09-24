import { describe, it, expect } from 'vitest'
import { slugOfPath } from '../portalPath'

/**
 * 内置页短路径 ↔ 前端静态路由的逐字对齐。
 *
 * 后端 PortalUrls.page() 现在按 BuiltInPages 发内置页地址（/about、/jobs…），
 * 而前端只有一条 /p/:slug 兜底路由。少一条静态路由，访客与爬虫就会拿着一个打不开的地址
 * ——历史上的 /jobs 正是这样：后端清单里认它，前端从来没有这条路由。这份清单就是那扇门。
 */
const BUILT_IN_ROUTES: Array<{ path: string; name: string }> = [
  { path: '/', name: 'portal-home' },
  { path: '/about', name: 'portal-about' },
  { path: '/services', name: 'portal-services' },
  { path: '/cases', name: 'portal-cases' },
  { path: '/news', name: 'portal-news' },
  { path: '/contact', name: 'portal-contact' },
  { path: '/jobs', name: 'portal-jobs' }
]

/** import.meta.glob 的参数必须是字面量，所以每个文件各写一次，不封装成函数 */
function readRouterSource() {
  const records = import.meta.glob('../../router/index.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
  return Object.values(records).join('')
}

describe('门户内置页短路径', () => {
  const source = readRouterSource()

  it('每条内置短路径都有一条挂在 PortalDynamicPage 上的静态路由', () => {
    expect(source).toBeTruthy()
    BUILT_IN_ROUTES.forEach(({ path, name }) => {
      const record = new RegExp(`path: '${path}',\\s*name: '${name}',\\s*component: PortalDynamicPage`)
      expect(source, `router/index.ts 里缺 ${name}（${path}）`).toMatch(record)
    })
    // 租户自定义页仍然由 /p/:slug 兜底
    expect(source).toMatch(/path: '\/p\/:slug'/)
  })

  it('短路径反推回 slug，与后端 PortalUrls.slugOfPath 同口径', () => {
    expect(slugOfPath('/')).toBe('home')
    BUILT_IN_ROUTES.slice(1).forEach(({ path }) => {
      expect(slugOfPath(path)).toBe(path.slice(1))
    })
    expect(slugOfPath('/p/zhen-wei')).toBe('zhen-wei')
  })
})
