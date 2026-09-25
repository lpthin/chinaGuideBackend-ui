import http, { AI_REQUEST_TIMEOUT } from './http'

/**
 * 素材存储（对象存储迁移）的超管接口，对应后端 `MediaStorageAdminController`。
 *
 * 只有两个口，且都是超管口（后端 `AdminAuthUtils.checkSuperAdmin()`，与 `/api/ai-model` 同口径）：
 * 一次「搬」会改**所有租户**的 `media` 行，所以租户侧没有这一屏的读法，也不该有。
 *
 * `localFilesDeleted` 不是装饰：迁移只复制、不删本地文件，因为内容表里存的仍是
 * `/uploads/...` 那批 URL（见后端 V106）。界面把它显示出来，免得「搬完了」被读成「磁盘上的可以清了」。
 */

/** 迁移这道题的「现在到哪了」 */
export interface MediaStorageState {
  /** 这个进程实际把新素材写去哪儿：local / oss */
  activeStorage: string
  /** 当前进程里配了哪几种存储。只有一个就说明点了搬也无处可搬 */
  availableStorages: string[]
  totalRows: number
  /** storage_type 还没跟上 activeStorage 的行数（含库里那个值为 NULL 的） */
  pendingRows: number
  /** 明确要保留本地副本的行数——这一批搬了也还是会在磁盘上留一份，不是漏搬 */
  retainedLocalRows: number
  drained: boolean
}

/** 一次搬迁的账。恒等式由后端钉住：scanned = migrated + skippedAlreadyOnTarget + missingSource + failed */
export interface MediaMigrationReport {
  targetStorage: string
  scanned: number
  migrated: number
  skippedAlreadyOnTarget: number
  missingSource: number
  failed: number
  bytesMoved: number
  /** 每条失败的「素材id: 中文原因」，后端最多带 50 条 */
  errors: string[]
  clean: boolean
  localFilesDeleted: boolean
}

/**
 * 一批最多 500 个文件要走公网。默认的 30s 会在后端还在复制的时候先把连接掐掉，
 * 留下「界面报超时、库里其实搬成了」这种最难查的账，所以单独放宽（与整站组装同一处理）。
 */
export const MIGRATE_TIMEOUT = Math.max(AI_REQUEST_TIMEOUT, 600000)

export const mediaStorageApi = {
  status: () => http.get<MediaStorageState>('/media/storage/status'),

  /**
   * 搬一批。不自动跑、不定时跑：失败原因（AK 没权限、桶不同地域、endpoint 写错）只有人在场时才解释得清。
   *
   * @param tenantId 留空 = 全平台
   * @param limit 这次最多处理多少行，默认 500；重跑安全（已经在目标存储的行会被幂等跳过）
   */
  migrateToOss: (params: { tenantId?: number | null; limit?: number } = {}) => {
    // 空租户是「不传这个参数」，不是 tenantId=0：后端把「没带 tenantId」读成全平台迁移，
    // 传个 0 出去就是把一次「只搬某个租户」的点击变成改所有租户的 media 行。
    const query: Record<string, number> = { limit: params.limit ?? 500 }
    if (params.tenantId) query.tenantId = params.tenantId
    return http.post<MediaMigrationReport>('/media/storage/migrate-to-oss', null, {
      params: query,
      timeout: MIGRATE_TIMEOUT
    })
  }
}
