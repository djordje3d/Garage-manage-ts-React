import type { QueryResult, QueryResultRow } from "pg";
type Queryable = {
  query: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<QueryResult<R>>;
};
import { calculateFeeSync } from "./pricing";

export async function computeSpotTicketCounts(
  db: Queryable,
  garageId: number | null
): Promise<[number, number, number, number]> {
  const spotFilter = garageId != null ? "WHERE garage_id = $1" : "";
  const spotParams = garageId != null ? [garageId] : [];

  const totalAll = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM parking_spot ${spotFilter}`,
    spotParams
  );
  const totalActive = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM parking_spot WHERE is_active = true ${
      garageId != null ? "AND garage_id = $1" : ""
    }`,
    spotParams
  );
  const freeCount = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM parking_spot p
     WHERE p.is_active = true
       ${garageId != null ? "AND p.garage_id = $1" : ""}
       AND NOT EXISTS (
         SELECT 1 FROM tickets t
         WHERE t.spot_id = p.id AND t.ticket_state = 'OPEN'
       )`,
    spotParams
  );

  const totalAllN = parseInt(totalAll.rows[0]?.c ?? "0", 10);
  const totalActiveN = parseInt(totalActive.rows[0]?.c ?? "0", 10);
  const freeN = parseInt(freeCount.rows[0]?.c ?? "0", 10);
  const inactive = Math.max(0, totalAllN - totalActiveN);
  const occupied = Math.max(0, totalActiveN - freeN);

  const openQ =
    garageId != null
      ? await db.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM tickets WHERE ticket_state = 'OPEN' AND garage_id = $1`,
          [garageId]
        )
      : await db.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM tickets WHERE ticket_state = 'OPEN'`,
          []
        );
  const openTickets = parseInt(openQ.rows[0]?.c ?? "0", 10);

  return [freeN, occupied, inactive, openTickets];
}

function dateBoundsUtc(fromDate: string, toInclusive: string): { start: Date; endExclusive: Date } {
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toInclusive}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, endExclusive: end };
}

export async function sumPaymentsInRange(
  db: Queryable,
  garageId: number | null,
  fromDate: string,
  toDateInclusive: string
): Promise<number> {
  const { start, endExclusive } = dateBoundsUtc(fromDate, toDateInclusive);
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

export async function computeTotalOutstanding(
  db: Queryable,
  garageId: number | null
): Promise<number> {
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
  let total = 0;
  for (const t of r.rows) {
    let fee: number;
    if (t.entry_time && t.exit_time) {
      const vtRate = t.vt_rate != null ? parseFloat(t.vt_rate) : null;
      const gRate = t.g_default_rate != null ? parseFloat(t.g_default_rate) : null;
      fee = calculateFeeSync({
        entry_time: t.entry_time,
        exit_time: t.exit_time,
        vehicleTypeRate: vtRate,
        garageDefaultRate: gRate
      });
    } else {
      fee = t.fee != null ? parseFloat(t.fee) : 0;
    }
    const paidR = await db.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS s FROM payments WHERE ticket_id = $1`,
      [t.id]
    );
    const paid = parseFloat(paidR.rows[0]?.s ?? "0");
    total += fee - paid;
  }
  return Math.max(0, total);
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

export function computeRestToPayForTicket(params: {
  ticket_state: string;
  payment_status: string;
  entry_time: Date | null;
  exit_time: Date | null;
  fee: string | null;
  vt_rate: string | null;
  g_default_rate: string | null;
  paid: number;
}): number {
  if (params.ticket_state === "OPEN" || params.payment_status === "PAID") return 0;
  let fee: number;
  if (params.entry_time && params.exit_time) {
    const vtRate = params.vt_rate != null ? parseFloat(params.vt_rate) : null;
    const gRate = params.g_default_rate != null ? parseFloat(params.g_default_rate) : null;
    fee = calculateFeeSync({
      entry_time: params.entry_time,
      exit_time: params.exit_time,
      vehicleTypeRate: vtRate,
      garageDefaultRate: gRate
    });
  } else {
    fee = params.fee != null ? parseFloat(params.fee) : 0;
  }
  return Math.max(0, fee - params.paid);
}
