import type { ApiRequestConfig } from './client'
import { api } from './client'
import type { Paginated } from './garages'

export interface TicketResponse {
  id: number
  entry_time: string | null
  exit_time: string | null
  fee: string | null
  ticket_state: string | null
  payment_status: string | null
  operational_status: string | null
  vehicle_id: number | null
  garage_id: number
  spot_id: number | null
  ticket_token: string
}

export interface TicketDashboardRow extends TicketResponse {
  licence_plate: string | null
  spot_code: string | null
  garage_name: string | null
  vehicle_type?: string | null
  image_url?: string | null
  rest_to_pay?: number
}

export function listTickets(
  params?: {
    state?: 'OPEN' | 'CLOSED'
    payment_status?: string
    garage_id?: number
    limit?: number
    offset?: number
  },
  config?: ApiRequestConfig,
) {
  return api.get<Paginated<TicketResponse>>('/tickets', { params, ...config })
}

export function listTicketsDashboard(
  params?: {
    garage_id?: number
    ticket_state?: 'OPEN' | 'CLOSED'
    from_date?: string
    to_date?: string
    limit?: number
    offset?: number
  },
  config?: ApiRequestConfig,
) {
  return api.get<Paginated<TicketDashboardRow>>('/tickets/dashboard', {
    params,
    ...config,
  })
}

export function getTicket(id: number, config?: ApiRequestConfig) {
  return api.get<TicketResponse>(`/tickets/${id}`, config)
}

export function ticketExit(id: number, data?: { exit_time?: string }) {
  return api.post<TicketResponse>(`/tickets/${id}/exit`, data ?? {})
}

export function ticketEntry(data: {
  vehicle_id: number
  garage_id: number
  spot_id?: number | null
  rentable_only?: boolean
  entry_time?: string
  image_url?: string | null
}) {
  return api.post<TicketResponse>('/tickets/entry', data)
}
