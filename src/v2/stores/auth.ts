// v2 认证状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api'
import type { UserInfo, LoginRequest, LoginResponse } from '../types'

// Storage keys
const TOKEN_KEY = 'v2_access_token'
const REFRESH_TOKEN_KEY = 'v2_refresh_token'
const USER_KEY = 'v2_user_info'
const SELECTED_TENANT_ID_KEY = 'v2_selected_tenant_id'

function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

function getStoredRefreshToken(): string {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || ''
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

export const useAuthStore = defineStore('v2-auth', () => {
  // State
  const accessToken = ref<string>(getStoredToken())
  const refreshToken = ref<string>(getStoredRefreshToken())
  const user = ref<UserInfo | null>(getStoredUser())
  const selectedTenantId = ref<number | null>(getStoredSelectedTenantId())
  const loading = ref(false)

  // Getters
  const isLoggedIn = computed(() => !!accessToken.value)
  const isSuperAdmin = computed(() => user.value?.username === 'admin')
  const username = computed(() => user.value?.username || '')
  const nickname = computed(() => user.value?.nickname || '')
  const avatar = computed(() => user.value?.avatar || '')
  const tenantId = computed(() => user.value?.tenantId || 1)
  const roles = computed(() => user.value?.roles || [])
  const permissions = computed(() => user.value?.permissions || [])

  // Actions
  async function login(credentials: LoginRequest): Promise<LoginResponse> {
    loading.value = true
    try {
      const response = await authApi.login(credentials)
      
      // Store tokens
      accessToken.value = response.accessToken
      refreshToken.value = response.refreshToken
      localStorage.setItem(TOKEN_KEY, response.accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)
      
      // Store user info
      user.value = response.user
      localStorage.setItem(USER_KEY, JSON.stringify(response.user))
      
      return response
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      // Clear local state regardless of API success
      accessToken.value = ''
      refreshToken.value = ''
      user.value = null
      selectedTenantId.value = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(SELECTED_TENANT_ID_KEY)
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

  async function refreshAccessToken(): Promise<string> {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }
    
    const response = await authApi.refreshToken({ refreshToken: refreshToken.value })
    accessToken.value = response.accessToken
    localStorage.setItem(TOKEN_KEY, response.accessToken)
    return response.accessToken
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

  function switchTenant(tenantId: number | null): void {
    selectedTenantId.value = tenantId
    if (tenantId !== null) {
      localStorage.setItem(SELECTED_TENANT_ID_KEY, String(tenantId))
    } else {
      localStorage.removeItem(SELECTED_TENANT_ID_KEY)
    }
  }

  return {
    // State
    accessToken,
    refreshToken,
    user,
    selectedTenantId,
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
    login,
    logout,
    fetchCurrentUser,
    updateUserInfo,
    refreshAccessToken,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
    switchTenant,
  }
})

// 别名导出，兼容旧代码中的 useV2AuthStore 引用
export const useV2AuthStore = useAuthStore
