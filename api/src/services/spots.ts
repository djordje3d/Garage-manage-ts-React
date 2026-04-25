import type { PoolClient } from "pg";
import type { QueryResult, QueryResultRow } from "pg";
type Queryable = {
  query: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<QueryResult<R>>;
};

export type SpotRow = {
  id: number;
  garage_id: number;
  code: string;
  is_rentable: boolean;
  is_active: boolean;
};

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

export async function toSpotResponse(
  db: Queryable,
  spot: SpotRow,
  occupied?: boolean
): Promise<{
  id: number;
  garage_id: number;
  code: string;
  is_rentable: boolean;
  is_active: boolean;
  is_occupied: boolean;
}> {
  const occ = occupied ?? (await spotIsOccupied(db, spot.id));
  return {
    id: spot.id,
    garage_id: spot.garage_id,
    code: spot.code,
    is_rentable: spot.is_rentable,
    is_active: spot.is_active,
    is_occupied: occ
  };
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
