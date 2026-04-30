import { http } from './http'
import type { Role, Permission } from '@/types/api'

export function listRolesApi() {
  return http.get<unknown, Role[]>('/admin/roles')
}

export function createRoleApi(role: { code: string; name: string; description?: string }) {
  return http.post<unknown, Role>('/admin/roles', role)
}

export function updateRoleApi(id: number, role: { name?: string; description?: string }) {
  return http.put<unknown, Role>(`/admin/roles/${id}`, role)
}

export function deleteRoleApi(id: number) {
  return http.delete<unknown, void>(`/admin/roles/${id}`)
}

export function assignRolePermissionsApi(roleId: number, permissionIds: number[]) {
  return http.put<unknown, void>(`/admin/roles/${roleId}/permissions`, permissionIds)
}

export function getRolePermissionsApi(roleId: number) {
  return http.get<unknown, number[]>(`/admin/roles/${roleId}/permissions`)
}

export function listPermissionsApi() {
  return http.get<unknown, Permission[]>('/admin/permissions')
}

export function createPermissionApi(perm: { code: string; name: string; module: string; action: string }) {
  return http.post<unknown, Permission>('/admin/permissions', perm)
}

export function listUsersApi() {
  return http.get<unknown, Array<{ id: number; username: string; nickname: string; status: string }>>('/admin/users')
}

export function assignUserRolesApi(userId: number, roleIds: number[]) {
  return http.put<unknown, void>(`/admin/users/${userId}/roles`, roleIds)
}

export function getUserRolesApi(userId: number) {
  return http.get<unknown, number[]>(`/admin/users/${userId}/roles`)
}
