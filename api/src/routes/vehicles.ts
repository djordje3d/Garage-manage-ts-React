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

function mapVehicle(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    licence_plate: r.licence_plate as string | null,
    vehicle_type_id: r.vehicle_type_id as number | null,
    created: r.created,
    status: Number(r.status)
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset);
    const totalR = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM vehicle`);
    const total = parseInt(totalR.rows[0]?.c ?? "0", 10);
    const itemsR = await query(
      `SELECT id, licence_plate, vehicle_type_id, created, status FROM vehicle ORDER BY id LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ total, limit, offset, items: itemsR.rows.map(mapVehicle) });
  } catch (e) {
    next(e);
  }
});

router.get("/by-plate/:plate", async (req, res, next) => {
  try {
    const plate = req.params.plate;
    const r = await query(
      `SELECT id, licence_plate, vehicle_type_id, created, status FROM vehicle WHERE licence_plate = $1`,
      [plate]
    );
    if (!r.rowCount) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
    res.json(mapVehicle(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.get("/:vehicle_id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.vehicle_id, 10);
    const r = await query(
      `SELECT id, licence_plate, vehicle_type_id, created, status FROM vehicle WHERE id = $1`,
      [id]
    );
    if (!r.rowCount) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
    res.json(mapVehicle(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const b = req.body as {
      licence_plate?: string | null;
      vehicle_type_id: number;
      status?: number;
    };
    const vt = await query(`SELECT id FROM vehicle_types WHERE id = $1`, [b.vehicle_type_id]);
    if (!vt.rowCount) {
      throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type does not exist.");
    }
    if (b.licence_plate != null) {
      const ex = await query(`SELECT id FROM vehicle WHERE licence_plate = $1`, [
        b.licence_plate
      ]);
      if (ex.rowCount) {
        throw new ApiError(
          409,
          "VEHICLE_ALREADY_EXISTS",
          "Vehicle with this licence plate already exists."
        );
      }
    }
    const r = await query(
      `INSERT INTO vehicle (licence_plate, vehicle_type_id, status)
       VALUES ($1, $2, COALESCE($3, 1))
       RETURNING id, licence_plate, vehicle_type_id, created, status`,
      [b.licence_plate ?? null, b.vehicle_type_id, b.status ?? 1]
    );
    res.status(201).json(mapVehicle(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.patch("/:vehicle_id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.vehicle_id, 10);
    const b = req.body as {
      licence_plate?: string | null;
      status?: number;
      vehicle_type_id?: number;
    };
    const cur = await query(`SELECT * FROM vehicle WHERE id = $1`, [id]);
    if (!cur.rowCount) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
    const row = cur.rows[0] as Record<string, unknown>;
    if (b.vehicle_type_id !== undefined && b.vehicle_type_id != null) {
      const vt = await query(`SELECT id FROM vehicle_types WHERE id = $1`, [b.vehicle_type_id]);
      if (!vt.rowCount) {
        throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type does not exist.");
      }
    }
    const merged = {
      licence_plate: b.licence_plate !== undefined ? b.licence_plate : row.licence_plate,
      status: b.status !== undefined ? b.status : row.status,
      vehicle_type_id:
        b.vehicle_type_id !== undefined ? b.vehicle_type_id : row.vehicle_type_id
    };
    const r = await query(
      `UPDATE vehicle SET licence_plate = $1, status = $2, vehicle_type_id = $3
       WHERE id = $4
       RETURNING id, licence_plate, vehicle_type_id, created, status`,
      [merged.licence_plate, merged.status, merged.vehicle_type_id, id]
    );
    res.json(mapVehicle(r.rows[0] as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

router.delete("/:vehicle_id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.vehicle_id, 10);
    const del = await query(`DELETE FROM vehicle WHERE id = $1 RETURNING id`, [id]);
    if (!del.rowCount) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
    res.json({ deleted: true });
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23503") {
      next(
        new ApiError(
          409,
          "VEHICLE_DELETE_CONFLICT",
          "Cannot delete vehicle because it has tickets."
        )
      );
      return;
    }
    next(e);
  }
});

export default router;
