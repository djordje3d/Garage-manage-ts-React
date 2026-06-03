import { api } from './client'
import type { Paginated } from './garages'

export interface Vehicle {
  id: number
  licence_plate: string | null
  vehicle_type_id: number | null
  created: string | null
  status: number
}

export function listVehicles(params?: { limit?: number; offset?: number }) {
  return api.get<Paginated<Vehicle>>('/vehicles', { params })
}

export function getVehicleByPlate(plate: string) {
  return api.get<Vehicle>(`/vehicles/by-plate/${encodeURIComponent(plate)}`)
}

export function getVehicle(id: number) {
  return api.get<Vehicle>(`/vehicles/${id}`)
}

export function createVehicle(data: {
  licence_plate: string | null
  vehicle_type_id: number
  status?: number
}) {
  return api.post<Vehicle>('/vehicles', { ...data, status: data.status ?? 1 })
}
