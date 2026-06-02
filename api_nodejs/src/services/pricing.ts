import type { QueryResult, QueryResultRow } from "pg";
type Queryable = {
  query: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<QueryResult<R>>;
};

export type TicketForFee = {
  id: number;
  entry_time: Date | string | null;
  exit_time: Date | string | null;
  garage_id: number;
  vehicle_id: number | null;
};

function ensureUtc(dt: Date | string | null | undefined): Date | null {
  if (dt == null) return null;
  const d = typeof dt === "string" ? new Date(dt) : dt;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function getRateForTicket(
  client: Queryable,
  ticket: TicketForFee
): Promise<number> {
  if (ticket.vehicle_id) {
    const vt = await client.query<{ rate: string }>(
      `SELECT vt.rate::text AS rate
       FROM vehicle v
       JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
       WHERE v.id = $1`,
      [ticket.vehicle_id]
    );
    if (vt.rows[0]?.rate != null) return parseFloat(vt.rows[0].rate);
  }
  const g = await client.query<{ default_rate: string }>(
    `SELECT default_rate::text AS default_rate FROM parking_config WHERE id = $1`,
    [ticket.garage_id]
  );
  if (g.rows[0]?.default_rate != null) return parseFloat(g.rows[0].default_rate);
  return 0;
}

export async function calculateFee(
  client: Queryable,
  ticket: TicketForFee
): Promise<number> {
  const entry = ensureUtc(ticket.entry_time);
  const exit = ensureUtc(ticket.exit_time);
  if (!entry || !exit) return 0;
  const deltaMs = exit.getTime() - entry.getTime();
  const minutes = Math.max(1, Math.floor(deltaMs / 60000));
  const hours = Math.max(1, Math.ceil(minutes / 60));
  const rate = await getRateForTicket(client, ticket);
  return hours * rate;
}

export async function getTicketFee(
  client: Queryable,
  ticket: TicketForFee
): Promise<number> {
  return calculateFee(client, ticket);
}

/** Used when ticket row includes joined vehicle_type rate (ORM path). */
export function calculateFeeSync(params: {
  entry_time: Date | string | null;
  exit_time: Date | string | null;
  vehicleTypeRate: number | null;
  garageDefaultRate: number | null;
}): number {
  const entry = ensureUtc(params.entry_time);
  const exit = ensureUtc(params.exit_time);
  if (!entry || !exit) return 0;
  const deltaMs = exit.getTime() - entry.getTime();
  const minutes = Math.max(1, Math.floor(deltaMs / 60000));
  const hours = Math.max(1, Math.ceil(minutes / 60));
  const rate =
    params.vehicleTypeRate != null && !Number.isNaN(params.vehicleTypeRate)
      ? params.vehicleTypeRate
      : params.garageDefaultRate ?? 0;
  return hours * rate;
}
