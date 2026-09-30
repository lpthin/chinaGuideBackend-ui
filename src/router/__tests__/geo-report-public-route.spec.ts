import { describe, it, expect } from 'vitest'
import { router, routes } from '../index'
import { collectMenuLeaves } from '../../navigation/workspaceMenu'

/**
 * 只读外链的路由形状（Spec-G G6，任务 #158）。
 *
 * 这一页是给「拿不到后台账号的人」看的，所以它必须同时满足两件相反的事：
 * 1. <b>免鉴权</b>：`meta.requiresAuth === false`，守卫不许把它踢去登录页
 *    （踢了就等于客户链接开不出报告，G6 整条白做）；
 * 2. <b>进不了后台导航</b>：管理端菜单是从 `/workspace` 的 children 单源生成的
 *    （`navigation/workspaceMenu.ts` 的 `collectMenuLeaves`），所以它只能挂在路由表最外层——
 *    挂进去就得再写一份「隐藏」清单，那正是当年「僵尸路由」长出来的地方。
 *
 * 顺带钉住 `/brief/:token`（Spec-C 的客户选择页）与它是同一条路：
 * 两条公开页共用一套形状，将来加第三条也是照这一份抄，而不是各写各的。
 */

const TOKEN = 'c'.repeat(64)

function topLevel(path: string) {
  return routes.find((route) => route.path === path)
}

describe('只读外链页挂在路由表最外层', () => {
  it('有这一条顶层路由，免鉴权，也不挂任何权限码', () => {
    const route = topLevel('/geo-report/:token')
    expect(route).toBeTruthy()
    expect(route!.name).toBe('geo-report-public')
    expect(route!.meta?.requiresAuth).toBe(false)
    // 令牌本身就是准入凭据：挂权限码等于要求访客有登录态，守卫与后端都不会给他
    expect(route!.meta?.requiredPermission).toBeUndefined()
    expect(route!.meta?.requiresSuperAdmin).toBeUndefined()
  })

  it('它不在 /workspace 的 children 里，所以菜单生成不出来这一条（结构上进不了后台导航）', () => {
    const workspace = topLevel('/workspace')!
    const children = (workspace.children ?? []).map((child) => child.path)
    expect(children.filter((path) => String(path).includes('geo-report'))).toEqual([])
    const leafKeys = collectMenuLeaves(routes).map((leaf) => `${leaf.routeName} ${leaf.key}`)
    expect(leafKeys.filter((entry) => entry.includes('geo-report'))).toEqual([])
  })

  it('解析得出的 matched 只有这一条记录，且 meta 就是那份免鉴权', () => {
    const resolved = router.resolve(`/geo-report/${TOKEN}`)
    expect(resolved.name).toBe('geo-report-public')
    expect(resolved.matched).toHaveLength(1)
    expect(resolved.matched[0].meta.requiresAuth).toBe(false)
    // 令牌是路径里那一段，不是查询串：地址上没有可换成别人家轮次号的位置
    expect(resolved.params.token).toBe(TOKEN)
    expect(resolved.query.runId).toBeUndefined()
  })

  it('跟建站方案确认页是同一条路：公开页只有「顶层 + requiresAuth:false」这一种形状', () => {
    const brief = topLevel('/brief/:token')
    const geo = topLevel('/geo-report/:token')
    expect(brief).toBeTruthy()
    expect(geo).toBeTruthy()
    for (const route of [brief!, geo!]) {
      expect(route.meta?.requiresAuth).toBe(false)
      expect(route.path.startsWith('/')).toBe(true)
    }
    // 公开页不躲在 /workspace 底下：外壳（侧边菜单、租户切换器）本身要登录
    expect(String(geo!.path).startsWith('/workspace')).toBe(false)
  })
})
