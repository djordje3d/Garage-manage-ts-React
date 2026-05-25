import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPayment, getPaymentsByTicket } from '../../api/payments'
import { parseApiError } from '../../api/error'
import { formatMoney } from '../../composables/useFormatters'
import { ButtonIn } from '../ui/ButtonIn'
import { InputIn } from '../ui/InputIn'
import { Modal } from '../ui/Modal'
import { StandardDropdown } from '../ui/StandardDropdown'

export type PaymentModalProps = {
  modelValue: boolean
  ticketId: number
  fee: string | null
  garageName?: string | null
  onModelValueChange?: (value: boolean) => void
  onClose?: () => void
  onDone?: () => void
}

export function PaymentModal({
  modelValue,
  ticketId,
  fee,
  garageName,
  onModelValueChange,
  onClose,
  onDone,
}: PaymentModalProps) {
  const { t } = useTranslation()

  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<string | null>('CASH')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totalPaid, setTotalPaid] = useState(0)

  const methodOptions = useMemo(
    () => [
      { id: 'CASH' as const, label: t('payment.cash') },
      { id: 'CARD' as const, label: t('payment.card') },
    ],
    [t],
  )

  const modalTitle = useMemo(
    () =>
      garageName
        ? `${t('payment.payment')} – ${garageName}`
        : t('payment.payment'),
    [garageName, t],
  )

  const feeNum = useMemo(() => {
    const f = fee ? parseFloat(fee) : 0
    return Number.isNaN(f) ? 0 : f
  }, [fee])

  const restToPay = useMemo(() => {
    const rest = feeNum - totalPaid
    return rest < 0 ? 0 : rest
  }, [feeNum, totalPaid])

  const amountExceedsRest =
    restToPay != null && restToPay > 0 && amount > restToPay

  function close() {
    onModelValueChange?.(false)
    onClose?.()
  }

  async function loadPayments() {
    try {
      const res = await getPaymentsByTicket(ticketId, { limit: 500 })
      const sum = res.data.items.reduce(
        (s, p) => s + parseFloat(p.amount),
        0,
      )
      setTotalPaid(sum)
      const feeValue = fee ? parseFloat(fee) : 0
      setAmount(Math.max(0, (Number.isNaN(feeValue) ? 0 : feeValue) - sum))
    } catch {
      setTotalPaid(0)
    }
  }

  useEffect(() => {
    void loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fee, ticketId])

  async function submit() {
    setError('')
    if (amount <= 0) {
      setError(t('payment.amountMustBePositive'))
      return
    }
    if (amountExceedsRest) {
      setError(
        t('payment.amountExceedsRemainingBalance', {
          amount: formatMoney(restToPay),
        }),
      )
      return
    }
    setLoading(true)
    try {
      await createPayment({
        ticket_id: ticketId,
        amount,
        method: method ?? 'CASH',
        currency: 'RSD',
      })
      setLoading(false)
      requestAnimationFrame(() => {
        onDone?.()
        close()
      })
    } catch (e: unknown) {
      setError(parseApiError(e, t('payment.paymentFailed')).message)
      setLoading(false)
    }
  }

  return (
    <Modal
      modelValue={modelValue}
      title={modalTitle}
      showHeaderClose={false}
      onModelValueChange={onModelValueChange}
    >
      <p className="mt-1 text-sm text-gray-600">
        {t('ticket.ticket')} #{ticketId}
      </p>
      <p className="mb-1 text-sm text-gray-600">
        {t('payment.totalFee')}: {formatMoney(fee)}
      </p>
      {restToPay != null ? (
        <p className="mb-2 text-sm font-medium text-amber-700">
          {t('payment.restToPay')}: {formatMoney(restToPay)}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <InputIn
                id="amount"
                modelValue={amount}
                onModelValueChange={(v) => setAmount(Number(v))}
                label={t('payment.amount')}
                type="number"
                step={1}
                min={1}
                required
                variant={amountExceedsRest ? 'error' : 'default'}
                error={
                  amountExceedsRest && restToPay != null
                    ? `${t('payment.amountExceedsRemainingBalance')} ${formatMoney(restToPay)}.`
                    : undefined
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <StandardDropdown
                label={t('payment.method')}
                options={methodOptions}
                modelValue={method}
                placeholder={t('payment.selectMethod')}
                nullable={false}
                onModelValueChange={(v) => setMethod(v as string | null)}
              />
            </div>
          </div>
        </div>

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-between gap-2">
          <ButtonIn
            id="cancelBtn"
            label={t('payment.cancel')}
            variant="outline"
            onUserClick={close}
            caption={t('payment.cancel')}
          />
          <ButtonIn
            id="submitPaymentBtn"
            label={t('payment.submitPayment')}
            variant="primary"
            disabled={amountExceedsRest || loading}
            onUserClick={() => void submit()}
            caption={t('payment.submitPayment')}
          />
        </div>
      </form>
    </Modal>
  )
}
