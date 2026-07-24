# 系统模块审视与完善 - 产品需求文档

## Overview
- **Summary**: 对系统 v2 各模块进行全面审视，识别缺失功能、路由问题、代码质量问题，并制定完善计划，确保系统功能完整、路由正确、代码规范。
- **Purpose**: 系统经过快速迭代后，存在部分模块路由缺失、功能不完整、代码质量参差不齐等问题，需要系统性梳理和完善。
- **Target Users**: 系统管理员、运营人员、开发团队

## Goals
- 修复路由冲突和缺失问题，确保所有页面可正常访问
- 完善缺失的功能模块，补齐菜单和路由
- 清理代码中的调试日志和 mock 数据
- 提升代码质量和用户体验
- 消除 404 错误

## Non-Goals (Out of Scope)
- 后端 API 接口开发（仅前端完善）
- 大规模重构现有功能
- 新增未规划的业务功能
- 性能优化和架构调整

## Background & Context
系统 v2 版本包含以下主要模块：
1. **内容生产工作流**：热词管理、聚类分析、AI生成、审核管理、发布管理
2. **文章管理**：文章列表、栏目管理、软文模板
3. **知识库**：仪表板、资料库、知识卡片、知识图谱、分类、标签
4. **案例管理**：案例列表
5. **计费系统**：账单管理、消费统计
6. **门户网站**：模板管理、Banner、招聘、站内信、留言、企业信息、SEO
7. **GEO地理**：行政区划、门店管理、附近门店
8. **AI配置**：大模型、向量数据库、向量化、用量监控、模板库
9. **运营管理**：运营概览、客户案例、数据报表
10. **系统管理**：站点、租户、用户、角色、权限、Prompt、设置、审计日志
11. **报警管理**：报警规则、报警记录、通知渠道

## Functional Requirements
- **FR-1**: 修复路由冲突问题（首页 `/` 同时映射门户首页和工作区重定向）
- **FR-2**: 添加 404 页面路由，处理未匹配路径
- **FR-3**: 补齐计费系统缺失路由（钱包、发票、订单）
- **FR-4**: 补齐客户管理模块路由和菜单
- **FR-5**: 补齐图片库模块路由和菜单
- **FR-6**: 清理生产代码中的 console.log 调试语句
- **FR-7**: 清理或替换页面中的 mock 数据为真实 API 调用

## Non-Functional Requirements
- **NFR-1**: 所有路由可正常访问，无 404 错误
- **NFR-2**: 编译通过，无 TypeScript 错误
- **NFR-3**: 菜单导航与路由配置一致
- **NFR-4**: 代码中不包含生产环境不需要的调试日志

## Constraints
- **Technical**: Vue 3 + TypeScript + Vue Router 4 + Ant Design Vue
- **Business**: 不改变现有业务逻辑和用户操作流程
- **Dependencies**: 依赖后端 API 接口，如接口缺失需标注

## Assumptions
- 后端 API 接口已基本就绪
- 现有功能模块的 UI 已基本完成
- 用户希望优先解决路由和功能完整性问题

## Acceptance Criteria

### AC-1: 路由冲突解决
- **Given**: 用户访问首页 `/`
- **When**: 用户已登录
- **Then**: 跳转到工作区仪表板 `/workspace/dashboard`
- **Verification**: `programmatic`
- **Notes**: 未登录时访问 `/` 应显示门户首页或跳转到登录页

### AC-2: 404 页面
- **Given**: 用户访问不存在的路径
- **When**: 输入任意未配置的 URL
- **Then**: 显示 404 页面，提供返回首页链接
- **Verification**: `human-judgment`

### AC-3: 计费系统路由完整
- **Given**: 用户有计费系统访问权限
- **When**: 查看计费系统菜单
- **Then**: 包含账单管理、消费统计、钱包、发票、订单等入口
- **Verification**: `human-judgment`

### AC-4: 客户管理模块可用
- **Given**: 用户有客户管理权限
- **When**: 访问客户管理页面
- **Then**: 页面正常显示，功能可用
- **Verification**: `human-judgment`

### AC-5: 图片库模块可用
- **Given**: 用户访问图片库
- **When**: 打开图片库页面
- **Then**: 页面正常显示，可浏览和管理图片
- **Verification**: `human-judgment`

### AC-6: 代码清理
- **Given**: 生产构建
- **When**: 检查代码
- **Then**: 不包含 console.log 调试语句（允许 error 和 warn）
- **Verification**: `programmatic`

### AC-7: 编译通过
- **Given**: 运行构建命令
- **When**: 执行 `npm run build`
- **Then**: 编译成功无错误
- **Verification**: `programmatic`

## Open Questions
- [ ] 首页 `/` 未登录时应该显示门户首页还是跳转到登录页？
- [ ] 客户管理模块属于哪个菜单分类？
- [ ] 图片库模块属于哪个菜单分类？
- [ ] 是否需要保留 console.warn 和 console.error？
