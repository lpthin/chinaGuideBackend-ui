/**
 * 访客地址 → 页面 slug 的换算，必须与后端 {@code site/PortalUrls.java} 的 slugOfPath 保持一致。
 *
 * 单独抽一个文件是因为门户 URL 有若干内置短路径 + 一个 /p/ 前缀，抄两份迟早对不上；
 * 对不上的后果是访客点得到、程序取不到（后端按 slug 查页面），页面模型一开就整站 404。
 */
export const PAGE_PATH_PREFIX = '/p/'

export function slugOfPath(path: string | null | undefined): string {
  const value = (path ?? '').trim()
  if (!value || value === '/') {
    return 'home'
  }
  if (value.startsWith(PAGE_PATH_PREFIX)) {
    return decodeURIComponent(value.slice(PAGE_PATH_PREFIX.length))
  }
  const segment = value.replace(/^\//, '').split('/')[0]
  return segment || 'home'
}
