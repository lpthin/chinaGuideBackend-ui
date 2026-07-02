// 认证模块 API
import http from './http'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
  UserInfo,
  Role,
  Permission,
  UserQuery,
  RoleQuery,
  UserForm,
  RoleForm,
  PageResult
} from '../types'

// 认证 API
export const authApi = {
  // 登录
  login: (data: LoginRequest) =>
    http.post<LoginResponse>('/auth/login', data),

  // 登出
  logout: () =>
    http.post<void>('/auth/logout'),

  // 刷新 token
  refreshToken: (data: RefreshTokenRequest) =>
    http.post<{ accessToken: string; expiresIn: number }>('/auth/refresh', data),

  // 获取当前用户信息
  getCurrentUser: () =>
    http.get<UserInfo>('/auth/me'),

  // 修改密码
  changePassword: (data: ChangePasswordRequest) =>
    http.post<void>('/auth/change-password', data),

  // 重置密码
  resetPassword: (data: ResetPasswordRequest) =>
    http.post<void>('/auth/reset-password', data),

  // 注册
  register: (data: RegisterRequest) =>
    http.post<{ success: boolean; message: string }>('/auth/register', data),

  // 获取验证码
  getCaptcha: () =>
    http.get<{ image: string; key: string }>('/auth/captcha'),
}

// 用户管理 API
export const userApi = {
  // 获取用户列表
  list: (params: UserQuery) =>
    http.get<PageResult<UserInfo>>('/admin/users', { params }),

  // 获取用户详情
  get: (id: number) =>
    http.get<UserInfo>(`/admin/users/${id}`),

  // 创建用户
  create: (data: UserForm) =>
    http.post<UserInfo>('/admin/users', data),

  // 更新用户
  update: (id: number, data: UserForm) =>
    http.put<UserInfo>(`/admin/users/${id}`, data),

  // 删除用户
  delete: (id: number) =>
    http.delete(`/admin/users/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/admin/users/batch', { data: ids }),

  // 启用/禁用用户
  toggleStatus: (id: number, status: 'enabled' | 'disabled') =>
    http.patch(`/admin/users/${id}/status`, { status }),

  // 重置用户密码
  resetUserPassword: (id: number, newPassword: string) =>
    http.post(`/admin/users/${id}/reset-password`, { newPassword }),

  // 获取用户角色
  getRoles: (id: number) =>
    http.get<number[]>(`/admin/users/${id}/roles`),

  // 分配用户角色
  assignRoles: (id: number, roleIds: number[]) =>
    http.post(`/admin/users/${id}/roles`, { roleIds }),
}

// 角色管理 API
export const roleApi = {
  // 获取角色列表
  list: (params: RoleQuery) =>
    http.get<PageResult<Role>>('/admin/roles', { params }),

  // 获取所有角色（不分页）
  all: (tenantId: number) =>
    http.get<Role[]>('/admin/roles/all', { params: { tenantId } }),

  // 获取角色详情
  get: (id: number) =>
    http.get<Role>(`/admin/roles/${id}`),

  // 创建角色
  create: (data: RoleForm) =>
    http.post<Role>('/admin/roles', data),

  // 更新角色
  update: (id: number, data: RoleForm) =>
    http.put<Role>(`/admin/roles/${id}`, data),

  // 删除角色
  delete: (id: number) =>
    http.delete(`/admin/roles/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/admin/roles/batch', { data: ids }),

  // 启用/禁用角色
  toggleStatus: (id: number, status: 'active' | 'inactive') =>
    http.patch(`/admin/roles/${id}/status`, { status }),

  // 获取角色权限
  getPermissions: (id: number) =>
    http.get<number[]>(`/admin/roles/${id}/permissions`),

  // 分配角色权限
  assignPermissions: (id: number, permissionIds: number[]) =>
    http.post(`/admin/roles/${id}/permissions`, { permissionIds }),
}

// 权限管理 API
export const permissionApi = {
  // 获取权限树
  tree: (tenantId: number) =>
    http.get<Permission[]>('/admin/permissions/tree', { params: { tenantId } }),

  // 获取所有权限列表
  list: (tenantId: number) =>
    http.get<Permission[]>('/admin/permissions', { params: { tenantId } }),

  // 获取权限详情
  get: (id: number) =>
    http.get<Permission>(`/admin/permissions/${id}`),

  // 创建权限
  create: (data: Partial<Permission>) =>
    http.post<Permission>('/admin/permissions', data),

  // 更新权限
  update: (id: number, data: Partial<Permission>) =>
    http.put<Permission>(`/admin/permissions/${id}`, data),

  // 删除权限
  delete: (id: number) =>
    http.delete(`/admin/permissions/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/admin/permissions/batch', { data: ids }),
}

// 个人中心 API
export const profileApi = {
  // 获取个人信息
  getProfile: () =>
    http.get<any>('/user/profile'),

  // 更新个人信息
  updateProfile: (data: { nickname?: string; email?: string }) =>
    http.put<void>('/user/profile', data),

  // 修改密码
  changePassword: (data: { oldPassword: string; newPassword: string; confirmPassword: string }) =>
    http.put<void>('/user/password', data),

  // 绑定手机号
  bindPhone: (data: { phone: string; code: string }) =>
    http.put<void>('/user/phone', data),

  // 获取登录日志
  getLoginLogs: (params?: { page?: number; size?: number }) =>
    http.get<any>('/user/login-logs', { params }),
}
