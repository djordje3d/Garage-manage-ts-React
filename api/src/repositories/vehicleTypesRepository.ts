import { query } from "../config/db";

export type VehicleTypeRow = {
  id: number;
  type: string;
  rate: string;
};

export async function countVehicleTypes(): Promise<number> {
  const r = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM vehicle_types`);
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function listVehicleTypes(limit: number, offset: number): Promise<VehicleTypeRow[]> {
  const r = await query<VehicleTypeRow>(
    `SELECT id, type, rate::text AS rate FROM vehicle_types ORDER BY id LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return r.rows;
}

export async function findVehicleTypeById(id: number): Promise<VehicleTypeRow | null> {
  const r = await query<VehicleTypeRow>(
    `SELECT id, type, rate::text AS rate FROM vehicle_types WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function insertVehicleType(type: string, rate: number): Promise<VehicleTypeRow> {
  const r = await query<VehicleTypeRow>(
    `INSERT INTO vehicle_types (type, rate) VALUES ($1, $2)
     RETURNING id, type, rate::text AS rate`,
    [type, rate]
  );
  return r.rows[0]!;
}

export async function updateVehicleType(
  id: number,
  type: string,
  rate: number
): Promise<VehicleTypeRow | null> {
  const r = await query<VehicleTypeRow>(
    `UPDATE vehicle_types SET type = $1, rate = $2 WHERE id = $3
     RETURNING id, type, rate::text AS rate`,
    [type, rate, id]
  );
  return r.rows[0] ?? null;
}

export async function deleteVehicleType(id: number): Promise<boolean> {
  const r = await query(`DELETE FROM vehicle_types WHERE id = $1 RETURNING id`, [id]);
  return (r.rowCount ?? 0) > 0;
}
