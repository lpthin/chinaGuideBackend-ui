import http, { AI_REQUEST_TIMEOUT } from './http'

/**
 * 素材存储的超管接口，对应后端 `MediaStorageAdminController`。
 *
 * 五个口全是超管口（后端 `AdminAuthUtils.checkSuperAdmin()`，与 `/api/ai-model` 同口径）：
 * 一次「搬」会改**所有租户**的 `media` 行，一份「存」决定**全站**每个新上传落在哪个桶，
 * 所以租户侧没有这一屏的读法，也不该有。
 *
 * `localFilesDeleted` 不是装饰：迁移只复制、不删本地文件，因为内容表里存的仍是
 * `/uploads/...` 那批 URL（见后端 V106）。界面把它显示出来，免得「搬完了」被读成「磁盘上的可以清了」。
 */

/** 迁移这道题的「现在到哪了」 */
export interface MediaStorageState {
  /** 这个进程实际把新素材写去哪儿：local / oss */
  activeStorage: string
  /** 系统当前认识哪几种存储。只有一个就说明点了搬也无处可搬 */
  availableStorages: string[]
  totalRows: number
  /** storage_type 还没跟上 activeStorage 的行数（含库里那个值为 NULL 的） */
  pendingRows: number
  /** 明确要保留本地副本的行数——这一批搬了也还是会在磁盘上留一份，不是漏搬 */
  retainedLocalRows: number
  /** 这份判定来自哪里：database（界面里存的）/ env（YAML 与环境变量）/ database-unreadable */
  configSource: string
  /** 选定的后端为什么不可用（缺密钥、库里配置读不出来）；一切正常是 null */
  note: string | null
  /** 后端确实拿得出来才算 true——与 drained（跑完了）是两件事 */
  usable: boolean
  drained: boolean
}

/**
 * 界面上那份存储配置。密钥两项永远只有掩码：GET 回来的 accessKeyId 是 `LTAI****abcd` 这种形状，
 * accessKeySecret 只会是「已保存（不显示）」。提交时留空或原样回填那句话 = 不改这一项。
 */
export interface MediaStorageConfig {
  configured: boolean
  /** null = 还没在界面上选过写入目标，此时写去哪儿仍由 YAML 的 app.media.storage 决定 */
  storage: string | null
  endpoint: string | null
  bucket: string | null
  accessKeyId: string | null
  accessKeySecret: string | null
  publicBaseUrl: string | null
  keyPrefix: string | null
  privatePrefix: string | null
  /** ok / failed / null（null = 从没测过，界面别替它说「已验证」） */
  lastTestStatus: string | null
  lastTestMessage: string | null
  lastTestedAt: string | null
  /** 上次测试与当前这组参数是不是同一组：改过任一项就变 false，必须重测 */
  lastTestMatchesCurrent: boolean
  updatedBy: string | null
  updatedAt: string | null
}

/** 提交给 PUT /config 的形状（不传的字段 = 不改；密钥留空或回填掩码 = 沿用库里那份） */
export interface MediaStorageConfigForm {
  storage?: string | null
  endpoint?: string | null
  bucket?: string | null
  accessKeyId?: string | null
  accessKeySecret?: string | null
  publicBaseUrl?: string | null
  keyPrefix?: string | null
  privatePrefix?: string | null
}

/** 一次连通性测试的结果：后端真往桶里写了一个探针、读回来比对、再删掉 */
export interface MediaStorageTestResult {
  success: boolean
  status: string
  message: string
  elapsedMs: number
  bucket: string
  endpoint: string
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

/** 测一次连接要走三趟公网往返（写探针、读回、删掉），比一次普通读慢得多，给 60s（axios 默认是 30s） */
export const TEST_TIMEOUT = 60000

export const mediaStorageApi = {
  status: () => http.get<MediaStorageState>('/media/storage/status'),

  /** 界面上那份配置（密钥只回掩码） */
  config: () => http.get<MediaStorageConfig>('/media/storage/config'),

  /**
   * 存这份配置。
   *
   * 后端有三道闸（写入目标只认 local/oss/留空、选 oss 必须四项齐、那组参数必须先测过），
   * 一道都不在界面里重复实现——界面只做「别让人白点一次」的提前提示，判据以接口返回的为准。
   */
  saveConfig: (form: MediaStorageConfigForm) =>
    http.put<MediaStorageConfig>('/media/storage/config', form),

  /**
   * 真连一次桶（写探针、读回、删掉）。带表单 = 测还没保存的那组参数；不带 = 测库里那份。
   *
   * 一次请求要跑三趟公网往返（PUT/GET/DELETE），默认的 30s 在网络抖的时候会把「其实测过了」
   * 变成「界面说超时」，所以单独放宽。
   */
  testConfig: (form?: MediaStorageConfigForm | null) =>
    http.post<MediaStorageTestResult>('/media/storage/config/test', form ?? null, { timeout: TEST_TIMEOUT }),

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
