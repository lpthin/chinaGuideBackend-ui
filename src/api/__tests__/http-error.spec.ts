import { describe, it, expect } from 'vitest'
import { describeHttpError, isContainerLevelRejection } from '../http'

function axiosError(partial: Record<string, any>) {
  return Object.assign(new Error(partial?.response?.data?.message || 'Request failed'), { isAxiosError: true }, partial)
}

/**
 * 2026-10-18 M-P37-8 现场量下的原文（`scratch/mp37-8/t4-raw-dump.txt`）：
 * 坏百分号编码、超长请求行、超长单枚请求头三只回的是<em>同一页</em>（正文 SHA1 逐字节相同），
 * 头里没有 `X-Trace-Id` 也没有 `Server`。这一份是判据的唯一夹具来源，不许凭印象编。
 */
const CONTAINER_400_BODY = '<!doctype html><html lang="en"><head><title>HTTP Status 400 – Bad Request</title>'
  + '<style type="text/css">body {font-family:Tahoma,Arial,sans-serif;}</style></head>'
  + '<body><h1>HTTP Status 400 – Bad Request</h1></body></html>'
const CONTAINER_400_HEADERS = { 'content-type': 'text/html;charset=utf-8', 'content-language': 'en' }

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

/**
 * M-P38 拍板①：容器级 400 那一形<b>不改形状</b>（换 ErrorReportValve 是代码改动，本批没验），
 * 只让界面把话说对——这一发不是本系统回的，让人去改地址与请求尺寸，而不是去改表单。
 */
describe('容器级错误页（回的不是自家 {success,code,message,data} 形状）', () => {
  it('现场那一形：不再念「请求参数有误」，念出谁回的和下一步做什么', () => {
    const said = describeHttpError(axiosError({
      response: { status: 400, data: CONTAINER_400_BODY, headers: CONTAINER_400_HEADERS },
    }))
    expect(said).toContain('这一发不是本系统回的话')
    expect(said).toContain('HTTP 400')
    expect(said).toContain('百分号编码')
    expect(said).not.toContain('请求参数有误')
  })

  /**
   * 变异检验：判据若写成「状态码是 400 就算」，这一条会红。
   * 自家业务 400（带 code、没带 message）那句话该照旧念，因为请求<em>真的</em>进了业务处理。
   */
  it('自家 400（JSON 形状、没有 message）仍念「请求参数有误」', () => {
    const said = describeHttpError(axiosError({
      response: { status: 400, data: { success: false, code: 'BAD_REQUEST' }, headers: { 'content-type': 'application/json' } },
    }))
    expect(said).toBe('请求参数有误，请检查后重试')
  })

  /** 变异检验：判据若写成「没有 message 就算」，403 这一条会连带改口 */
  it('自家 403 不受影响', () => {
    expect(describeHttpError(axiosError({
      response: { status: 403, data: { success: false, code: 'FORBIDDEN' }, headers: { 'content-type': 'application/json' } },
    }))).toBe('没有权限执行该操作')
  })

  it('网关 502 的 HTML 错误页也念同一句，但不套用 400 那一句原因', () => {
    const said = describeHttpError(axiosError({
      response: { status: 502, data: '<html><body>502 Bad Gateway</body></html>', headers: { 'content-type': 'text/html' } },
    }))
    expect(said).toContain('这一发不是本系统回的话（HTTP 502）')
    expect(said).not.toContain('百分号编码')
  })

  it('判据本身：无响应/自家形状都判否，只有回体不是自家形状才判是', () => {
    expect(isContainerLevelRejection(undefined)).toBe(false)
    expect(isContainerLevelRejection(axiosError({}))).toBe(false)
    expect(isContainerLevelRejection(axiosError({
      response: { status: 200, data: { success: true, code: 'OK', data: [] }, headers: { 'content-type': 'application/json' } },
    }))).toBe(false)
    // 只有正文是 HTML、头里没带 content-type（axios 在某些代理回包下就是这样）也要认出来
    expect(isContainerLevelRejection(axiosError({
      response: { status: 400, data: CONTAINER_400_BODY, headers: {} },
    }))).toBe(true)
    expect(isContainerLevelRejection(axiosError({
      response: { status: 400, data: CONTAINER_400_BODY, headers: CONTAINER_400_HEADERS },
    }))).toBe(true)
  })
})
