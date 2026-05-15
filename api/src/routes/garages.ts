import { Router } from "express";
import { query } from "../config/db";
import { ApiError } from "../errors";

const router = Router();

function parseLimitOffset(
  limitRaw: unknown,
  offsetRaw: unknown,
  defLimit: number,
  maxLimit: number
): { limit: number; offset: number } {
  let limit = parseInt(String(limitRaw ?? defLimit), 10);
  let offset = parseInt(String(offsetRaw ?? 0), 10);
  if (Number.isNaN(limit) || limit < 1) limit = defLimit;
  if (limit > maxLimit) limit = maxLimit;
  if (Number.isNaN(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

function mapGarageRow(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    name: r.name as string,
    capacity: Number(r.capacity),
    default_rate: parseFloat(String(r.default_rate)),
    lost_ticket_fee: r.lost_ticket_fee != null ? parseFloat(String(r.lost_ticket_fee)) : null,
    night_rate: r.night_rate != null ? parseFloat(String(r.night_rate)) : null,
    day_rate: r.day_rate != null ? parseFloat(String(r.day_rate)) : null,
    open_time: r.open_time != null ? String(r.open_time).slice(0, 8) : null,
    close_time: r.close_time != null ? String(r.close_time).slice(0, 8) : null,
    allow_subscription: r.allow_subscription as boolean | null,
    created_at: r.created_at
  };
}

router.get("/overview", async (req, res, next) => {
  try {
    const garageIdRaw = req.query.garage_id;
    const garage_id =
      garageIdRaw === undefined || garageIdRaw === "" || garageIdRaw == null
        ? null
        : parseInt(String(garageIdRaw), 10);

    const sql = `
      SELECT
          pc.id AS garage_id,
          pc.name,
          COUNT(p.id)::int AS total_spots,
          COUNT(p.id) FILTER (WHERE p.is_active AND NOT EXISTS (
              SELECT 1 FROM tickets t
              WHERE t.spot_id = p.id AND t.ticket_state = 'OPEN'
          ))::int AS free_spots,
          COUNT(p.id) FILTER (WHERE p.is_active AND EXISTS (
              SELECT 1 FROM tickets t
              WHERE t.spot_id = p.id AND t.ticket_state = 'OPEN'
          ))::int AS occupied_spots,
          COUNT(p.id) FILTER (WHERE p.is_active AND p.is_rentable)::int AS rentable_spots
      FROM parking_config pc
      LEFT JOIN parking_spot p ON p.garage_id = pc.id
      WHERE ($1::int IS NULL OR pc.id = $1)
      GROUP BY pc.id, pc.name
      ORDER BY pc.id
    `;
    const r = await query(sql, [Number.isNaN(garage_id as number) ? null : garage_id]);
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset, 100, 1000);
    const totalR = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM parking_config`);
    const total = parseInt(totalR.rows[0]?.c ?? "0", 10);
    const itemsR = await query(
      `SELECT id, name, capacity, default_rate::text, lost_ticket_fee::text, night_rate::text,
              day_rate::text, open_time, close_time, allow_subscription, created_at
       FROM parking_config ORDER BY id LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({
      total,
      limit,
      offset,
      items: itemsR.rows.map(mapGarageRow)
    });
  } catch (e) {
    next(e);
  }
});

router.get("/:garage_id", async (req, res, next) => {
  try {
    const garage_id = parseInt(req.params.garage_id, 10);
    const r = await query(
      `SELECT id, name, capacity, default_rate::text, lost_ticket_fee::text, night_rate::text,
              day_rate::text, open_time, close_time, allow_subscription, created_at
       FROM parking_config WHERE id = $1`,
      [garage_id]
    );
    if (!r.rowCount) throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
    res.json(mapGarageRow(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>;
    const r = await query(
      `INSERT INTO parking_config (
         name, capacity, default_rate, lost_ticket_fee, night_rate, day_rate,
         open_time, close_time, allow_subscription, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW()))
       RETURNING id, name, capacity, default_rate::text, lost_ticket_fee::text, night_rate::text,
                 day_rate::text, open_time, close_time, allow_subscription, created_at`,
      [
        b.name,
        b.capacity,
        b.default_rate,
        b.lost_ticket_fee ?? null,
        b.night_rate ?? null,
        b.day_rate ?? null,
        b.open_time ?? null,
        b.close_time ?? null,
        b.allow_subscription ?? true,
        b.created_at ?? null
      ]
    );
    res.status(201).json(mapGarageRow(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.put("/:garage_id", async (req, res, next) => {
  try {
    const garage_id = parseInt(req.params.garage_id, 10);
    const b = req.body as Record<string, unknown>;
    const r = await query(
      `UPDATE parking_config SET
         name = $1, capacity = $2, default_rate = $3, lost_ticket_fee = $4,
         night_rate = $5, day_rate = $6, open_time = $7, close_time = $8, allow_subscription = $9
       WHERE id = $10
       RETURNING id, name, capacity, default_rate::text, lost_ticket_fee::text, night_rate::text,
                 day_rate::text, open_time, close_time, allow_subscription, created_at`,
      [
        b.name,
        b.capacity,
        b.default_rate,
        b.lost_ticket_fee ?? null,
        b.night_rate ?? null,
        b.day_rate ?? null,
        b.open_time ?? null,
        b.close_time ?? null,
        b.allow_subscription ?? null,
        garage_id
      ]
    );
    if (!r.rowCount) throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
    res.json(mapGarageRow(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.patch("/:garage_id", async (req, res, next) => {
  try {
    const garage_id = parseInt(req.params.garage_id, 10);
    const b = req.body as Record<string, unknown>;
    const existing = await query(`SELECT * FROM parking_config WHERE id = $1`, [garage_id]);
    if (!existing.rowCount) throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
    const cur = existing.rows[0] as Record<string, unknown>;
    const merged = {
      name: b.name !== undefined ? b.name : cur.name,
      capacity: b.capacity !== undefined ? b.capacity : cur.capacity,
      default_rate: b.default_rate !== undefined ? b.default_rate : cur.default_rate,
      lost_ticket_fee: b.lost_ticket_fee !== undefined ? b.lost_ticket_fee : cur.lost_ticket_fee,
      night_rate: b.night_rate !== undefined ? b.night_rate : cur.night_rate,
      day_rate: b.day_rate !== undefined ? b.day_rate : cur.day_rate,
      open_time: b.open_time !== undefined ? b.open_time : cur.open_time,
      close_time: b.close_time !== undefined ? b.close_time : cur.close_time,
      allow_subscription:
        b.allow_subscription !== undefined ? b.allow_subscription : cur.allow_subscription
    };
    const r = await query(
      `UPDATE parking_config SET
         name = $1, capacity = $2, default_rate = $3, lost_ticket_fee = $4,
         night_rate = $5, day_rate = $6, open_time = $7, close_time = $8, allow_subscription = $9
       WHERE id = $10
       RETURNING id, name, capacity, default_rate::text, lost_ticket_fee::text, night_rate::text,
                 day_rate::text, open_time, close_time, allow_subscription, created_at`,
      [
        merged.name,
        merged.capacity,
        merged.default_rate,
        merged.lost_ticket_fee,
        merged.night_rate,
        merged.day_rate,
        merged.open_time,
        merged.close_time,
        merged.allow_subscription,
        garage_id
      ]
    );
    res.json(mapGarageRow(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.delete("/:garage_id", async (req, res, next) => {
  try {
    const garage_id = parseInt(req.params.garage_id, 10);
    const del = await query(`DELETE FROM parking_config WHERE id = $1 RETURNING id`, [garage_id]);
    if (!del.rowCount) throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
    res.json({ deleted: true });
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23503") {
      next(
        new ApiError(
          409,
          "GARAGE_DELETE_CONFLICT",
          "Cannot delete garage because it has parking spots or tickets."
        )
      );
      return;
    }
    next(e);
  }
});

export default router;
