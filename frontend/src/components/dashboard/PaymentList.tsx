import { useTranslation } from 'react-i18next'
import type { Payment } from '../../api/payments'
import { formatMoney, formatTime } from '../../composables/useFormatters'

export type PaymentListProps = {
  paymentsLoading: boolean
  payments: Payment[]
  totalPaid: number
}

export function PaymentList({
  paymentsLoading,
  payments,
  totalPaid,
}: PaymentListProps) {
  const { t } = useTranslation()

  if (paymentsLoading) {
    return <div className="mt-3 text-sm text-gray-500">{t('ticket.loading')}</div>
  }

  if (!payments.length) {
    return (
      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
        {t('ticket.noPaymentsRecorded')}
      </div>
    )
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500"
            >
              #
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500"
            >
              {t('payment.amount')}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500"
            >
              {t('payment.when')}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500"
            >
              {t('payment.method')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {payments.map((p, idx) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                {idx + 1}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-900">
                {formatMoney(p.amount)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                {formatTime(p.paid_at)}
              </td>
              <td className="px-3 py-2 text-right font-medium text-gray-600">
                {p.method ?? '–'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td
              colSpan={2}
              className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600"
            >
              {t('payment.totalPaid')}
            </td>
            <td
              colSpan={2}
              className="whitespace-nowrap px-3 py-2 text-right font-semibold text-gray-900"
            >
              {formatMoney(String(totalPaid))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
