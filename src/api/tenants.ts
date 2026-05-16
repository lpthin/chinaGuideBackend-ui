import { http } from './http'
import type { Plan, Tenant, TenantUsage } from '@/types/api'

export interface TenantLoginRequest {
  code: string
  email?: string
  password: string
}

export interface TenantLoginResult {
  token: string
  username?: string
  userId?: number
  tenantId?: number
  tenantCode?: string
}

export const tenantLoginApi = (data: TenantLoginRequest): Promise<TenantLoginResult> => {
  return http.post('/tenants/login', data)
}

export const getPlansApi = (): Promise<Plan[]> => {
  return http.get('/tenants/plans')
}

export const getCurrentTenantApi = (): Promise<Tenant> => {
  return http.get('/tenants/me')
}

export const getTenantUsageApi = (): Promise<Record<string, TenantUsage>> => {
  return http.get('/tenants/me/usage')
}

export const registerTenantApi = (data: {
  code: string
  name: string
  email: string
  password: string
}): Promise<Tenant> => {
  return http.post('/tenants/register', data)
}

export const changePlanApi = (planId: number): Promise<any> => {
  return http.post('/tenants/change-plan', null, { params: { planId } })
}
