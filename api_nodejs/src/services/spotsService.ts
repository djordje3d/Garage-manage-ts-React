import { pool } from "../config/db";
import { ApiError } from "../errors";
import { isPgError } from "../utils/pgErrors";
import { parseLimitOffset, type PaginatedResult } from "../utils/pagination";
import { parseBool, parseOptionalInt } from "../utils/queryParams";
import { garageExists } from "../repositories/garagesRepository";
import * as repo from "../repositories/spotsRepository";
import type { Queryable } from "../repositories/types";

export type SpotResponse = {
  id: number;
  garage_id: number;
  code: string;
  is_rentable: boolean;
  is_active: boolean;
  is_occupied: boolean;
};

export type { SpotRow } from "../repositories/spotsRepository";

export async function toSpotResponse(
  db: Queryable,
  spot: repo.SpotRow,
  occupied?: boolean
): Promise<SpotResponse> {
  const occ = occupied ?? (await repo.spotIsOccupied(db, spot.id));
  return {
    id: spot.id,
    garage_id: spot.garage_id,
    code: spot.code,
    is_rentable: spot.is_rentable,
    is_active: spot.is_active,
    is_occupied: occ
  };
}

export { allocateFreeSpot } from "../repositories/spotsRepository";

export async function list(query: {
  limit?: unknown;
  offset?: unknown;
  garage_id?: unknown;
  active_only?: unknown;
  rentable_only?: unknown;
  only_free?: unknown;
}): Promise<PaginatedResult<SpotResponse>> {
  const { limit, offset } = parseLimitOffset(query.limit, query.offset);
  const filters: repo.SpotListFilters = {
    garage_id: parseOptionalInt(query.garage_id),
    active_only: parseBool(query.active_only, true),
    rentable_only: parseBool(query.rentable_only, false),
    only_free: parseBool(query.only_free, false)
  };

  const [total, rows] = await Promise.all([
    repo.countSpots(filters),
    repo.listSpots(filters, limit, offset)
  ]);

  const occupiedSet = await repo.spotIdsWithOpenTickets(pool, rows.map((s) => s.id));
  const items = await Promise.all(
    rows.map((s) => toSpotResponse(pool, s, occupiedSet.has(s.id)))
  );

  return { total, limit, offset, items };
}

export async function getById(id: number): Promise<SpotResponse> {
  const row = await repo.findSpotById(id);
  if (!row) throw new ApiError(404, "SPOT_NOT_FOUND", "Parking spot not found.");
  return toSpotResponse(pool, row);
}

export async function activate(id: number): Promise<SpotResponse> {
  const row = await repo.activateSpot(id);
  if (!row) throw new ApiError(404, "SPOT_NOT_FOUND", "Parking spot not found.");
  return toSpotResponse(pool, row);
}

export async function create(body: {
  garage_id: number;
  code: string;
  is_rentable?: boolean;
  is_active?: boolean;
}): Promise<SpotResponse> {
  if (!(await garageExists(body.garage_id))) {
    throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
  }
  try {
    const row = await repo.insertSpot({
      garage_id: body.garage_id,
      code: body.code,
      is_rentable: body.is_rentable ?? false,
      is_active: body.is_active ?? true
    });
    return toSpotResponse(pool, row);
  } catch (e) {
    if (isPgError(e, "23505")) {
      throw new ApiError(409, "SPOT_CODE_CONFLICT", "Spot code already exists in this garage.");
    }
    throw e;
  }
}

export async function patch(
  id: number,
  body: { code?: string; is_rentable?: boolean; is_active?: boolean }
): Promise<SpotResponse> {
  const cur = await repo.findSpotById(id);
  if (!cur) throw new ApiError(404, "SPOT_NOT_FOUND", "Parking spot not found.");
  const merged = {
    code: body.code !== undefined ? body.code : cur.code,
    is_rentable: body.is_rentable !== undefined ? body.is_rentable : cur.is_rentable,
    is_active: body.is_active !== undefined ? body.is_active : cur.is_active
  };
  try {
    const row = await repo.updateSpot(id, merged.code, merged.is_rentable, merged.is_active);
    return toSpotResponse(pool, row!);
  } catch (e) {
    if (isPgError(e, "23505")) {
      throw new ApiError(409, "SPOT_CODE_CONFLICT", "Spot code already exists in this garage.");
    }
    throw e;
  }
}

export async function deactivate(id: number): Promise<{ message: string; spot_id: number }> {
  const spot = await repo.findSpotById(id);
  if (!spot) throw new ApiError(404, "SPOT_NOT_FOUND", "Parking spot not found.");
  if (await repo.spotHasOpenTicket(id)) {
    throw new ApiError(
      409,
      "SPOT_HAS_OPEN_TICKET",
      "Cannot deactivate spot because it has an OPEN ticket."
    );
  }
  await repo.deactivateSpot(id);
  return { message: "Parking spot successfully deactivated", spot_id: id };
}
