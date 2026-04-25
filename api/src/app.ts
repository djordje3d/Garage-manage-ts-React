import cors from "cors";
import express from "express";
import authRouter from "./routes/auth.routes";
import healthRouter from "./routes/health.routes";
import { requireAuth } from "./middleware/auth.middleware";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);

app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    message: "Authenticated request successful.",
    user: req.user
  });
});

export default app;
