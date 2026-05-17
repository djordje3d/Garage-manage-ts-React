export function pgErrorCode(e: unknown): string | undefined {
  return (e as { code?: string })?.code;
}

export function isPgError(e: unknown, code: string): boolean {
  return pgErrorCode(e) === code;
}
