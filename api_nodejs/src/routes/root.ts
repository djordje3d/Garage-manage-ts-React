import { Router } from "express";
import { buildErrorPayload } from "../errors";
import * as healthService from "../services/healthService";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Parking API", docs: "/docs" });
});

router.get("/health", async (_req, res) => {
  try {
    res.json(await healthService.checkHealth());
  } catch {
    res.status(503).json(
      buildErrorPayload("DATABASE_UNAVAILABLE", "Database unavailable.", null)
    );
  }
});

export default router;
