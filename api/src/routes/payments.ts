import { Router } from "express";
import { query, withTransaction, pool } from "../config/db";
import { env } from "../config/env";
import { ApiError } from "../errors";
import { recalcTicketPaymentStatus } from "../services/payments";
import { computeTotalOutstanding } from "../services/dashboardAnalytics";

const router = Router();

function parseLimitOffset(limitRaw: unknown, offsetRaw: unknown, def = 100, max = 1000) {
  let limit = parseInt(String(limitRaw ?? def), 10);
  let offset = parseInt(String(offsetRaw ?? 0), 10);
  if (Number.isNaN(limit) || limit < 1) limit = def;
  if (limit > max) limit = max;
  if (Number.isNaN(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset);
    const garageId = req.query.garage_id ? parseInt(String(req.query.garage_id), 10) : null;
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T00:00:00.000Z`) : null;
    const toExclusive = to ? new Date(to.getTime() + 86400000) : null;
    const cond: string[] = ["1=1"];
    const params: unknown[] = [];
    let p = 1;
    let join = "";
    if (garageId != null && !Number.isNaN(garageId)) {
      join = "JOIN tickets t ON t.id = p.ticket_id";
      cond.push(`t.garage_id = $${p++}`);
      params.push(garageId);
    }
    if (from) {
      cond.push(`p.paid_at >= $${p++}`);
      params.push(from);
    }
    if (toExclusive) {
      cond.push(`p.paid_at < $${p++}`);
      params.push(toExclusive);
    }
    const where = cond.join(" AND ");
    const totalR = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM payments p ${join} WHERE ${where}`, params);
    const total = parseInt(totalR.rows[0]?.c ?? "0", 10);
    const itemsR = await query(
      `SELECT p.id, p.ticket_id, p.amount::text AS amount, p.method, p.currency, p.paid_at
       FROM payments p ${join}
       WHERE ${where}
       ORDER BY p.paid_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );
    res.json({
      total,
      limit,
      offset,
      items: itemsR.rows.map((r) => ({ ...r, amount: parseFloat(String(r.amount)) }))
    });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const b = req.body as { ticket_id: number; amount: number; method: string; currency?: string; paid_at?: string };
    const created = await withTransaction(async (client) => {
      const ticketR = await client.query<{ ticket_state: string; fee: string | null }>(
        `SELECT ticket_state, fee::text AS fee FROM tickets WHERE id = $1`,
        [b.ticket_id]
      );
      const t = ticketR.rows[0];
      if (!t) throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
      if (t.ticket_state !== "CLOSED") {
        throw new ApiError(409, "PAYMENT_NOT_ALLOWED_FOR_OPEN_TICKET", "Payment is allowed only for closed tickets.");
      }
      if (t.fee != null && parseFloat(t.fee) > 0) {
        const paidR = await client.query<{ s: string }>(
          `SELECT COALESCE(SUM(amount), 0)::text AS s FROM payments WHERE ticket_id = $1`,
          [b.ticket_id]
        );
        const paid = parseFloat(paidR.rows[0]?.s ?? "0");
        const fee = parseFloat(t.fee);
        if (paid + b.amount > fee) {
          throw new ApiError(409, "OVERPAYMENT_NOT_ALLOWED", "Payment amount exceeds the remaining balance.", {
            ticket_id: b.ticket_id,
            remaining_balance: fee - paid,
            attempted_amount: b.amount
          });
        }
      }
      const ins = await client.query(
        `INSERT INTO payments (ticket_id, amount, method, currency, paid_at)
         VALUES ($1, $2, $3, COALESCE($4, 'RSD'), COALESCE($5::timestamptz, NOW()))
         RETURNING id, ticket_id, amount::text AS amount, method, currency, paid_at`,
        [b.ticket_id, b.amount, b.method, b.currency ?? "RSD", b.paid_at ?? null]
      );
      if (env.useApiPaymentStatus) await recalcTicketPaymentStatus(client, b.ticket_id);
      return ins.rows[0];
    });
    res.status(201).json({ ...created, amount: parseFloat(String(created.amount)) });
  } catch (e) {
    next(e);
  }
});

router.get("/outstanding", async (req, res, next) => {
  try {
    const garageId = req.query.garage_id ? parseInt(String(req.query.garage_id), 10) : null;
    const total_outstanding = await computeTotalOutstanding(pool, Number.isNaN(garageId as number) ? null : garageId);
    res.json({ total_outstanding });
  } catch (e) {
    next(e);
  }
});

router.get("/by-ticket/:ticket_id", async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset);
    const totalR = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM payments WHERE ticket_id = $1`, [ticketId]);
    const total = parseInt(totalR.rows[0]?.c ?? "0", 10);
    const itemsR = await query(
      `SELECT id, ticket_id, amount::text AS amount, method, currency, paid_at
       FROM payments WHERE ticket_id = $1 ORDER BY id LIMIT $2 OFFSET $3`,
      [ticketId, limit, offset]
    );
    res.json({ total, limit, offset, items: itemsR.rows.map((r) => ({ ...r, amount: parseFloat(String(r.amount)) })) });
  } catch (e) {
    next(e);
  }
});

router.get("/:payment_id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.payment_id, 10);
    const r = await query(`SELECT id, ticket_id, amount::text AS amount, method, currency, paid_at FROM payments WHERE id = $1`, [id]);
    if (!r.rowCount) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
    res.json({ ...r.rows[0], amount: parseFloat(String(r.rows[0].amount)) });
  } catch (e) {
    next(e);
  }
});

router.put("/:payment_id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.payment_id, 10);
    const b = req.body as { amount: number; method: string; currency?: string; paid_at?: string };
    const updated = await withTransaction(async (client) => {
      const cur = await client.query<{ ticket_id: number }>(`SELECT ticket_id FROM payments WHERE id = $1`, [id]);
      if (!cur.rowCount) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
      const ticketId = cur.rows[0].ticket_id;
      const up = await client.query(
        `UPDATE payments
         SET amount = $1, method = $2, currency = COALESCE($3, 'RSD'), paid_at = COALESCE($4::timestamptz, NOW())
         WHERE id = $5
         RETURNING id, ticket_id, amount::text AS amount, method, currency, paid_at`,
        [b.amount, b.method, b.currency ?? "RSD", b.paid_at ?? null, id]
      );
      if (env.useApiPaymentStatus) await recalcTicketPaymentStatus(client, ticketId);
      return up.rows[0];
    });
    res.json({ ...updated, amount: parseFloat(String(updated.amount)) });
  } catch (e) {
    next(e);
  }
});

router.delete("/:payment_id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.payment_id, 10);
    await withTransaction(async (client) => {
      const cur = await client.query<{ ticket_id: number }>(`SELECT ticket_id FROM payments WHERE id = $1`, [id]);
      if (!cur.rowCount) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
      const ticketId = cur.rows[0].ticket_id;
      await client.query(`DELETE FROM payments WHERE id = $1`, [id]);
      if (env.useApiPaymentStatus) await recalcTicketPaymentStatus(client, ticketId);
    });
    res.json({ deleted: true });
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23503") return next(new ApiError(409, "PAYMENT_DELETE_CONFLICT", "Cannot delete payment."));
    next(e);
  }
});

export default router;
