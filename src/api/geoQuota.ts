import http from './http'

/**
 * GEO 诊断那一池的月度水位，对应后端 `GeoQuotaAdminController`（V158 / Spec-G N2 拍板）。
 *
 * 拍板原文：「GEO 的额度池可以先空着，留给后端（超级管理员）设置。如果不设置，不用去限制额度。」
 * 前端在这一条上只做一件事，而且必须做好：<b>不许把「没人设过」念成「余额 0」</b>。
 * 后端把这一个规则写在 `GeoQuotaService.resolve` 一处，本模块只是把它的读法原样接过来——
 * 界面上任何一格都不参与判据，`?? 0` 那种兜底在这里是错的（0 与「不限制」是两个相反的意思）。
 *
 * 两个口都是超管口（后端 `AdminAuthUtils.checkSuperAdmin()`，与 `/media/storage/config` 同一口径）：
 * 这一行决定的是「这个租户还能不能继续花平台付给第三方模型的钱」，写它的人得站在收钱那一侧。
 */

/** 生效水位来自哪一路，逐字镜像 `GeoQuotaService.SOURCE_*` 三个常量 */
export type GeoQuotaSource = 'TENANT' | 'PLATFORM' | 'UNLIMITED'

/**
 * 一次读/写的回执：这一池「现在这一刻」的账。
 *
 * `monthlyQuota` / `remainingTokens` / `usedPercent` 三格的 null 都是<b>有含义的</b>：
 * 没设上限。第三格尤其别当成 0%——0% 读作「一分钱都没花」，而真相是「没有上限可除」。
 */
export interface GeoQuotaStatus {
  tenantId: number | null
  usageType: string
  poolLabel: string
  /** 本租户单独设的那个数（NULL/undefined = 没设过） */
  tenantQuota: number | null
  /** 平台兜底水位（app.ai.quota.geo-monthly-quota），没设也是 null */
  platformQuota: number | null
  monthlyQuota: number | null
  quotaSource: GeoQuotaSource | string
  quotaUnlimited: boolean
  usedTokens: number
  remainingTokens: number | null
  usedPercent: number | null
  /** 「去哪儿设这一池的水位」那一句，后端发的原文；界面不许自己拼一份 */
  whereToSet: string | null
  /** 「为什么现在是这个数」那一句，同样是后端发的原文 */
  note: string | null
  updatedAt: string | null
  /** 最后一次设这个数的管理员用户 id；库里存 id，昵称能改 */
  updatedBy: number | null
}

/**
 * 提交给 PUT 的形状。
 *
 * `monthlyTokenQuota` 留空（null）= 撤销这个租户的设置、回到「不限制」；填 0 会被后端拒掉
 * （0 是「上限为零、一分钱都花不了」，与「没人设过」不是同一件事，判据在
 * `GeoQuotaService.setTenantQuota`）。
 */
export interface GeoQuotaForm {
  tenantId: number
  monthlyTokenQuota: number | null
}

export const geoQuotaApi = {
  /** 读这一池当前的水位与账（必须点名租户，与用量页同一判据） */
  status: (tenantId: number) =>
    http.get<GeoQuotaStatus>('/admin/geo-quota', { params: { tenantId } }),

  /**
   * 设这一池的水位。判据一条都不在前端重复实现：界面只做「别让人白点一次」的提前提示，
   * 能不能存、留空算什么，以接口返回为准。
   */
  set: (form: GeoQuotaForm) => http.put<GeoQuotaStatus>('/admin/geo-quota', form),
}
