export interface ApiErrorEnvelope {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  detail?: string
  message?: string
}

export interface ParsedApiError {
  code?: string
  message: string
  details?: unknown
}

export function parseApiError(error: unknown, fallbackMessage: string): ParsedApiError {
  const responseData = (
    error as { response?: { data?: ApiErrorEnvelope } } | undefined
  )?.response?.data

  const envelope = responseData?.error
  const message =
    envelope?.message ||
    (typeof responseData?.detail === 'string' ? responseData.detail : null) ||
    responseData?.message ||
    fallbackMessage

  return {
    code: envelope?.code,
    message,
    details: envelope?.details,
  }
}
