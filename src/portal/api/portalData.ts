/**
 * 门户属于哪个站点由访问域名决定，前端不再声明租户身份。
 * 本地/预览用 ?site={租户代码} 显式指定，该参数只在后端开启
 * app.portal.allow-site-param 时才生效（生产关闭）。
 *
 * <p>?site= 只会出现在入口那一个 URL 上，点进内页后地址栏就没有了；缓存一份到本次会话，
 * 否则访客从首页进详情页就变成「查不到站点」。生产环境后端根本不读这个参数，留着无害。</p>
 *
 * <p>这里原本还有 {@code getPortalData()} 和一整份门户数据类型：那是三套写死模板的取数口，
 * 模板删除（Spec D3 / R8）后一起收掉。区块要读门户数据是通过 layout 里的 {@code {"$data":...}}
 * 绑定由后端解析，前端不再自己拉一份聚合结果。</p>
 */
const SITE_SESSION_KEY = 'portal.site'

export function resolveSiteCode(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('site')
  if (fromUrl) {
    try {
      sessionStorage.setItem(SITE_SESSION_KEY, fromUrl)
    } catch {
      // 隐私模式下写不进去，这一页还能用，下一页退回按域名解析
    }
    return fromUrl
  }
  try {
    return sessionStorage.getItem(SITE_SESSION_KEY) || ''
  } catch {
    return ''
  }
}
