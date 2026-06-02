import { ApiError } from "../errors";
import { isPgError } from "../utils/pgErrors";
import { parseLimitOffset, type PaginatedResult } from "../utils/pagination";
import * as repo from "../repositories/vehiclesRepository";

export type Vehicle = {
  id: number;
  licence_plate: string | null;
  vehicle_type_id: number | null;
  created: unknown;
  status: number;
};

function mapRow(r: repo.VehicleRow): Vehicle {
  return {
    id: r.id,
    licence_plate: r.licence_plate,
    vehicle_type_id: r.vehicle_type_id,
    created: r.created,
    status: Number(r.status)
  };
}

export async function list(query: {
  limit?: unknown;
  offset?: unknown;
}): Promise<PaginatedResult<Vehicle>> {
  const { limit, offset } = parseLimitOffset(query.limit, query.offset);
  const [total, rows] = await Promise.all([
    repo.countVehicles(),
    repo.listVehicles(limit, offset)
  ]);
  return { total, limit, offset, items: rows.map(mapRow) };
}

export async function getById(id: number): Promise<Vehicle> {
  const row = await repo.findVehicleById(id);
  if (!row) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  return mapRow(row);
}

export async function getByPlate(plate: string): Promise<Vehicle> {
  const row = await repo.findVehicleByPlate(plate);
  if (!row) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  return mapRow(row);
}

export async function create(body: {
  licence_plate?: string | null;
  vehicle_type_id: number;
  status?: number;
}): Promise<Vehicle> {
  if (!(await repo.vehicleTypeExists(body.vehicle_type_id))) {
    throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type does not exist.");
  }
  if (body.licence_plate != null) {
    const ex = await repo.findVehicleByPlate(body.licence_plate);
    if (ex) {
      throw new ApiError(
        409,
        "VEHICLE_ALREADY_EXISTS",
        "Vehicle with this licence plate already exists."
      );
    }
  }
  const row = await repo.insertVehicle(
    body.licence_plate ?? null,
    body.vehicle_type_id,
    body.status ?? 1
  );
  return mapRow(row);
}

export async function patch(
  id: number,
  body: {
    licence_plate?: string | null;
    status?: number;
    vehicle_type_id?: number;
  }
): Promise<Vehicle> {
  const cur = await repo.findVehicleRowById(id);
  if (!cur) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");

  if (body.vehicle_type_id !== undefined && body.vehicle_type_id != null) {
    if (!(await repo.vehicleTypeExists(body.vehicle_type_id))) {
      throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type does not exist.");
    }
  }

  const merged = {
    licence_plate: body.licence_plate !== undefined ? body.licence_plate : cur.licence_plate,
    status: body.status !== undefined ? body.status : cur.status,
    vehicle_type_id:
      body.vehicle_type_id !== undefined ? body.vehicle_type_id : cur.vehicle_type_id
  };

  const row = await repo.updateVehicle(
    id,
    merged.licence_plate as string | null,
    Number(merged.status),
    merged.vehicle_type_id as number | null
  );
  return mapRow(row!);
}

export async function remove(id: number): Promise<{ deleted: true }> {
  try {
    const ok = await repo.deleteVehicle(id);
    if (!ok) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
    return { deleted: true };
  } catch (e) {
    if (isPgError(e, "23503")) {
      throw new ApiError(
        409,
        "VEHICLE_DELETE_CONFLICT",
        "Cannot delete vehicle because it has tickets."
      );
    }
    throw e;
  }
}
