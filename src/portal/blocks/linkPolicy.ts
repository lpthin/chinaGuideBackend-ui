/**
 * 区块链接的取值规则（纯函数，便于单测）。
 *
 * 链接一律来自后端或站点配置：站内路径交给 router，站外只放行 http(s)，
 * javascript: / data: 这类协议在这里就被判为「无链接」，组件不会渲染成可点元素。
 */

export function isInternalPath(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')
}

export function safeExternal(url: string | null | undefined): string {
  if (typeof url !== 'string') return ''
  const value = url.trim()
  return /^https?:\/\//i.test(value) ? value : ''
}

export interface ResolvedLink {
  kind: 'route' | 'external' | 'none'
  /** kind=route 时是 { path, query }；external 时是完整 URL */
  target: string | { path: string; query?: Record<string, string> } | null
}

/** '/news?category=公司动态' 里的中文查询参数在浏览器里已经是解码态，直接拆即可 */
export function resolveLink(url: string | null | undefined): ResolvedLink {
  if (typeof url !== 'string' || !url.trim()) {
    return { kind: 'none', target: null }
  }
  const value = url.trim()
  if (isInternalPath(value)) {
    const [path, query] = value.split('?')
    if (!query) {
      return { kind: 'route', target: { path } }
    }
    const parsed = new URLSearchParams(query)
    return { kind: 'route', target: { path, query: Object.fromEntries(parsed.entries()) } }
  }
  const external = safeExternal(value)
  return external ? { kind: 'external', target: external } : { kind: 'none', target: null }
}
