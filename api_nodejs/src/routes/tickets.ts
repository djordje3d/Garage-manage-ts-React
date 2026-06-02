import { Router } from "express";
import { withTransaction } from "../config/db";
import { ApiError } from "../errors";
import {
  InvalidSpotError,
  InvalidVehicleError,
  NoFreeSpotError,
  SpotGarageMismatchError,
  SpotInactiveError,
  SpotOccupiedError,
  TicketNotFoundError,
  TicketPersistenceError,
  TicketStateError,
  TicketTokenRetryExceededError,
  applyTicketUpdate,
  closeTicket,
  createTicketEntry
} from "../services/tickets";
import * as ticketsQueryService from "../services/ticketsQueryService";

const router = Router();

router.get("/dashboard", async (req, res, next) => {
  try {
    res.json(await ticketsQueryService.listDashboard(req.query));
  } catch (e) {
    next(e);
  }
});

router.get("/", async (req, res, next) => {
  try {
    res.json(await ticketsQueryService.list(req.query));
  } catch (e) {
    next(e);
  }
});

router.get("/:ticket_id", async (req, res, next) => {
  try {
    res.json(await ticketsQueryService.getById(parseInt(req.params.ticket_id, 10)));
  } catch (e) {
    next(e);
  }
});

router.put("/:ticket_id", async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);
    await withTransaction(async (client) => {
      await applyTicketUpdate(client, ticketId, req.body ?? {});
    });
    res.json(await ticketsQueryService.getFullById(ticketId));
  } catch (e) {
    if (e instanceof TicketNotFoundError) return next(new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found."));
    if (e instanceof InvalidSpotError) return next(new ApiError(400, "INVALID_SPOT_UPDATE", e.message));
    if (e instanceof SpotGarageMismatchError) return next(new ApiError(409, "SPOT_GARAGE_MISMATCH", "Selected parking spot does not belong to this ticket's garage."));
    if (e instanceof SpotInactiveError) return next(new ApiError(409, "SPOT_INACTIVE", "Selected parking spot is inactive."));
    if (e instanceof SpotOccupiedError) return next(new ApiError(409, "SPOT_OCCUPIED", "The selected parking spot is already occupied."));
    if (e instanceof TicketStateError) return next(new ApiError(409, "TICKET_NOT_OPEN", e.message));
    next(e);
  }
});

router.delete("/:ticket_id", async (req, res, next) => {
  try {
    res.json(await ticketsQueryService.remove(parseInt(req.params.ticket_id, 10)));
  } catch (e) {
    next(e);
  }
});

router.post("/entry", async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>;
    const ticketId = await withTransaction(async (client) =>
      createTicketEntry(client, {
        vehicle_id: Number(b.vehicle_id),
        entry_time: b.entry_time ? new Date(String(b.entry_time)) : null,
        garage_id: Number(b.garage_id),
        spot_id: b.spot_id != null ? Number(b.spot_id) : null,
        rentable_only: Boolean(b.rentable_only ?? false),
        image_url: b.image_url != null ? String(b.image_url) : null
      })
    );
    const ticket = await ticketsQueryService.getFullById(ticketId);
    res.status(201).json(ticket);
  } catch (e) {
    if (e instanceof InvalidVehicleError) return next(new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle does not exist."));
    if (e instanceof InvalidSpotError) return next(new ApiError(404, "SPOT_NOT_FOUND", "Parking spot does not exist."));
    if (e instanceof SpotGarageMismatchError) return next(new ApiError(409, "SPOT_GARAGE_MISMATCH", "Selected parking spot does not belong to selected garage."));
    if (e instanceof SpotInactiveError) return next(new ApiError(409, "SPOT_INACTIVE", "Selected parking spot is inactive."));
    if (e instanceof SpotOccupiedError) return next(new ApiError(409, "SPOT_OCCUPIED", "The selected parking spot is already occupied."));
    if (e instanceof NoFreeSpotError) return next(new ApiError(409, "NO_FREE_SPOTS_AVAILABLE", "No free spots available for this garage."));
    if (e instanceof TicketPersistenceError || e instanceof TicketTokenRetryExceededError) {
      return next(new ApiError(500, "DATABASE_ERROR", "Ticket could not be saved.", { reason: e.constructor.name }));
    }
    next(e);
  }
});

router.post("/:ticket_id/exit", async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.ticket_id, 10);
    const b = req.body as { exit_time?: string };
    await withTransaction(async (client) => {
      await closeTicket(client, ticketId, { exit_time: b.exit_time ? new Date(b.exit_time) : null });
    });
    res.json(await ticketsQueryService.getFullById(ticketId));
  } catch (e) {
    if (e instanceof TicketNotFoundError) return next(new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found."));
    if (e instanceof TicketStateError) return next(new ApiError(409, "TICKET_ALREADY_CLOSED", "Ticket is not open."));
    next(e);
  }
});

export default router;
