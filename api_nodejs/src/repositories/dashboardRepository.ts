import type { Queryable } from "./types";

export type TicketOutstandingRow = {
  id: number;
  entry_time: Date | null;
  exit_time: Date | null;
  fee: string | null;
  garage_id: number;
  vehicle_id: number | null;
  vt_rate: string | null;
  g_default_rate: string | null;
};

export async function countAllSpots(
  db: Queryable,
  garageId: number | null
): Promise<number> {
  const spotFilter = garageId != null ? "WHERE garage_id = $1" : "";
  const spotParams = garageId != null ? [garageId] : [];
  const r = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM parking_spot ${spotFilter}`,
    spotParams
  );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function countActiveSpots(
  db: Queryable,
  garageId: number | null
): Promise<number> {
  const spotParams = garageId != null ? [garageId] : [];
  const r = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM parking_spot WHERE is_active = true ${
      garageId != null ? "AND garage_id = $1" : ""
    }`,
    spotParams
  );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function countFreeSpots(
  db: Queryable,
  garageId: number | null
): Promise<number> {
  const spotParams = garageId != null ? [garageId] : [];
  const r = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM parking_spot p
     WHERE p.is_active = true
       ${garageId != null ? "AND p.garage_id = $1" : ""}
       AND NOT EXISTS (
         SELECT 1 FROM tickets t
         WHERE t.spot_id = p.id AND t.ticket_state = 'OPEN'
       )`,
    spotParams
  );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function countOpenTickets(
  db: Queryable,
  garageId: number | null
): Promise<number> {
  const r =
    garageId != null
      ? await db.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM tickets WHERE ticket_state = 'OPEN' AND garage_id = $1`,
          [garageId]
        )
      : await db.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM tickets WHERE ticket_state = 'OPEN'`,
          []
        );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function sumPaymentsInRange(
  db: Queryable,
  garageId: number | null,
  start: Date,
  endExclusive: Date
): Promise<number> {
  const sql =
    garageId != null
      ? `SELECT COALESCE(SUM(p.amount), 0)::text AS s
         FROM payments p
         JOIN tickets t ON t.id = p.ticket_id
         WHERE t.garage_id = $1 AND p.paid_at >= $2 AND p.paid_at < $3`
      : `SELECT COALESCE(SUM(p.amount), 0)::text AS s
         FROM payments p
         WHERE p.paid_at >= $1 AND p.paid_at < $2`;
  const params =
    garageId != null ? [garageId, start, endExclusive] : [start, endExclusive];
  const r = await db.query<{ s: string }>(sql, params);
  return parseFloat(r.rows[0]?.s ?? "0");
}

export async function countUnpaidAndPartial(
  db: Queryable,
  garageId: number | null
): Promise<number> {
  const clause =
    garageId != null
      ? "WHERE payment_status IN ('UNPAID','PARTIALLY_PAID') AND garage_id = $1"
      : "WHERE payment_status IN ('UNPAID','PARTIALLY_PAID')";
  const params = garageId != null ? [garageId] : [];
  const r = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM tickets ${clause}`,
    params
  );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function listOutstandingTickets(
  db: Queryable,
  garageId: number | null
): Promise<TicketOutstandingRow[]> {
  const sql = `
    SELECT t.id, t.entry_time, t.exit_time, t.fee::text AS fee, t.garage_id, t.vehicle_id,
           vt.rate::text AS vt_rate,
           pc.default_rate::text AS g_default_rate
    FROM tickets t
    LEFT JOIN vehicle v ON v.id = t.vehicle_id
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    JOIN parking_config pc ON pc.id = t.garage_id
    WHERE t.ticket_state = 'CLOSED'
      AND t.payment_status IN ('UNPAID', 'PARTIALLY_PAID')
      ${garageId != null ? "AND t.garage_id = $1" : ""}
  `;
  const r = await db.query<TicketOutstandingRow>(sql, garageId != null ? [garageId] : []);
  return r.rows;
}

export async function sumPaymentsByTicket(
  db: Queryable,
  ticketId: number
): Promise<number> {
  const r = await db.query<{ s: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS s FROM payments WHERE ticket_id = $1`,
    [ticketId]
  );
  return parseFloat(r.rows[0]?.s ?? "0");
}

export async function batchPaymentTotalsByTicket(
  db: Queryable,
  ticketIds: number[]
): Promise<Map<number, number>> {
  if (ticketIds.length === 0) return new Map();
  const r = await db.query<{ ticket_id: number; amt: string }>(
    `SELECT ticket_id, COALESCE(SUM(amount), 0)::text AS amt
     FROM payments WHERE ticket_id = ANY($1::int[])
     GROUP BY ticket_id`,
    [ticketIds]
  );
  const m = new Map<number, number>();
  for (const row of r.rows) {
    m.set(row.ticket_id, parseFloat(row.amt));
  }
  return m;
}
