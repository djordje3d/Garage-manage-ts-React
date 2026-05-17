import { pool } from "../config/db";
import { parseOptionalInt } from "../utils/queryParams";
import {
  computeSpotTicketCounts,
  computeTotalOutstanding,
  countUnpaidAndPartial,
  sumPaymentsInRange
} from "./dashboardAnalytics";

export async function getAnalytics(query: {
  garage_id?: unknown;
  today?: unknown;
  month_from?: unknown;
  month_to?: unknown;
}) {
  const garage_id = parseOptionalInt(query.garage_id);
  const today = String(query.today ?? "");
  const month_from = String(query.month_from ?? "");
  const month_to = String(query.month_to ?? "");

  const [free_spots, occupied_spots, inactive_spots, open_tickets] =
    await computeSpotTicketCounts(pool, garage_id);
  const today_revenue = await sumPaymentsInRange(pool, garage_id, today, today);
  const month_revenue = await sumPaymentsInRange(pool, garage_id, month_from, month_to);
  const unpaid_partially_paid_count = await countUnpaidAndPartial(pool, garage_id);
  const total_outstanding = await computeTotalOutstanding(pool, garage_id);

  return {
    free_spots,
    occupied_spots,
    inactive_spots,
    open_tickets,
    today_revenue,
    month_revenue,
    unpaid_partially_paid_count,
    total_outstanding
  };
}
