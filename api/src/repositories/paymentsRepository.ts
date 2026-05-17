import type { PoolClient } from "pg";
import { query } from "../config/db";

export type PaymentRow = {
  id: number;
  ticket_id: number;
  amount: string;
  method: string;
  currency: string;
  paid_at: Date;
};

export type PaymentListFilters = {
  garage_id: number | null;
  from: Date | null;
  to_exclusive: Date | null;
};

function buildPaymentListWhere(filters: PaymentListFilters): {
  join: string;
  where: string;
  params: unknown[];
} {
  const cond: string[] = ["1=1"];
  const params: unknown[] = [];
  let p = 1;
  let join = "";
  if (filters.garage_id != null) {
    join = "JOIN tickets t ON t.id = p.ticket_id";
    cond.push(`t.garage_id = $${p++}`);
    params.push(filters.garage_id);
  }
  if (filters.from) {
    cond.push(`p.paid_at >= $${p++}`);
    params.push(filters.from);
  }
  if (filters.to_exclusive) {
    cond.push(`p.paid_at < $${p++}`);
    params.push(filters.to_exclusive);
  }
  return { join, where: cond.join(" AND "), params };
}

export async function countPayments(filters: PaymentListFilters): Promise<number> {
  const { join, where, params } = buildPaymentListWhere(filters);
  const r = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM payments p ${join} WHERE ${where}`,
    params
  );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function listPayments(
  filters: PaymentListFilters,
  limit: number,
  offset: number
): Promise<PaymentRow[]> {
  const { join, where, params } = buildPaymentListWhere(filters);
  let p = params.length + 1;
  const r = await query<PaymentRow>(
    `SELECT p.id, p.ticket_id, p.amount::text AS amount, p.method, p.currency, p.paid_at
     FROM payments p ${join}
     WHERE ${where}
     ORDER BY p.paid_at DESC LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );
  return r.rows;
}

export async function countPaymentsByTicket(ticketId: number): Promise<number> {
  const r = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM payments WHERE ticket_id = $1`,
    [ticketId]
  );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function listPaymentsByTicket(
  ticketId: number,
  limit: number,
  offset: number
): Promise<PaymentRow[]> {
  const r = await query<PaymentRow>(
    `SELECT id, ticket_id, amount::text AS amount, method, currency, paid_at
     FROM payments WHERE ticket_id = $1 ORDER BY id LIMIT $2 OFFSET $3`,
    [ticketId, limit, offset]
  );
  return r.rows;
}

export async function findPaymentById(id: number): Promise<PaymentRow | null> {
  const r = await query<PaymentRow>(
    `SELECT id, ticket_id, amount::text AS amount, method, currency, paid_at FROM payments WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findPaymentTicketId(
  client: PoolClient,
  paymentId: number
): Promise<number | null> {
  const r = await client.query<{ ticket_id: number }>(
    `SELECT ticket_id FROM payments WHERE id = $1`,
    [paymentId]
  );
  return r.rows[0]?.ticket_id ?? null;
}

export async function findTicketForPayment(
  client: PoolClient,
  ticketId: number
): Promise<{ ticket_state: string; fee: string | null } | null> {
  const r = await client.query<{ ticket_state: string; fee: string | null }>(
    `SELECT ticket_state, fee::text AS fee FROM tickets WHERE id = $1`,
    [ticketId]
  );
  return r.rows[0] ?? null;
}

export async function sumPaymentsForTicket(
  client: PoolClient,
  ticketId: number
): Promise<number> {
  const r = await client.query<{ s: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS s FROM payments WHERE ticket_id = $1`,
    [ticketId]
  );
  return parseFloat(r.rows[0]?.s ?? "0");
}

export async function insertPayment(
  client: PoolClient,
  data: {
    ticket_id: number;
    amount: number;
    method: string;
    currency: string;
    paid_at: string | null;
  }
): Promise<PaymentRow> {
  const r = await client.query<PaymentRow>(
    `INSERT INTO payments (ticket_id, amount, method, currency, paid_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))
     RETURNING id, ticket_id, amount::text AS amount, method, currency, paid_at`,
    [data.ticket_id, data.amount, data.method, data.currency, data.paid_at]
  );
  return r.rows[0]!;
}

export async function updatePayment(
  client: PoolClient,
  id: number,
  data: {
    amount: number;
    method: string;
    currency: string;
    paid_at: string | null;
  }
): Promise<PaymentRow | null> {
  const r = await client.query<PaymentRow>(
    `UPDATE payments
     SET amount = $1, method = $2, currency = COALESCE($3, 'RSD'), paid_at = COALESCE($4::timestamptz, NOW())
     WHERE id = $5
     RETURNING id, ticket_id, amount::text AS amount, method, currency, paid_at`,
    [data.amount, data.method, data.currency, data.paid_at, id]
  );
  return r.rows[0] ?? null;
}

export async function deletePayment(client: PoolClient, id: number): Promise<boolean> {
  const r = await client.query(`DELETE FROM payments WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function getTicketFeeAndPaid(
  client: Pick<PoolClient, "query">,
  ticketId: number
): Promise<{ fee: number; totalPaid: number } | null> {
  const t = await client.query<{ fee: string | null }>(
    `SELECT fee::text AS fee FROM tickets WHERE id = $1`,
    [ticketId]
  );
  const ticket = t.rows[0];
  if (!ticket) return null;

  const paidR = await client.query<{ sum: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS sum FROM payments WHERE ticket_id = $1`,
    [ticketId]
  );
  const totalPaid = parseFloat(paidR.rows[0]?.sum ?? "0");
  const fee = ticket.fee != null ? parseFloat(ticket.fee) : 0;
  return { fee, totalPaid };
}

export async function updateTicketPaymentStatus(
  client: Pick<PoolClient, "query">,
  ticketId: number,
  paymentStatus: string
): Promise<void> {
  await client.query(`UPDATE tickets SET payment_status = $1 WHERE id = $2`, [
    paymentStatus,
    ticketId
  ]);
}
