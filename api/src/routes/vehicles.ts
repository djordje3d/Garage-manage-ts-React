import { Router } from "express";
import * as vehiclesService from "../services/vehiclesService";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await vehiclesService.list(req.query));
  } catch (e) {
    next(e);
  }
});

router.get("/by-plate/:plate", async (req, res, next) => {
  try {
    res.json(await vehiclesService.getByPlate(req.params.plate));
  } catch (e) {
    next(e);
  }
});

router.get("/:vehicle_id", async (req, res, next) => {
  try {
    res.json(await vehiclesService.getById(parseInt(req.params.vehicle_id, 10)));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = await vehiclesService.create(req.body);
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

router.patch("/:vehicle_id", async (req, res, next) => {
  try {
    res.json(await vehiclesService.patch(parseInt(req.params.vehicle_id, 10), req.body));
  } catch (e) {
    next(e);
  }
});

router.delete("/:vehicle_id", async (req, res, next) => {
  try {
    res.json(await vehiclesService.remove(parseInt(req.params.vehicle_id, 10)));
  } catch (e) {
    next(e);
  }
});

export default router;
