import { useTranslation } from 'react-i18next'
import type { TicketDashboardRow } from '../../api/tickets'
import { formatMoney } from '../../composables/useFormatters'
import { normalizeTicketImageUrl } from '../../utils/ticketImageUrl'
import { HelpTooltip } from '../ui/HelpTooltip'
import { TicketRow } from './TicketRow'

export type TicketTableProps = {
  tickets: TicketDashboardRow[]
  restToPayMap: Record<number, number>
  onViewTicket?: (ticket: TicketDashboardRow) => void
  onViewTicketImage?: (ticket: TicketDashboardRow) => void
  onCloseTicket?: (ticketId: number) => void
  onOpenPayment?: (ticket: TicketDashboardRow) => void
}

export function TicketTable({
  tickets,
  restToPayMap,
  onViewTicket,
  onViewTicketImage,
  onCloseTicket,
  onOpenPayment,
}: TicketTableProps) {
  const { t } = useTranslation()

  function formatRestToPay(ticket: TicketDashboardRow): string {
    if (ticket.ticket_state === 'OPEN') return '–'
    if (ticket.payment_status === 'PAID') return '0 RSD'

    const rest = restToPayMap[ticket.id]
    if (rest !== undefined) return formatMoney(String(rest))

    if (
      ticket.ticket_state === 'CLOSED' &&
      ticket.payment_status !== 'PAID'
    ) {
      return '…'
    }

    return '–'
  }

  function restToPayClass(ticket: TicketDashboardRow): string {
    if (ticket.payment_status === 'PAID' || ticket.ticket_state === 'OPEN') {
      return 'text-gray-500'
    }
    return 'text-amber-700'
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            {t('ticket.garage')}
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            {t('ticket.plate')}
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            {t('ticket.spot')}
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            {t('ticket.entryTime')}
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            {t('ticket.exitTime')}
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            <span className="inline-flex items-center gap-1">
              {t('ticket.state')}
              <HelpTooltip
                asIcon
                text={t('help.ticket.ticketState')}
                ariaLabel={t('help.aria.ticketState')}
              />
            </span>
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            <span className="inline-flex items-center gap-1">
              {t('ticket.payment')}
              <HelpTooltip
                asIcon
                text={t('help.ticket.paymentStatus')}
                ariaLabel={t('help.aria.paymentStatus')}
              />
            </span>
          </th>
          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
            <span className="inline-flex w-full items-center justify-end gap-1">
              {t('ticket.fee')}
              <HelpTooltip
                asIcon
                text={t('help.ticket.fee')}
                ariaLabel={t('help.aria.ticketFee')}
              />
            </span>
          </th>
          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
            <span className="inline-flex w-full items-center justify-end gap-1">
              {t('ticket.restToPay')}
              <HelpTooltip
                asIcon
                text={t('help.ticket.restToPay')}
                ariaLabel={t('help.aria.restToPay')}
              />
            </span>
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            {t('ticket.image')}
          </th>
          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
            {t('ticket.actions')}
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-200 bg-white">
        {tickets.map((ticket) => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            ticketImageUrl={normalizeTicketImageUrl(ticket.image_url)}
            restToPayValue={formatRestToPay(ticket)}
            restToPayClass={restToPayClass(ticket)}
            onViewTicket={onViewTicket}
            onViewTicketImage={onViewTicketImage}
            onCloseTicket={onCloseTicket}
            onOpenPayment={onOpenPayment}
          />
        ))}
        {tickets.length === 0 ? (
          <tr>
            <td colSpan={11} className="px-4 py-6 text-center text-gray-500">
              {t('ticket.noTickets')}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  )
}
