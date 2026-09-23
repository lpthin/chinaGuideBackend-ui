// 文章系统模块类型定义

// 文章分类
export interface ArticleCategory {
  id: number
  tenantId: number
  parentId: number | null
  name: string
  /** 站点内唯一，编辑器要能读回来 */
  code?: string
  slug?: string
  icon: string
  description: string
  sort: number
  status: string
  /** 演示内容包生成的栏目：门户与统计不算它 */
  isDemo?: boolean
  createdAt: string
  updatedAt: string
  children?: ArticleCategory[]
}

// 文章模板
export interface ArticleTemplate {
  id: number
  tenantId: number
  name: string
  description: string
  contentTemplate: string
  variables: string
  variableList?: TemplateVariable[]
  useCount: number
  status: string
  version?: string
  createdAt: string
  updatedAt: string
}

export interface TemplateVariable {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required: boolean
  defaultValue?: string
  options?: string[]
}

// 文章
export interface Article {
  id: number
  tenantId: number
  categoryId: number
  categoryName?: string
  templateId?: number | null
  title: string
  subtitle?: string
  summary: string
  content: string
  contentMd?: string
  coverImage: string
  featuredMediaId?: number
  keywords: string
  keywordList?: string[]
  tags?: string[]
  source: string
  authorId?: number
  authorName?: string
  viewCount: number
  likeCount: number
  /** 演示内容包生成的行：门户、sitemap 与统计都不算它 */
  isDemo?: boolean
  status: string
  isTop?: boolean
  isRecommend?: boolean
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
}

// 图片库
export interface ImageLibrary {
  id: number
  tenantId: number
  category: string
  name: string
  url: string
  thumbnail: string
  fileSize: number
  fileType: string
  width: number
  height: number
  tags: string
  useCount: number
  createdAt: string
  updatedAt: string
}

// 查询参数
export interface ArticleCategoryQuery {
  tenantId: number
  parentId?: number
  status?: string
  page?: number
  size?: number
}

export interface ArticleQuery {
  tenantId: number
  categoryId?: number | null
  status?: string
  keyword?: string
  page?: number
  size?: number
}

export interface ArticleTemplateQuery {
  tenantId: number
  status?: string
  page?: number
  size?: number
}

export interface ImageLibraryQuery {
  tenantId: number
  category?: string
  keyword?: string
  page?: number
  size?: number
}

// 创建/更新表单
export interface ArticleCategoryForm {
  id?: number
  tenantId: number
  parentId?: number | null
  name: string
  icon?: string
  description?: string
  sort?: number
  status?: string
}

export interface ArticleTemplateForm {
  id?: number
  tenantId: number
  name: string
  description?: string
  contentTemplate: string
  variables?: string
  status?: string
  version?: string
}

export interface ArticleForm {
  id?: number
  tenantId?: number
  categoryId?: number | null
  templateId?: number
  title: string
  subtitle?: string
  summary?: string
  content?: string
  contentMd?: string
  coverImage?: string
  featuredMediaId?: number
  keywords?: string
  tags?: string[]
  source?: string
  authorId?: number
  status?: string
  isTop?: boolean
  isRecommend?: boolean
}

/** 发布参数：后端只认 scheduledTime/priority，给了未来时间即入队，否则立即发布 */
export interface ArticlePublish {
  scheduledTime?: string
  priority?: number
}

/** 撤回发布的返回：jobId 指向那条被撤回的发布记录 */
export interface ArticleUnpublishResult {
  articleId: number
  jobId: number
  status: string
  unpublishedAt: string
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}
