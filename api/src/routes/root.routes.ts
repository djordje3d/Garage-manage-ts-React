import { Router } from "express";
import { query } from "../config/db";
import { buildErrorPayload } from "../errors";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Parking API", docs: "/docs" });
});

router.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json(
      buildErrorPayload("DATABASE_UNAVAILABLE", "Database unavailable.", null)
    );
  }
});

export default router;
