import axios from 'axios'
import { getStoredToken } from './auth-storage'

export const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const apiKey = import.meta.env.VITE_API_KEY || ''

export interface ApiRequestConfig {
  signal?: AbortSignal
}

export const api = axios.create({
  baseURL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
  },
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    delete config.headers['X-API-Key']
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('api-connection-ok'))
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname
      if (path !== '/login') {
        window.dispatchEvent(new CustomEvent('session-expired'))
      }
    }
    if (error.code === 'ERR_CANCELED' && typeof window !== 'undefined') {
      return Promise.reject(error)
    }
    const isTimeout =
      error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')
    const isNetworkError =
      error.code === 'ERR_NETWORK' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('connection refused')
    if (typeof window !== 'undefined') {
      if (isTimeout) {
        window.dispatchEvent(new CustomEvent('api-connection-timeout', { detail: { baseURL } }))
      } else if (isNetworkError) {
        window.dispatchEvent(new CustomEvent('api-connection-error', { detail: { baseURL } }))
      }
    }
    return Promise.reject(error)
  },
)

export default api
