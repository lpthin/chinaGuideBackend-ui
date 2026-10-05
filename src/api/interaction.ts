import http from './http'

/**
 * 后台「读者互动」那一页的四口，对应后端 `WorkspaceInteractionController`（P9-C / G-08）。
 *
 * 三处纪律写在这里，免得有人在界面抄第二份：
 * ① `disclosure`、`skipReasonText`、`sourceText`、以及保存被拒时那句中文，全部是后端发的。
 *    开关开着意味着「系统会替你补评论和点赞」，而前台一个字都不标 AI——这句话必须由我们说，
 *    说的那一处就是 `InteractionConfigService.disclosure`。前端拼一份中文，两处就会分家。
 * ② 区间（每篇 1~10 条、点赞 0~999）的判据只在 `InteractionConfigService.apply` 一处，
 *    这里的 min/max 只是「别让人白点一次」，存不存得下以接口返回为准。
 * ③ 队列上的动作只有 approve / reject / remove 三个词。拼错的后端会直接拒（COMMENT_ACTION_INVALID），
 *    以前那种「不是 approve 就当 reject」会替租户驳回一条正常评论。
 */

/** 读者写的评论进哪一道：review = 一律先人工待审（默认），auto = 先过内容安全闸，判过的直接对外 */
export type InteractionModerationMode = 'review' | 'auto'

export interface InteractionConfig {
  /** 1 = 开，0 = 关。两个开关各管一张表，没有一根总开关 */
  aiCommentEnabled: number
  virtualLikeEnabled: number
  moderationMode: InteractionModerationMode | string
  /** 一篇稿子最多补几条示例评论，1~10 */
  aiCommentMaxPerArticle: number
  /** 发布那一刻补的点赞数落在这个区间里随机取 */
  likeSeedMin: number
  likeSeedMax: number
  /** 最后一次改这两下的人；没建行时是 null，表示出厂默认（两个开关都关） */
  updatedBy: number | null
  updatedAt: string | null
  /** 给租户看的那句实话，出处是后端；前端不许改写也不许自己拼 */
  disclosure: string
}

export interface InteractionConfigForm {
  aiCommentEnabled?: number
  virtualLikeEnabled?: number
  moderationMode?: string
  aiCommentMaxPerArticle?: number
  likeSeedMin?: number
  likeSeedMax?: number
}

/** 队列里的一行。`source` 只在这一页出现：前台不带 AI 标识，后台必须分得清谁写的 */
export interface InteractionCommentItem {
  id: number
  articleId: number | null
  articleTitle: string | null
  authorName: string | null
  content: string
  status: string
  source: string | null
  sourceText: string | null
  /** 安全闸判拒时那句结论，原样存进行里；null 是「没被机器判过」，不是「判过了没说」 */
  moderationNote: string | null
  createdAt: string | null
  reviewedAt: string | null
}

export interface InteractionCommentPage {
  items: InteractionCommentItem[]
  total: number
  counts: { pending: number, approved: number, rejected: number }
}

/** 这一家的总账：真实与系统补的分开数，排产计划按状态分开数 */
export interface InteractionStats {
  readerComments: number
  approvedReaderComments: number
  pendingReaderComments: number
  seededComments: number
  virtualLikes: number
  readerLikes: number
  seedPending: number
  seedDone: number
  seedSkipped: number
  seedFailed: number
}

/** 排产计划的一行：`fireAt` 就是「发布后一个月内随机时刻」那一拍落库的样子 */
export interface InteractionSeedTask {
  id: number
  articleId: number
  seq: number | null
  fireAt: string | null
  status: string
  commentId: number | null
  skipReason: string | null
  skipReasonText: string | null
  note: string | null
}

export const interactionApi = {
  config: (tenantId?: number) =>
    http.get<InteractionConfig>('/workspace/interaction/config', { params: { tenantId } }),

  /** 只提交改过的那几项：后端对没带的字段一律不动 */
  saveConfig: (form: InteractionConfigForm, tenantId?: number) =>
    http.put<InteractionConfig>('/workspace/interaction/config', form, { params: { tenantId } }),

  /** 默认只看待审；status 传 'all' 看全部 */
  comments: (params: { status?: string, articleId?: number, page?: number, size?: number } = {}, tenantId?: number) =>
    http.get<InteractionCommentPage>('/workspace/interaction/comments', { params: { ...params, tenantId } }),

  moderate: (id: number, action: 'approve' | 'reject' | 'remove', tenantId?: number) =>
    http.post<{ id: number, status: string }>(`/workspace/interaction/comments/${id}/moderate`, { action }, { params: { tenantId } }),

  stats: (tenantId?: number) =>
    http.get<InteractionStats>('/workspace/interaction/stats', { params: { tenantId } }),

  seedTasks: (limit = 20, tenantId?: number) =>
    http.get<InteractionSeedTask[]>('/workspace/interaction/seed-tasks', { params: { tenantId, limit } })
}
