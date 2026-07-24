# 移除 v2 路由前缀 - 实现计划

## [ ] Task 1: 修改路由配置文件，移除 `/v2/` 前缀
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `/v2/router/index.ts` 中的路由配置
  - 将 `/v2/login` 改为 `/login`
  - 将 `/v2/workspace` 改为 `/workspace`
  - 将 `/v2` 重定向改为 `/workspace/dashboard`
  - 更新所有子路由的 name 属性，移除 `v2-workspace-` 前缀
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: 路由配置文件中不再包含 `/v2/` 前缀的路由
  - `human-judgement` TR-1.2: 检查路由配置是否正确，子路由结构完整

## [ ] Task 2: 更新路由守卫中的登录页判断
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改路由守卫中的 `to.name === 'v2-login'` 判断
  - 修改 `requiresAuth` 重定向目标从 `v2-login` 改为 `login`
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-2.1: 未登录访问受保护路由时正确重定向到 `/login`

## [x] Task 3: 更新 HTTP 拦截器中的登录重定向路径
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `/v2/api/http.ts` 中 `handleUnauthorized` 函数的登录路径
  - 将 `/v2/login` 改为 `/login`
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-3.1: 登录状态失效时正确重定向到 `/login`

## [ ] Task 4: 更新登录页面的跳转逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `/v2/views/LoginView.vue` 中的登录成功后跳转路径
  - 将 `/v2/workspace/dashboard` 改为 `/workspace/dashboard`
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-4.1: 登录成功后正确跳转到 `/workspace/dashboard`

## [ ] Task 5: 更新退出登录逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `/v2/views/workspace/WorkspaceView.vue` 中的退出登录跳转路径
  - 将 `/v2/login` 改为 `/login`
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement` TR-5.1: 退出登录后正确跳转到 `/login`

## [x] Task 6: 更新所有组件中的路由跳转引用
- **Priority**: medium
- **Depends On**: Task 1
- **Description**: 
  - 搜索并更新所有组件中对 `/v2/` 路由的引用
  - 包括 `router.push()`、`router.replace()`、`router.resolve()` 等调用
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-6.1: 所有组件中的路由跳转引用已更新
  - `human-judgement` TR-6.2: 功能菜单点击后正确跳转

## [x] Task 7: 构建验证
- **Priority**: high
- **Depends On**: Tasks 1-6
- **Description**: 
  - 运行 `npm run build` 验证编译是否通过
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-7.1: `npm run build` 编译成功无错误