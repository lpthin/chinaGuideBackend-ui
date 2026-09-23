// 认证模块 API
import http from './http'
import type { LoginRequest, LoginResponse, ChangePasswordRequest, UserInfo } from '../types'

// 认证 API
export const authApi = {
  // 登录
  login: (data: LoginRequest) =>
    http.post<LoginResponse>('/auth/login', data),

  // 登出
  logout: () =>
    http.post<void>('/auth/logout'),

  // 获取当前用户信息
  getCurrentUser: () =>
    http.get<UserInfo>('/auth/me'),

  // 修改密码（当前登录用户自己改）
  changePassword: (data: ChangePasswordRequest) =>
    http.put<void>('/user/password', data)
}

// 个人中心 API
export const profileApi = {
  // 获取个人信息
  getProfile: () =>
    http.get<any>('/user/profile'),

  // 更新个人信息
  updateProfile: (data: { nickname?: string; email?: string; phone?: string; avatar?: string }) =>
    http.put<void>('/user/profile', data),

  // 修改密码
  changePassword: (data: { oldPassword: string; newPassword: string; confirmPassword: string }) =>
    http.put<void>('/user/password', data),

  // 获取登录日志
  getLoginLogs: (params?: { page?: number; size?: number }) =>
    http.get<any>('/user/login-logs', { params }),

  // 上传头像
  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return http.post<any>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}
