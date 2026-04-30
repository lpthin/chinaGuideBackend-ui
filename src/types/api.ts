export interface ApiResponse<T> {
  success: boolean
  code: string
  message: string
  data: T
}

export interface LoginResult {
  token: string
  username?: string
  userId?: number
}

export interface LoginRequest {
  username: string
  password: string
}
