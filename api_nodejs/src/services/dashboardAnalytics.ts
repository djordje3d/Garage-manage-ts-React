import { calculateFeeSync } from "./pricing";
import type { Queryable } from "../repositories/types";
import * as dashRepo from "../repositories/dashboardRepository";

export async function computeSpotTicketCounts(
  db: Queryable,
  garageId: number | null
): Promise<[number, number, number, number]> {
  const [totalAllN, totalActiveN, freeN, openTickets] = await Promise.all([
    dashRepo.countAllSpots(db, garageId),
    dashRepo.countActiveSpots(db, garageId),
    dashRepo.countFreeSpots(db, garageId),
    dashRepo.countOpenTickets(db, garageId)
  ]);

  const inactive = Math.max(0, totalAllN - totalActiveN);
  const occupied = Math.max(0, totalActiveN - freeN);

  return [freeN, occupied, inactive, openTickets];
}

function dateBoundsUtc(fromDate: string, toInclusive: string): { start: Date; endExclusive: Date } {
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toInclusive}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, endExclusive: end };
}

export async function sumPaymentsInRange(
  db: Queryable,
  garageId: number | null,
  fromDate: string,
  toDateInclusive: string
): Promise<number> {
  const { start, endExclusive } = dateBoundsUtc(fromDate, toDateInclusive);
  return dashRepo.sumPaymentsInRange(db, garageId, start, endExclusive);
}

export async function countUnpaidAndPartial(
  db: Queryable,
  garageId: number | null
): Promise<number> {
  return dashRepo.countUnpaidAndPartial(db, garageId);
}

export async function computeTotalOutstanding(
  db: Queryable,
  garageId: number | null
): Promise<number> {
  const rows = await dashRepo.listOutstandingTickets(db, garageId);
  let total = 0;
  for (const t of rows) {
    let fee: number;
    if (t.entry_time && t.exit_time) {
      const vtRate = t.vt_rate != null ? parseFloat(t.vt_rate) : null;
      const gRate = t.g_default_rate != null ? parseFloat(t.g_default_rate) : null;
      fee = calculateFeeSync({
        entry_time: t.entry_time,
        exit_time: t.exit_time,
        vehicleTypeRate: vtRate,
        garageDefaultRate: gRate
      });
    } else {
      fee = t.fee != null ? parseFloat(t.fee) : 0;
    }
    const paid = await dashRepo.sumPaymentsByTicket(db, t.id);
    total += fee - paid;
  }
  return Math.max(0, total);
}

export async function batchPaymentTotalsByTicket(
  db: Queryable,
  ticketIds: number[]
): Promise<Map<number, number>> {
  return dashRepo.batchPaymentTotalsByTicket(db, ticketIds);
}

export function computeRestToPayForTicket(params: {
  ticket_state: string;
  payment_status: string;
  entry_time: Date | null;
  exit_time: Date | null;
  fee: string | null;
  vt_rate: string | null;
  g_default_rate: string | null;
  paid: number;
}): number {
  if (params.ticket_state === "OPEN" || params.payment_status === "PAID") return 0;
  let fee: number;
  if (params.entry_time && params.exit_time) {
    const vtRate = params.vt_rate != null ? parseFloat(params.vt_rate) : null;
    const gRate = params.g_default_rate != null ? parseFloat(params.g_default_rate) : null;
    fee = calculateFeeSync({
      entry_time: params.entry_time,
      exit_time: params.exit_time,
      vehicleTypeRate: vtRate,
      garageDefaultRate: gRate
    });
  } else {
    fee = params.fee != null ? parseFloat(params.fee) : 0;
  }
  return Math.max(0, fee - params.paid);
}
