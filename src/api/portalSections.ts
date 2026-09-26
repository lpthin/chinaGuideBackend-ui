import http from './http';

/**
 * 栏目（Spec §5.1 / §5.2 / I-1）。
 *
 * <p>这里<strong>没有任何中文栏目名，也没有栏目 key 清单</strong>：显示名、顺序、对外地址、
 * 由哪个内容模块维护，全部来自后端那份词表（`SectionCatalogue` + 本站覆盖值）。前端一旦抄一份，
 * 超管改完名这里就还是老字，而 `portal-sections-api.spec.ts` 会红。</p>
 */

/** 一个栏目在本站的生效态（后端 `SectionAccess.State`） */
export interface SectionState {
  key: string;
  displayName: string;
  pageKind: string | null;
  /** 绑定的集合数据源名；null = 这一栏目不靠列表数据（关于我们/联系我们读标量） */
  dataSource: string | null;
  /** 内容入口：租户侧由哪个内容模块维护，取值见后端词表 */
  contentEntry: string;
  publicPath: string;
  enabled: boolean;
  navVisible: boolean;
  navSort: number;
  landingPageId: number | null;
}

/**
 * 一个栏目的内容完整度（后端 `SectionCompleteness.Value`，问题十）。
 *
 * <p>档位代码 `level` 只用来配色，`label` 与 `hint` 那两句中文一律照后端渲染：
 * 前端自己写第二份「missingImage → 有内容缺图」的映射，后端加一档时界面上只会安静地
 * 把新档演成它认识的那句话（I-1）。</p>
 */
export interface SectionCompleteness {
  /** notList | empty | missingImage | complete | noCoverSlot */
  level: string;
  /** 卡上那句短标签的中文，后端词表给 */
  label: string;
  /** 说清「差在哪、下一步做什么」的一句话，里面的数字是真数出来的 */
  hint: string;
  /** 其中没有封面图的条数；null = 这一类内容在数据模型里没有图位，后端没判这一项 */
  missingImageCount: number | null;
  /** 已发布但没进这一栏目的条数；null = 这一栏目没有这种区分 */
  unlistedCount: number | null;
}

/** 一个栏目的内容统计（后端 `SectionSummaryService.Summary`） */
export interface SectionSummary {
  key: string;
  displayName: string;
  publicPath: string;
  /** 访客视角地址；站点没配域名时退化成站内相对路径 */
  previewUrl: string;
  contentEntry: string;
  /** null = 这一栏目不是列表，显示「—」而不是 0 */
  contentCount: number | null;
  landingPageId: number | null;
  landingPageTitle: string | null;
  /** null = 该 pageKind 一个页面都没有；draft/offline 表示有页但访客看不到 */
  landingPageStatus: string | null;
  /** 内容完整度（含缺图）：那一串数派生出来的档位与中文 */
  completeness: SectionCompleteness;
}

/** 超管改栏目的表单：只翻开关与显示名，不碰页面本身 */
export interface SectionForm {
  displayName?: string | null;
  enabled?: boolean | null;
  navVisible?: boolean | null;
  navSort?: number | null;
}

/**
 * 批量口的一行（后端 `SectionAdminController.SectionForm` 的批量形状）：
 * 单行口的 key 在地址上，批量口的 key 只能在体里。
 *
 * <p>卡片页一次保存走的是这一条（Spec-D D4）：换序本来就是两栏一起动，逐栏点六次保存
 * 会把中间态留在库里，而一次原子整批不会。</p>
 */
export interface SectionBulkItem extends SectionForm {
  key: string;
}

/** AI 推导出来的一条栏目建议（后端 site-briefs 那条 advice 口的 items 元素） */
export interface SectionAdviceItem {
  /** 后端词表里的栏目 key；界面对不上这一页某一行时只当它是陌生 key，绝不新建一行 */
  sectionKey: string;
  /** 这一栏目的中文名，后端词表给的，前端不解释它的取值 */
  label: string;
  enabled: boolean;
  navVisible: boolean;
  navSort: number;
  /** 模型给出的中文理由，原样透传，不改写也不归纳 */
  reason: string;
}

/** 一条需求单的栏目建议全貌（generated=false 时 items 是空的，界面得能区分这两种「空」） */
export interface SectionAdviceView {
  generated: boolean;
  items: SectionAdviceItem[];
  generatedAt: string | null;
}

/**
 * 「这一口后端还没上线」的判据。
 *
 * <p>状态码在 `api/http.ts` 的响应拦截器里就被压成了一句中文（`describeHttpError` 的 404 分支），
 * 视图层拿不到 `error.response.status`。建议卡必须能区分「后端真的报错了」和「这一套还没做好」，
 * 而眼下能拿到的只有这一句固定文案——所以在这里比对一次，视图只管用。</p>
 */
export const MISSING_ENDPOINT_MESSAGE = '请求的内容不存在或已被删除';

export function isMissingEndpoint(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error ?? '');
  return text.includes(MISSING_ENDPOINT_MESSAGE);
}

export const portalSectionsApi = {
  /** 租户侧只读：本站栏目词表 + 开通态，工作台这一页唯一的数据源 */
  list: (siteId?: number | null) =>
    http.get<SectionState[]>('/portal/sections', { params: { siteId: siteId ?? undefined } }),

  summary: (key: string, siteId?: number | null) =>
    http.get<SectionSummary>(`/portal/sections/${encodeURIComponent(key)}/summary`, {
      params: { siteId: siteId ?? undefined }
    }),

  /** 以下两个端点是建设域（`portal:build:section`），租户令牌打过来应当真 403 */
  adminList: (siteId: number) =>
    http.get<SectionState[]>(`/admin/sites/${siteId}/sections`),

  adminUpdate: (siteId: number, key: string, form: SectionForm) =>
    http.put<SectionState>(`/admin/sites/${siteId}/sections/${encodeURIComponent(key)}`, form),

  /**
   * 一次保存整批（Spec-D D4）。整批原子：任一 key 不认识或重复，后端一条都不写并给中文原因。
   * 回的是改完之后的全量生效态——界面直接拿它覆盖本地，不自己拼「改了几条」。
   */
  adminBulkUpdate: (siteId: number, items: SectionBulkItem[]) =>
    http.put<SectionState[]>(`/admin/sites/${siteId}/sections/bulk`, items),

  /**
   * AI 推导栏目建议（读的是需求单、改的是栏目，所以端点挂在 site-briefs 下、客户端写在这一份文件里：
   * 它是栏目这件事的唯一接口面，另开一个 api 文件就会有两处找）。
   *
   * <p>生成那一发会真的调模型、要花租户配额，所以只有 `generate` 这一颗按钮发得出去，
   * 界面也绝不自动调它（项目纪律：付模型的口默认要人明确点一次）。</p>
   */
  advice: (briefId: number) =>
    http.get<SectionAdviceView>(`/admin/site-briefs/${briefId}/section-advice`),

  generateAdvice: (briefId: number) =>
    http.post<void>(`/admin/site-briefs/${briefId}/section-advice`)
};
