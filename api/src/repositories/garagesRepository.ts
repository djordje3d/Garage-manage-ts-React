import { query } from "../config/db";

export type GarageRow = {
  id: number;
  name: string;
  capacity: number;
  default_rate: string;
  lost_ticket_fee: string | null;
  night_rate: string | null;
  day_rate: string | null;
  open_time: unknown;
  close_time: unknown;
  allow_subscription: boolean | null;
  created_at: unknown;
};

export type GarageOverviewRow = {
  garage_id: number;
  name: string;
  total_spots: number;
  free_spots: number;
  occupied_spots: number;
  rentable_spots: number;
};

export async function listGarageOverview(garageId: number | null): Promise<GarageOverviewRow[]> {
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
  const r = await query<GarageOverviewRow>(sql, [garageId]);
  return r.rows;
}

export async function countGarages(): Promise<number> {
  const r = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM parking_config`);
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

const GARAGE_SELECT = `SELECT id, name, capacity, default_rate::text AS default_rate, lost_ticket_fee::text,
  night_rate::text, day_rate::text, open_time, close_time, allow_subscription, created_at
  FROM parking_config`;

export async function listGarages(limit: number, offset: number): Promise<GarageRow[]> {
  const r = await query<GarageRow>(`${GARAGE_SELECT} ORDER BY id LIMIT $1 OFFSET $2`, [limit, offset]);
  return r.rows;
}

export async function findGarageById(id: number): Promise<GarageRow | null> {
  const r = await query<GarageRow>(`${GARAGE_SELECT} WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function findGarageRawById(id: number): Promise<Record<string, unknown> | null> {
  const r = await query(`SELECT * FROM parking_config WHERE id = $1`, [id]);
  return (r.rows[0] as Record<string, unknown>) ?? null;
}

export async function insertGarage(data: {
  name: unknown;
  capacity: unknown;
  default_rate: unknown;
  lost_ticket_fee: unknown;
  night_rate: unknown;
  day_rate: unknown;
  open_time: unknown;
  close_time: unknown;
  allow_subscription: unknown;
  created_at: unknown;
}): Promise<GarageRow> {
  const r = await query<GarageRow>(
    `INSERT INTO parking_config (
       name, capacity, default_rate, lost_ticket_fee, night_rate, day_rate,
       open_time, close_time, allow_subscription, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW()))
     RETURNING id, name, capacity, default_rate::text, lost_ticket_fee::text, night_rate::text,
               day_rate::text, open_time, close_time, allow_subscription, created_at`,
    [
      data.name,
      data.capacity,
      data.default_rate,
      data.lost_ticket_fee ?? null,
      data.night_rate ?? null,
      data.day_rate ?? null,
      data.open_time ?? null,
      data.close_time ?? null,
      data.allow_subscription ?? true,
      data.created_at ?? null
    ]
  );
  return r.rows[0]!;
}

export async function updateGarage(
  id: number,
  data: {
    name: unknown;
    capacity: unknown;
    default_rate: unknown;
    lost_ticket_fee: unknown;
    night_rate: unknown;
    day_rate: unknown;
    open_time: unknown;
    close_time: unknown;
    allow_subscription: unknown;
  }
): Promise<GarageRow | null> {
  const r = await query<GarageRow>(
    `UPDATE parking_config SET
       name = $1, capacity = $2, default_rate = $3, lost_ticket_fee = $4,
       night_rate = $5, day_rate = $6, open_time = $7, close_time = $8, allow_subscription = $9
     WHERE id = $10
     RETURNING id, name, capacity, default_rate::text, lost_ticket_fee::text, night_rate::text,
               day_rate::text, open_time, close_time, allow_subscription, created_at`,
    [
      data.name,
      data.capacity,
      data.default_rate,
      data.lost_ticket_fee ?? null,
      data.night_rate ?? null,
      data.day_rate ?? null,
      data.open_time ?? null,
      data.close_time ?? null,
      data.allow_subscription ?? null,
      id
    ]
  );
  return r.rows[0] ?? null;
}

export async function deleteGarage(id: number): Promise<boolean> {
  const r = await query(`DELETE FROM parking_config WHERE id = $1 RETURNING id`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function garageExists(id: number): Promise<boolean> {
  const r = await query(`SELECT id FROM parking_config WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}
