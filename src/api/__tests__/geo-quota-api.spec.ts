import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GEO 池水位的两口契约（V158 / Spec-G N2 拍板）。
 *
 * 钉的是「前端这两条路径与形状跟后端源码一模一样」，逐字取自
 * `billing/GeoQuotaAdminController`：`@RequestMapping("/api/admin/geo-quota")` +
 * 裸 `@GetMapping`（`?tenantId=`）与裸 `@PutMapping`（`@RequestBody SetForm(tenantId, monthlyTokenQuota)`）。
 * http 层的 baseURL 是 `/api`，所以这里断言的是去掉 `/api` 之后那一段。
 *
 * 第二条钉的是 N2 那一寸：<b>留空提交 null，不提交 0</b>。
 * 「不限制」在库里就是那一列为 NULL，0 是「上限为零、一分钱都花不了」，
 * 前端替人兜一个 0 出去，就把一次「放开限制」的点击变成了一次「把这个租户锁死」。
 */

const calls: Array<{ method: string; args: unknown[] }> = []

vi.mock('../http', () => ({
  default: {
    get: (...args: unknown[]) => calls.push({ method: 'get', args }),
    put: (...args: unknown[]) => calls.push({ method: 'put', args }),
  },
}))

import { geoQuotaApi } from '../geoQuota'

function last(): { method: string; url: string; rest: unknown[] } {
  const entry = calls[calls.length - 1]
  return { method: entry.method, url: String(entry.args[0]), rest: entry.args.slice(1) }
}

beforeEach(() => {
  calls.length = 0
})

describe('读口：这一池现在生效的是哪一个数', () => {
  it('GET /admin/geo-quota?tenantId=15 —— 必须点名租户（这一池是按租户分账的）', async () => {
    await geoQuotaApi.status(15)
    expect(last()).toEqual({ method: 'get', url: '/admin/geo-quota', rest: [{ params: { tenantId: 15 } }] })
  })
})

describe('写口：设这个租户的水位', () => {
  it('PUT /admin/geo-quota，body 只有后端 SetForm 那两根字段', async () => {
    await geoQuotaApi.set({ tenantId: 15, monthlyTokenQuota: 200000 })
    expect(last()).toEqual({
      method: 'put',
      url: '/admin/geo-quota',
      rest: [{ tenantId: 15, monthlyTokenQuota: 200000 }],
    })
  })

  it('「清空 = 不限制」交出去的是 null，不是 0，也不是干脆不带这一根', async () => {
    await geoQuotaApi.set({ tenantId: 15, monthlyTokenQuota: null })
    const body = last().rest[0] as Record<string, unknown>
    // 这一条钉的是「不许顺手兜一个 0」：0 是「上限为零、一分钱花不了」，
    // 一次「放开限制」的点击若被兜成 0，就变成了把这个租户锁死
    expect(Object.keys(body)).toContain('monthlyTokenQuota')
    expect(body.monthlyTokenQuota).toBeNull()
  })
})
