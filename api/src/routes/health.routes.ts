import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/hello-world", (_req, res) => {
  res.json({
    message: "Hello, world!",
    status: "ok"
  });
});

export default healthRouter;
