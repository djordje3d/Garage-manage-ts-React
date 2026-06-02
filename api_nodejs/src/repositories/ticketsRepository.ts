import type { PoolClient } from "pg";
import { query } from "../config/db";
import type { Queryable } from "./types";

export type TicketListFilters = {
  state: string | null;
  payment_status: string | null;
  garage_id: number | null;
};

export type TicketDashboardFilters = {
  garage_id: number | null;
  ticket_state: string | null;
  from_date: Date | null;
  to_date_exclusive: Date | null;
};

export type TicketRow = Record<string, unknown>;

function buildTicketListWhere(filters: TicketListFilters): { where: string; params: unknown[] } {
  const cond: string[] = ["1=1"];
  const params: unknown[] = [];
  let p = 1;
  if (filters.state) {
    cond.push(`ticket_state = $${p++}`);
    params.push(filters.state);
  }
  if (filters.payment_status) {
    cond.push(`payment_status = $${p++}`);
    params.push(filters.payment_status);
  }
  if (filters.garage_id != null) {
    cond.push(`garage_id = $${p++}`);
    params.push(filters.garage_id);
  }
  return { where: cond.join(" AND "), params };
}

function buildDashboardWhere(filters: TicketDashboardFilters): { where: string; params: unknown[] } {
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];
  let p = 1;
  if (filters.garage_id != null) {
    conditions.push(`t.garage_id = $${p++}`);
    params.push(filters.garage_id);
  }
  if (filters.ticket_state) {
    conditions.push(`t.ticket_state = $${p++}`);
    params.push(filters.ticket_state);
  }
  if (filters.from_date) {
    conditions.push(`t.entry_time >= $${p++}`);
    params.push(filters.from_date);
  }
  if (filters.to_date_exclusive) {
    conditions.push(`t.entry_time < $${p++}`);
    params.push(filters.to_date_exclusive);
  }
  return { where: conditions.join(" AND "), params };
}

export async function countTickets(filters: TicketListFilters): Promise<number> {
  const { where, params } = buildTicketListWhere(filters);
  const r = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM tickets WHERE ${where}`, params);
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function listTickets(
  filters: TicketListFilters,
  limit: number,
  offset: number
): Promise<TicketRow[]> {
  const { where, params } = buildTicketListWhere(filters);
  let p = params.length + 1;
  const r = await query<TicketRow>(
    `SELECT id, entry_time, exit_time, fee::text AS fee, ticket_state, payment_status, operational_status,
            vehicle_id, garage_id, spot_id, image_url, ticket_token
     FROM tickets WHERE ${where} ORDER BY id DESC LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );
  return r.rows;
}

export async function countTicketsDashboard(filters: TicketDashboardFilters): Promise<number> {
  const { where, params } = buildDashboardWhere(filters);
  const r = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM tickets t WHERE ${where}`,
    params
  );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function listTicketsDashboard(
  filters: TicketDashboardFilters,
  limit: number,
  offset: number
): Promise<TicketRow[]> {
  const { where, params } = buildDashboardWhere(filters);
  let p = params.length + 1;
  const r = await query<TicketRow>(
    `SELECT t.id, t.entry_time, t.exit_time, t.fee::text AS fee, t.ticket_state, t.payment_status,
            t.operational_status, t.vehicle_id, t.garage_id, t.spot_id, t.ticket_token, t.image_url,
            v.licence_plate, ps.code AS spot_code, pc.name AS garage_name, vt.type AS vehicle_type,
            vt.rate::text AS vt_rate, pc.default_rate::text AS g_default_rate
     FROM tickets t
     LEFT JOIN vehicle v ON v.id = t.vehicle_id
     LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
     LEFT JOIN parking_spot ps ON ps.id = t.spot_id
     LEFT JOIN parking_config pc ON pc.id = t.garage_id
     WHERE ${where}
     ORDER BY t.id DESC LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );
  return r.rows;
}

export async function findTicketById(id: number): Promise<TicketRow | null> {
  const r = await query<TicketRow>(
    `SELECT id, entry_time, exit_time, fee::text AS fee, ticket_state, payment_status, operational_status,
            vehicle_id, garage_id, spot_id, image_url, ticket_token
     FROM tickets WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findTicketFullById(id: number): Promise<TicketRow | null> {
  const r = await query(`SELECT * FROM tickets WHERE id = $1`, [id]);
  return (r.rows[0] as TicketRow) ?? null;
}

export async function deleteTicket(id: number): Promise<boolean> {
  const r = await query(`DELETE FROM tickets WHERE id = $1 RETURNING id`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function ticketSpotOccupied(
  db: Queryable,
  spotId: number,
  excludeTicketId?: number
): Promise<boolean> {
  if (excludeTicketId != null) {
    const r = await db.query(
      `SELECT 1 FROM tickets WHERE spot_id = $1 AND ticket_state = 'OPEN' AND id <> $2 LIMIT 1`,
      [spotId, excludeTicketId]
    );
    return (r.rowCount ?? 0) > 0;
  }
  const r = await db.query(
    `SELECT 1 FROM tickets WHERE spot_id = $1 AND ticket_state = 'OPEN' LIMIT 1`,
    [spotId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function findTicketForUpdate(
  client: PoolClient,
  ticketId: number
): Promise<{ id: number; ticket_state: string; spot_id: number | null } | null> {
  const r = await client.query<{ id: number; ticket_state: string; spot_id: number | null }>(
    `SELECT id, ticket_state, spot_id FROM tickets WHERE id = $1`,
    [ticketId]
  );
  return r.rows[0] ?? null;
}

export async function findTicketGarageId(
  client: PoolClient,
  ticketId: number
): Promise<number | null> {
  const r = await client.query<{ garage_id: number }>(
    `SELECT garage_id FROM tickets WHERE id = $1`,
    [ticketId]
  );
  return r.rows[0]?.garage_id ?? null;
}

export async function findTicketForClose(
  client: PoolClient,
  ticketId: number
): Promise<{
  id: number;
  ticket_state: string;
  exit_time: Date | null;
  entry_time: Date | null;
  garage_id: number;
  vehicle_id: number | null;
} | null> {
  const r = await client.query<{
    id: number;
    ticket_state: string;
    exit_time: Date | null;
    entry_time: Date | null;
    garage_id: number;
    vehicle_id: number | null;
  }>(
    `SELECT id, ticket_state, exit_time, entry_time, garage_id, vehicle_id FROM tickets WHERE id = $1`,
    [ticketId]
  );
  return r.rows[0] ?? null;
}

export async function insertTicket(
  client: PoolClient,
  data: {
    ticket_token: string;
    vehicle_id: number;
    entry_time: Date;
    garage_id: number;
    spot_id: number;
    image_url: string | null;
  }
): Promise<number> {
  const ins = await client.query<{ id: number }>(
    `INSERT INTO tickets (
       ticket_token, vehicle_id, entry_time, ticket_state, payment_status,
       operational_status, garage_id, fee, spot_id, image_url
     ) VALUES ($1, $2, $3, 'OPEN', 'NOT_APPLICABLE', 'OK', $4, 0, $5, $6)
     RETURNING id`,
    [
      data.ticket_token,
      data.vehicle_id,
      data.entry_time,
      data.garage_id,
      data.spot_id,
      data.image_url
    ]
  );
  return ins.rows[0]!.id;
}

export async function updateTicketOperationalStatus(
  client: PoolClient,
  ticketId: number,
  status: string
): Promise<void> {
  await client.query(`UPDATE tickets SET operational_status = $1 WHERE id = $2`, [
    status,
    ticketId
  ]);
}

export async function updateTicketImageUrl(
  client: PoolClient,
  ticketId: number,
  imageUrl: string | null
): Promise<void> {
  await client.query(`UPDATE tickets SET image_url = $1 WHERE id = $2`, [imageUrl, ticketId]);
}

export async function updateTicketSpot(
  client: PoolClient,
  ticketId: number,
  spotId: number
): Promise<void> {
  await client.query(`UPDATE tickets SET spot_id = $1 WHERE id = $2`, [spotId, ticketId]);
}

export async function closeTicketWithFee(
  client: PoolClient,
  ticketId: number,
  exitTime: Date,
  fee: number
): Promise<void> {
  await client.query(
    `UPDATE tickets SET exit_time = $1, ticket_state = 'CLOSED', fee = $2 WHERE id = $3`,
    [exitTime, fee, ticketId]
  );
}

export async function closeTicketWithoutFee(
  client: PoolClient,
  ticketId: number,
  exitTime: Date
): Promise<void> {
  await client.query(
    `UPDATE tickets SET exit_time = $1, ticket_state = 'CLOSED' WHERE id = $2`,
    [exitTime, ticketId]
  );
}
