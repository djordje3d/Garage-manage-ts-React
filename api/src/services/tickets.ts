import type { PoolClient } from "pg";
import { env } from "../config/env";
import { allocateFreeSpot } from "./spots";
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
    const spot = await client.query<{
      id: number;
      garage_id: number;
      is_active: boolean;
    }>(`SELECT id, garage_id, is_active FROM parking_spot WHERE id = $1`, [data.spot_id]);
    const s = spot.rows[0];
    if (!s) throw new InvalidSpotError("Invalid spot_id");
    if (s.garage_id !== data.garage_id) throw new SpotGarageMismatchError("spot_id does not belong to garage");
    if (!s.is_active) throw new SpotInactiveError("Spot is not active");
    const occ = await client.query(
      `SELECT 1 FROM tickets WHERE spot_id = $1 AND ticket_state = 'OPEN' LIMIT 1`,
      [data.spot_id]
    );
    if (occ.rowCount && occ.rowCount > 0) throw new SpotOccupiedError("Spot is occupied");
    return data.spot_id;
  }
  try {
    return await allocateFreeSpot(client, data.garage_id, data.rentable_only);
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
  const spot = await client.query<{
    id: number;
    garage_id: number;
    is_active: boolean;
  }>(`SELECT id, garage_id, is_active FROM parking_spot WHERE id = $1`, [newSpotId]);
  const s = spot.rows[0];
  if (!s) throw new InvalidSpotError("Invalid spot_id");
  const t = await client.query<{ garage_id: number }>(
    `SELECT garage_id FROM tickets WHERE id = $1`,
    [ticketId]
  );
  const gid = t.rows[0]?.garage_id;
  if (gid == null || s.garage_id !== gid) throw new SpotGarageMismatchError("spot_id does not belong to garage");
  if (!s.is_active) throw new SpotInactiveError("Spot is not active");
  const occ = await client.query(
    `SELECT 1 FROM tickets WHERE spot_id = $1 AND ticket_state = 'OPEN' AND id <> $2 LIMIT 1`,
    [newSpotId, ticketId]
  );
  if (occ.rowCount && occ.rowCount > 0) throw new SpotOccupiedError("Spot is occupied");
}

export async function createTicketEntry(
  client: PoolClient,
  data: TicketEntryInput
): Promise<number> {
  const v = await client.query(`SELECT id FROM vehicle WHERE id = $1`, [data.vehicle_id]);
  if (!v.rowCount) throw new InvalidVehicleError("Invalid vehicle_id");

  const spotId = await resolveSpotId(client, data);
  const entryTime = data.entry_time ?? new Date();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const token = generateTicketToken(data.garage_id);
    try {
      const ins = await client.query<{ id: number }>(
        `INSERT INTO tickets (
           ticket_token, vehicle_id, entry_time, ticket_state, payment_status,
           operational_status, garage_id, fee, spot_id, image_url
         ) VALUES ($1, $2, $3, 'OPEN', 'NOT_APPLICABLE', 'OK', $4, 0, $5, $6)
         RETURNING id`,
        [token, data.vehicle_id, entryTime, data.garage_id, spotId, data.image_url]
      );
      return ins.rows[0]!.id;
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
  const ticket = await client.query<{
    id: number;
    ticket_state: string;
    spot_id: number | null;
  }>(`SELECT id, ticket_state, spot_id FROM tickets WHERE id = $1`, [ticketId]);
  const t = ticket.rows[0];
  if (!t) throw new TicketNotFoundError("Ticket not found");

  const hasAny =
    data.operational_status !== undefined ||
    data.image_url !== undefined ||
    data.spot_id !== undefined;
  if (!hasAny) return;

  if (data.operational_status !== undefined && data.operational_status != null) {
    await client.query(`UPDATE tickets SET operational_status = $1 WHERE id = $2`, [
      data.operational_status,
      ticketId
    ]);
  }
  if (data.image_url !== undefined) {
    await client.query(`UPDATE tickets SET image_url = $1 WHERE id = $2`, [
      data.image_url,
      ticketId
    ]);
  }
  if (data.spot_id !== undefined) {
    if (t.ticket_state !== "OPEN") {
      throw new TicketStateError("Spot can only be changed on open tickets");
    }
    const newSid = data.spot_id;
    if (newSid == null) throw new InvalidSpotError("spot_id cannot be cleared");
    await validateSpotReassignment(client, ticketId, t.spot_id, newSid);
    await client.query(`UPDATE tickets SET spot_id = $1 WHERE id = $2`, [newSid, ticketId]);
  }
}

export async function closeTicket(
  client: PoolClient,
  ticketId: number,
  data: TicketExitInput
): Promise<void> {
  const ticket = await client.query<{
    id: number;
    ticket_state: string;
    exit_time: Date | null;
    entry_time: Date | null;
    garage_id: number;
    vehicle_id: number | null;
  }>(
    `SELECT id, ticket_state, exit_time, entry_time, garage_id, vehicle_id FROM tickets WHERE id = $1`,
    [ticketId]
  );
  const t = ticket.rows[0];
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
    await client.query(
      `UPDATE tickets SET exit_time = $1, ticket_state = 'CLOSED', fee = $2 WHERE id = $3`,
      [exitTime, fee, ticketId]
    );
  } else {
    await client.query(
      `UPDATE tickets SET exit_time = $1, ticket_state = 'CLOSED' WHERE id = $2`,
      [exitTime, ticketId]
    );
  }
}
