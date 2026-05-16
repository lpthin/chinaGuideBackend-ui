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

export const createPaymentApi = (planId: number, paymentMethod?: string): Promise<any> => {
  return http.post('/api/payments/create', null, { params: { planId, paymentMethod } })
}

export const verifyPaymentApi = (paymentId: string, paymentMethod: string, signature?: string): Promise<any> => {
  return http.post('/api/payments/verify', null, { params: { paymentId, paymentMethod, signature } })
}

export const getPaymentOrderApi = (orderId: string): Promise<any> => {
  return http.get(`/api/payments/order/${orderId}`)
}

export interface PaymentConfig {
  id?: number
  provider: string
  appId?: string
  appSecret?: string
  merchantId?: string
  privateKey?: string
  publicKey?: string
  callbackUrl?: string
  returnUrl?: string
  enabled: boolean
  configJson?: string
}

export const getPaymentConfigsApi = (): Promise<PaymentConfig[]> => {
  return http.get('/api/payment/config/list')
}

export const getPaymentConfigApi = (provider: string): Promise<PaymentConfig> => {
  return http.get(`/api/payment/config/${provider}`)
}

export const savePaymentConfigApi = (config: PaymentConfig): Promise<PaymentConfig> => {
  return http.post('/api/payment/config/save', config)
}

export const togglePaymentApi = (provider: string, enabled: boolean): Promise<boolean> => {
  return http.put(`/api/payment/config/toggle/${provider}`, null, { params: { enabled } })
}

export const initPaymentConfigsApi = (): Promise<void> => {
  return http.post('/api/payment/config/init')
}

export interface Invoice {
  id?: number
  invoiceNumber?: string
  title?: string
  taxNumber?: string
  bankName?: string
  bankAccount?: string
  address?: string
  phone?: string
  email?: string
  amount?: number
  status?: string
  type?: string
  content?: string
  pdfPath?: string
  createdAt?: string
}

export interface InvoiceRequest {
  title: string
  taxNumber?: string
  bankName?: string
  bankAccount?: string
  address?: string
  phone?: string
  email?: string
  amount: number
  type: string
  content: string
}

export const getInvoicesApi = (): Promise<Invoice[]> => {
  return http.get('/api/invoices')
}

export const getInvoiceApi = (id: number): Promise<Invoice> => {
  return http.get(`/api/invoices/${id}`)
}

export const createInvoiceApi = (data: InvoiceRequest): Promise<Invoice> => {
  return http.post('/api/invoices', data)
}

export const downloadInvoiceApi = (id: number): Promise<string> => {
  return http.get(`/api/invoices/${id}/download`)
}

export const deleteInvoiceApi = (id: number): Promise<boolean> => {
  return http.delete(`/api/invoices/${id}`)
}

export interface AuditLog {
  id?: number
  action?: string
  resource?: string
  method?: string
  ipAddress?: string
  createdAt?: string
}

export const getAuditLogsApi = (params?: { page?: number; size?: number }): Promise<any> => {
  return http.get('/api/audit/logs', { params })
}
