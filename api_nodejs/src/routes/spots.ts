import { Router } from "express";
import * as spotsService from "../services/spotsService";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await spotsService.list(req.query));
  } catch (e) {
    next(e);
  }
});

router.patch("/:spot_id/activate", async (req, res, next) => {
  try {
    res.json(await spotsService.activate(parseInt(req.params.spot_id, 10)));
  } catch (e) {
    next(e);
  }
});

router.get("/:spot_id", async (req, res, next) => {
  try {
    res.json(await spotsService.getById(parseInt(req.params.spot_id, 10)));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = await spotsService.create(req.body);
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

router.patch("/:spot_id", async (req, res, next) => {
  try {
    res.json(await spotsService.patch(parseInt(req.params.spot_id, 10), req.body));
  } catch (e) {
    next(e);
  }
});

router.delete("/:spot_id", async (req, res, next) => {
  try {
    res.json(await spotsService.deactivate(parseInt(req.params.spot_id, 10)));
  } catch (e) {
    next(e);
  }
});

export default router;
