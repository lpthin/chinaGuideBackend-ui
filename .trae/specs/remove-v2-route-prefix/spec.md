# 移除 v2 路由前缀 - 产品需求文档

## Overview
- **Summary**: 将系统 v2 版本的路由前缀 `/v2/` 移除，使管理后台路由直接映射到根路径（如 `/login`、`/workspace/dashboard`），确保前后端路由一致，避免 404 错误。
- **Purpose**: 当前系统存在两套路由结构，v2 路由前缀 `/v2/` 导致路径冗余，需要统一为简洁的路由结构。
- **Target Users**: 系统管理员、运营人员、所有后台管理用户

## Goals
- 将所有 `/v2/` 前缀的路由改为无前缀路由
- 更新所有路由跳转引用，确保功能正常
- 保持门户网站前台路由不变（`/`、`/about`、`/services` 等）
- API 接口保持 `/api/v2/` 不变

## Non-Goals (Out of Scope)
- 修改 API 接口路径（保持 `/api/v2/` 不变）
- 修改门户网站前台路由结构
- 修改后端路由配置

## Background & Context
- 当前路由结构：
  - 门户网站前台：`/`、`/about`、`/services`、`/cases`、`/news`、`/contact`
  - 管理后台：`/v2/login`、`/v2/workspace/*`
- API 接口：`/api/v2/*`
- 需要将管理后台路由改为：`/login`、`/workspace/*`

## Functional Requirements
- **FR-1**: 修改路由配置，移除 `/v2/` 前缀
- **FR-2**: 更新登录页面跳转逻辑
- **FR-3**: 更新退出登录跳转逻辑
- **FR-4**: 更新 HTTP 拦截器中的登录重定向路径
- **FR-5**: 更新路由守卫中的登录页判断
- **FR-6**: 更新所有组件中的路由跳转引用

## Non-Functional Requirements
- **NFR-1**: 编译无 TypeScript 错误
- **NFR-2**: 路由跳转无 404 错误
- **NFR-3**: 登录/退出登录功能正常

## Constraints
- **Technical**: Vue Router 4.x、TypeScript、Vite
- **Dependencies**: 后端 API 接口保持 `/api/v2/` 不变

## Assumptions
- 后端 API 接口路径 `/api/v2/` 保持不变
- 门户网站前台路由结构保持不变

## Acceptance Criteria

### AC-1: 路由配置更新
- **Given**: 访问 `/login` 路径
- **When**: 用户在浏览器地址栏输入 `/login`
- **Then**: 显示登录页面
- **Verification**: `programmatic`

### AC-2: 工作区路由更新
- **Given**: 用户已登录
- **When**: 用户访问 `/workspace/dashboard`
- **Then**: 显示工作台仪表板页面
- **Verification**: `programmatic`

### AC-3: 登录后跳转
- **Given**: 用户登录成功
- **When**: 登录成功后
- **Then**: 跳转到 `/workspace/dashboard`
- **Verification**: `human-judgment`

### AC-4: 退出登录跳转
- **Given**: 用户点击退出登录
- **When**: 退出登录完成
- **Then**: 跳转到 `/login`
- **Verification**: `human-judgment`

### AC-5: 未授权跳转
- **Given**: 用户未登录访问受保护路由
- **When**: 访问 `/workspace/*`
- **Then**: 重定向到 `/login?redirect=xxx`
- **Verification**: `human-judgment`

### AC-6: 编译通过
- **Given**: 运行构建命令
- **When**: 执行 `npm run build`
- **Then**: 编译成功无错误
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要兼容旧的 `/v2/` 路由（301 重定向）？