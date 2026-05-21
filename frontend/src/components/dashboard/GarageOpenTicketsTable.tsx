import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TicketDashboardRow } from '../../api/tickets'
import { formatTime } from '../../composables/useFormatters'
import { normalizeTicketImageUrl } from '../../utils/ticketImageUrl'
import { Modal } from '../ui/Modal'
import { PaginationBar } from '../ui/PaginationBar'

export type GarageOpenTicketsTableProps = {
  openTickets: TicketDashboardRow[]
  page: number
  pageSize: number
  total: number
  loading: boolean
  refreshing: boolean
  error: boolean
  hasLoadedOnce: boolean
  onRetry?: () => void
  onPageChange?: (page: number) => void
}

export function GarageOpenTicketsTable({
  openTickets,
  page,
  pageSize,
  total,
  loading,
  refreshing,
  error,
  hasLoadedOnce,
  onRetry,
  onPageChange,
}: GarageOpenTicketsTableProps) {
  const { t } = useTranslation()
  const [viewingTicketImage, setViewingTicketImage] =
    useState<TicketDashboardRow | null>(null)
  const [showTicketImageModal, setShowTicketImageModal] = useState(false)

  const ticketImagePreviewUrl = useMemo(
    () => normalizeTicketImageUrl(viewingTicketImage?.image_url),
    [viewingTicketImage?.image_url],
  )

  function rowImageUrl(row: TicketDashboardRow): string | undefined {
    return normalizeTicketImageUrl(row.image_url)
  }

  function openTicketImage(ticket: TicketDashboardRow) {
    setViewingTicketImage(ticket)
    setShowTicketImageModal(true)
  }

  function onTicketImageModalUpdate(value: boolean) {
    setShowTicketImageModal(value)
    if (!value) {
      requestAnimationFrame(() => setViewingTicketImage(null))
    }
  }

  return (
    <div className="dashboard-card overflow-hidden">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold">{t('garageDetail.openTickets')}</h2>
      </div>

      {error ? (
        <div
          className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
          role="alert"
        >
          <button
            type="button"
            className="text-red-600 underline hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
            onClick={onRetry}
          >
            {t('garageDetail.retryBtn')}
          </button>
        </div>
      ) : loading && !hasLoadedOnce ? (
        <div
          className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-gray-500"
          aria-busy="true"
        >
          <span
            className="icon-spinner5 inline-block text-2xl animate-spin"
            aria-hidden="true"
          />
          <span>{t('garageDetail.loading')}</span>
        </div>
      ) : (
        <>
          <div className="relative overflow-x-auto">
            {refreshing ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-white/70"
                aria-busy="true"
              >
                <span
                  className="icon-spinner3 inline-block text-3xl animate-spin text-gray-500"
                  aria-hidden="true"
                />
              </div>
            ) : null}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    {t('garageDetail.id')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    {t('garageDetail.entryTime')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    {t('garageDetail.spot')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    {t('garageDetail.plate')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    {t('ticket.image')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {openTickets.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{row.id}</td>
                    <td className="px-4 py-3 text-sm">
                      {formatTime(row.entry_time)}
                    </td>
                    <td className="px-4 py-3">{row.spot_code ?? '–'}</td>
                    <td className="px-4 py-3">{row.licence_plate ?? '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {rowImageUrl(row) ? (
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white p-0 hover:shadow-sm"
                          title={t('garageDetail.viewTicketImage')}
                          onClick={() => openTicketImage(row)}
                        >
                          <img
                            src={rowImageUrl(row)}
                            alt={`Ticket image for #${row.id}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-xs text-gray-400 select-none"
                          title={t('garageDetail.noTicketImage')}
                        >
                          –
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {openTickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      {t('garageDetail.noOpenTickets')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
          />
        </>
      )}

      <Modal
        modelValue={showTicketImageModal}
        title={
          viewingTicketImage
            ? `${viewingTicketImage.garage_name ?? '–'} — Ticket #${viewingTicketImage.id}`
            : ''
        }
        onModelValueChange={onTicketImageModalUpdate}
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
