import { ApiError } from "../errors";
import { isPgError } from "../utils/pgErrors";
import { parseLimitOffset, type PaginatedResult } from "../utils/pagination";
import * as repo from "../repositories/vehicleTypesRepository";

export type VehicleType = {
  id: number;
  type: string;
  rate: number;
};

function mapRow(r: repo.VehicleTypeRow): VehicleType {
  return { id: r.id, type: r.type, rate: parseFloat(r.rate) };
}

export async function list(query: {
  limit?: unknown;
  offset?: unknown;
}): Promise<PaginatedResult<VehicleType>> {
  const { limit, offset } = parseLimitOffset(query.limit, query.offset);
  const [total, rows] = await Promise.all([
    repo.countVehicleTypes(),
    repo.listVehicleTypes(limit, offset)
  ]);
  return { total, limit, offset, items: rows.map(mapRow) };
}

export async function getById(id: number): Promise<VehicleType> {
  const row = await repo.findVehicleTypeById(id);
  if (!row) throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type not found.");
  return mapRow(row);
}

export async function create(body: { type?: string; rate?: number }): Promise<VehicleType> {
  if (!body.type?.trim()) {
    throw new ApiError(422, "VALIDATION_ERROR", "Request validation failed.", {
      fields: [{ field: "type", message: "Required" }]
    });
  }
  const row = await repo.insertVehicleType(body.type.trim(), body.rate ?? 0);
  return mapRow(row);
}

export async function update(
  id: number,
  body: { type?: string; rate?: number }
): Promise<VehicleType> {
  try {
    const row = await repo.updateVehicleType(id, body.type!, body.rate!);
    if (!row) throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type not found.");
    return mapRow(row);
  } catch (e) {
    if (isPgError(e, "23505")) {
      throw new ApiError(
        409,
        "VEHICLE_TYPE_ALREADY_EXISTS",
        "Vehicle type name already exists."
      );
    }
    throw e;
  }
}

export async function remove(id: number): Promise<{ deleted: true }> {
  try {
    const ok = await repo.deleteVehicleType(id);
    if (!ok) throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type not found.");
    return { deleted: true };
  } catch (e) {
    if (isPgError(e, "23503")) {
      throw new ApiError(
        409,
        "VEHICLE_TYPE_DELETE_CONFLICT",
        "Cannot delete vehicle type because vehicles use it."
      );
    }
    throw e;
  }
}
