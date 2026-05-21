import type { ApiRequestConfig } from './client'
import { api } from './client'
import type { Paginated } from './garages'

export interface Spot {
  id: number
  garage_id: number
  code: string
  is_rentable: boolean
  is_active: boolean
  is_occupied: boolean
}

export function listSpots(
  params?: {
    garage_id?: number
    active_only?: boolean
    rentable_only?: boolean
    only_free?: boolean
    limit?: number
    offset?: number
  },
  config?: ApiRequestConfig,
) {
  return api.get<Paginated<Spot>>('/spots', { params, ...config })
}

export function getSpot(id: number, config?: ApiRequestConfig) {
  return api.get<Spot>(`/spots/${id}`, config)
}
