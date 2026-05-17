import type { PoolClient } from "pg";
import { query } from "../config/db";
import type { Queryable } from "./types";

export type SpotRow = {
  id: number;
  garage_id: number;
  code: string;
  is_rentable: boolean;
  is_active: boolean;
};

export type SpotListFilters = {
  garage_id: number | null;
  active_only: boolean;
  rentable_only: boolean;
  only_free: boolean;
};

function buildSpotListWhere(filters: SpotListFilters): { where: string; params: unknown[] } {
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];
  let p = 1;
  if (filters.garage_id != null) {
    conditions.push(`garage_id = $${p}`);
    params.push(filters.garage_id);
    p += 1;
  }
  if (filters.active_only) {
    conditions.push(`is_active = true`);
  }
  if (filters.rentable_only) {
    conditions.push(`is_rentable = true`);
  }
  if (filters.only_free) {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM tickets t WHERE t.spot_id = parking_spot.id AND t.ticket_state = 'OPEN')`
    );
  }
  return { where: conditions.join(" AND "), params };
}

export async function countSpots(filters: SpotListFilters): Promise<number> {
  const { where, params } = buildSpotListWhere(filters);
  const r = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM parking_spot WHERE ${where}`,
    params
  );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function listSpots(
  filters: SpotListFilters,
  limit: number,
  offset: number
): Promise<SpotRow[]> {
  const { where, params } = buildSpotListWhere(filters);
  let p = params.length + 1;
  const r = await query<SpotRow>(
    `SELECT id, garage_id, code, is_rentable, is_active FROM parking_spot WHERE ${where} ORDER BY id DESC LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );
  return r.rows;
}

export async function findSpotById(id: number): Promise<SpotRow | null> {
  const r = await query<SpotRow>(
    `SELECT id, garage_id, code, is_rentable, is_active FROM parking_spot WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function insertSpot(data: {
  garage_id: number;
  code: string;
  is_rentable: boolean;
  is_active: boolean;
}): Promise<SpotRow> {
  const r = await query<SpotRow>(
    `INSERT INTO parking_spot (garage_id, code, is_rentable, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, garage_id, code, is_rentable, is_active`,
    [data.garage_id, data.code, data.is_rentable, data.is_active]
  );
  return r.rows[0]!;
}

export async function updateSpot(
  id: number,
  code: string,
  is_rentable: boolean,
  is_active: boolean
): Promise<SpotRow | null> {
  const r = await query<SpotRow>(
    `UPDATE parking_spot SET code = $1, is_rentable = $2, is_active = $3
     WHERE id = $4
     RETURNING id, garage_id, code, is_rentable, is_active`,
    [code, is_rentable, is_active, id]
  );
  return r.rows[0] ?? null;
}

export async function activateSpot(id: number): Promise<SpotRow | null> {
  const r = await query<SpotRow>(
    `UPDATE parking_spot SET is_active = true WHERE id = $1
     RETURNING id, garage_id, code, is_rentable, is_active`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function deactivateSpot(id: number): Promise<void> {
  await query(`UPDATE parking_spot SET is_active = false WHERE id = $1`, [id]);
}

export async function spotHasOpenTicket(spotId: number): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM tickets WHERE spot_id = $1 AND ticket_state = 'OPEN' LIMIT 1`,
    [spotId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function spotIdsWithOpenTickets(
  db: Queryable,
  spotIds: number[]
): Promise<Set<number>> {
  const ids = spotIds.filter((i) => i != null);
  if (ids.length === 0) return new Set();
  const r = await db.query<{ spot_id: number }>(
    `SELECT DISTINCT spot_id FROM tickets
     WHERE spot_id = ANY($1::int[]) AND ticket_state = 'OPEN' AND spot_id IS NOT NULL`,
    [ids]
  );
  return new Set(r.rows.map((x) => x.spot_id));
}

export async function spotIsOccupied(db: Queryable, spotId: number): Promise<boolean> {
  const r = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM tickets WHERE spot_id = $1 AND ticket_state = 'OPEN'
     ) AS exists`,
    [spotId]
  );
  return Boolean(r.rows[0]?.exists);
}

export async function findSpotForTicket(
  db: Queryable,
  spotId: number
): Promise<{ id: number; garage_id: number; is_active: boolean } | null> {
  const r = await db.query<{ id: number; garage_id: number; is_active: boolean }>(
    `SELECT id, garage_id, is_active FROM parking_spot WHERE id = $1`,
    [spotId]
  );
  return r.rows[0] ?? null;
}

export async function allocateFreeSpot(
  client: PoolClient,
  garageId: number,
  rentableOnly: boolean
): Promise<number> {
  const sql = `
    SELECT ps.id
    FROM parking_spot ps
    WHERE ps.garage_id = $1
      AND ps.is_active = true
      AND ($2::boolean = false OR ps.is_rentable = true)
      AND NOT EXISTS (
        SELECT 1
        FROM tickets t
        WHERE t.spot_id = ps.id
          AND t.ticket_state = 'OPEN'
      )
    ORDER BY ps.id
    FOR UPDATE OF ps SKIP LOCKED
    LIMIT 1
  `;
  const r = await client.query<{ id: number }>(sql, [garageId, rentableOnly]);
  const spotId = r.rows[0]?.id;
  if (spotId == null) {
    throw new Error("No free spots available");
  }
  return spotId;
}
