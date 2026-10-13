import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { routes } from '../index'

/**
 * #233 的第一件事：超管的「换租户」把手要在每一个鉴权后台页都够得着。
 *
 * 现实里这个把手只有一个挂载点——`/workspace` 外壳的顶栏（WorkspaceView 的
 * `<TenantSwitcher v-if="auth.isSuperAdmin" />`）。之所以够用，是因为路由表里所有需要登录的
 * 后台页都挂在这条外壳的 children 下面：菜单是从那组 children 单源生成的，公开页
 * （门户、登录、/brief/:token、/geo-report/:token）则刻意留在最外层、免鉴权。
 *
 * 于是真正要钉的不是「给某个游离页补一个把手」（当前根本没有这样的鉴权游离页），
 * 而是这条会悄悄破掉的不变式：
 *   —— 只要出现一条「需要登录、却不在 /workspace 外壳里」的顶层路由，超管在那一页就没有换租户的把手，
 *      会看见一份和他以为的不一样的数据。
 * 这条用例就是那道闸门：将来谁加了 such 一条路由，它会红，逼着作者当场处理范围可见性。
 */

const workspaceShell = routes.find((route) => route.path === '/workspace')

/** 与路由守卫同口径：matched 里只要有一条 meta.requiresAuth !== false，这一路由就要登录。 */
function requiresAuthTopLevel(route: (typeof routes)[number]): boolean {
  return route.meta?.requiresAuth !== false
}

describe('需要登录的后台页全都在 /workspace 外壳里', () => {
  it('顶层路由中，唯一要鉴权的那一条就是 /workspace 外壳', () => {
    const authenticatedTopLevel = routes.filter(requiresAuthTopLevel).map((route) => route.path)
    // 除 /workspace 外，任何顶层鉴权路由都是一个「没有换租户把手」的后台页——正是这个缺陷的病灶。
    expect(authenticatedTopLevel).toEqual(['/workspace'])
  })

  it('外壳确实带着一组 children（后台页都住在里面，而不是各自漂在顶层）', () => {
    expect(workspaceShell?.children?.length).toBeGreaterThan(0)
  })

  it('children 里没有任何一条自己声明 requiresAuth:false（否则它就成了免登录的后台页）', () => {
    const escaped = (workspaceShell?.children ?? []).filter(
      (child) => child.meta?.requiresAuth === false
    )
    expect(escaped).toEqual([])
  })
})

describe('公开 / 令牌页免鉴权，因而本就不该有换租户把手', () => {
  it.each(['/login', '/brief/:token', '/geo-report/:token', '/p/:slug', '/'])(
    '%s 是免登录的公开页',
    (path) => {
      const route = routes.find((r) => r.path === path)
      expect(route, `路由 ${path} 应存在于顶层`).toBeTruthy()
      expect(route!.meta?.requiresAuth).toBe(false)
    }
  )
})

describe('换租户把手的唯一挂载点就在外壳顶栏', () => {
  it('外壳按超管身份渲染 TenantSwitcher', () => {
    // 从仓库根（vitest root / cwd）解析到那个唯一的挂载点，钉住它确实按超管身份渲染这把把手。
    const shellSource = readFileSync(join(process.cwd(), 'src/views/workspace/WorkspaceView.vue'), 'utf8')
    expect(shellSource).toMatch(/<TenantSwitcher\s+v-if="auth\.isSuperAdmin"\s*\/>/)
  })
})
