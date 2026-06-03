import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Payment } from '../../api/payments'
import type { TicketDashboardRow } from '../../api/tickets'
import { formatMoney, formatTime } from '../../composables/useFormatters'
import { ButtonIn } from '../ui/ButtonIn'
import { ImageIn } from '../ui/ImageIn'
import { Modal } from '../ui/Modal'
import { PaymentList } from './PaymentList'

export type TicketDetailModalProps = {
  modelValue: boolean
  ticket: TicketDashboardRow | null
  ticketImageUrl?: string
  barcodeImageSrc: string
  paymentsLoading: boolean
  payments: Payment[]
  paymentsTotal: number
  onModelValueChange?: (value: boolean) => void
  onGoToPayment?: (ticket: TicketDashboardRow) => void
}

export function TicketDetailModal({
  modelValue,
  ticket,
  ticketImageUrl,
  barcodeImageSrc,
  paymentsLoading,
  payments,
  paymentsTotal,
  onModelValueChange,
  onGoToPayment,
}: TicketDetailModalProps) {
  const { t } = useTranslation()

  const modalTitle = useMemo(
    () =>
      ticket ? `${ticket.garage_name ?? '–'} — Ticket #${ticket.id}` : '',
    [ticket],
  )

  return (
    <Modal
      modelValue={modelValue}
      title={modalTitle}
      showHeaderClose={false}
      onModelValueChange={onModelValueChange}
    >
      {ticket ? (
        <>
          <div className="mx-auto w-full max-w-sm">
            {ticketImageUrl ? (
              <div className="mb-4">
                <ImageIn
                  key={`ticket-img-${ticket.id}-${ticketImageUrl}`}
                  src={ticketImageUrl}
                  alt={`Ticket #${ticket.id}`}
                />
              </div>
            ) : null}

            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">{t('ticket.garage')}</dt>
                <dd>{ticket.garage_name ?? '–'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('ticket.plate')}</dt>
                <dd>{ticket.licence_plate ?? '–'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('ticket.spot')}</dt>
                <dd>{ticket.spot_code ?? '–'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('ticket.entryTime')}</dt>
                <dd>{formatTime(ticket.entry_time)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('ticket.exitTime')}</dt>
                <dd>{formatTime(ticket.exit_time) || '–'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('ticket.fee')}</dt>
                <dd>{formatMoney(ticket.fee)}</dd>
              </div>
            </dl>
          </div>

          <dd className="mt-2 -mx-6">
            {barcodeImageSrc ? (
              <img
                src={barcodeImageSrc}
                className="block h-auto w-full bg-white"
                alt={`Barcode for ticket ${ticket.ticket_token ?? ticket.id}`}
              />
            ) : (
              <span className="px-6 text-xs text-gray-400">
                Barcode unavailable
              </span>
            )}
          </dd>

          <div className="mt-4 border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-800">
              {t('ticket.evidenceOfPayments')}
            </h4>
            <p className="mt-0.5 text-xs text-gray-500">
              {t('ticket.allPaymentsForThisTicket')}
            </p>

            <PaymentList
              paymentsLoading={paymentsLoading}
              payments={payments}
              totalPaid={paymentsTotal}
            />
          </div>

          <div className="mt-4 flex justify-between gap-2">
            <ButtonIn
              id="ticket-detail-close"
              type="button"
              variant="outline"
              onUserClick={() => onModelValueChange?.(false)}
              label={t('ticket.close')}
              caption={t('ticket.close')}
            >
              {t('ticket.close')}
            </ButtonIn>

            {ticket.ticket_state === 'CLOSED' &&
            ticket.payment_status !== 'PAID' ? (
              <ButtonIn
                id="ticket-detail-go-to-payment"
                type="button"
                variant="primary"
                onUserClick={() => {
                  onGoToPayment?.(ticket)
                  onModelValueChange?.(false)
                }}
              >
                {t('ticket.goToPayment')}
              </ButtonIn>
            ) : null}
          </div>
        </>
      ) : null}
    </Modal>
  )
}
