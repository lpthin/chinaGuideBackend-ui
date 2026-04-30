import { http } from './http'
import type { LoginRequest, LoginResult } from '@/types/api'

export function loginApi(payload: LoginRequest) {
  return http.post<unknown, LoginResult>('/admin/auth/login', payload)
}
