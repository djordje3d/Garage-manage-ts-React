import { Router } from "express";
import * as dashboardService from "../services/dashboardService";

const router = Router();

router.get("/analytics", async (req, res, next) => {
  try {
    res.json(await dashboardService.getAnalytics(req.query));
  } catch (e) {
    next(e);
  }
});

export default router;
