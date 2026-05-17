import { ApiError } from "../errors";
import { isPgError } from "../utils/pgErrors";
import { parseLimitOffset, type PaginatedResult } from "../utils/pagination";
import { parseOptionalInt } from "../utils/queryParams";
import * as repo from "../repositories/garagesRepository";

export type Garage = {
  id: number;
  name: string;
  capacity: number;
  default_rate: number;
  lost_ticket_fee: number | null;
  night_rate: number | null;
  day_rate: number | null;
  open_time: string | null;
  close_time: string | null;
  allow_subscription: boolean | null;
  created_at: unknown;
};

function mapRow(r: repo.GarageRow): Garage {
  return {
    id: r.id,
    name: r.name,
    capacity: Number(r.capacity),
    default_rate: parseFloat(r.default_rate),
    lost_ticket_fee: r.lost_ticket_fee != null ? parseFloat(r.lost_ticket_fee) : null,
    night_rate: r.night_rate != null ? parseFloat(r.night_rate) : null,
    day_rate: r.day_rate != null ? parseFloat(r.day_rate) : null,
    open_time: r.open_time != null ? String(r.open_time).slice(0, 8) : null,
    close_time: r.close_time != null ? String(r.close_time).slice(0, 8) : null,
    allow_subscription: r.allow_subscription,
    created_at: r.created_at
  };
}

export async function overview(query: { garage_id?: unknown }) {
  const garageId = parseOptionalInt(query.garage_id);
  return repo.listGarageOverview(garageId);
}

export async function list(query: {
  limit?: unknown;
  offset?: unknown;
}): Promise<PaginatedResult<Garage>> {
  const { limit, offset } = parseLimitOffset(query.limit, query.offset);
  const [total, rows] = await Promise.all([
    repo.countGarages(),
    repo.listGarages(limit, offset)
  ]);
  return { total, limit, offset, items: rows.map(mapRow) };
}

export async function getById(id: number): Promise<Garage> {
  const row = await repo.findGarageById(id);
  if (!row) throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
  return mapRow(row);
}

export async function create(body: Record<string, unknown>): Promise<Garage> {
  const row = await repo.insertGarage({
    name: body.name,
    capacity: body.capacity,
    default_rate: body.default_rate,
    lost_ticket_fee: body.lost_ticket_fee,
    night_rate: body.night_rate,
    day_rate: body.day_rate,
    open_time: body.open_time,
    close_time: body.close_time,
    allow_subscription: body.allow_subscription,
    created_at: body.created_at
  });
  return mapRow(row);
}

export async function replace(id: number, body: Record<string, unknown>): Promise<Garage> {
  const row = await repo.updateGarage(id, {
    name: body.name,
    capacity: body.capacity,
    default_rate: body.default_rate,
    lost_ticket_fee: body.lost_ticket_fee,
    night_rate: body.night_rate,
    day_rate: body.day_rate,
    open_time: body.open_time,
    close_time: body.close_time,
    allow_subscription: body.allow_subscription
  });
  if (!row) throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
  return mapRow(row);
}

export async function patch(id: number, body: Record<string, unknown>): Promise<Garage> {
  const cur = await repo.findGarageRawById(id);
  if (!cur) throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
  const merged = {
    name: body.name !== undefined ? body.name : cur.name,
    capacity: body.capacity !== undefined ? body.capacity : cur.capacity,
    default_rate: body.default_rate !== undefined ? body.default_rate : cur.default_rate,
    lost_ticket_fee:
      body.lost_ticket_fee !== undefined ? body.lost_ticket_fee : cur.lost_ticket_fee,
    night_rate: body.night_rate !== undefined ? body.night_rate : cur.night_rate,
    day_rate: body.day_rate !== undefined ? body.day_rate : cur.day_rate,
    open_time: body.open_time !== undefined ? body.open_time : cur.open_time,
    close_time: body.close_time !== undefined ? body.close_time : cur.close_time,
    allow_subscription:
      body.allow_subscription !== undefined ? body.allow_subscription : cur.allow_subscription
  };
  const row = await repo.updateGarage(id, merged);
  return mapRow(row!);
}

export async function remove(id: number): Promise<{ deleted: true }> {
  try {
    const ok = await repo.deleteGarage(id);
    if (!ok) throw new ApiError(404, "GARAGE_NOT_FOUND", "Garage not found.");
    return { deleted: true };
  } catch (e) {
    if (isPgError(e, "23503")) {
      throw new ApiError(
        409,
        "GARAGE_DELETE_CONFLICT",
        "Cannot delete garage because it has parking spots or tickets."
      );
    }
    throw e;
  }
}
