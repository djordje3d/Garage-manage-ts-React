import { pool, withTransaction } from "../config/db";
import { env } from "../config/env";
import { ApiError } from "../errors";
import { isPgError } from "../utils/pgErrors";
import { parseLimitOffset, type PaginatedResult } from "../utils/pagination";
import { dayRangeExclusive, parseOptionalDateDay, parseOptionalInt } from "../utils/queryParams";
import * as repo from "../repositories/paymentsRepository";
import { computeTotalOutstanding } from "./dashboardAnalytics";
import { recalcTicketPaymentStatus } from "./payments";

export type Payment = {
  id: number;
  ticket_id: number;
  amount: number;
  method: string;
  currency: string;
  paid_at: Date;
};

function mapPayment(r: repo.PaymentRow): Payment {
  return { ...r, amount: parseFloat(r.amount) };
}

export async function list(query: {
  limit?: unknown;
  offset?: unknown;
  garage_id?: unknown;
  from?: unknown;
  to?: unknown;
}): Promise<PaginatedResult<Payment>> {
  const { limit, offset } = parseLimitOffset(query.limit, query.offset);
  const to = parseOptionalDateDay(query.to);
  const filters: repo.PaymentListFilters = {
    garage_id: parseOptionalInt(query.garage_id),
    from: parseOptionalDateDay(query.from),
    to_exclusive: to ? dayRangeExclusive(to) : null
  };

  const [total, rows] = await Promise.all([
    repo.countPayments(filters),
    repo.listPayments(filters, limit, offset)
  ]);

  return { total, limit, offset, items: rows.map(mapPayment) };
}

export async function listByTicket(
  ticketId: number,
  query: { limit?: unknown; offset?: unknown }
): Promise<PaginatedResult<Payment>> {
  const { limit, offset } = parseLimitOffset(query.limit, query.offset);
  const [total, rows] = await Promise.all([
    repo.countPaymentsByTicket(ticketId),
    repo.listPaymentsByTicket(ticketId, limit, offset)
  ]);
  return { total, limit, offset, items: rows.map(mapPayment) };
}

export async function getById(id: number): Promise<Payment> {
  const row = await repo.findPaymentById(id);
  if (!row) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
  return mapPayment(row);
}

export async function getOutstanding(query: { garage_id?: unknown }) {
  const garageId = parseOptionalInt(query.garage_id);
  const total_outstanding = await computeTotalOutstanding(pool, garageId);
  return { total_outstanding };
}

export async function create(body: {
  ticket_id: number;
  amount: number;
  method: string;
  currency?: string;
  paid_at?: string;
}): Promise<Payment> {
  const created = await withTransaction(async (client) => {
    const t = await repo.findTicketForPayment(client, body.ticket_id);
    if (!t) throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
    if (t.ticket_state !== "CLOSED") {
      throw new ApiError(
        409,
        "PAYMENT_NOT_ALLOWED_FOR_OPEN_TICKET",
        "Payment is allowed only for closed tickets."
      );
    }
    if (t.fee != null && parseFloat(t.fee) > 0) {
      const paid = await repo.sumPaymentsForTicket(client, body.ticket_id);
      const fee = parseFloat(t.fee);
      if (paid + body.amount > fee) {
        throw new ApiError(409, "OVERPAYMENT_NOT_ALLOWED", "Payment amount exceeds the remaining balance.", {
          ticket_id: body.ticket_id,
          remaining_balance: fee - paid,
          attempted_amount: body.amount
        });
      }
    }
    const row = await repo.insertPayment(client, {
      ticket_id: body.ticket_id,
      amount: body.amount,
      method: body.method,
      currency: body.currency ?? "RSD",
      paid_at: body.paid_at ?? null
    });
    if (env.useApiPaymentStatus) await recalcTicketPaymentStatus(client, body.ticket_id);
    return row;
  });
  return mapPayment(created);
}

export async function update(
  id: number,
  body: { amount: number; method: string; currency?: string; paid_at?: string }
): Promise<Payment> {
  const updated = await withTransaction(async (client) => {
    const ticketId = await repo.findPaymentTicketId(client, id);
    if (ticketId == null) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
    const row = await repo.updatePayment(client, id, {
      amount: body.amount,
      method: body.method,
      currency: body.currency ?? "RSD",
      paid_at: body.paid_at ?? null
    });
    if (!row) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
    if (env.useApiPaymentStatus) await recalcTicketPaymentStatus(client, ticketId);
    return row;
  });
  return mapPayment(updated);
}

export async function remove(id: number): Promise<{ deleted: true }> {
  try {
    await withTransaction(async (client) => {
      const ticketId = await repo.findPaymentTicketId(client, id);
      if (ticketId == null) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
      await repo.deletePayment(client, id);
      if (env.useApiPaymentStatus) await recalcTicketPaymentStatus(client, ticketId);
    });
    return { deleted: true };
  } catch (e) {
    if (isPgError(e, "23503")) {
      throw new ApiError(409, "PAYMENT_DELETE_CONFLICT", "Cannot delete payment.");
    }
    throw e;
  }
}
