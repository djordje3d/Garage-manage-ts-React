import { Router } from "express";
import { pool, query } from "../config/db";
import { ApiError } from "../errors";
import { spotIdsWithOpenTickets, toSpotResponse, type SpotRow } from "../services/spots";

const router = Router();

function parseLimitOffset(limitRaw: unknown, offsetRaw: unknown, def = 100, max = 1000) {
  let limit = parseInt(String(limitRaw ?? def), 10);
  let offset = parseInt(String(offsetRaw ?? 0), 10);
  if (Number.isNaN(limit) || limit < 1) limit = def;
  if (limit > max) limit = max;
  if (Number.isNaN(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

function parseBool(v: unknown, defaultValue: boolean): boolean {
  if (v === undefined || v === "") return defaultValue;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset);
    const garageIdRaw = req.query.garage_id;
    const garage_id =
      garageIdRaw === undefined || garageIdRaw === ""
        ? null
        : parseInt(String(garageIdRaw), 10);
    const activeOnly = parseBool(req.query.active_only, true);
    const rentableOnly = parseBool(req.query.rentable_only, false);
    const onlyFree = parseBool(req.query.only_free, false);

    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];
    let p = 1;
    if (garage_id != null && !Number.isNaN(garage_id)) {
      conditions.push(`garage_id = $${p}`);
      params.push(garage_id);
      p += 1;
    }
    if (activeOnly) {
      conditions.push(`is_active = true`);
    }
    if (rentableOnly) {
      conditions.push(`is_rentable = true`);
    }
    if (onlyFree) {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM tickets t WHERE t.spot_id = parking_spot.id AND t.ticket_state = 'OPEN')`
      );
    }
    const where = conditions.join(" AND ");

    const countR = await query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM parking_spot WHERE ${where}`,
      params
    );
    const total = parseInt(countR.rows[0]?.c ?? "0", 10);

    const itemsR = await query<SpotRow>(
      `SELECT id, garage_id, code, is_rentable, is_active FROM parking_spot WHERE ${where} ORDER BY id DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    const ids = itemsR.rows.map((s) => s.id);
    const occupiedSet = await spotIdsWithOpenTickets(pool, ids);
    const items = await Promise.all(
      itemsR.rows.map((s) => toSpotResponse(pool, s, occupiedSet.has(s.id)))
    );

    res.json({ total, limit, offset, items });
  } catch (e) {
    next(e);
  }
});

router.patch("/:spot_id/activate", async (req, res, next) => {
  try {
    const spot_id = parseInt(req.params.spot_id, 10);
    const u = await query(
      `UPDATE parking_spot SET is_active = true WHERE id = $1
       RETURNING id, garage_id, code, is_rentable, is_active`,
      [spot_id]
    );
    if (!u.rowCount) throw new ApiError(404, "SPOT_NOT_FOUND", "Parking spot not found.");
    const row = u.rows[0] as SpotRow;
    res.json(await toSpotResponse(pool, row));
  } catch (e) {
    next(e);
  }
});

router.get("/:spot_id", async (req, res, next) => {
  try {
    const spot_id = parseInt(req.params.spot_id, 10);
    const r = await query<SpotRow>(
      `SELECT id, garage_id, code, is_rentable, is_active FROM parking_spot WHERE id = $1`,
      [spot_id]
    );
    if (!r.rowCount) throw new ApiError(404, "SPOT_NOT_FOUND", "Parking spot not found.");
    res.json(await toSpotResponse(pool, r.rows[0] as SpotRow));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const b = req.body as {
      garage_id: number;
      code: string;
      is_rentable?: boolean;
      is_active?: boolean;
    };
    const g = await query(`SELECT id FROM parking_config WHERE id = $1`, [b.garage_id]);
    if (!g.rowCount) throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
    const ins = await query<SpotRow>(
      `INSERT INTO parking_spot (garage_id, code, is_rentable, is_active)
       VALUES ($1, $2, COALESCE($3, false), COALESCE($4, true))
       RETURNING id, garage_id, code, is_rentable, is_active`,
      [b.garage_id, b.code, b.is_rentable ?? false, b.is_active ?? true]
    );
    res.status(201).json(await toSpotResponse(pool, ins.rows[0] as SpotRow));
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23505") {
      next(
        new ApiError(409, "SPOT_CODE_CONFLICT", "Spot code already exists in this garage.")
      );
      return;
    }
    next(e);
  }
});

router.patch("/:spot_id", async (req, res, next) => {
  try {
    const spot_id = parseInt(req.params.spot_id, 10);
    const b = req.body as { code?: string; is_rentable?: boolean; is_active?: boolean };
    const cur = await query<SpotRow>(
      `SELECT id, garage_id, code, is_rentable, is_active FROM parking_spot WHERE id = $1`,
      [spot_id]
    );
    if (!cur.rowCount) throw new ApiError(404, "SPOT_NOT_FOUND", "Parking spot not found.");
    const row = cur.rows[0] as SpotRow;
    const merged = {
      code: b.code !== undefined ? b.code : row.code,
      is_rentable: b.is_rentable !== undefined ? b.is_rentable : row.is_rentable,
      is_active: b.is_active !== undefined ? b.is_active : row.is_active
    };
    const u = await query<SpotRow>(
      `UPDATE parking_spot SET code = $1, is_rentable = $2, is_active = $3
       WHERE id = $4
       RETURNING id, garage_id, code, is_rentable, is_active`,
      [merged.code, merged.is_rentable, merged.is_active, spot_id]
    );
    res.json(await toSpotResponse(pool, u.rows[0] as SpotRow));
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23505") {
      next(
        new ApiError(409, "SPOT_CODE_CONFLICT", "Spot code already exists in this garage.")
      );
      return;
    }
    next(e);
  }
});

router.delete("/:spot_id", async (req, res, next) => {
  try {
    const spot_id = parseInt(req.params.spot_id, 10);
    const spot = await query(`SELECT id FROM parking_spot WHERE id = $1`, [spot_id]);
    if (!spot.rowCount) throw new ApiError(404, "SPOT_NOT_FOUND", "Parking spot not found.");
    const open = await query(
      `SELECT 1 FROM tickets WHERE spot_id = $1 AND ticket_state = 'OPEN' LIMIT 1`,
      [spot_id]
    );
    if (open.rowCount) {
      throw new ApiError(
        409,
        "SPOT_HAS_OPEN_TICKET",
        "Cannot deactivate spot because it has an OPEN ticket."
      );
    }
    await query(`UPDATE parking_spot SET is_active = false WHERE id = $1`, [spot_id]);
    res.json({ message: "Parking spot successfully deactivated", spot_id });
  } catch (e) {
    next(e);
  }
});

export default router;
