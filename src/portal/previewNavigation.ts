/**
 * 整站预览的「翻页还带着这一枚令牌」那一半（任务 #53）。
 *
 * 为什么需要这一层：站级预览令牌（作用域 {@code site:{id}}，候选站那一档）授权的是<em>这一整套站</em>，
 * 而后端认站点先认令牌、再认域名/`?site=`（{@code SiteVisibilityGuard#targetSite}）。
 * 令牌一旦只在首页那条 URL 上活着，客户点一下导航就变成「访问域名未绑定站点」——
 * 「链接点得开、第二页就死」是这一档预览最容易演成半成品的地方。
 *
 * 两条纪律：
 * 1. 记的只有<em>整站级</em>那一条令牌。逐页预览（{@code page:{id}}）的授权范围就是一页，
 *    把它续到别的页面等于自动扩权，那种事一次都不能有（{@code useReviewMode} 顶部那条老纪律的来处）；
 * 2. 状态只活在内存里、不落 sessionStorage：关标签即失效，与「令牌只从地址栏读」口径一致。
 *    URL 才是这份状态的载体，这里只是替路由把那一段补回去。
 */
import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'
import { PREVIEW_TOKEN_PARAM } from './api/portalPublic'

/**
 * 不该被补上预览令牌的那几张面：工作台与登录是管理侧，`/brief/` 那条客户选择页
 * 自己的令牌在<em>路径</em>里（拍板 10），两种令牌混进同一条查询参数就是给自己埋雷。
 */
const NON_PORTAL_PREFIXES = ['/workspace', '/login', '/admin', '/brief/']

let siteScopedToken: string | null = null

/** 只有确认过作用域是整站的那一条令牌才配被续上（{@code useReviewMode} 取到 /context 之后调用） */
export function rememberSitePreviewToken(token: string | null): void {
  siteScopedToken = token && token.trim() ? token.trim() : null
}

/** 当前这一轮整站预览用的令牌；没有就是空串 */
export function sitePreviewToken(): string {
  return siteScopedToken || ''
}

function isPortalPath(path: string): boolean {
  const value = path || '/'
  return !NON_PORTAL_PREFIXES.some(prefix => value.startsWith(prefix))
}

/**
 * 路由守卫用的那一句：整站预览进行中、目标又是门户那一路且地址栏还没令牌时，
 * 把同一枚令牌补进查询参数（返回替换目标）；其余情况一律返回 undefined，不改这次导航。
 *
 * 返回类型写成 vue-router 的 RouteLocationRaw 而不是自造的形状：守卫里 `return carried`
 * 就是要交给 router 处理的形状，自己拼一个 {path, query: Record<string, unknown>} 会在
 * vue-tsc 那一关变成「query 里的 unknown 不是 LocationQueryValueRaw」——
 * 编译期报出来比在真浏览器里点一次导航才发现便宜。
 */
export function withSitePreviewToken(to: {
  path?: string
  query?: Record<string, unknown>
  hash?: string
}): RouteLocationRaw | undefined {
  const token = siteScopedToken
  if (!token || !to || to.query?.[PREVIEW_TOKEN_PARAM]) {
    return undefined
  }
  if (!isPortalPath(to.path || '')) {
    return undefined
  }
  return {
    path: to.path || '/',
    query: { ...(to.query || {}), [PREVIEW_TOKEN_PARAM]: token } as LocationQueryRaw,
    hash: to.hash || ''
  }
}
