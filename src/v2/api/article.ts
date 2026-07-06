// 文章系统模块 API
import http from './http'
import type {
  ArticleCategory,
  Article,
  ArticleTemplate,
  ImageLibrary,
  ArticleCategoryQuery,
  ArticleQuery,
  ArticleTemplateQuery,
  ImageLibraryQuery,
  ArticleCategoryForm,
  ArticleForm,
  ArticleTemplateForm,
  ArticlePublish,
  PageResult
} from '../types/article'

// 文章分类 API
export const articleCategoryApi = {
  // 获取分类列表（分页）
  list: (params: ArticleCategoryQuery) =>
    http.get<PageResult<ArticleCategory>>('/article/categories', { params }),

  // 获取全部分类（不分页）
  all: (tenantId: number) =>
    http.get<ArticleCategory[]>('/article/categories/all', { params: { tenantId } }),

  // 获取分类详情
  get: (id: number) =>
    http.get<ArticleCategory>(`/article/categories/${id}`),

  // 创建分类
  create: (data: ArticleCategoryForm) =>
    http.post<ArticleCategory>('/article/categories', data),

  // 更新分类
  update: (id: number, data: ArticleCategoryForm) =>
    http.put<ArticleCategory>(`/article/categories/${id}`, data),

  // 删除分类
  delete: (id: number) =>
    http.delete(`/article/categories/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/article/categories/batch', { data: ids })
}

// 文章模板 API
export const articleTemplateApi = {
  // 获取模板列表
  list: (params: ArticleTemplateQuery) =>
    http.get<PageResult<ArticleTemplate>>('/article/templates', { params }),

  // 获取模板详情
  get: (id: number) =>
    http.get<ArticleTemplate>(`/article/templates/${id}`),

  // 创建模板
  create: (data: ArticleTemplateForm) =>
    http.post<ArticleTemplate>('/article/templates', data),

  // 更新模板
  update: (id: number, data: ArticleTemplateForm) =>
    http.put<ArticleTemplate>(`/article/templates/${id}`, data),

  // 删除模板
  delete: (id: number) =>
    http.delete(`/article/templates/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/article/templates/batch', { data: ids })
}

// 文章管理 API
export const articleManageApi = {
  // 获取文章列表（分页）
  list: (params: ArticleQuery) =>
    http.get<PageResult<Article>>('/articles', { params }),

  // 搜索文章
  search: (params: ArticleQuery) =>
    http.get<PageResult<Article>>('/articles/search', { params }),

  // 获取文章详情
  get: (id: number) =>
    http.get<Article>(`/articles/${id}`),

  // 创建文章
  create: (data: ArticleForm) =>
    http.post<Article>('/articles', data),

  // 更新文章
  update: (id: number, data: ArticleForm) =>
    http.put<Article>(`/articles/${id}`, data),

  // 删除文章
  delete: (id: number) =>
    http.delete(`/articles/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/articles/batch', { data: ids }),

  // 发布文章
  publish: (id: number, data?: ArticlePublish) =>
    http.put<Article>(`/articles/${id}/publish`, data || {}),

  // 点赞文章
  like: (id: number) =>
    http.post(`/articles/${id}/like`),

  // 分享文章（增加统计）
  share: (id: number) =>
    http.post(`/articles/${id}/share`)
}

// 图片库 API
export const imageLibraryApi = {
  // 获取图片列表
  list: (params: ImageLibraryQuery) =>
    http.get<PageResult<ImageLibrary>>('/media', { params }),

  // 搜索图片
  search: (params: ImageLibraryQuery) =>
    http.get<PageResult<ImageLibrary>>('/media', { params }),

  // 获取图片详情
  get: (id: number) =>
    http.get<ImageLibrary>(`/media/${id}`),

  // 上传图片
  upload: (formData: FormData, onProgress?: (progress: number) => void) =>
    http.post<ImageLibrary>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      }
    }),

  // 批量上传
  uploadBatch: (formData: FormData, onProgress?: (progress: number) => void) =>
    http.post<ImageLibrary[]>('/media/upload-batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      }
    }),

  // 删除图片
  delete: (id: number) =>
    http.delete(`/media/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/media/batch', { data: ids })
}

export default {
  category: articleCategoryApi,
  template: articleTemplateApi,
  article: articleManageApi,
  image: imageLibraryApi
}
