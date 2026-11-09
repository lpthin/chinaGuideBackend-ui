import { describe, it, expect } from 'vitest'
import { routes } from '../../router'

/**
 * 读失败度量页是治理工具，只给平台（超管）看（SPEC-UI-9 B2）。
 *
 * 原来它只有 `hidden: true`——不进菜单，但任何登录用户敲地址都能进，
 * 一览全是接口路径、页面路径与错误原文。所以这里钉两件事：
 * 1. 档位必须落在 meta 上（`requiresSuperAdmin`）；
 * 2. 非授权要按「页面不存在」处理（`notFoundIfForbidden`），不许弹「无权限」
 *    把「这里有个内部看板」告诉对方。
 */
const metrics = routes
  .find(route => route.path === '/workspace')!
  .children!.find(child => child.path === 'dev/metrics')!

describe('读失败度量页只给平台账号', () => {
  it('路由挂上了超管档位与 404 降级标记', () => {
    const meta = (metrics.meta ?? {}) as Record<string, unknown>
    expect(meta.requiresSuperAdmin).toBe(true)
    expect(meta.notFoundIfForbidden).toBe(true)
  })

  it('仍然不进菜单、不计入页面浏览分母', () => {
    const meta = (metrics.meta ?? {}) as Record<string, unknown>
    expect(meta.hidden).toBe(true)
  })
})
