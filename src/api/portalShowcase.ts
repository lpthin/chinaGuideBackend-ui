import http from './http'

/**
 * 门户展示条目（V134 `portal_showcase_item`）的租户侧接口，对应后端
 * `PortalShowcaseItemController`（`/api/portal/showcase`，权限码 portal:siteinfo:manage）。
 *
 * <p>这里没有七个 kind 的中文清单：标签、顺序、归属栏目全部来自 `GET /kinds`
 * （后端 `ShowcaseKinds` 词表的唯一出口）。前端抄一份的下场在 `portalSections.ts` 开头
 * 写过——后端加一档，界面就把它安静地演成它认识的那句话（I-1）。</p>
 *
 * <p>写入体的字段与后端 `ShowcaseForm.ALLOWED_FIELDS` 一一对应：多传一个键后端直接拒
 * （「不认识的字段：xxx」），所以这一层不做任何字段翻译，界面填什么就交什么。</p>
 */

/** 一个 kind 的元数据（后端 ShowcaseKindOption：key/中文名/数据源名/归属栏目） */
export interface ShowcaseKind {
  key: string
  /** 中文显示名：页签标签的唯一来源，前端不解释它的取值 */
  label: string
  /** 这一类内容在门户聚合里占的数据源名（PortalDataDTO 字段），界面只展示不消费 */
  dataSource: string | null
  /** 归属栏目（null = 全站性内容，不随栏目开关走）；用来提示「平台关掉 about 这一栏会连带藏掉它」 */
  sectionKey: string | null
}

/** 一条展示条目（后端实体 PortalShowcaseItem 的 JSON 形状；库里只有 mediaId，没有第二份 URL） */
export interface ShowcaseItem {
  id: number
  siteId: number
  kind: string
  title: string
  subtitle: string | null
  body: string | null
  valueNumber: number | string | null
  valueSuffix: string | null
  mediaId: number | null
  url: string | null
  industry: string | null
  sortOrder: number
  enabled: boolean
  /** 演示内容标记：这一条是 AI 产的示意，界面上必须挂「示意」徽标（本期核心动机） */
  isDemo: boolean
  createdAt?: string
  updatedAt?: string
  updatedBy?: string | null
}

/** 写入体：与 ShowcaseForm 的十三个允许字段同形，不传的键 = 后端按默认值处理 */
export interface ShowcaseForm {
  siteId: number
  kind: string
  title: string
  subtitle?: string | null
  body?: string | null
  valueNumber?: number | string | null
  valueSuffix?: string | null
  mediaId?: number | null
  url?: string | null
  industry?: string | null
  sortOrder?: number | null
  enabled?: boolean | null
  isDemo?: boolean | null
}

export const portalShowcaseApi = {
  /** kind 词表：声明顺序 = 页签顺序 */
  kinds: () => http.get<ShowcaseKind[]>('/portal/showcase/kinds'),

  /** 列表：siteId/kind 不传 = 该租户全部；连关掉的、示意的都回（「看不到」≠「被删了」） */
  list: (siteId?: number | null, kind?: string | null) =>
    http.get<ShowcaseItem[]>('/portal/showcase', {
      params: { siteId: siteId ?? undefined, kind: kind || undefined }
    }),

  /** 条数：与列表同一把条件（后端注释钉住「共 N 条」不许有第二套判据） */
  count: (siteId?: number | null, kind?: string | null) =>
    http.get<number>('/portal/showcase/count', {
      params: { siteId: siteId ?? undefined, kind: kind || undefined }
    }),

  create: (form: ShowcaseForm) => http.post<ShowcaseItem>('/portal/showcase', form),

  update: (id: number, form: ShowcaseForm) => http.put<ShowcaseItem>(`/portal/showcase/${id}`, form),

  remove: (id: number) => http.delete<void>(`/portal/showcase/${id}`),

  /** 门户取数那一份的后台镜像：排查「为什么访客看不到这条」用，界面第一版先不摆 */
  portalVisible: (siteId: number) =>
    http.get<ShowcaseItem[]>('/portal/showcase/portal-visible', { params: { siteId } })
}

/** 扫描 `/media` 列表做 url→id 反查时最多翻的页数（100 条/页；再深就如实报「没定位到」） */
const MEDIA_SCAN_LIMIT = 10

interface MediaRow {
  id: number
  url: string
}

/**
 * 「挑中了一张库里的图」→ 这一条目的 mediaId。
 *
 * <p>为什么要这一跳：挑图复用的是现成的媒体库弹窗（`MediaImageLibraryModal`，挑图 + 就地上传
 * 都在这一个组件里），它的 `pick` 事件交回的是图片地址；而 `portal_showcase_item` 存的是
 * `mediaId`（软引用，对外地址由后端 `MediaStorage#publicUrlOf` 现算，库里刻意不存第二份 URL）。
 * 于是在这里拿地址回查一次媒体列表。查不到就返回 null 让界面如实说——把地址硬存进去、
 * 或者让用户手填一个「编号」，都是在造假。</p>
 *
 * <p>写在这份文件而不是视图里：它是「展示条目的图位」这件事接口面的一部分，另开一个
 * media api 文件就会有两处找。</p>
 */
export async function resolveMediaIdByUrl(url: string, tenantId: number | null): Promise<number | null> {
  const target = (url || '').trim()
  if (!target) return null
  for (let page = 1; page <= MEDIA_SCAN_LIMIT; page += 1) {
    const data = await http.get<{ records?: MediaRow[]; pages?: number }>('/media', {
      params: { tenantId: tenantId ?? undefined, fileType: 'image', page, size: 100 }
    })
    const records = data?.records || []
    const hit = records.find(row => (row.url || '').trim() === target)
    if (hit) return hit.id
    if (!data?.pages || page >= data.pages) break
  }
  return null
}

/** 按 mediaId 取对外地址（列表缩略图与表单预览都用这一口；失败由调用方如实显示） */
export async function fetchMediaUrl(mediaId: number): Promise<string> {
  const data = await http.get<{ url?: string; data?: { url?: string } }>(`/media/${mediaId}`)
  const url = data?.url ?? data?.data?.url
  if (!url) {
    throw new Error('素材返回里没有地址')
  }
  return String(url)
}

export default portalShowcaseApi
