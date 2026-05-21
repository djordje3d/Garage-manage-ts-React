import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Payment } from '../../api/payments'
import { getPaymentsByTicket } from '../../api/payments'
import type { TicketDashboardRow } from '../../api/tickets'
import { listTicketsDashboard, ticketExit } from '../../api/tickets'
import {
  DASHBOARD_REQUEST_REFRESH_EVENT,
  DASHBOARD_WIDGET_FETCH_DONE,
} from '../../constants/dashboardRefresh'
import {
  DASHBOARD_REFRESH_EVENT,
  useDashboardRefreshAbortSignal,
} from '../../contexts/dashboardRefresh'
import { generateCode39BarcodeImage } from '../../utils/code39'
import { normalizeTicketImageUrl } from '../../utils/ticketImageUrl'
import { Modal } from '../ui/Modal'
import { PaginationBar } from '../ui/PaginationBar'
import { PaymentModal } from './PaymentModal'
import { TicketDetailModal } from './TicketDetailModal'
import { TicketTable } from './TicketTable'

const BARCODE_WIDTH = 360
const PAYMENTS_VIEW_LIMIT = 50

export type TicketActivityProps = {
  garageId?: number | null
  fromDate?: string
  toDate?: string
}

export function TicketActivity({
  garageId,
  fromDate,
  toDate,
}: TicketActivityProps) {
  const { t } = useTranslation()
  const dashboardRefreshAbortSignal = useDashboardRefreshAbortSignal()

  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const [tickets, setTickets] = useState<TicketDashboardRow[]>([])
  const [ticketsPage, setTicketsPage] = useState(1)
  const [ticketsPageSize, setTicketsPageSize] = useState(10)
  const [ticketsTotal, setTicketsTotal] = useState(0)

  const [viewingTicket, setViewingTicket] = useState<TicketDashboardRow | null>(
    null,
  )
  const [viewingTicketImage, setViewingTicketImage] =
    useState<TicketDashboardRow | null>(null)
  const [showTicketImageModal, setShowTicketImageModal] = useState(false)

  const [viewPayments, setViewPayments] = useState<Payment[]>([])
  const [viewPaymentsLoading, setViewPaymentsLoading] = useState(false)

  const [paymentTicket, setPaymentTicket] = useState<TicketDashboardRow | null>(
    null,
  )
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const [restToPayMap, setRestToPayMap] = useState<Record<number, number>>({})
  const paymentsCacheRef = useMemo(() => new Map<number, Payment[]>(), [])

  const ticketsOffset = (ticketsPage - 1) * ticketsPageSize

  const barcodeImageSrc = useMemo(() => {
    const ticket = viewingTicket
    if (!ticket) return ''
    const token = ticket.ticket_token ?? String(ticket.id)
    if (!token) return ''
    try {
      return generateCode39BarcodeImage(String(token), BARCODE_WIDTH)
    } catch (err) {
      console.error('Failed to generate Code 39 barcode:', err)
      return ''
    }
  }, [viewingTicket])

  const viewPaymentsTotal = useMemo(
    () => viewPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
    [viewPayments],
  )

  const viewPaymentsSorted = useMemo(() => {
    const list = [...viewPayments]
    list.sort((a, b) => {
      const ta = a.paid_at ? new Date(a.paid_at).getTime() : 0
      const tb = b.paid_at ? new Date(b.paid_at).getTime() : 0
      return tb - ta
    })
    return list
  }, [viewPayments])

  const ticketImageUrl = useMemo(
    () => normalizeTicketImageUrl(viewingTicket?.image_url),
    [viewingTicket?.image_url],
  )

  const ticketImagePreviewUrl = useMemo(
    () => normalizeTicketImageUrl(viewingTicketImage?.image_url),
    [viewingTicketImage?.image_url],
  )

  function invalidatePaymentsCache(ticketId?: number) {
    if (ticketId != null) paymentsCacheRef.delete(ticketId)
    else paymentsCacheRef.clear()
  }

  const fetchPaymentsForView = useCallback(
    async (ticketId: number, config?: { signal?: AbortSignal }) => {
      const cached = paymentsCacheRef.get(ticketId)
      if (cached !== undefined) {
        setViewPayments(cached)
        return
      }

      setViewPaymentsLoading(true)
      setViewPayments([])

      try {
        const res = await getPaymentsByTicket(
          ticketId,
          { limit: PAYMENTS_VIEW_LIMIT },
          config,
        )
        const items = res.data.items
        setViewPayments(items)
        paymentsCacheRef.set(ticketId, items)
      } catch {
        setViewPayments([])
      } finally {
        setViewPaymentsLoading(false)
      }
    },
    [paymentsCacheRef],
  )

  function viewTicket(ticket: TicketDashboardRow) {
    setViewingTicket(ticket)
    const signal = dashboardRefreshAbortSignal ?? undefined
    void fetchPaymentsForView(
      ticket.id,
      signal ? { signal } : undefined,
    )
  }

  function openTicketImage(ticket: TicketDashboardRow) {
    setViewingTicketImage(ticket)
    setViewingTicket(null)
    setShowTicketImageModal(true)
  }

  function openPayment(ticket: TicketDashboardRow) {
    setPaymentTicket(ticket)
    setShowPaymentModal(true)
  }

  async function closeTicket(id: number) {
    try {
      await ticketExit(id)
      window.dispatchEvent(new CustomEvent(DASHBOARD_REQUEST_REFRESH_EVENT))
    } catch {
      // optionally show toast
    }
  }

  function closePaymentModal() {
    setShowPaymentModal(false)
    requestAnimationFrame(() => setPaymentTicket(null))
  }

  function onPaymentDone() {
    invalidatePaymentsCache(paymentTicket?.id)
    setShowPaymentModal(false)
    requestAnimationFrame(() => {
      setPaymentTicket(null)
      window.dispatchEvent(new CustomEvent(DASHBOARD_REQUEST_REFRESH_EVENT))
    })
  }

  const fetchData = useCallback(
    async (refreshEpoch?: number) => {
      const hasData = tickets.length > 0 || hasLoadedOnce

      if (!hasData) {
        setLoading(true)
        setError(false)
        setRestToPayMap({})
      } else {
        setRefreshing(true)
      }

      const signal = dashboardRefreshAbortSignal ?? undefined
      const config = signal ? { signal } : undefined

      try {
        const res = await listTicketsDashboard(
          {
            ...(garageId != null ? { garage_id: garageId } : {}),
            ...(fromDate ? { from_date: fromDate } : {}),
            ...(toDate ? { to_date: toDate } : {}),
            limit: ticketsPageSize,
            offset: ticketsOffset,
          },
          config,
        )

        setTickets(res.data.items)
        setTicketsTotal(res.data.total)
        setRestToPayMap(
          Object.fromEntries(
            res.data.items.map((item) => [item.id, item.rest_to_pay ?? 0]),
          ),
        )
        setHasLoadedOnce(true)
        setError(false)
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === 'ERR_CANCELED') return
        setError(true)
        if (!hasData) {
          setTickets([])
          setTicketsTotal(0)
          setRestToPayMap({})
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
        if (refreshEpoch != null && refreshEpoch > 0) {
          window.dispatchEvent(
            new CustomEvent(DASHBOARD_WIDGET_FETCH_DONE, {
              detail: { epoch: refreshEpoch },
            }),
          )
        }
      }
    },
    [
      dashboardRefreshAbortSignal,
      fromDate,
      garageId,
      hasLoadedOnce,
      tickets.length,
      ticketsOffset,
      ticketsPageSize,
      toDate,
    ],
  )

  const retry = useCallback(() => {
    setError(false)
    void fetchData()
  }, [fetchData])

  function handleTicketsPageSizeChange(value: number) {
    setTicketsPageSize(value)
    setTicketsPage(1)
  }

  useEffect(() => {
    setTicketsPage(1)
    void fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garageId, fromDate, toDate])

  useEffect(() => {
    if (!hasLoadedOnce) return
    void fetchData()
  }, [ticketsPage, ticketsPageSize, hasLoadedOnce, fetchData])

  useEffect(() => {
    const onDashboardRefresh = (e: Event) => {
      const epoch = (e as CustomEvent<{ epoch?: number }>).detail?.epoch
      void fetchData(epoch)
    }

    window.addEventListener(DASHBOARD_REFRESH_EVENT, onDashboardRefresh)
    void fetchData()

    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, onDashboardRefresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="dashboard-card">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('ticket.ticketActivity')}
        </h2>
      </div>

      <div className="overflow-x-auto">
        {error ? (
          <div
            className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
            role="alert"
          >
            <button
              type="button"
              className="text-red-600 underline hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              onClick={retry}
            >
              Failed to fetch data, click here to retry
            </button>
          </div>
        ) : loading ? (
          <div
            className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-gray-500"
            aria-busy="true"
            aria-live="polite"
          >
            <span
              className="icon-spinner11 inline-block text-2xl animate-spin"
              aria-hidden="true"
            />
            <span>loading data...</span>
          </div>
        ) : !hasLoadedOnce && !refreshing ? (
          <div className="px-4 py-12 text-center text-gray-400">—</div>
        ) : (
          <div className="relative min-h-[120px]">
            {refreshing ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-white/70"
                aria-busy="true"
                aria-label="Refreshing"
              >
                <span
                  className="icon-spinner11 inline-block text-3xl animate-spin text-gray-500"
                  aria-hidden="true"
                />
              </div>
            ) : null}

            <TicketTable
              tickets={tickets}
              restToPayMap={restToPayMap}
              onViewTicket={viewTicket}
              onViewTicketImage={openTicketImage}
              onCloseTicket={(id) => void closeTicket(id)}
              onOpenPayment={openPayment}
            />
            <PaginationBar
              page={ticketsPage}
              pageSize={ticketsPageSize}
              total={ticketsTotal}
              showPageSize
              pageSizeOptions={[5, 10, 20]}
              onPageChange={setTicketsPage}
              onPageSizeChange={handleTicketsPageSizeChange}
            />
          </div>
        )}
      </div>

      <PaymentModal
        modelValue={showPaymentModal}
        ticketId={paymentTicket?.id ?? 0}
        fee={paymentTicket?.fee ?? null}
        garageName={paymentTicket?.garage_name ?? undefined}
        onModelValueChange={setShowPaymentModal}
        onClose={closePaymentModal}
        onDone={onPaymentDone}
      />

      <TicketDetailModal
        modelValue={!!viewingTicket}
        ticket={viewingTicket}
        ticketImageUrl={ticketImageUrl}
        barcodeImageSrc={barcodeImageSrc}
        paymentsLoading={viewPaymentsLoading}
        payments={viewPaymentsSorted}
        paymentsTotal={viewPaymentsTotal}
        onModelValueChange={(value) => {
          if (!value) setViewingTicket(null)
        }}
        onGoToPayment={(ticket) => {
          openPayment(ticket)
          setViewingTicket(null)
        }}
      />

      <Modal
        modelValue={showTicketImageModal}
        title={
          viewingTicketImage
            ? `${viewingTicketImage.garage_name ?? '–'} — Ticket #${viewingTicketImage.id}`
            : ''
        }
        onModelValueChange={(value) => {
          setShowTicketImageModal(value)
          if (!value) {
            requestAnimationFrame(() => setViewingTicketImage(null))
          }
        }}
      >
        <div className="flex items-center justify-center p-1">
          {ticketImagePreviewUrl ? (
            <img
              src={ticketImagePreviewUrl}
              alt={
                viewingTicketImage
                  ? `Ticket image for #${viewingTicketImage.id}`
                  : 'Ticket image'
              }
              className="max-h-[70vh] w-full rounded-lg border border-gray-200 bg-white object-contain"
            />
          ) : (
            <div className="flex h-[200px] w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-gray-400">
              –
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
