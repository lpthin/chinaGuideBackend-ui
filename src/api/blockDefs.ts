import http from './http'
import type { PortalBlockMeta } from './portalPages'

/**
 * 组件库（`portal_block_def`）的超管侧接口，对应后端 `AdminBlockDefController`
 * （`/api/admin/portal-blocks`，权限码 `portal:block:manage`，V177）。
 *
 * <p>与 `portalPagesApi.blocks()`（`GET /api/portal/blocks`）的分工是同一张表两种问法：
 * 那边答「这一页能挑哪些」（只出启用的），这里答「库里到底有什么、人要改它」
 * （含停用行、含来源族，还带写口要用的 id / enabled / source）。两份共用后端同一个
 * {@code BlockDefView}，所以这一层的类型直接 extends 那个读口的形状，不抄第二份字段。</p>
 *
 * <p>这里<b>没有</b>分类清单、也没有可用渲染器清单：那两族取值只有后端一处
 * （{@code ManualBlockDefService.CATEGORIES} / {@code RendererKeys}），界面读
 * {@link blockDefsApi.categories} 与 {@link blockDefsApi.rendererOptions}。
 * 抄一份的下场在本仓写过三次：后端加一档，界面就把它安静地演成它认识的那几句话。</p>
 */

/** 组件库里的一行：两族都在（code = 代码声明的投影，界面上只读；manual = 界面新建的） */
export interface BlockDefRow extends PortalBlockMeta {
  id: number
  enabled: boolean
  /** 'code' | 'manual'；判据在后端，界面只按这一格决定摆哪些按钮 */
  source: string
  provenanceUrl: string | null
  provenanceNote: string | null
  updatedAt: string | null
}

/** 新建体：与后端 ManualBlockDefService.CreateForm 同形。rendererKey 交上去被拒是判据④要的结果 */
export interface BlockDefCreateForm {
  blockKey: string
  name: string
  category: string
  maxInstances?: number | null
  rendererKey: string
  dataSchemaJson: string
  provenanceUrl?: string | null
  provenanceNote?: string | null
}

/**
 * 修改体：后端 UpdateForm 结构上就没有 blockKey / rendererKey / source 三格，
 * 所以这里也不提供——「禁改」不是靠界面藏起来，是接口收不到。
 */
export interface BlockDefUpdateForm {
  name: string
  category: string
  maxInstances?: number | null
  dataSchemaJson: string
  provenanceUrl?: string | null
  provenanceNote?: string | null
}

export const blockDefsApi = {
  /** 组件库列表：两族都要，停用的也摆出来（带「已停用」标记，不是从列表里消失） */
  list: () => http.get<BlockDefRow[]>('/admin/portal-blocks'),

  /** 分类词表的唯一出口：新建抽屉里那个下拉吃这一口 */
  categories: () => http.get<string[]>('/admin/portal-blocks/categories'),

  /** 可用渲染器清单：今天只有 genericCard 一支，那句话由后端说，界面不代言 */
  rendererOptions: () => http.get<string[]>('/admin/portal-blocks/renderer-options'),

  /** 新建抽屉预填的那份 props schema：与「一键沉淀」拟的是同一份常量 */
  schemaPrefill: () => http.get<string>('/admin/portal-blocks/schema-prefill'),

  /** 新建一律落成草稿（enabled=false），启用是第二个动作 */
  create: (form: BlockDefCreateForm) => http.post<BlockDefRow>('/admin/portal-blocks', form),

  update: (id: number, form: BlockDefUpdateForm) =>
    http.put<BlockDefRow>(`/admin/portal-blocks/${id}`, form),

  setEnabled: (id: number, enabled: boolean) =>
    http.put<BlockDefRow>(`/admin/portal-blocks/${id}/enabled`, null, { params: { enabled } }),

  /** 软删：只准删界面那一族；代码族的行删不掉，下一次启动按代码声明又刷回来 */
  remove: (id: number) => http.delete<void>(`/admin/portal-blocks/${id}`)
}

export default blockDefsApi
