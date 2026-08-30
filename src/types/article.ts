// 文章系统模块类型定义

// 文章分类
export interface ArticleCategory {
  id: number
  tenantId: number
  parentId: number | null
  name: string
  icon: string
  description: string
  sort: number
  status: string
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
  views?: number
  viewCount: number
  likeCount: number
  shareCount: number
  sort: number
  sortOrder?: number
  status: string
  isTop?: boolean
  isRecommend?: boolean
  publishAt: string
  createdAt: string
  updatedAt: string
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
  sort?: number
  sortOrder?: number
  status?: string
  isTop?: boolean
  isRecommend?: boolean
}

export interface ArticlePublish {
  id: number
  scheduledAt?: string
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}
