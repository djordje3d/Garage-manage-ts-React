import { Router } from "express";
import { withTransaction, query, pool } from "../config/db";
import { ApiError } from "../errors";
import {
  InvalidSpotError,
  InvalidVehicleError,
  NoFreeSpotError,
  SpotGarageMismatchError,
  SpotInactiveError,
  SpotOccupiedError,
  TicketNotFoundError,
  TicketPersistenceError,
  TicketStateError,
  TicketTokenRetryExceededError,
  applyTicketUpdate,
  closeTicket,
  createTicketEntry
} from "../services/tickets";
import {
  batchPaymentTotalsByTicket,
  computeRestToPayForTicket
} from "../services/dashboardAnalytics";

const router = Router();

function parseLimitOffset(limitRaw: unknown, offsetRaw: unknown, def = 100, max = 1000) {
  let limit = parseInt(String(limitRaw ?? def), 10);
  let offset = parseInt(String(offsetRaw ?? 0), 10);
  if (Number.isNaN(limit) || limit < 1) limit = def;
  if (limit > max) limit = max;
  if (Number.isNaN(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

router.get("/dashboard", async (req, res, next) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset, 1000, 5000);
    const garageId = req.query.garage_id ? parseInt(String(req.query.garage_id), 10) : null;
    const ticketState = req.query.ticket_state ? String(req.query.ticket_state) : null;
    const fromDate = req.query.from_date ? new Date(`${req.query.from_date}T00:00:00.000Z`) : null;
    const toDate = req.query.to_date ? new Date(`${req.query.to_date}T00:00:00.000Z`) : null;
    const toDateExclusive = toDate ? new Date(toDate.getTime() + 86400000) : null;

    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];
    let p = 1;
    if (garageId != null && !Number.isNaN(garageId)) {
      conditions.push(`t.garage_id = $${p++}`);
      params.push(garageId);
    }
    if (ticketState) {
      conditions.push(`t.ticket_state = $${p++}`);
      params.push(ticketState);
    }
    if (fromDate) {
      conditions.push(`t.entry_time >= $${p++}`);
      params.push(fromDate);
    }
    if (toDateExclusive) {
      conditions.push(`t.entry_time < $${p++}`);
      params.push(toDateExclusive);
    }
    const where = conditions.join(" AND ");
    const totalR = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM tickets t WHERE ${where}`, params);
    const total = parseInt(totalR.rows[0]?.c ?? "0", 10);

    const itemsR = await query<Record<string, unknown>>(
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
    const paymentMap = await batchPaymentTotalsByTicket(pool, itemsR.rows.map((r) => Number(r.id)));
    const items = itemsR.rows.map((r) => {
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
    res.json({ total, limit, offset, items });
  } catch (e) {
    next(e);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset, 100, 1000);
    const state = req.query.state ? String(req.query.state) : null;
    const paymentStatus = req.query.payment_status ? String(req.query.payment_status) : null;
    const garageId = req.query.garage_id ? parseInt(String(req.query.garage_id), 10) : null;
    const cond: string[] = ["1=1"];
    const params: unknown[] = [];
    let p = 1;
    if (state) { cond.push(`ticket_state = $${p++}`); params.push(state); }
    if (paymentStatus) { cond.push(`payment_status = $${p++}`); params.push(paymentStatus); }
    if (garageId != null && !Number.isNaN(garageId)) { cond.push(`garage_id = $${p++}`); params.push(garageId); }
    const where = cond.join(" AND ");
    const totalR = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM tickets WHERE ${where}`, params);
    const total = parseInt(totalR.rows[0]?.c ?? "0", 10);
    const itemsR = await query(
      `SELECT id, entry_time, exit_time, fee::text AS fee, ticket_state, payment_status, operational_status,
              vehicle_id, garage_id, spot_id, image_url, ticket_token
       FROM tickets WHERE ${where} ORDER BY id DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );
    res.json({
      total,
      limit,
      offset,
      items: itemsR.rows.map((r) => ({ ...r, fee: r.fee != null ? parseFloat(String(r.fee)) : null }))
    });
  } catch (e) {
    next(e);
  }
});

router.get("/:ticket_id", async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const r = await query(
      `SELECT id, entry_time, exit_time, fee::text AS fee, ticket_state, payment_status, operational_status,
              vehicle_id, garage_id, spot_id, image_url, ticket_token
       FROM tickets WHERE id = $1`,
      [ticketId]
    );
    if (!r.rowCount) throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
    res.json({ ...r.rows[0], fee: r.rows[0].fee != null ? parseFloat(String(r.rows[0].fee)) : null });
  } catch (e) {
    next(e);
  }
});

router.put("/:ticket_id", async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);
    await withTransaction(async (client) => {
      await applyTicketUpdate(client, ticketId, req.body ?? {});
    });
    const r = await query(`SELECT * FROM tickets WHERE id = $1`, [ticketId]);
    if (!r.rowCount) throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
    res.json(r.rows[0]);
  } catch (e) {
    if (e instanceof TicketNotFoundError) return next(new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found."));
    if (e instanceof InvalidSpotError) return next(new ApiError(400, "INVALID_SPOT_UPDATE", e.message));
    if (e instanceof SpotGarageMismatchError) return next(new ApiError(409, "SPOT_GARAGE_MISMATCH", "Selected parking spot does not belong to this ticket's garage."));
    if (e instanceof SpotInactiveError) return next(new ApiError(409, "SPOT_INACTIVE", "Selected parking spot is inactive."));
    if (e instanceof SpotOccupiedError) return next(new ApiError(409, "SPOT_OCCUPIED", "The selected parking spot is already occupied."));
    if (e instanceof TicketStateError) return next(new ApiError(409, "TICKET_NOT_OPEN", e.message));
    next(e);
  }
});

router.delete("/:ticket_id", async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const del = await query(`DELETE FROM tickets WHERE id = $1 RETURNING id`, [ticketId]);
    if (!del.rowCount) throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
    res.json({ deleted: true });
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23503") return next(new ApiError(409, "TICKET_DELETE_CONFLICT", "Cannot delete ticket because it has payments."));
    next(e);
  }
});

router.post("/entry", async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>;
    const ticketId = await withTransaction(async (client) =>
      createTicketEntry(client, {
        vehicle_id: Number(b.vehicle_id),
        entry_time: b.entry_time ? new Date(String(b.entry_time)) : null,
        garage_id: Number(b.garage_id),
        spot_id: b.spot_id != null ? Number(b.spot_id) : null,
        rentable_only: Boolean(b.rentable_only ?? false),
        image_url: b.image_url != null ? String(b.image_url) : null
      })
    );
    const r = await query(`SELECT * FROM tickets WHERE id = $1`, [ticketId]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e instanceof InvalidVehicleError) return next(new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle does not exist."));
    if (e instanceof InvalidSpotError) return next(new ApiError(404, "SPOT_NOT_FOUND", "Parking spot does not exist."));
    if (e instanceof SpotGarageMismatchError) return next(new ApiError(409, "SPOT_GARAGE_MISMATCH", "Selected parking spot does not belong to selected garage."));
    if (e instanceof SpotInactiveError) return next(new ApiError(409, "SPOT_INACTIVE", "Selected parking spot is inactive."));
    if (e instanceof SpotOccupiedError) return next(new ApiError(409, "SPOT_OCCUPIED", "The selected parking spot is already occupied."));
    if (e instanceof NoFreeSpotError) return next(new ApiError(409, "NO_FREE_SPOTS_AVAILABLE", "No free spots available for this garage."));
    if (e instanceof TicketPersistenceError || e instanceof TicketTokenRetryExceededError) {
      return next(new ApiError(500, "DATABASE_ERROR", "Ticket could not be saved.", { reason: e.constructor.name }));
    }
    next(e);
  }
});

router.post("/:ticket_id/exit", async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const b = req.body as { exit_time?: string };
    await withTransaction(async (client) => {
      await closeTicket(client, ticketId, { exit_time: b.exit_time ? new Date(b.exit_time) : null });
    });
    const r = await query(`SELECT * FROM tickets WHERE id = $1`, [ticketId]);
    res.json(r.rows[0]);
  } catch (e) {
    if (e instanceof TicketNotFoundError) return next(new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found."));
    if (e instanceof TicketStateError) return next(new ApiError(409, "TICKET_ALREADY_CLOSED", "Ticket is not open."));
    next(e);
  }
});

export default router;
