// 认证模块类型定义

// 登录请求
export interface LoginRequest {
  username: string
  password: string
}

// 登录响应
export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  user: UserInfo
}

// 用户信息
export interface UserInfo {
  id: number
  username: string
  nickname: string
  email?: string
  phone?: string
  avatar?: string
  tenantId: number
  tenantName?: string
  roles: string[]
  permissions: string[]
  status: 'enabled' | 'disabled'
  createdAt: string
}

// 注册请求
export interface RegisterRequest {
  username: string
  password: string
  confirmPassword: string
  email?: string
  phone?: string
  nickname: string
}

// 修改密码请求
export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

// 角色
// 这一族词的唯一出处：库里 role.status 现读只有 'enabled'（列默认值也是它），
// 旧版本这里写的是 active/inactive，界面提交进去会和库里混成两套词。
export type RoleStatus = 'enabled' | 'disabled'

export interface Role {
  id: number
  tenantId: number
  name: string
  code: string
  description?: string
  status: RoleStatus
  sort: number
  createdAt: string
  updatedAt: string
  permissions?: Permission[]
}

// 权限
export interface Permission {
  id: number
  tenantId: number
  parentId: number | null
  name: string
  code: string
  type: 'menu' | 'button' | 'api'
  icon?: string
  path?: string
  component?: string
  sort: number
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
  children?: Permission[]
}

// 用户摘要信息
export interface AdminUserSummary {
  id: number
  username: string
  nickname: string
  avatar?: string
  status: 'enabled' | 'disabled'
  roles?: string[]
  createdAt: string
}

// 用户查询参数
export interface UserQuery {
  tenantId: number
  keyword?: string
  status?: 'enabled' | 'disabled'
  roleId?: number
  page?: number
  size?: number
}

// 角色查询参数
export interface RoleQuery {
  tenantId: number
  keyword?: string
  status?: RoleStatus
  page?: number
  size?: number
}

// 创建/更新用户表单
export interface UserForm {
  id?: number
  tenantId: number
  username: string
  nickname: string
  email?: string
  phone?: string
  avatar?: string
  password?: string
  status: 'enabled' | 'disabled'
  roleIds?: number[]
}

// 创建/更新角色表单
export interface RoleForm {
  id?: number
  tenantId: number
  name: string
  code: string
  description?: string
  status: RoleStatus
  sort?: number
  permissionIds?: number[]
}

// JWT Payload
export interface JwtPayload {
  sub: string
  userId: number
  tenantId: number
  username: string
  roles: string[]
  iat: number
  exp: number
}

// Token 刷新请求
export interface RefreshTokenRequest {
  refreshToken: string
}
