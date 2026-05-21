import type { ApiRequestConfig } from './client'
import { api } from './client'
import type { Paginated } from './garages'

export interface Payment {
  id: number
  ticket_id: number | null
  amount: string
  method: string | null
  currency: string
  paid_at: string | null
}

export function listPayments(
  params?: {
    from?: string
    to?: string
    garage_id?: number
    limit?: number
    offset?: number
  },
  config?: ApiRequestConfig,
) {
  return api.get<Paginated<Payment>>('/payments', { params, ...config })
}

export interface OutstandingResponse {
  total_outstanding: number
}

export function getOutstanding(
  garageId?: number | null,
  config?: ApiRequestConfig,
) {
  return api.get<OutstandingResponse>('/payments/outstanding', {
    params: garageId != null ? { garage_id: garageId } : {},
    ...config,
  })
}

export function getPaymentsByTicket(
  ticketId: number,
  params?: { limit?: number; offset?: number },
  config?: ApiRequestConfig,
) {
  return api.get<Paginated<Payment>>(`/payments/by-ticket/${ticketId}`, {
    params,
    ...config,
  })
}

export function createPayment(data: {
  ticket_id: number
  amount: string | number
  method: string
  currency?: string
  paid_at?: string
}) {
  return api.post<Payment>('/payments', {
    ...data,
    amount: typeof data.amount === 'number' ? data.amount : Number(data.amount),
    currency: data.currency ?? 'RSD',
  })
}
