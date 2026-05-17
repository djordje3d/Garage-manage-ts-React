import { query } from "../config/db";

export type VehicleRow = {
  id: number;
  licence_plate: string | null;
  vehicle_type_id: number | null;
  created: unknown;
  status: number;
};

export async function countVehicles(): Promise<number> {
  const r = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM vehicle`);
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

export async function listVehicles(limit: number, offset: number): Promise<VehicleRow[]> {
  const r = await query<VehicleRow>(
    `SELECT id, licence_plate, vehicle_type_id, created, status FROM vehicle ORDER BY id LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return r.rows;
}

export async function findVehicleById(id: number): Promise<VehicleRow | null> {
  const r = await query<VehicleRow>(
    `SELECT id, licence_plate, vehicle_type_id, created, status FROM vehicle WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findVehicleByPlate(plate: string): Promise<VehicleRow | null> {
  const r = await query<VehicleRow>(
    `SELECT id, licence_plate, vehicle_type_id, created, status FROM vehicle WHERE licence_plate = $1`,
    [plate]
  );
  return r.rows[0] ?? null;
}

export async function vehicleTypeExists(id: number): Promise<boolean> {
  const r = await query(`SELECT id FROM vehicle_types WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function findVehicleRowById(id: number): Promise<Record<string, unknown> | null> {
  const r = await query(`SELECT * FROM vehicle WHERE id = $1`, [id]);
  return (r.rows[0] as Record<string, unknown>) ?? null;
}

export async function insertVehicle(
  licencePlate: string | null,
  vehicleTypeId: number,
  status: number
): Promise<VehicleRow> {
  const r = await query<VehicleRow>(
    `INSERT INTO vehicle (licence_plate, vehicle_type_id, status)
     VALUES ($1, $2, $3)
     RETURNING id, licence_plate, vehicle_type_id, created, status`,
    [licencePlate, vehicleTypeId, status]
  );
  return r.rows[0]!;
}

export async function updateVehicle(
  id: number,
  licencePlate: string | null,
  status: number,
  vehicleTypeId: number | null
): Promise<VehicleRow | null> {
  const r = await query<VehicleRow>(
    `UPDATE vehicle SET licence_plate = $1, status = $2, vehicle_type_id = $3
     WHERE id = $4
     RETURNING id, licence_plate, vehicle_type_id, created, status`,
    [licencePlate, status, vehicleTypeId, id]
  );
  return r.rows[0] ?? null;
}

export async function deleteVehicle(id: number): Promise<boolean> {
  const r = await query(`DELETE FROM vehicle WHERE id = $1 RETURNING id`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function vehicleExists(id: number): Promise<boolean> {
  const r = await query(`SELECT id FROM vehicle WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}
