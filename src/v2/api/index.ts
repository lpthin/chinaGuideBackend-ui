// V2 API 统一导出
import http from './http'
import knowledge from './knowledge'
import article from './article'
import portal from './portal'
import operation from './operation'
import workspace from './workspace'

export { default as http } from './http'

// 知识库模块
export { knowledge }
export * from './knowledge'

// 文章系统模块
export { article }
export * from './article'

// 门户网站模块
export { portal }
export * from './portal'

// 运营管理模块
export { operation }
export * from './operation'

// Workspace 模块
export { workspace }
export * from './workspace'

// 认证模块
export * from './auth'
export { authApi, userApi, roleApi, permissionApi, profileApi } from './auth'

// 统一导出
export default {
  knowledge,
  article,
  portal,
  operation,
  workspace,
  http
}
