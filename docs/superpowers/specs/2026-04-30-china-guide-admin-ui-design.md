# China Guide 后台管理 UI 设计

日期：2026-04-30

## 目标

为 China Guide / GeoCMS Phase 1 后端提供一个可用的 PC 管理后台，跑通内容生产最小闭环：登录 → 站点/栏目配置 → 关键词导入与蒸馏 → 文章草稿生成 → 审核 → dry-run/发布。

首版目标是快速可用，不追求复杂权限、移动端或高级运营能力。

## 技术栈

- Vue 3
- Vite
- TypeScript
- Element Plus
- Pinia
- Vue Router
- Axios

首版仅支持 PC 后台视图。

## 布局方向

采用经典后台布局：左侧固定菜单、顶部工具栏、右侧主内容区。

左侧菜单：

1. 仪表盘
2. 站点管理
3. 栏目管理
4. 关键词库
5. 内容草稿
6. 审核中心
7. 发布任务

顶部工具栏：

- 当前站点选择器
- 当前登录用户
- 退出登录

## MVP 页面范围

### 登录页

功能：

- 输入用户名和密码
- 调用 `POST /api/admin/auth/login`
- 保存 token 和用户信息
- 登录成功后进入仪表盘
- 登录失败展示错误提示

### 仪表盘

功能：

- 展示当前站点的内容生产概览
- 展示关键词数量、聚类数量、文章数量、待审核数量、可发布数量
- 提供快捷入口：导入关键词、生成草稿、进入审核、dry-run 发布

首版统计可通过已有列表接口在前端聚合；如后端暂缺精确统计，页面展示列表聚合值或占位提示。

### 站点管理

接口：

- `GET /api/admin/sites`
- `POST /api/admin/sites`
- `GET /api/admin/sites/{id}`
- `PUT /api/admin/sites/{id}`

功能：

- 站点列表
- 新建站点
- 编辑站点基础信息
- 选择当前站点作为全局上下文

### 栏目管理

接口：

- `GET /api/admin/sites/{siteId}/categories`
- `POST /api/admin/sites/{siteId}/categories`
- `PUT /api/admin/categories/{id}`

功能：

- 按当前站点展示栏目列表
- 新建栏目
- 编辑栏目
- 支持父子级字段展示，首版可用表格缩进或普通表格

### 关键词库

接口：

- `GET /api/admin/sites/{siteId}/keywords`
- `POST /api/admin/sites/{siteId}/keywords/import`
- `POST /api/admin/sites/{siteId}/keywords/distill`
- `GET /api/admin/sites/{siteId}/keywords/clusters`

功能：

- 关键词列表
- 批量导入关键词文本
- 触发 AI 蒸馏
- 查看关键词聚类
- 从聚类触发文章草稿生成

### 内容草稿 / 文章列表

接口：

- `POST /api/admin/sites/{siteId}/content-drafts/generate`
- `POST /api/admin/sites/{siteId}/content-drafts/generate-daily`
- `GET /api/admin/sites/{siteId}/articles`
- `GET /api/admin/articles/{articleId}/versions`

功能：

- 查看文章列表与状态
- 根据聚类生成中文文章草稿
- 查看文章版本详情，包括标题、摘要、正文 Markdown、SEO 字段、FAQ、Schema、llms 摘要、GEO 引用摘要
- 首版不做富文本编辑；正文详情以只读 Markdown / pre 展示为主

### 审核中心

接口：

- `POST /api/admin/articles/{id}/human-review`
- `POST /api/admin/articles/{id}/ai-review`
- `POST /api/admin/sites/{siteId}/articles/review-pending-before-nine`

功能：

- 筛选待审核文章
- 人工通过/驳回
- 填写审核意见
- 触发 AI 审核
- 查看审核后文章状态

### 发布任务

接口：

- `POST /api/admin/articles/{id}/publish/dry-run`
- `POST /api/admin/articles/{id}/publish`

功能：

- 对 approved 文章执行 dry-run
- 展示目标输出路径和影响文件
- 正式发布按钮需要二次确认
- 发布失败展示后端错误信息

首版没有发布任务列表接口时，页面可在当前会话中展示最近操作结果；任务历史后续补后端接口。

## 暂缓范围

以下功能不进入首版：

- 用户/角色/权限 CRUD
- 媒体库
- 表单设计器
- 评论、点赞、前台用户登录
- 统计分析与广告管理
- 移动端适配
- 富文本编辑器
- 多语言内容编辑

## 状态管理

Pinia stores：

- `authStore`：token、用户信息、登录/退出
- `siteStore`：站点列表、当前站点
- `appStore`：全局加载、错误提示等轻量 UI 状态

Token 存储：

- 首版使用 `localStorage`
- Axios 请求拦截器自动附加 `Authorization: Bearer <token>`
- 401 响应清理登录态并跳转登录页

## 路由设计

- `/login`
- `/` → redirect `/dashboard`
- `/dashboard`
- `/sites`
- `/categories`
- `/keywords`
- `/articles`
- `/reviews`
- `/publishing`

所有后台路由需要登录守卫。

## API 封装

按领域拆分 API 文件：

- `api/http.ts`
- `api/auth.ts`
- `api/sites.ts`
- `api/categories.ts`
- `api/keywords.ts`
- `api/articles.ts`
- `api/reviews.ts`
- `api/publishing.ts`

统一处理后端响应结构：

```ts
interface ApiResponse<T> {
  success: boolean
  code: string
  message: string
  data: T
}
```

当 `success=false` 时抛出业务错误并展示 `message`。

## 错误处理

- 表单校验错误：页面内提示
- API 业务错误：Element Plus message 弹出
- 登录过期：跳转登录
- 发布类操作：保留错误详情在结果区，方便排查

## 测试与验证

首版验证以构建和手动冒烟为主：

- `npm install`
- `npm run build`
- 登录成功
- 当前站点选择成功
- 导入关键词成功
- 蒸馏关键词成功
- 生成文章草稿成功
- 人工审核通过成功
- dry-run 发布成功

后续可补充 Vitest 单元测试和 Playwright E2E。

## 实施策略

1. 初始化 Vite Vue TypeScript 项目。
2. 接入 Element Plus、Pinia、Vue Router、Axios。
3. 先完成登录和主布局。
4. 再按业务闭环顺序实现：站点 → 栏目 → 关键词 → 文章 → 审核 → 发布。
5. 每个阶段至少执行一次构建验证。
