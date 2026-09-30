import { describe, it, expect, beforeEach } from 'vitest'
import { tenantUnresolvedFromHeaders } from '../http'
import { useAuthStore } from '@/stores/auth'

/**
 * Spec-F §13-13 / P6-B 拍板 A：后端认不出租户时读的是空结果，界面上必须有一句说清
 * 「这一批空是这么来的」。这一位判据来自响应头，所以先钉住「头能不能读到」。
 *
 * 为什么单独钉这一条：axios 把响应头一律转成小写，代码里写成 X-Tenant-Unresolved
 * 就永远读不到——而那次失败在界面上是**静默**的，用户看到的还是一句「这家真的没有数据」。
 */
describe('认不出租户的那一句怎么从响应头走到界面', () => {
  it('axios 那种小写头名读得到', () => {
    expect(tenantUnresolvedFromHeaders({ 'x-tenant-unresolved': '99001' })).toBe('99001')
  })

  it('原样大小写的头名也读得到（后端与网关怎么写不该影响这一句）', () => {
    expect(tenantUnresolvedFromHeaders({ 'X-Tenant-Unresolved': '99001' })).toBe('99001')
  })

  it('没带头就是认出来了，回 null 而不是留着一句旧话', () => {
    expect(tenantUnresolvedFromHeaders({ 'x-new-token': 'abc' })).toBeNull()
    expect(tenantUnresolvedFromHeaders(undefined)).toBeNull()
    expect(tenantUnresolvedFromHeaders(null)).toBeNull()
  })

  it('空串按「没这一句」处理，界面上不念一个空气泡', () => {
    expect(tenantUnresolvedFromHeaders({ 'x-tenant-unresolved': '' })).toBeNull()
  })

  it('非数字的声明原样念：后端没资格替它编一个号', () => {
    expect(tenantUnresolvedFromHeaders({ 'x-tenant-unresolved': 'abc' })).toBe('abc')
  })
})

describe('auth store 上那一位的进出', () => {
  const auth = useAuthStore()

  beforeEach(() => {
    auth.markTenantUnresolved(null)
    auth.switchTenant(null)
  })

  it('后端点名了就记着原串', () => {
    auth.markTenantUnresolved('99001')
    expect(auth.tenantUnresolvedDeclaration).toBe('99001')
  })

  it('换过一次租户后那句「没认出来」自动撤下', () => {
    auth.markTenantUnresolved('99001')
    auth.switchTenant(15, 'dental')
    expect(auth.tenantUnresolvedDeclaration).toBeNull()
  })

  it('清空选择（看全部租户）也把那句撤下', () => {
    auth.markTenantUnresolved('99001')
    auth.switchTenant(null)
    expect(auth.tenantUnresolvedDeclaration).toBeNull()
    expect(localStorage.getItem('selected_tenant_id')).toBeNull()
  })
})
