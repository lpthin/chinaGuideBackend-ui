import http from './http'

/**
 * 门店（后端 `store` 表）的租户侧接口，对应 `StoreController`
 * （`/api/portal/stores`，权限码 portal:siteinfo:manage）。
 *
 * <p>三件在别处踩过的事，这里写清楚：</p>
 * <ul>
 *   <li><strong>没有站点参数</strong>：门店按公司归属，同一租户名下几个站看到的是同一批门店。
 *       界面不许出现「这一站的门店」那种说法（后端 {@code Store} 的类注释解释了为什么不补 site_id）；</li>
 *   <li><strong>状态三档的含义不在这里抄一份</strong>：中文标签与「这一档会不会出现在门户地图上」
 *       全部来自 `GET /options`（后端 {@code StoreStatuses} 词表的出口）。前端自己写一遍 1=营业中，
 *       就是哪天门户改判据时界面在谎报（I-1）；</li>
 *   <li><strong>地图点位上限也来自 `GET /options`</strong>：界面上那句「排第 N+1 的营业中门店
 *       不会出现在地图上」里的 N，必须是门户真在用的那一份（{@code PortalAggregationService#STORE_LIMIT}）。</li>
 * </ul>
 *
 * <p>写入体的键与后端 `StoreForm.ALLOWED_FIELDS` 一一对应：多传一个键后端直接拒
 * （「不认识的字段：xxx」），所以这一层不做任何字段翻译。</p>
 */

/** 一档营业状态（后端 StoreStatuses.Status） */
export interface StoreStatusOption {
  code: number
  /** 中文标签：下拉与状态标签的唯一来源 */
  label: string
  /** 这一档会不会出现在门户地图上——界面上那句提醒只认这一位，不自己判 code === 1 */
  visibleOnPortal: boolean
}

/** 录入界面要念的词表 */
export interface StoreOptions {
  statuses: StoreStatusOption[]
  /** 门户地图一次取死的点位条数，超出按排序截断 */
  portalRowLimit: number
}

/** 一条门店（后端实体 Store 的 JSON 形状） */
export interface StoreRow {
  id: number
  tenantId: number
  name: string
  address: string | null
  phone: string | null
  /**
   * 库里是 decimal(11,8)，JSON 里就是个数字：人写的 `120.15000000` 过一道 JS 会变成 `120.15`。
   * 两者数值完全相等，回填再保存不会把店挪走一位，所以这里不做字符串保真——
   * 真正要紧的是「小数位不超过 8」，那一刀在后端门口判。
   */
  longitude: number | string | null
  latitude: number | string | null
  businessHours: string | null
  status: number
  sortOrder: number
  createdAt?: string | null
  updatedAt?: string | null
  createBy?: string | null
  updateBy?: string | null
}

/** 写入体：与 StoreForm 那八个允许字段同形 */
export interface StoreForm {
  name: string
  address?: string | null
  phone?: string | null
  longitude?: string | number | null
  latitude?: string | number | null
  businessHours?: string | null
  status?: number | null
  sortOrder?: number | null
}

export const portalStoreApi = {
  /** 词表：状态三档 + 门户点位上限 */
  options: () => http.get<StoreOptions>('/portal/stores/options'),

  /** 列表：三档状态都回（改成「装修中」不等于消失），顺序与门户取数同一份 */
  list: (keyword?: string | null, status?: number | null) =>
    http.get<StoreRow[]>('/portal/stores', {
      params: { keyword: keyword?.trim() || undefined, status: status ?? undefined }
    }),

  /** 条数：与列表同一把条件（「共 N 家」不许有第二套判据） */
  count: (keyword?: string | null, status?: number | null) =>
    http.get<number>('/portal/stores/count', {
      params: { keyword: keyword?.trim() || undefined, status: status ?? undefined }
    }),

  create: (form: StoreForm) => http.post<StoreRow>('/portal/stores', form),

  update: (id: number, form: StoreForm) => http.put<StoreRow>(`/portal/stores/${id}`, form),

  remove: (id: number) => http.delete<void>(`/portal/stores/${id}`)
}

export default portalStoreApi
