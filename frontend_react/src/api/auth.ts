import { api } from './client'
import { setStoredToken } from './auth-storage'
import { setStoredLocale, type SupportedLocale } from '../i18n'

export {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  isAuthenticated,
  ACCESS_TOKEN_KEY,
} from './auth-storage'

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  preferred_language?: SupportedLocale
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { username, password })
  setStoredToken(data.access_token, data.expires_in)
  setStoredLocale('en')
  return data
}

export async function refresh(): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/refresh')
  setStoredToken(data.access_token, data.expires_in)
  return data
}
