import { Router } from "express";
import * as vehicleTypesService from "../services/vehicleTypesService";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    res.json(await vehicleTypesService.list(req.query));
  } catch (e) {
    next(e);
  }
});

router.get("/:vt_id", async (req, res, next) => {
  try {
    res.json(await vehicleTypesService.getById(parseInt(req.params.vt_id, 10)));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = await vehicleTypesService.create(req.body);
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

router.put("/:vt_id", async (req, res, next) => {
  try {
    res.json(
      await vehicleTypesService.update(parseInt(req.params.vt_id, 10), req.body)
    );
  } catch (e) {
    next(e);
  }
});

router.delete("/:vt_id", async (req, res, next) => {
  try {
    res.json(await vehicleTypesService.remove(parseInt(req.params.vt_id, 10)));
  } catch (e) {
    next(e);
  }
});

export default router;
