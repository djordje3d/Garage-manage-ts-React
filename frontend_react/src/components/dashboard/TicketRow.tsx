import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TicketDashboardRow } from '../../api/tickets'
import { formatMoney, formatTime } from '../../composables/useFormatters'

export type TicketRowProps = {
  ticket: TicketDashboardRow
  ticketImageUrl?: string
  restToPayValue: string
  restToPayClass: string
  onViewTicket?: (ticket: TicketDashboardRow) => void
  onViewTicketImage?: (ticket: TicketDashboardRow) => void
  onCloseTicket?: (ticketId: number) => void
  onOpenPayment?: (ticket: TicketDashboardRow) => void
}

export function TicketRow({
  ticket,
  ticketImageUrl,
  restToPayValue,
  restToPayClass,
  onViewTicket,
  onViewTicketImage,
  onCloseTicket,
  onOpenPayment,
}: TicketRowProps) {
  const { t, i18n } = useTranslation()

  const activeLocale = useMemo<'en' | 'sr'>(() => {
    const lang = String(i18n.language).toLowerCase()
    return lang.startsWith('sr') ? 'sr' : 'en'
  }, [i18n.language])

  const ticketStateLabel = useMemo(() => {
    const s = ticket.ticket_state
    if (!s) return '–'
    const key = `ticket.ticketState.${s}`
    return i18n.exists(key) ? t(key) : s
  }, [i18n, t, ticket.ticket_state])

  const paymentStatusLabel = useMemo(() => {
    const s = ticket.payment_status
    if (!s) return '–'
    const key = `ticket.paymentStatus.${s}`
    return i18n.exists(key) ? t(key) : s
  }, [i18n, t, ticket.payment_status])

  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
        {ticket.garage_name ?? '–'}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
        {ticket.licence_plate ?? '–'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {ticket.spot_code ?? '–'}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
        {formatTime(ticket.entry_time, activeLocale)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
        {formatTime(ticket.exit_time, activeLocale)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
        {ticketStateLabel}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
        {paymentStatusLabel}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
        {formatMoney(ticket.fee)}
      </td>
      <td
        className={`whitespace-nowrap px-4 py-3 text-right text-sm font-medium ${restToPayClass}`}
      >
        {restToPayValue}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {ticketImageUrl ? (
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white p-0 hover:shadow-sm"
            title="View image"
            onClick={() => onViewTicketImage?.(ticket)}
          >
            <img
              src={ticketImageUrl}
              alt={`Ticket image for #${ticket.id}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-xs text-gray-400 select-none"
            title="No image"
          >
            –
          </div>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
            title="View ticket & payments"
            aria-label="View ticket & payments"
            onClick={() => onViewTicket?.(ticket)}
          >
            <span className="icon-barcode text-lg" aria-hidden="true" />
          </button>

          {ticket.ticket_state === 'OPEN' ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
              title="Close ticket"
              aria-label="Close ticket"
              onClick={() => onCloseTicket?.(ticket.id)}
            >
              <span className="icon-exit text-lg" aria-hidden="true" />
            </button>
          ) : ticket.ticket_state === 'CLOSED' &&
            ticket.payment_status !== 'PAID' ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
              title="Go to payment"
              aria-label="Go to payment"
              onClick={() => onOpenPayment?.(ticket)}
            >
              <span className="icon-credit-card text-lg" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
