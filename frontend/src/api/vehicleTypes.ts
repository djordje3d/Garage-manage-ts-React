import { api } from './client'
import type { Paginated } from './garages'

export interface VehicleType {
  id: number
  type: string
  rate: number
}

export function listVehicleTypes(params?: { limit?: number; offset?: number }) {
  return api.get<Paginated<VehicleType>>('/vehicle-types', { params })
}
