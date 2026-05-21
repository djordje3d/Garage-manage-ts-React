import type { ApiRequestConfig } from './client'
import { api } from './client'

export interface DashboardAnalytics {
  free_spots: number
  occupied_spots: number
  inactive_spots: number
  open_tickets: number
  today_revenue: number
  month_revenue: number
  unpaid_partially_paid_count: number
  total_outstanding: number
}

export function getDashboardAnalytics(
  params: {
    garage_id?: number
    today: string
    month_from: string
    month_to: string
  },
  config?: ApiRequestConfig,
) {
  return api.get<DashboardAnalytics>('/dashboard/analytics', {
    params,
    ...config,
  })
}
