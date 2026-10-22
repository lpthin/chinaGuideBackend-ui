import { describe, it, expect } from 'vitest'
import { routes } from '../../router'
import { buildMenuSections, collectMenuLeaves } from '../../navigation/workspaceMenu'

/**
 * 「页面巡检」这一屏只给平台看（2026-10-22 产品口径：租户那边不应该看到页面巡检）。
 *
 * 原来这一屏只判权限码，而码是可以在「角色管理」里授给任何角色的（`RoleController.assignPermissions`
 * 只判点授权的人是不是超管）——码一授出去，租户敲地址就进得来，侧栏却因为它归平台段仍然不显示，
 * 于是变成「看不见但进得去」那一形。所以这一条要钉的是<em>档位</em>，不是码。
 *
 * 后端同一条口径在 `PortalHealthController` / `SiteValidationController` 每一句第一行的
 * `AdminAuthUtils.checkSuperAdmin()`（用例：`PortalHealthPlatformOnlyGateTest`）。
 */

const leaves = collectMenuLeaves(routes)
const health = routes.find(route => route.path === '/workspace')!.children!
  .find(child => child.path === 'portal/health')!

/** 词表说这些栏目都开着，免得「栏目未开通」把别的原因混进来 */
const ALL_OPEN = new Set(leaves.flatMap(leaf => (leaf.contentEntry ? [leaf.contentEntry] : [])))

/** 最坏那一形：租户管理员被误授了巡检码 */
const TENANT_WITH_HEALTH = {
  isSuperAdmin: false,
  hasPermission: (code: string) => code === 'portal:build:health' || code === 'portal:build:manage',
  openContentEntries: ALL_OPEN
}

const TENANT_PLAIN = {
  isSuperAdmin: false,
  // 与 workspace-menu.spec.ts 那份同源：库里现读 SITE_ADMIN 真持有的那几码，一个 portal:build:* 都不给
  hasPermission: (code: string) => ['portal:siteinfo:manage', 'portal:page:manage', 'media:manage',
    'analytics:view', 'portal:ticket:submit', 'case:manage', 'operation:case:view'].includes(code),
  openContentEntries: ALL_OPEN
}

describe('页面巡检是平台专用的那一屏', () => {
  it('路由 meta 上档位与码都在，缺档位就等于把口径押在一次配置不出错', () => {
    const meta = (health.meta ?? {}) as Record<string, unknown>
    expect(meta.requiredPermission).toBe('portal:build:health')
    expect(meta.requiresSuperAdmin).toBe(true)
  })

  it('被误授了码的租户，菜单里也摆不出这一项（侧栏按档位与归属段过滤，不按码）', () => {
    const labels = buildMenuSections(leaves, TENANT_WITH_HEALTH)
      .flatMap(section => section.groups.flatMap(group => group.items.map(item => item.label)))
    expect(labels).not.toContain('页面巡检')
  })

  it('只拿租户日常那几码的人看得到自己的页面，也仍然看不到巡检（不是「一行都没有」蒙绿的）', () => {
    const sections = buildMenuSections(leaves, TENANT_PLAIN)
    const labels = sections.flatMap(section => section.groups.flatMap(group => group.items.map(item => item.label)))
    expect(labels.length, '这一趟什么都没渲染，说明可见性夹具写错了，那「不含巡检」就不算证到').toBeGreaterThan(0)
    expect(labels).not.toContain('页面巡检')
  })
})
