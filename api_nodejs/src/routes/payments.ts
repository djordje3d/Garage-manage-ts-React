import { Router } from "express";
import * as paymentsService from "../services/paymentsService";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await paymentsService.list(req.query));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = await paymentsService.create(req.body);
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

router.get("/outstanding", async (req, res, next) => {
  try {
    res.json(await paymentsService.getOutstanding(req.query));
  } catch (e) {
    next(e);
  }
});

router.get("/by-ticket/:ticket_id", async (req, res, next) => {
  try {
    res.json(
      await paymentsService.listByTicket(parseInt(req.params.ticket_id, 10), req.query)
    );
  } catch (e) {
    next(e);
  }
});

router.get("/:payment_id", async (req, res, next) => {
  try {
    res.json(await paymentsService.getById(parseInt(req.params.payment_id, 10)));
  } catch (e) {
    next(e);
  }
});

router.put("/:payment_id", async (req, res, next) => {
  try {
    res.json(await paymentsService.update(parseInt(req.params.payment_id, 10), req.body));
  } catch (e) {
    next(e);
  }
});

router.delete("/:payment_id", async (req, res, next) => {
  try {
    res.json(await paymentsService.remove(parseInt(req.params.payment_id, 10)));
  } catch (e) {
    next(e);
  }
});

export default router;
