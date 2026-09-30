// 认证状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api'
import type { UserInfo } from '../types'

// Storage keys
const TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_KEY = 'user_info'
const SELECTED_TENANT_ID_KEY = 'selected_tenant_id'
const SELECTED_TENANT_CODE_KEY = 'selected_tenant_code'

function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

function getStoredUser(): UserInfo | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserInfo
  } catch {
    return null
  }
}

function getStoredSelectedTenantId(): number | null {
  const raw = localStorage.getItem(SELECTED_TENANT_ID_KEY)
  if (!raw) return null
  try {
    return Number(raw)
  } catch {
    return null
  }
}

function getStoredSelectedTenantCode(): string | null {
  return localStorage.getItem(SELECTED_TENANT_CODE_KEY)
}

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN'

export const useAuthStore = defineStore('auth', () => {
  // State
  const accessToken = ref<string>(getStoredToken())
  const user = ref<UserInfo | null>(getStoredUser())
  const selectedTenantId = ref<number | null>(getStoredSelectedTenantId())
  const selectedTenantCode = ref<string | null>(getStoredSelectedTenantCode())
  /**
   * 后端回话「你这次点的租户我认不出来」（响应头 X-Tenant-Unresolved）时记着原样那串。
   *
   * 为什么要有这一位：认不出租户时后端读的是空结果，而空列表在界面上与「这家真的没有数据」
   * 长得一模一样——客户会得出「我们门户没人引用」这种假结论（Spec-F §13-13 / P6-B 拍板 A）。
   * 只有超管会被标上：普通用户的租户来自登录态，那两个头本来就不发。
   */
  const tenantUnresolvedDeclaration = ref<string | null>(null)
  const loading = ref(false)

  // Getters
  const isLoggedIn = computed(() => !!accessToken.value)
  const isSuperAdmin = computed(() => roles.value.includes(SUPER_ADMIN_ROLE))
  const username = computed(() => user.value?.username || '')
  const nickname = computed(() => user.value?.nickname || '')
  const avatar = computed(() => user.value?.avatar || '')
  const tenantId = computed(() => user.value?.tenantId || 1)
  const roles = computed(() => user.value?.roles || [])
  const permissions = computed(() => user.value?.permissions || [])

  // Actions
  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      // Clear local state regardless of API success
      accessToken.value = ''
      user.value = null
      selectedTenantId.value = null
      selectedTenantCode.value = null
      tenantUnresolvedDeclaration.value = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(SELECTED_TENANT_ID_KEY)
      localStorage.removeItem(SELECTED_TENANT_CODE_KEY)
    }
  }

  async function fetchCurrentUser(): Promise<UserInfo> {
    const response = await authApi.getCurrentUser()
    user.value = response
    localStorage.setItem(USER_KEY, JSON.stringify(response))
    return response
  }

  function updateUserInfo(updates: Partial<UserInfo>): void {
    if (!user.value) return
    user.value = { ...user.value, ...updates }
    localStorage.setItem(USER_KEY, JSON.stringify(user.value))
  }

  function hasPermission(permissionCode: string): boolean {
    return permissions.value.includes(permissionCode)
  }

  function hasAnyPermission(permissionCodes: string[]): boolean {
    return permissionCodes.some(code => permissions.value.includes(code))
  }

  function hasRole(roleCode: string): boolean {
    return roles.value.includes(roleCode)
  }

  function hasAnyRole(roleCodes: string[]): boolean {
    return roleCodes.some(code => roles.value.includes(code))
  }

  function switchTenant(tenantId: number | null, tenantCode?: string | null): void {
    selectedTenantId.value = tenantId
    // 换过一次选择就把「上一次没认出来」那句话清掉：它是上一次请求的回执，不是这一次的
    tenantUnresolvedDeclaration.value = null
    if (tenantId !== null) {
      localStorage.setItem(SELECTED_TENANT_ID_KEY, String(tenantId))
    } else {
      localStorage.removeItem(SELECTED_TENANT_ID_KEY)
    }

    if (tenantId === null) {
      selectedTenantCode.value = null
      localStorage.removeItem(SELECTED_TENANT_CODE_KEY)
    } else if (tenantCode !== undefined) {
      selectedTenantCode.value = tenantCode
      if (tenantCode !== null) {
        localStorage.setItem(SELECTED_TENANT_CODE_KEY, tenantCode)
      } else {
        localStorage.removeItem(SELECTED_TENANT_CODE_KEY)
      }
    }
  }

  /** 后端在响应头里点名「这一串我没认出来」；传 null 表示这一次认出来了，把上一句撤下 */
  function markTenantUnresolved(declaration: string | null): void {
    tenantUnresolvedDeclaration.value = declaration === null || declaration === '' ? null : declaration
  }

  return {
    // State
    accessToken,
    user,
    selectedTenantId,
    selectedTenantCode,
    tenantUnresolvedDeclaration,
    loading,
    
    // Getters
    isLoggedIn,
    isSuperAdmin,
    username,
    nickname,
    avatar,
    tenantId,
    roles,
    permissions,
    
    // Actions
    logout,
    fetchCurrentUser,
    updateUserInfo,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
    switchTenant,
    markTenantUnresolved,
  }
})
