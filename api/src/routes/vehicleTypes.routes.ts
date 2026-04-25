import { Router } from "express";
import { query } from "../config/db";
import { ApiError } from "../errors";

const router = Router();

function parseLimitOffset(limitRaw: unknown, offsetRaw: unknown) {
  let limit = parseInt(String(limitRaw ?? 100), 10);
  let offset = parseInt(String(offsetRaw ?? 0), 10);
  if (Number.isNaN(limit) || limit < 1) limit = 100;
  if (limit > 1000) limit = 1000;
  if (Number.isNaN(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

function mapVt(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    type: r.type as string,
    rate: parseFloat(String(r.rate))
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset);
    const totalR = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM vehicle_types`);
    const total = parseInt(totalR.rows[0]?.c ?? "0", 10);
    const itemsR = await query(
      `SELECT id, type, rate::text FROM vehicle_types ORDER BY id LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ total, limit, offset, items: itemsR.rows.map(mapVt) });
  } catch (e) {
    next(e);
  }
});

router.get("/:vt_id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.vt_id, 10);
    const r = await query(`SELECT id, type, rate::text FROM vehicle_types WHERE id = $1`, [id]);
    if (!r.rowCount) throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type not found.");
    res.json(mapVt(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const b = req.body as { type?: string; rate?: number };
    if (!b.type?.trim()) {
      res.status(422).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: { fields: [{ field: "type", message: "Required" }] }
        }
      });
      return;
    }
    const r = await query(
      `INSERT INTO vehicle_types (type, rate) VALUES ($1, $2)
       RETURNING id, type, rate::text`,
      [b.type.trim(), b.rate]
    );
    res.status(201).json(mapVt(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.put("/:vt_id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.vt_id, 10);
    const b = req.body as { type?: string; rate?: number };
    const r = await query(
      `UPDATE vehicle_types SET type = $1, rate = $2 WHERE id = $3
       RETURNING id, type, rate::text`,
      [b.type, b.rate, id]
    );
    if (!r.rowCount) throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type not found.");
    res.json(mapVt(r.rows[0] as Record<string, unknown>));
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23505") {
      next(
        new ApiError(
          409,
          "VEHICLE_TYPE_ALREADY_EXISTS",
          "Vehicle type name already exists."
        )
      );
      return;
    }
    next(e);
  }
});

router.delete("/:vt_id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.vt_id, 10);
    const del = await query(`DELETE FROM vehicle_types WHERE id = $1 RETURNING id`, [id]);
    if (!del.rowCount) throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type not found.");
    res.json({ deleted: true });
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23503") {
      next(
        new ApiError(
          409,
          "VEHICLE_TYPE_DELETE_CONFLICT",
          "Cannot delete vehicle type because vehicles use it."
        )
      );
      return;
    }
    next(e);
  }
});

export default router;
