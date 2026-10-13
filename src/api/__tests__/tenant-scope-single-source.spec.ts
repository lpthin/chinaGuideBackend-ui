import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tenantScopeHeaders } from '../http'
import { useAuthStore } from '@/stores/auth'

/**
 * #233 的第二件事：「我在替哪家租户看数据」只能有一个来源 —— pinia 的 auth store
 * （selectedTenantId / switchTenant，落盘的键是 selected_tenant_id）。
 *
 * 这里钉两层：
 * 1. 形状层——被点过名的那几个文件里，不许再出现任何一处 localStorage 读写 geocms_tenant_id。
 *    这是一道源码闸门（跟后端 GenerationTaskStatusesTest 那种扫源码的门一个思路）：
 *    留一个「以防万一」的旧键读法，就等于留一条会念旧租户的暗路，而界面上完全看不出来。
 * 2. 行为层——tenantScopeHeaders() 真的只按 store 出号：即便 localStorage 里躺着一枚旧的
 *    geocms_tenant_id，它也一律不读。
 */

// 只匹配「localStorage 直接调方法读/写这个键」那种真用法，注释里提到键名不算回潮。
const LEGACY_SCOPE_READ = /localStorage\s*\.\s*(getItem|setItem|removeItem)\s*\([^)]*geocms_tenant_id/

// 相对仓库根解析各被测文件（沿用 build-page-titles.spec / theme.spec 那档最小 fs 口子，不引 @types/node）。
function sourceOf(relFromRoot: string): string {
  return readFileSync(join(process.cwd(), relFromRoot), 'utf8')
}

const changedFiles: Array<{ label: string; rel: string }> = [
  { label: 'src/api/http.ts', rel: 'src/api/http.ts' },
  { label: 'src/api/knowledge.ts', rel: 'src/api/knowledge.ts' },
  { label: 'src/components/TenantSelect.vue', rel: 'src/components/TenantSelect.vue' },
  { label: 'src/views/LoginView.vue', rel: 'src/views/LoginView.vue' },
]

describe('租户范围的旧键 geocms_tenant_id 已从源码里清干净', () => {
  it.each(changedFiles)('$label 里不再有任何 localStorage 读写 geocms_tenant_id', ({ rel }) => {
    const src = sourceOf(rel)
    expect(src).not.toMatch(LEGACY_SCOPE_READ)
  })

  // 正向对照：闸门不该是空跑——store 仍是 selected_tenant_id 这个唯一键的持有者。
  it('auth store 仍用 selected_tenant_id 作为落盘键（证明上一条不是把断言写空了）', () => {
    const storeSrc = sourceOf('src/stores/auth.ts')
    expect(storeSrc).toContain("'selected_tenant_id'")
    expect(storeSrc).not.toMatch(LEGACY_SCOPE_READ)
  })
})

describe('tenantScopeHeaders 只认 store，不认那枚旧键', () => {
  const auth = useAuthStore()

  beforeEach(() => {
    localStorage.clear()
    auth.user = null
    auth.switchTenant(null)
  })

  it('超管选中租户：发的是 store 里那家，哪怕 localStorage 躺着一枚过期的 geocms_tenant_id', () => {
    auth.user = { id: 1, username: 'admin', roles: ['SUPER_ADMIN'], permissions: [] } as any
    auth.switchTenant(180, 'acme')
    localStorage.setItem('geocms_tenant_id', '1') // 现场那枚一直没跟着刷新、停在 1 的旧键

    expect(tenantScopeHeaders()).toEqual({ 'X-Tenant-Id': '180', 'X-Tenant-Code': 'acme' })
  })

  it('超管平台档（没选租户）：一个租户头都不发，也不去捡那枚旧键', () => {
    auth.user = { id: 1, username: 'admin', roles: ['SUPER_ADMIN'], permissions: [] } as any
    localStorage.setItem('geocms_tenant_id', '1')

    expect(tenantScopeHeaders()).toEqual({})
  })

  it('普通用户：发的是登录态里的 tenantId，不是旧键那一位', () => {
    auth.user = { id: 2, username: 'site', roles: ['SITE_ADMIN'], permissions: [], tenantId: 42 } as any
    localStorage.setItem('geocms_tenant_id', '1') // 过期旧键
    localStorage.setItem('geocms_tenant_code', 'code42')

    expect(tenantScopeHeaders()).toEqual({ 'X-Tenant-Id': '42', 'X-Tenant-Code': 'code42' })
  })
})
