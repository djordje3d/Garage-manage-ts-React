import { Router } from "express";
import * as garagesService from "../services/garagesService";

const router = Router();

router.get("/overview", async (req, res, next) => {
  try {
    res.json(await garagesService.overview(req.query));
  } catch (e) {
    next(e);
  }
});

router.get("/", async (req, res, next) => {
  try {
    res.json(await garagesService.list(req.query));
  } catch (e) {
    next(e);
  }
});

router.get("/:garage_id", async (req, res, next) => {
  try {
    res.json(await garagesService.getById(parseInt(req.params.garage_id, 10)));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = await garagesService.create(req.body);
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

router.put("/:garage_id", async (req, res, next) => {
  try {
    res.json(await garagesService.replace(parseInt(req.params.garage_id, 10), req.body));
  } catch (e) {
    next(e);
  }
});

router.patch("/:garage_id", async (req, res, next) => {
  try {
    res.json(await garagesService.patch(parseInt(req.params.garage_id, 10), req.body));
  } catch (e) {
    next(e);
  }
});

router.delete("/:garage_id", async (req, res, next) => {
  try {
    res.json(await garagesService.remove(parseInt(req.params.garage_id, 10)));
  } catch (e) {
    next(e);
  }
});

export default router;
