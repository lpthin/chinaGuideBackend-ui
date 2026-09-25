import http from './http'

/**
 * 门户骨架（整站模板）接口（Spec §4.2 / §5.2 / I-4，Q2）。
 *
 * 这里刻意不出现任何一份骨架 key 清单、区块 key 清单或状态中文：
 * 骨架是数据库里的数据资产（V96 种子起，N3 明确禁止写进代码），
 * 状态的中文说法只有 `/admin/portal/skeletons/statuses` 这一处来源。
 * 一旦这个文件里抄了一份「有哪几套骨架 / 每套几页」，超管新增骨架时界面不会跟着变，
 * 而 `portal-skeletons-api.spec.ts` 的源码扫描用例会红。
 */

/** 骨架里的一页（后端 `SkeletonSource.Page`），字段与 `portal_skeleton_page` 逐字对齐 */
export interface SkeletonPage {
  pageKey: string
  slug: string | null
  title: string | null
  pageType: string | null
  navSort: number
  navVisible: boolean
  /** JSON 字符串，形状 `{"blocks":[{"instanceId":"b1","blockKey":"...","props":{...}}]}` */
  layoutJson: string | null
  /** 这一页承接的栏目；null = 不属于任何栏目（通常是首页） */
  sectionKey: string | null
}

/** 画廊用的一整套骨架。页数按 `pages.length` 算：后端那个 pageCount 不是 record 分量，不保证序列化出来 */
export interface SkeletonView {
  skeletonKey: string
  name: string
  description: string | null
  /** 这套骨架的来路（平台预置 / 参考站沉淀 / 站点反沉），取值由后端给，前端不解释 */
  origin: string | null
  version: number
  status: string
  /** 皮肤默认值（JSON 字符串，键与 theme_json 同一套 design token） */
  tokensJson: string | null
  pages: SkeletonPage[] | null
}

/** 实例化计划的一行：哪一页会新建、哪一页跳过以及跳过的中文原因 */
export interface SkeletonPlanItem {
  pageKey: string
  slug: string | null
  title: string | null
  pageType: string | null
  navSort: number
  willCreate: boolean
  /** 后端给的中文说明，会新建与跳过两种情况都有话，前端不替它编 */
  reason: string | null
}

/** apply-skeleton 的回执：dry-run 与真执行同一个结构，靠 dryRun 区分 */
export interface SkeletonApplyResult {
  skeletonKey: string
  skeletonName: string | null
  skeletonVersion: number
  dryRun: boolean
  items: SkeletonPlanItem[] | null
  created: number
}

/** 沉淀的入参：key 可空（后端按任务号兜一个），名称与说明也都是可空的覆盖值 */
export interface SkeletonDistillForm {
  skeletonKey?: string | null
  name?: string | null
  description?: string | null
}

/**
 * 一次沉淀的回执：`stripped` 是「哪些客户文案与外链被洗掉了」，`skippedPages` 是「哪几页没带进来、为什么」。
 *
 * 这两串是审核的证据，不是日志：后端逐页写好了中文说明，界面原样列出来，
 * 让点「发布」的人在点之前就看到这套骨架里还残留什么、丢了什么——洗过几处这件事没有别的地方能查。
 */
export interface DistilledSkeleton {
  skeletonKey: string
  name: string | null
  pageCount: number
  blockCount: number
  stripped: string[]
  skippedPages: string[]
}

/**
 * publish / retire 回的是骨架表那一行本身（没有 pages 分量，和 `SkeletonView` 不是一回事）：
 * 状态以它回的那一行为准，界面不按「刚点了哪个按钮」猜结果。
 */
export interface SkeletonRecord {
  id?: number | null
  skeletonKey: string
  name?: string | null
  version?: number | null
  status?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
}

export const portalSkeletonsApi = {
  /** 骨架库列表（建设域 `portal:build:preset`） */
  list: () => http.get<SkeletonView[]>('/admin/portal/skeletons'),

  /**
   * 待审的沉淀骨架：形状与 `list()` 完全相同，筛哪一种状态归后端说，
   * 前端一处状态字符串都不比对（比对了就得跟着后端改名）。
   */
  pending: () => http.get<SkeletonView[]>('/admin/portal/skeletons/pending'),

  /** 逐页 layout：列表页只要元数据，预览才按 key 取这一发（key 一律 URL 编码） */
  pages: (skeletonKey: string) =>
    http.get<SkeletonPage[]>(`/admin/portal/skeletons/${encodeURIComponent(skeletonKey)}/pages`),

  /** 状态词表：中文说法只有这一个来源，界面不许再抄一份 */
  statusLabels: () => http.get<Record<string, string>>('/admin/portal/skeletons/statuses'),

  /**
   * 按骨架给站点补页。两步是后端契约，不是一句口号：
   * `confirm:false` 只回计划、一行都不写；超管在页面上看过计划、再点「确认执行」才发 `confirm:true`。
   */
  apply: (siteId: number, skeletonKey: string, confirm: boolean) =>
    http.post<SkeletonApplyResult>(`/admin/sites/${siteId}/apply-skeleton`, { skeletonKey, confirm }),

  /**
   * 参考站 → 骨架沉淀（Spec §6.4）：把一个摄取完的参考站洗成平台骨架库里的一套新骨架。
   *
   * 任务没摄到位、key 撞了、一页都带不进来，后端各有一句中文原因，原因原样透出即可；
   * 产物停在待审状态，发布与否归 publish，这一发不会替谁发布。
   */
  distill: (referenceId: number, data: SkeletonDistillForm) =>
    http.post<DistilledSkeleton>(`/admin/portal/reference-sites/${referenceId}/distill-skeleton`, data),

  /**
   * 审核发布 / 退役：两个都是写动作，各自一次独立的确认，不许一个按钮二合一、也不许发完发布顺手退役。
   * 退役不删数据，只是新站点选不到它（I-4：已按它生出来的页面照旧跑）。
   */
  publish: (skeletonKey: string) =>
    http.post<SkeletonRecord>(`/admin/portal/skeletons/${encodeURIComponent(skeletonKey)}/publish`),

  retire: (skeletonKey: string) =>
    http.post<SkeletonRecord>(`/admin/portal/skeletons/${encodeURIComponent(skeletonKey)}/retire`)
}
