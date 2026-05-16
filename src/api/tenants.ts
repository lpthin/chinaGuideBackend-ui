import { http } from './http'
import type {
  Plan, Tenant, TenantUsage, TenantLoginRequest, TenantLoginResult } from '@/types/api'

export const tenantLoginApi = (data: TenantLoginRequest): Promise<TenantLoginResult> => {
  return http.post('/tenants/login', data)
}

export const getPlansApi = (): Promise<Plan[]> => {
  return http.get('/tenants/plans')
}

export const getCurrentTenantApi = (): Promise<Tenant> => {
  return http.get('/admin/tenant')
}

export const getTenantUsageApi = (): Promise<Record<string, TenantUsage>> => {
  return http.get('/admin/usage')
}
