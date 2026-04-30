import { defineStore } from 'pinia'
import { loginApi } from '@/api/auth'

interface AuthUser {
  username?: string
  userId?: number
}

interface AuthState {
  token: string
  user: AuthUser | null
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

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem('geocms_token') || '',
    user: readUser()
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token)
  },
  actions: {
    async login(username: string, password: string) {
      const result = await loginApi({ username, password })
      this.token = result.token
      this.user = { username: result.username || username, userId: result.userId }
      localStorage.setItem('geocms_token', this.token)
      localStorage.setItem('geocms_user', JSON.stringify(this.user))
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('geocms_token')
      localStorage.removeItem('geocms_user')
    }
  }
})
