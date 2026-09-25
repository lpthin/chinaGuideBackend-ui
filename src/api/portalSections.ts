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
    http.put<SectionState>(`/admin/sites/${siteId}/sections/${encodeURIComponent(key)}`, form)
};
