import http from './http';

/**
 * 租户侧「网站信息」适配层（Spec-C §6.4 / §7 那张表里 GeoSeoConfigView+GeoSeoCompanyView 并入的那一页，
 * §8 P5 行的验收对象；后端契约 = SiteInfoController，路径 /api/portal/site-info）。
 *
 * 为什么所有形状都收在这一个文件：这一页对的是另一路并行、仍在写的后端（cgBackendP5）。
 * 契约一旦变（DTO 字段名、路径、动词），只需要改这一份，视图不动。视图里也不抄第二份中文词表（I-1）：
 * 字段名、来源标签、可勾选项、状态中文一律来自这里读回的接口，取不到就露原码，绝不本地编一份。
 *
 * 观察自后端的真实端点（http 实例 baseURL 已是 /api，这里不再写 /api 前缀）：
 * - GET    /portal/site-info?siteId=            → SiteInfoView（每项当前值 + 是谁写的 + 能不能改）
 * - GET    /portal/site-info/fields             → { key: 中文名 }
 * - GET    /portal/site-info/change-sources     → { key: 中文标签 }（ai_brief_seo→AI 生成、tenant_edit→人工修改）
 * - GET    /portal/site-info/crawler-options    → [{ id, userAgent, vendor, label }]（表单初始化，不含允许状态）
 * - PUT    /portal/site-info                    body { siteId, fields: { key: FieldPatch } } → SiteInfoView
 * - POST   /portal/site-info/ai-rewrite         body { siteId, fields: [key], instruction } → RewriteResult
 * - GET    /portal/site-info/pages/seo?siteId=  → 逐页 SEO 只读镜像（租户看得到，写仍只在超管页面搭建）
 */

/** 信息项的 key（后端 SiteInfoFields）；robots 是唯一带结构化形态的那一项 */
export const SITE_INFO_FIELD_KEYS = ['robots', 'llms_summary', 'geo_citation_summary', 'llms_txt_template'] as const;

/** robots 的档位（后端 RobotsTxtPolicy）：勾选集合推导 或 人工覆写原文，一次只认一档 */
export const ROBOTS_MODE_STRUCTURED = 'structured';
export const ROBOTS_MODE_RAW_OVERRIDE = 'raw_override';

/** 「让 AI 重写」当前口径：本期不接模型，generated 恒 false，只登记（界面不许演成已经改好） */
export const REWRITE_NOT_GENERATED_YET_TEXT =
  '重写请求已登记。AI 生成这一条链路还没有接入，本次没有产生任何内容，上面这些字段的现值保持原样。';

/** 「AI 先填好、租户只在不同意时改它」——这一页没有一项是租户必须从零填的（R-4 / §6.4） */
export const SITE_INFO_AI_FIRST_TEXT =
  '下面这些站点信息是 AI 按你的需求单先填好的，你不用从头填——只有不同意时才改它。这一页没有任何一项是「必须你来填」的。';

/** /crawler-options 一行 */
export interface CrawlerOption {
  id: string;
  userAgent: string;
  vendor: string;
  label: string;
}

/** robots.structured.crawlers 一行（比 /crawler-options 多一个 allowed 当前状态） */
export interface CrawlerState extends CrawlerOption {
  allowed: boolean;
}

/** robots 那一项的结构化状态（后端 robotsState） */
export interface RobotsStructured {
  mode: string;
  crawlers: CrawlerState[];
  overrideText: string | null;
  exportedText: string;
}

/** 一个信息项的读回（后端 SiteInfoService.FieldView） */
export interface SiteInfoFieldView {
  key: string;
  label: string;
  editable: boolean;
  /** ai_brief_seo / tenant_edit / null（未记录，不猜） */
  changeSource: string | null;
  /** 后端给的中文标签，含「未记录」这一如实说法 */
  changeSourceLabel: string;
  text: string | null;
  structured?: RobotsStructured | null;
}

/** 整页读回（后端 SiteInfoService.SiteInfoView） */
export interface SiteInfoView {
  tenantId: number | null;
  siteId: number | null;
  siteName: string | null;
  siteStatus: string | null;
  configId: number | null;
  fields: Record<string, SiteInfoFieldView>;
}

/** 一个信息项的写入内容（后端 SiteInfoService.FieldPatch）：robots 用 crawlers/overrideText（二选一），文本项用 text */
export interface FieldPatch {
  crawlers?: string[];
  overrideText?: string;
  text?: string;
}

/** 「让 AI 重写」登记结果（后端 RewriteResult）：generated 恒 false，message 原话说明没产生内容 */
export interface RewriteResult {
  requestId: number;
  fields: string[];
  generated: boolean;
  message: string;
}

/** 逐页 SEO 只读镜像一行（后端 pagesSeo 的一行 Map） */
export interface PageSeoRow {
  pageId: number;
  slug: string;
  title: string;
  pageKind: string;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
}

export const siteInfoApi = {
  read: (siteId?: number | null) =>
    http.get<SiteInfoView>('/portal/site-info', { params: { siteId: siteId ?? undefined } }),

  /** 信息项词表 key→中文名：界面显示字段名只认这里（I-1，视图不抄第二份） */
  fields: () => http.get<Record<string, string>>('/portal/site-info/fields'),

  /** 来源词表 key→中文标签：那个「AI 生成 / 人工修改」角标只有这一个来源 */
  changeSources: () => http.get<Record<string, string>>('/portal/site-info/change-sources'),

  crawlerOptions: () => http.get<CrawlerOption[]>('/portal/site-info/crawler-options'),

  update: (body: { siteId?: number | null; fields: Record<string, FieldPatch> }) =>
    http.put<SiteInfoView>('/portal/site-info', body),

  aiRewrite: (body: { siteId?: number | null; fields: string[]; instruction?: string | null }) =>
    http.post<RewriteResult>('/portal/site-info/ai-rewrite', body),

  pagesSeo: (siteId?: number | null) =>
    http.get<PageSeoRow[]>('/portal/site-info/pages/seo', { params: { siteId: siteId ?? undefined } })
};

/**
 * 把读回的 fields 按后端词表顺序摊成数组给界面循环（不依赖 Object.keys 顺序，也不在前端重排语义）。
 * 只认后端给过的 key，多出来的（将来新字段）原样附在尾部，绝不丢弃、也不补一个后端没给过的字段。
 */
export function siteInfoFieldRows(view: SiteInfoView | null): SiteInfoFieldView[] {
  if (!view?.fields) return [];
  const entries = Object.entries(view.fields);
  const byKey = new Map(entries);
  const rows: SiteInfoFieldView[] = [];
  SITE_INFO_FIELD_KEYS.forEach(key => {
    const row = byKey.get(key);
    if (row) rows.push(row);
  });
  entries.forEach(([key, row]) => {
    if (!(SITE_INFO_FIELD_KEYS as readonly string[]).includes(key)) rows.push(row);
  });
  return rows;
}

/**
 * 来源角标的颜色：只按后端那个 ASCII 码上色（颜色是装饰，不是「是谁说的」的说法——说法来自 changeSourceLabel）。
 * 认不出的码一律走默认灰，不猜语义。
 */
export function changeSourceColor(source: string | null | undefined): string {
  if (source === 'ai_brief_seo') return 'blue';
  if (source === 'tenant_edit') return 'orange';
  return 'default';
}
