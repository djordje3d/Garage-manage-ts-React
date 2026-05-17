export function parseBool(v: unknown, defaultValue: boolean): boolean {
  if (v === undefined || v === "") return defaultValue;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

export function parseOptionalInt(v: unknown): number | null {
  if (v === undefined || v === "" || v == null) return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

export function parseOptionalDateDay(v: unknown): Date | null {
  if (v === undefined || v === "" || v == null) return null;
  return new Date(`${String(v)}T00:00:00.000Z`);
}

export function dayRangeExclusive(toDay: Date): Date {
  return new Date(toDay.getTime() + 86400000);
}
