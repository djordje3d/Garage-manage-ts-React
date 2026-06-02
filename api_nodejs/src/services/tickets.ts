import type { PoolClient } from "pg";
import { env } from "../config/env";
import * as spotsRepo from "../repositories/spotsRepository";
import * as ticketsRepo from "../repositories/ticketsRepository";
import { vehicleExists } from "../repositories/vehiclesRepository";
import { generateTicketToken } from "./ticketTokens";
import { getTicketFee } from "./pricing";

const MAX_RETRIES = 5;

export class TicketServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketServiceError";
  }
}

export class TicketNotFoundError extends TicketServiceError {}
export class InvalidVehicleError extends TicketServiceError {}
export class InvalidSpotError extends TicketServiceError {}
export class SpotGarageMismatchError extends TicketServiceError {}
export class SpotInactiveError extends TicketServiceError {}
export class SpotOccupiedError extends TicketServiceError {}
export class NoFreeSpotError extends TicketServiceError {}
export class TicketStateError extends TicketServiceError {}
export class TicketTokenRetryExceededError extends TicketServiceError {}
export class TicketPersistenceError extends TicketServiceError {}

export type TicketEntryInput = {
  vehicle_id: number;
  entry_time: Date | null;
  garage_id: number;
  spot_id: number | null;
  rentable_only: boolean;
  image_url: string | null;
};

export type TicketUpdateInput = {
  operational_status?: string | null;
  spot_id?: number | null;
  image_url?: string | null;
};

export type TicketExitInput = {
  exit_time: Date | null;
};

async function resolveSpotId(client: PoolClient, data: TicketEntryInput): Promise<number> {
  if (data.spot_id != null) {
    const s = await spotsRepo.findSpotForTicket(client, data.spot_id);
    if (!s) throw new InvalidSpotError("Invalid spot_id");
    if (s.garage_id !== data.garage_id) throw new SpotGarageMismatchError("spot_id does not belong to garage");
    if (!s.is_active) throw new SpotInactiveError("Spot is not active");
    if (await ticketsRepo.ticketSpotOccupied(client, data.spot_id)) {
      throw new SpotOccupiedError("Spot is occupied");
    }
    return data.spot_id;
  }
  try {
    return await spotsRepo.allocateFreeSpot(client, data.garage_id, data.rentable_only);
  } catch (e) {
    if (e instanceof Error && e.message === "No free spots available") {
      throw new NoFreeSpotError("No free spots available");
    }
    throw e;
  }
}

async function validateSpotReassignment(
  client: PoolClient,
  ticketId: number,
  currentSpotId: number | null,
  newSpotId: number
): Promise<void> {
  if (newSpotId === currentSpotId) return;
  const s = await spotsRepo.findSpotForTicket(client, newSpotId);
  if (!s) throw new InvalidSpotError("Invalid spot_id");
  const gid = await ticketsRepo.findTicketGarageId(client, ticketId);
  if (gid == null || s.garage_id !== gid) {
    throw new SpotGarageMismatchError("spot_id does not belong to garage");
  }
  if (!s.is_active) throw new SpotInactiveError("Spot is not active");
  if (await ticketsRepo.ticketSpotOccupied(client, newSpotId, ticketId)) {
    throw new SpotOccupiedError("Spot is occupied");
  }
}

export async function createTicketEntry(
  client: PoolClient,
  data: TicketEntryInput
): Promise<number> {
  if (!(await vehicleExists(data.vehicle_id))) {
    throw new InvalidVehicleError("Invalid vehicle_id");
  }

  const spotId = await resolveSpotId(client, data);
  const entryTime = data.entry_time ?? new Date();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const token = generateTicketToken(data.garage_id);
    try {
      return await ticketsRepo.insertTicket(client, {
        ticket_token: token,
        vehicle_id: data.vehicle_id,
        entry_time: entryTime,
        garage_id: data.garage_id,
        spot_id: spotId,
        image_url: data.image_url
      });
    } catch (e: unknown) {
      const pg = e as { code?: string; message?: string };
      if (pg.code === "23505" && String(pg.message).toLowerCase().includes("ticket_token")) {
        continue;
      }
      throw new TicketPersistenceError(
        `Database integrity error: ${pg.message ?? String(e)}`
      );
    }
  }
  throw new TicketTokenRetryExceededError(
    "Failed to generate unique ticket token after multiple retries"
  );
}

export async function applyTicketUpdate(
  client: PoolClient,
  ticketId: number,
  data: TicketUpdateInput
): Promise<void> {
  const t = await ticketsRepo.findTicketForUpdate(client, ticketId);
  if (!t) throw new TicketNotFoundError("Ticket not found");

  const hasAny =
    data.operational_status !== undefined ||
    data.image_url !== undefined ||
    data.spot_id !== undefined;
  if (!hasAny) return;

  if (data.operational_status !== undefined && data.operational_status != null) {
    await ticketsRepo.updateTicketOperationalStatus(
      client,
      ticketId,
      data.operational_status
    );
  }
  if (data.image_url !== undefined) {
    await ticketsRepo.updateTicketImageUrl(client, ticketId, data.image_url);
  }
  if (data.spot_id !== undefined) {
    if (t.ticket_state !== "OPEN") {
      throw new TicketStateError("Spot can only be changed on open tickets");
    }
    const newSid = data.spot_id;
    if (newSid == null) throw new InvalidSpotError("spot_id cannot be cleared");
    await validateSpotReassignment(client, ticketId, t.spot_id, newSid);
    await ticketsRepo.updateTicketSpot(client, ticketId, newSid);
  }
}

export async function closeTicket(
  client: PoolClient,
  ticketId: number,
  data: TicketExitInput
): Promise<void> {
  const t = await ticketsRepo.findTicketForClose(client, ticketId);
  if (!t) throw new TicketNotFoundError("Ticket not found");
  if (t.ticket_state !== "OPEN" || t.exit_time != null) {
    throw new TicketStateError("Ticket is not open");
  }

  const exitTime = data.exit_time ?? new Date();

  if (env.useApiFeeCalculation) {
    const fee = await getTicketFee(client, {
      id: t.id,
      entry_time: t.entry_time,
      exit_time: exitTime,
      garage_id: t.garage_id,
      vehicle_id: t.vehicle_id
    });
    await ticketsRepo.closeTicketWithFee(client, ticketId, exitTime, fee);
  } else {
    await ticketsRepo.closeTicketWithoutFee(client, ticketId, exitTime);
  }
}
