import { pool } from "../config/db";
import { ApiError } from "../errors";
import { isPgError } from "../utils/pgErrors";
import { parseLimitOffset, type PaginatedResult } from "../utils/pagination";
import { dayRangeExclusive, parseOptionalDateDay, parseOptionalInt } from "../utils/queryParams";
import * as repo from "../repositories/ticketsRepository";
import {
  batchPaymentTotalsByTicket,
  computeRestToPayForTicket
} from "./dashboardAnalytics";

export type Ticket = Record<string, unknown>;

function mapTicketFee(row: Ticket): Ticket {
  return {
    ...row,
    fee: row.fee != null ? parseFloat(String(row.fee)) : null
  };
}

export async function listDashboard(query: {
  limit?: unknown;
  offset?: unknown;
  garage_id?: unknown;
  ticket_state?: unknown;
  from_date?: unknown;
  to_date?: unknown;
}): Promise<PaginatedResult<Ticket>> {
  const { limit, offset } = parseLimitOffset(query.limit, query.offset, 1000, 5000);
  const toDate = parseOptionalDateDay(query.to_date);
  const filters: repo.TicketDashboardFilters = {
    garage_id: parseOptionalInt(query.garage_id),
    ticket_state: query.ticket_state ? String(query.ticket_state) : null,
    from_date: parseOptionalDateDay(query.from_date),
    to_date_exclusive: toDate ? dayRangeExclusive(toDate) : null
  };

  const [total, rows] = await Promise.all([
    repo.countTicketsDashboard(filters),
    repo.listTicketsDashboard(filters, limit, offset)
  ]);

  const paymentMap = await batchPaymentTotalsByTicket(
    pool,
    rows.map((r) => Number(r.id))
  );

  const items = rows.map((r) => {
    const paid = paymentMap.get(Number(r.id)) ?? 0;
    const rest = computeRestToPayForTicket({
      ticket_state: String(r.ticket_state),
      payment_status: String(r.payment_status),
      entry_time: (r.entry_time as Date | null) ?? null,
      exit_time: (r.exit_time as Date | null) ?? null,
      fee: (r.fee as string | null) ?? null,
      vt_rate: (r.vt_rate as string | null) ?? null,
      g_default_rate: (r.g_default_rate as string | null) ?? null,
      paid
    });
    return {
      id: r.id,
      entry_time: r.entry_time,
      exit_time: r.exit_time,
      fee: r.fee != null ? parseFloat(String(r.fee)) : null,
      ticket_state: r.ticket_state,
      payment_status: r.payment_status,
      operational_status: r.operational_status,
      vehicle_id: r.vehicle_id,
      garage_id: r.garage_id,
      spot_id: r.spot_id,
      ticket_token: r.ticket_token,
      licence_plate: r.licence_plate,
      spot_code: r.spot_code,
      garage_name: r.garage_name,
      vehicle_type: r.vehicle_type,
      image_url: r.image_url ?? null,
      rest_to_pay: rest
    };
  });

  return { total, limit, offset, items };
}

export async function list(query: {
  limit?: unknown;
  offset?: unknown;
  state?: unknown;
  payment_status?: unknown;
  garage_id?: unknown;
}): Promise<PaginatedResult<Ticket>> {
  const { limit, offset } = parseLimitOffset(query.limit, query.offset);
  const filters: repo.TicketListFilters = {
    state: query.state ? String(query.state) : null,
    payment_status: query.payment_status ? String(query.payment_status) : null,
    garage_id: parseOptionalInt(query.garage_id)
  };

  const [total, rows] = await Promise.all([
    repo.countTickets(filters),
    repo.listTickets(filters, limit, offset)
  ]);

  return {
    total,
    limit,
    offset,
    items: rows.map(mapTicketFee)
  };
}

export async function getById(id: number): Promise<Ticket> {
  const row = await repo.findTicketById(id);
  if (!row) throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
  return mapTicketFee(row);
}

export async function getFullById(id: number): Promise<Ticket> {
  const row = await repo.findTicketFullById(id);
  if (!row) throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
  return row;
}

export async function remove(id: number): Promise<{ deleted: true }> {
  try {
    const ok = await repo.deleteTicket(id);
    if (!ok) throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
    return { deleted: true };
  } catch (e) {
    if (isPgError(e, "23503")) {
      throw new ApiError(
        409,
        "TICKET_DELETE_CONFLICT",
        "Cannot delete ticket because it has payments."
      );
    }
    throw e;
  }
}
