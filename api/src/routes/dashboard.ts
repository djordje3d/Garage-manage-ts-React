import { Router } from "express";
import { query, pool } from "../config/db";
import {
  computeSpotTicketCounts,
  computeTotalOutstanding,
  countUnpaidAndPartial,
  sumPaymentsInRange
} from "../services/dashboardAnalytics";

const router = Router();

router.get("/analytics", async (req, res, next) => {
  try {
    const garage_id = req.query.garage_id ? parseInt(String(req.query.garage_id), 10) : null;
    const today = String(req.query.today ?? "");
    const month_from = String(req.query.month_from ?? "");
    const month_to = String(req.query.month_to ?? "");
    const gid = Number.isNaN(garage_id as number) ? null : garage_id;

    const [free_spots, occupied_spots, inactive_spots, open_tickets] =
      await computeSpotTicketCounts(pool, gid);
    const today_revenue = await sumPaymentsInRange(pool, gid, today, today);
    const month_revenue = await sumPaymentsInRange(pool, gid, month_from, month_to);
    const unpaid_partially_paid_count = await countUnpaidAndPartial(pool, gid);
    const total_outstanding = await computeTotalOutstanding(pool, gid);

    res.json({
      free_spots,
      occupied_spots,
      inactive_spots,
      open_tickets,
      today_revenue,
      month_revenue,
      unpaid_partially_paid_count,
      total_outstanding
    });
  } catch (e) {
    next(e);
  }
});

export default router;
