import { describe, it, expect } from 'vitest'
import { routes } from '../../router'
import { buildMenuSections, collectMenuLeaves } from '../../navigation/workspaceMenu'

/**
 * 「门户上线」这一屏收成超管专用，租户那一半改看内容工作台（Spec-Q Q7，§4.4）。
 *
 * 这一条钉的是两件事，缺一件都不算到位：
 *
 * 1. 档位挂在路由 meta 上，不是只挂在菜单里。菜单是「看不见」，meta 才是「进不去」——
 *    只改菜单的话，租户敲 `/workspace/portal/launch` 照样进得来，进去以后那一屏的
 *    灌演示包、转正式内容后端全是 `checkSuperAdmin`（AdminTenantController），只能拿到一串 403。
 * 2. 租户仍然看得到「内容工作台」：这一屏撤走的「还差什么才能上线」是搬进那一页的完成度带，
 *    不是搬没了。所以带里那一句和这一页的入口必须同时存在，否则 Q7 就成了「租户再也没有这句提示」。
 */

const leaves = collectMenuLeaves(routes)
const workspaceChildren = routes.find(route => route.path === '/workspace')!.children!
const launch = workspaceChildren.find(child => child.path === 'portal/launch')!
const workbench = workspaceChildren.find(child => child.path === 'portal/content')!

/** 库里现读 SITE_ADMIN 真持有的那几码（与 workspace-menu.spec.ts 同源），一个 portal:build:* 都不给 */
const TENANT_PLAIN = {
  isSuperAdmin: false,
  hasPermission: (code: string) => ['portal:siteinfo:manage', 'portal:page:manage', 'media:manage',
    'analytics:view', 'portal:ticket:submit', 'case:manage', 'operation:case:view'].includes(code),
  openContentEntries: new Set(leaves.flatMap(leaf => (leaf.contentEntry ? [leaf.contentEntry] : [])))
}

const PLATFORM = {
  isSuperAdmin: true,
  hasPermission: () => true,
  openContentEntries: new Set(leaves.flatMap(leaf => (leaf.contentEntry ? [leaf.contentEntry] : [])))
}

function labelsFor(view: typeof TENANT_PLAIN): string[] {
  return buildMenuSections(leaves, view).flatMap(section => section.groups.flatMap(group => group.items))
    .map(item => item.label)
}

describe('门户上线是超管专用的那一屏（Q7）', () => {
  it('路由 meta 上只有档位、没有权限码：这一屏的门是「是不是平台账号」', () => {
    const meta = (launch.meta ?? {}) as Record<string, unknown>
    expect(meta.requiresSuperAdmin).toBe(true)
    expect(meta.requiredPermission).toBeUndefined()
  })

  it('租户菜单里摆不出「门户上线」', () => {
    expect(labelsFor(TENANT_PLAIN)).not.toContain('门户上线')
  })

  it('超管仍然看得到（不是整项删掉，那是撤功能不是收权限）', () => {
    expect(labelsFor(PLATFORM)).toContain('门户上线')
  })

  it('租户看得到「内容工作台」：那句「还差什么才能上线」是搬进那一页，不是搬没了', () => {
    const labels = labelsFor(TENANT_PLAIN)
    expect(labels.length, '这一趟什么都没渲染，说明可见性夹具写错了，那「含工作台」就不算证到').toBeGreaterThan(0)
    expect(labels).toContain('内容工作台')
  })

  it('内容工作台那一码没变：搬了话术不能顺手把门也挪了', () => {
    expect((workbench.meta as Record<string, unknown>).requiredPermission).toBe('portal:siteinfo:manage')
    expect((workbench.meta as Record<string, unknown>).requiresSuperAdmin).toBeUndefined()
  })
})
