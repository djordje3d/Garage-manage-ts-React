import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChangeEvent } from 'react'

export type PaginationBarProps = {
  page: number
  pageSize: number
  total: number
  showPageSize?: boolean
  pageSizeOptions?: number[]
  onPageChange?: (value: number) => void
  onPageSizeChange?: (value: number) => void
}

export function PaginationBar({
  page,
  pageSize,
  total,
  showPageSize = false,
  pageSizeOptions = [5, 10, 20],
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const { t } = useTranslation()

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  )

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  function goPrev() {
    if (page > 1) onPageChange?.(page - 1)
  }

  function goNext() {
    if (page < totalPages) onPageChange?.(page + 1)
  }

  function onPageSizeSelect(event: ChangeEvent<HTMLSelectElement>) {
    const value = Number(event.target.value)
    if (Number.isFinite(value) && value > 0) {
      onPageSizeChange?.(value)
    }
  }

  if (total <= 0) return null

  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-600">
          Showing {start}–{end} of {total}
        </p>

        {showPageSize ? (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span>Page size</span>
            <select
              value={pageSize}
              className="h-12 rounded border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
              onChange={onPageSizeSelect}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
            aria-label="Previous page"
            title={t('garageDetail.previousPage')}
            onClick={goPrev}
          >
            <span className="icon-arrow-left text-sm" aria-hidden="true" />
          </button>
        ) : null}

        <span className="text-sm text-gray-600">
          {t('garageDetail.page')} {page} {t('garageDetail.of')} {totalPages}
        </span>

        {page < totalPages ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
            aria-label="Next page"
            title={t('garageDetail.nextPage')}
            onClick={goNext}
          >
            <span className="icon-arrow-right text-sm" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
