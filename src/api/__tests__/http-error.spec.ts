import { describe, it, expect } from 'vitest'
import { describeHttpError } from '../http'

function axiosError(partial: Record<string, any>) {
  return Object.assign(new Error(partial?.response?.data?.message || 'Request failed'), { isAxiosError: true }, partial)
}

describe('describeHttpError', () => {
  it('优先透出后端返回的中文业务文案', () => {
    const error = axiosError({
      response: { status: 200, data: { message: '仅审核通过的文章可发布' } },
    })
    expect(describeHttpError(error)).toBe('仅审核通过的文章可发布')
  })

  it('网关/HTTP 状态翻译成中文，不暴露 axios 英文原文', () => {
    expect(describeHttpError(axiosError({ response: { status: 502 } }))).toContain('502')
    expect(describeHttpError(axiosError({ response: { status: 403 } }))).toBe('没有权限执行该操作')
  })

  it('网络不通时说「无法连接服务器」，不透出 Network Error', () => {
    const error = Object.assign(new Error('Network Error'), { isAxiosError: true })
    expect(describeHttpError(error)).toBe('无法连接服务器，请确认后端已启动')
  })

  it('拦截器转抛的业务错误（无 HTTP 状态）保留后端中文文案', () => {
    expect(describeHttpError(new Error('请先选择租户'))).toBe('请先选择租户')
  })

  it('超时不显示英文 timeout', () => {
    expect(describeHttpError(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })))
      .toContain('请求超时')
  })

  it('未知输入不至于崩溃', () => {
    expect(describeHttpError(undefined)).toBe('无法连接服务器，请确认后端已启动')
  })
})
