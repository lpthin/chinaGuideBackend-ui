import { describe, it, expect } from 'vitest'
import { safeInternalPath, DEFAULT_AFTER_LOGIN } from '../redirect'

/**
 * SPEC-UI-7 U2：登录回跳来自地址栏，必须挡住开放重定向。
 * 判据只认「以单个 / 开头的站内路径」，别的一律回工作台。
 */
describe('safeInternalPath', () => {
  it('站内路径原样放行（含查询串）', () => {
    expect(safeInternalPath('/workspace/audit-log?page=2&size=20')).toBe('/workspace/audit-log?page=2&size=20')
    expect(safeInternalPath('/workspace/billing/orders')).toBe('/workspace/billing/orders')
  })

  it.each([
    ['外站协议', 'https://evil.example/login'],
    ['协议相对地址', '//evil.example/login'],
    ['反斜杠绕过', '/\\evil.example/login'],
    ['不带前导斜杠', 'workspace/dashboard'],
  ])('%s 一律回工作台', (_label, raw) => {
    expect(safeInternalPath(raw)).toBe(DEFAULT_AFTER_LOGIN)
  })

  it('数组取第一个（vue-router 的 query 可能是数组）', () => {
    expect(safeInternalPath(['/workspace/a', '/workspace/b'])).toBe('/workspace/a')
    expect(safeInternalPath(['//evil.example'])).toBe(DEFAULT_AFTER_LOGIN)
  })

  it('空值回工作台；调用方传空兜底时也能保持空串', () => {
    expect(safeInternalPath(undefined)).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeInternalPath(null)).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeInternalPath('')).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeInternalPath('//evil.example', '')).toBe('')
  })
})
