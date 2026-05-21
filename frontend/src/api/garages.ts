import { api } from './client'
import type { ApiRequestConfig } from './client'
export type { ApiRequestConfig } from './client'

export interface Garage {
  id: number
  name: string
  capacity: number
  default_rate: string
  lost_ticket_fee: string | null
  night_rate: string | null
  day_rate: string | null
  open_time: string | null
  close_time: string | null
  allow_subscription: boolean | null
  created_at: string | null
}

export interface Paginated<T> {
  total: number
  limit: number
  offset: number
  items: T[]
}

export function listGarages(
  params?: { limit?: number; offset?: number },
  config?: ApiRequestConfig,
) {
  return api.get<Paginated<Garage>>('/garages', { params, ...config })
}

export function getGarage(id: number, config?: ApiRequestConfig) {
  return api.get<Garage>(`/garages/${id}`, config)
}

export interface GarageOverviewRow {
  garage_id: number
  name: string
  total_spots: number
  free_spots: number
  occupied_spots: number
  rentable_spots: number
}

export function getGarageOverview(
  garageId?: number | null,
  config?: ApiRequestConfig,
) {
  return api.get<GarageOverviewRow[]>('/garages/overview', {
    params: garageId != null ? { garage_id: garageId } : {},
    ...config,
  })
}
