# 🚀 AI 门户网站 v2 开发启动清单

> 前端团队开发指南和任务分配

---

## 📋 目录

1. [项目概述](#项目概述)
2. [技术栈](#技术栈)
3. [项目结构](#项目结构)
4. [任务分配看板](#任务分配看板)
5. [开发流程](#开发流程)
6. [API 对接指南](#api-对接指南)
7. [测试计划](#测试计划)
8. [发布计划](#发布计划)

---

## 项目概述

### 项目目标

开发一套完整的 v2 版本内容管理系统，包含：
- 📚 **知识库系统** - 知识分类、卡片管理、标签、阅读记录
- ✍️ **文章系统** - 文章分类、文章管理、模板、图片库
- 🏢 **门户网站** - Banner、招聘、站内信、留言板、企业信息、SEO
- 📊 **运营管理** - 客户案例、数据报表、运营统计

### 里程碑计划

| 阶段 | 目标 | 时间 | 负责人 |
|------|------|------|--------|
| **Phase 1** | 知识库模块上线 | Week 1-2 | 开发组 A |
| **Phase 2** | 文章系统模块上线 | Week 2-3 | 开发组 B |
| **Phase 3** | 门户网站模块上线 | Week 3-4 | 开发组 C |
| **Phase 4** | 运营管理模块上线 | Week 4-5 | 开发组 A |
| **Phase 5** | 全功能联调测试上线 | Week 5 | 全体 |

---

## 技术栈

```json
{
  "框架": "Vue 3.3+",
  "类型系统": "TypeScript 5+",
  "构建工具": "Vite 5+",
  "路由": "Vue Router 4+",
  "状态管理": "Pinia",
  "UI 组件库": "Ant Design Vue 4+",
  "HTTP 客户端": "Axios",
  "图表库": "ECharts 5+",
  "富文本编辑器": "TinyMCE / Quill",
  "代码规范": "ESLint + Prettier"
}
```

---

## 项目结构

```bash
src/v2/
├── api/                          # API 层 ✅ 已完成
│   ├── knowledge.ts             # 知识库 API (15+)
│   ├── article.ts               # 文章系统 API (20+)
│   ├── portal.ts                # 门户网站 API (30+)
│   ├── operation.ts             # 运营管理 API (15+)
│   ├── http.ts                  # Axios 封装
│   └── index.ts                 # 统一导出
├── types/                        # 类型定义 ✅ 已完成
│   ├── knowledge.ts             # 知识库类型
│   ├── article.ts               # 文章系统类型
│   ├── portal.ts                # 门户网站类型
│   ├── operation.ts             # 运营管理类型
│   └── index.ts                 # 统一导出
├── router/                       # 路由配置 ✅ 已完成
│   └── index.ts                 # 30+ 路由配置
├── views/workspace/              # 工作区组件
│   └── (已有页面 15+)          # 基础页面
├── views/knowledge/              # 📚 知识库模块 (待开发)
│   ├── KnowledgeCategoryView.vue
│   ├── KnowledgeCardListView.vue
│   ├── KnowledgeCardDetailView.vue
│   ├── KnowledgeCardEditView.vue
│   └── KnowledgeTagView.vue
├── views/article/                # ✍️ 文章系统模块 (待开发)
│   ├── ArticleCategoryView.vue
│   ├── ArticleListView.vue
│   ├── ArticleDetailView.vue
│   ├── ArticleEditView.vue
│   ├── ArticleTemplateView.vue
│   └── ImageLibraryView.vue
├── views/portal/                 # 🏢 门户网站模块 (待开发)
│   ├── BannerManageView.vue
│   ├── JobPostManageView.vue
│   ├── PortalMessageView.vue
│   ├── GuestbookManageView.vue
│   ├── CompanyInfoView.vue
│   └── SeoConfigView.vue
└── views/operation/              # 📊 运营管理模块 (待开发)
    ├── CustomerCaseView.vue
    ├── DataReportView.vue
    └── OperationDashboardView.vue
```

---

## 任务分配看板

### 🎯 优先级定义

| 优先级 | 标识 | 说明 |
|--------|------|------|
| P0 | 🔴 | 阻塞开发，必须立即解决 |
| P1 | 🟠 | 重要功能，本迭代必须完成 |
| P2 | 🟡 | 次要功能，本迭代可选完成 |
| P3 | ⚪ | 优化/增强，后续迭代 |

---

### 👥 开发组 A - 知识库 & 运营管理

#### 📋 任务清单

| ID | 任务名称 | 优先级 | 预估工时 | 负责人 | 状态 | 依赖 |
|----|----------|--------|----------|--------|------|------|
| **K-01** | **知识分类页面** | 🟠 P1 | 1d | **待分配** | ⏳ 待开始 | - |
| K-02 | 知识卡片列表页 | 🟠 P1 | 1.5d | 待分配 | ⏳ 待开始 | K-01 |
| K-03 | 知识卡片详情页 | 🟠 P1 | 1d | 待分配 | ⏳ 待开始 | K-02 |
| K-04 | 知识卡片编辑页 | 🟠 P1 | 2d | 待分配 | ⏳ 待开始 | K-03 |
| K-05 | 知识标签管理页 | 🟡 P2 | 0.5d | 待分配 | ⏳ 待开始 | - |
| **O-01** | **运营概览页** | 🟠 P1 | 1.5d | 待分配 | ⏳ 待开始 | - |
| O-02 | 客户案例管理页 | 🟡 P2 | 1d | 待分配 | ⏳ 待开始 | - |
| O-03 | 数据报表管理页 | 🟡 P2 | 1.5d | 待分配 | ⏳ 待开始 | - |

#### 📝 页面功能说明

**K-01 知识分类页面**
- ✅ 分类树形展示
- ✅ 新增/编辑/删除分类
- ✅ 分类排序（拖拽）
- ✅ 启用/禁用分类
- ✅ 搜索/筛选功能

**K-02 知识卡片列表页**
- ✅ 卡片列表展示（卡片视图/列表视图切换）
- ✅ 按分类筛选
- ✅ 搜索功能（标题/内容/标签）
- ✅ 分页功能
- ✅ 批量操作（删除/移动分类）
- ✅ 统计信息（浏览量、点赞数）

**K-03 知识卡片详情页**
- ✅ 卡片详情展示（富文本）
- ✅ 阅读计数
- ✅ 点赞功能
- ✅ 标签展示
- ✅ 关联卡片推荐

**K-04 知识卡片编辑页**
- ✅ 富文本编辑器集成
- ✅ 分类选择
- ✅ 标签选择/新增
- ✅ 封面图上传
- ✅ 预览功能
- ✅ 保存草稿/发布

**K-05 知识标签管理页**
- ✅ 标签列表
- ✅ 标签使用次数统计
- ✅ 新增/编辑/删除标签
- ✅ 标签颜色设置

**O-01 运营概览页**
- ✅ 核心指标卡片（总浏览、总文章、总案例等）
- ✅ 趋势图表（日/周/月）
- ✅ 热门文章 TOP10
- ✅ 热门案例 TOP5
- ✅ 最新动态列表

**O-02 客户案例管理页**
- ✅ 案例列表
- ✅ 案例编辑/新增
- ✅ 行业分类筛选
- ✅ 案例排序
- ✅ 启用/禁用案例

**O-03 数据报表管理页**
- ✅ 报表列表
- ✅ 创建报表（选择类型、日期范围）
- ✅ 报表导出（Excel/PDF）
- ✅ 报表预览（图表展示）

---

### 👥 开发组 B - 文章系统

#### 📋 任务清单

| ID | 任务名称 | 优先级 | 预估工时 | 负责人 | 状态 | 依赖 |
|----|----------|--------|----------|--------|------|------|
| **A-01** | **文章分类管理页** | 🟠 P1 | 1d | **待分配** | ⏳ 待开始 | - |
| A-02 | 文章列表页 | 🟠 P1 | 1.5d | 待分配 | ⏳ 待开始 | A-01 |
| A-03 | 文章详情页 | 🟠 P1 | 1d | 待分配 | ⏳ 待开始 | A-02 |
| A-04 | 文章编辑页 | 🟠 P1 | 3d | 待分配 | ⏳ 待开始 | A-03 |
| A-05 | 文章模板管理页 | 🟡 P2 | 1.5d | 待分配 | ⏳ 待开始 | - |
| A-06 | 图片库管理页 | 🟡 P2 | 2d | 待分配 | ⏳ 待开始 | - |

#### 📝 页面功能说明

**A-01 文章分类管理页**
- ✅ 分类树状展示
- ✅ 新增/编辑/删除分类
- ✅ 分类排序
- ✅ SEO 配置（每个分类）

**A-02 文章列表页**
- ✅ 文章列表（表格视图）
- ✅ 按分类/状态筛选
- ✅ 搜索功能（标题/摘要/关键词）
- ✅ 分页功能
- ✅ 批量操作（删除/移动分类/变更状态）
- ✅ 发布/下架功能

**A-03 文章详情页**
- ✅ 文章详情展示
- ✅ 浏览/点赞/分享计数
- ✅ 关键词展示
- ✅ 来源/作者信息
- ✅ 编辑入口

**A-04 文章编辑页**
- ✅ 富文本编辑器
- ✅ 分类选择
- ✅ 关键词设置
- ✅ 封面图上传
- ✅ 模板选择（从模板库）
- ✅ 文章摘要自动生成
- ✅ 预览功能
- ✅ 保存草稿/立即发布/定时发布

**A-05 文章模板管理页**
- ✅ 模板列表
- ✅ 模板变量配置
- ✅ 新增/编辑/删除模板
- ✅ 模板预览
- ✅ 使用次数统计

**A-06 图片库管理页**
- ✅ 图片列表（网格/列表视图）
- ✅ 按分类/标签筛选
- ✅ 图片搜索
- ✅ 批量上传（带进度）
- ✅ 图片编辑（裁剪/压缩）
- ✅ 图片分类管理
- ✅ 使用统计

---

### 👥 开发组 C - 门户网站

#### 📋 任务清单

| ID | 任务名称 | 优先级 | 预估工时 | 负责人 | 状态 | 依赖 |
|----|----------|--------|----------|--------|------|------|
| **P-01** | **Banner 管理页** | 🟠 P1 | 1d | **待分配** | ⏳ 待开始 | - |
| P-02 | 招聘管理页 | 🟡 P2 | 1.5d | 待分配 | ⏳ 待开始 | - |
| P-03 | 站内信管理页 | 🟡 P2 | 1.5d | 待分配 | ⏳ 待开始 | - |
| P-04 | 留言板管理页 | 🟡 P2 | 1d | 待分配 | ⏳ 待开始 | - |
| P-05 | 企业信息配置页 | 🟡 P2 | 1d | 待分配 | ⏳ 待开始 | - |
| P-06 | SEO 配置管理页 | 🟡 P2 | 1d | 待分配 | ⏳ 待开始 | - |

#### 📝 页面功能说明

**P-01 Banner 管理页**
- ✅ Banner 列表展示（按位置）
- ✅ 新增/编辑 Banner
- ✅ 图片上传/裁剪
- ✅ 跳转链接配置
- ✅ 发布时间配置（定时上下线）
- ✅ 排序/拖拽调整
- ✅ 启用/禁用
- ✅ 点击量统计

**P-02 招聘管理页**
- ✅ 职位列表
- ✅ 新增/编辑/删除职位
- ✅ 职位分类（按部门/类型）
- ✅ 发布/下架职位
- ✅ 简历申请列表
- ✅ 简历状态管理（待处理/面试中/已录用/已拒绝）
- ✅ 导出简历数据

**P-03 站内信管理页**
- ✅ 消息列表（收件箱/发件箱）
- ✅ 发送消息
- ✅ 消息详情
- ✅ 标记已读/未读
- ✅ 批量删除
- ✅ 未读消息数统计

**P-04 留言板管理页**
- ✅ 留言列表
- ✅ 按状态筛选（待审核/已发布/已拒绝）
- ✅ 留言详情
- ✅ 回复留言
- ✅ 审核通过/拒绝
- ✅ 删除留言

**P-05 企业信息配置页**
- ✅ 基本信息配置（名称、Logo、简介、地址、电话、邮箱、官网）
- ✅ 营业时间配置
- ✅ 社交媒体链接（微信、微博、抖音等）
- ✅ 版权信息配置
- ✅ 预览效果

**P-06 SEO 配置管理页**
- ✅ 各页面 SEO 配置列表（首页、列表页、详情页等）
- ✅ SEO 配置编辑（Title、Meta Keywords、Meta Description、OG 标签等）
- ✅ 页面类型管理
- ✅ 配置预览（搜索结果预览）

---

## 开发流程

### 📝 标准开发流程

```
1. 领取任务（每日站会）
   ↓
2. 创建 Feature 分支 (git checkout -b feature/module-name)
   ↓
3. 开发（组件化开发 + 类型检查）
   ↓
4. 本地测试（API 联调 + E2E 测试）
   ↓
5. 代码 Review（MR/PR 审批）
   ↓
6. 合并到 develop 分支
   ↓
7. 测试环境部署验证
   ↓
8. ✅ 任务完成，更新看板
```

### 🎯 开发规范

#### TypeScript 严格模式

```typescript
// ✅ 推荐：完整类型定义
import type { KnowledgeCard, KnowledgeCategory, PageResult } from '@/v2/types'
import { knowledgeCardApi, knowledgeCategoryApi } from '@/v2/api'

// 响应式数据严格类型
const cardList = ref<KnowledgeCard[]>([])
const pagination = reactive<{ page: number; size: number; total: number }>({
  page: 1,
  size: 10,
  total: 0
})

// API 调用
const fetchCards = async () => {
  const res: PageResult<KnowledgeCard> = await knowledgeCardApi.list({
    tenantId: 1,
    page: pagination.page,
    size: pagination.size
  })
  cardList.value = res.records
  pagination.total = res.total
}
```

#### 组件规范

```vue
<script setup lang="ts">
// ✅ 推荐：单文件组件规范
import { ref, reactive, onMounted } from 'vue'
import { Button, Table, Modal, Form, Input, Select } from 'ant-design-vue'
import type { KnowledgeCategory } from '@/v2/types'
import { knowledgeCategoryApi } from '@/v2/api'

// Props 定义
const props = defineProps<{
  visible: boolean
  record?: KnowledgeCategory | null
}>()

// Emits 定义
const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void
  (e: 'success'): void
}>()

// 响应式数据
const loading = ref(false)
const formRef = ref()
const formData = reactive<Partial<KnowledgeCategory>>({
  tenantId: 1,
  name: '',
  description: '',
  status: 'active'
})

// 生命周期
onMounted(() => {
  if (props.record) {
    Object.assign(formData, props.record)
  }
})

// 方法定义
const handleSubmit = async () => {
  // ...
}
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="record ? '编辑分类' : '新增分类'"
    @ok="handleSubmit"
    @cancel="emit('update:visible', false)"
  >
    <Form ref="formRef" :model="formData" layout="vertical">
      <!-- Form Items -->
    </Form>
  </Modal>
</template>

<style scoped lang="scss">
// 样式使用 BEM 规范
</style>
```

---

## API 对接指南

### ✅ API 状态（已就绪）

所有 v2 API 已完成封装，可以直接使用：

```typescript
import {
  // 📚 知识库
  knowledgeCategoryApi,
  knowledgeCardApi,
  knowledgeTagApi,
  knowledgeReadRecordApi,

  // ✍️ 文章系统
  articleCategoryApi,
  articleApi,
  articleTemplateApi,
  imageLibraryApi,

  // 🏢 门户网站
  bannerApi,
  jobPostApi,
  jobApplicationApi,
  portalMessageApi,
  guestbookApi,
  companyInfoApi,
  seoConfigApi,

  // 📊 运营管理
  customerCaseApi,
  dataReportApi,
  operationStatsApi
} from '@/v2/api'
```

### 🔧 调试工具

1. **Knife4j API 文档**：http://localhost:8080/doc.html
2. **Chrome DevTools**：Network 面板查看请求
3. **Mock 数据**：如需 Mock，可在 http.ts 中拦截请求

### 📚 参考文档

- **FRONTEND_INTEGRATION_GUIDE.md** - 详细对接指南（1250+ 行）
  - 所有类型定义说明
  - 所有 API 用法示例
  - 常见问题解答
  - 工具函数推荐

---

## 测试计划

### 单元测试

```typescript
// tests/v2/knowledge.spec.ts - 示例
import { describe, it, expect } from 'vitest'
import { knowledgeCategoryApi } from '@/v2/api'

describe('Knowledge Module', () => {
  it('should fetch category list', async () => {
    const res = await knowledgeCategoryApi.list({ tenantId: 1, page: 1, size: 10 })
    expect(res.records).toBeDefined()
    expect(res.total).toBeGreaterThanOrEqual(0)
  })
})
```

### E2E 测试

使用 Playwright 进行端到端测试（后续配置）

---

## 发布计划

### 环境配置

| 环境 | URL | 说明 |
|------|-----|------|
| DEV | http://dev.xxx.com | 开发联调 |
| TEST | http://test.xxx.com | 测试验证 |
| PRE | http://pre.xxx.com | 预发布验证 |
| PROD | http://xxx.com | 正式环境 |

### 版本计划

| 版本 | 发布时间 | 包含模块 |
|------|----------|----------|
| v2.0.0-alpha | Week 2 | 知识库模块 |
| v2.0.0-beta | Week 3 | + 文章系统模块 |
| v2.0.0-rc | Week 4 | + 门户网站模块 |
| v2.0.0-release | Week 5 | + 运营管理模块 |