import { defineStore } from 'pinia'
import { loginApi } from '@/api/auth'
import { tenantLoginApi } from '@/api/tenants'
import type { TenantLoginResult } from '@/types/api'

interface AuthUser {
  username?: string
  userId?: number
}

interface AuthState {
  token: string
  user: AuthUser | null
  tenantId: number | null
  tenantCode: string | null
}

function readUser(): AuthUser | null {
  const raw = localStorage.getItem('geocms_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function readTenantId(): number | null {
  const raw = localStorage.getItem('geocms_tenant_id')
  if (!raw) return null
  try {
    return Number(raw)
  } catch {
    return null
  }
}

function readTenantCode(): string | null {
  return localStorage.getItem('geocms_tenant_code')
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem('geocms_token') || '',
    user: readUser(),
    tenantId: readTenantId(),
    tenantCode: readTenantCode()
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
    hasTenant: (state) => Boolean(state.tenantId && state.tenantCode)
  },
  actions: {
    async login(username: string, password: string) {
      const result = await loginApi({ username, password })
      this.token = result.token
      this.user = { username: result.username || username, userId: result.userId }
      localStorage.setItem('geocms_token', this.token)
      localStorage.setItem('geocms_user', JSON.stringify(this.user))
    },
    async tenantLogin(code: string, email: string, password: string) {
      const result: TenantLoginResult = await tenantLoginApi({ code, email, password })
      this.token = result.token
      this.user = { username: result.username, userId: result.userId }
      this.tenantId = result.tenantId || null
      this.tenantCode = result.tenantCode || null
      localStorage.setItem('geocms_token', this.token)
      localStorage.setItem('geocms_user', JSON.stringify(this.user))
      if (this.tenantId) {
        localStorage.setItem('geocms_tenant_id', String(this.tenantId))
      }
      if (this.tenantCode) {
        localStorage.setItem('geocms_tenant_code', this.tenantCode)
      }
    },
    logout() {
      this.token = ''
      this.user = null
      this.tenantId = null
      this.tenantCode = null
      localStorage.removeItem('geocms_token')
      localStorage.removeItem('geocms_user')
      localStorage.removeItem('geocms_tenant_id')
      localStorage.removeItem('geocms_tenant_code')
    },
    setTenant(tenantId: number, tenantCode: string) {
      this.tenantId = tenantId
      this.tenantCode = tenantCode
      localStorage.setItem('geocms_tenant_id', String(tenantId))
      localStorage.setItem('geocms_tenant_code', tenantCode)
    },
    clearTenant() {
      this.tenantId = null
      this.tenantCode = null
      localStorage.removeItem('geocms_tenant_id')
      localStorage.removeItem('geocms_tenant_code')
    }
  }
})
