# 系统模块审视与完善 - 实现计划

## [/] Task 1: 修复首页路由冲突
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 当前 `/` 路径同时映射了 `portal-home` 和重定向到 `/workspace/dashboard`，存在冲突
  - 调整路由顺序，确保已登录用户访问 `/` 跳转到工作区，未登录显示门户首页或跳转到登录页
  - 路由守卫中判断登录状态进行相应跳转
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 已登录访问 `/` 跳转到 `/workspace/dashboard`
  - `human-judgement` TR-1.2: 未登录访问 `/` 行为符合预期

## [/] Task 2: 添加 404 页面
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 创建 404 页面组件 `NotFoundView.vue`
  - 在路由配置最后添加 catch-all 路由 `/:pathMatch(.*)*`
  - 404 页面提供返回首页和返回上一页的按钮
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-2.1: 访问不存在的路径显示 404 页面
  - `programmatic` TR-2.2: 404 路由配置正确，不影响现有路由

## [/] Task 3: 补齐计费系统缺失路由和菜单
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 添加钱包页面路由 `/workspace/billing/wallet`
  - 添加发票管理路由 `/workspace/billing/invoices`
  - 添加订单管理路由 `/workspace/billing/orders`
  - 在侧边栏菜单中添加对应菜单项
  - 导入对应组件：WalletView, InvoiceView, OrdersView
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-3.1: 计费系统菜单包含钱包、发票、订单入口
  - `human-judgement` TR-3.2: 各页面可正常访问和显示

## [/] Task 4: 补齐客户管理模块路由和菜单
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 添加客户管理页面路由 `/workspace/admin/customers`
  - 在侧边栏菜单中添加客户管理入口（建议放在运营管理或系统管理下）
  - 导入 CustomerManageView 组件
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement` TR-4.1: 客户管理菜单可见且可点击
  - `human-judgement` TR-4.2: 客户管理页面正常显示

## [/] Task 5: 补齐图片库模块路由和菜单
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 添加图片库页面路由 `/workspace/article/images`
  - 在侧边栏菜单中添加图片库入口（建议放在文章管理下）
  - 导入 ImageLibraryView 组件
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-5.1: 图片库菜单可见且可点击
  - `human-judgement` TR-5.2: 图片库页面正常显示

## [/] Task 6: 清理 console.log 调试语句
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 清理生产代码中的 `console.log` 调试语句
  - 保留 `console.error` 和 `console.warn` 用于错误提示
  - 对确实需要保留的日志使用合适的日志级别
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-6.1: 代码中不再包含 `console.log` 语句
  - `programmatic` TR-6.2: 编译通过无错误

## [x] Task 7: 构建验证
- **Priority**: high
- **Depends On**: Tasks 1-6
- **Description**: 
  - 运行 `npm run build` 验证编译是否通过
  - 检查所有新增路由是否正确配置
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-7.1: `npm run build` 编译成功无错误
  - `programmatic` TR-7.2: 无 TypeScript 类型错误
