/**
 * 登录回跳只认站内绝对路径（SPEC-UI-7 U2）。
 *
 * `?redirect=` 来自地址栏，谁都能改：放行 `//evil.com` 或 `https://evil.com`
 * 就是把登录页做成开放重定向。这里只放行以单个 `/` 开头、且不接 `//`、`/\` 的路径。
 */
export const DEFAULT_AFTER_LOGIN = '/workspace/dashboard'

export function safeInternalPath(raw: unknown, fallback = DEFAULT_AFTER_LOGIN): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || value === '') return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
