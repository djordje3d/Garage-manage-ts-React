export type SummaryRowProps = {
  label: string
  value: string | number
  valueClass?: string
}

export function SummaryRow({
  label,
  value,
  valueClass = 'text-gray-900',
}: SummaryRowProps) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  )
}
