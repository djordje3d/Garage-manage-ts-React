import { type ChangeEvent, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import './ui-components.css'

export type InputInProps = {
  id: string
  label?: string
  modelValue?: string | number
  type?: 'text' | 'password' | 'number' | 'email'
  placeholder?: string
  required?: boolean
  disabled?: boolean
  variant?: 'default' | 'error'
  caption?: string
  error?: string
  onModelValueChange?: (value: string | number) => void
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'id'
  | 'value'
  | 'type'
  | 'placeholder'
  | 'required'
  | 'disabled'
  | 'onChange'
  | 'title'
>

function inputVariantClasses(variant: 'default' | 'error'): string {
  if (variant === 'error') {
    return 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500'
  }
  return 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'
}

export function InputIn({
  id,
  label,
  modelValue,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  variant = 'default',
  caption,
  error,
  className,
  onModelValueChange,
  ...rest
}: InputInProps) {
  function onInput(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target
    const val =
      type === 'number'
        ? Number.isNaN(el.valueAsNumber)
          ? 0
          : el.valueAsNumber
        : el.value
    onModelValueChange?.(val)
  }

  return (
    <div className="input-in-wrap">
      {label ? (
        <label
          htmlFor={id}
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      ) : null}
      <input
        {...rest}
        id={id}
        value={modelValue ?? ''}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        title={caption}
        aria-invalid={variant === 'error'}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'input-in w-full rounded border px-3 py-2 transition-colors focus:outline-none focus:ring-1',
          inputVariantClasses(variant),
          className,
        )}
        onChange={onInput}
      />
      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1 text-sm font-medium text-red-600"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
