export function parseLimitOffset(
  limitRaw: unknown,
  offsetRaw: unknown,
  defLimit = 100,
  maxLimit = 1000
): { limit: number; offset: number } {
  let limit = parseInt(String(limitRaw ?? defLimit), 10);
  let offset = parseInt(String(offsetRaw ?? 0), 10);
  if (Number.isNaN(limit) || limit < 1) limit = defLimit;
  if (limit > maxLimit) limit = maxLimit;
  if (Number.isNaN(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

export type PaginatedResult<T> = {
  total: number;
  limit: number;
  offset: number;
  items: T[];
};
