import http from './http'

/**
 * 租户侧读自己的站点（后端 `TenantSiteController`，`/api/portal/sites`，码 `portal:siteinfo:manage`）。
 *
 * <p>为什么不直接用 `siteApi.list()`：那一个是 `/api/admin/sites`，整棵挂在
 * `portal:build:manage` 上（V93 的边界：租户做内容与基础信息，不做建站）。上线检查表以前读的
 * 就是那一个口，403 被界面翻译成了「该租户还没有站点」——站点一直在，读的人没权限（全站普查 §3）。</p>
 *
 * <p>这里只有五列：`id / code / name / domain / status`。竞争域名、种子关键词那份经营账留在管理侧。</p>
 */

/** 一行本站站点（后端 TenantSiteController.TenantSiteView） */
export interface MySite {
  id: number
  code: string
  name: string
  /** 访客地址用的域名；null / 空串 = 还没绑定 */
  domain: string | null
  /**
   * 站点状态（enabled / disabled 等，词表在后端 SiteStatuses）。
   * 停用的站门户公开面整站 404——拿编码去数「访客能看到几条」之前先看这一位，
   * 别对着一个已经关门的站发请求，给控制台留一对没人能处理的红色 404。
   */
  status: string
}

export const portalSitesApi = {
  /** 当前租户可见的那几套站点（候选与归档站后端已经过滤，这里不传任何参数） */
  listMine: () => http.get<MySite[]>('/portal/sites'),
}
