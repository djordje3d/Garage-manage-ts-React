import fs from "fs";
import cors from "cors";
import express from "express";
import { env, corsOrigins } from "./config/env";
import rootRouter from "./routes/root";
import authRouter from "./routes/auth";
import garagesRouter from "./routes/garages";
import vehicleTypesRouter from "./routes/vehicleTypes";
import vehiclesRouter from "./routes/vehicles";
import spotsRouter from "./routes/spots";
import ticketsRouter from "./routes/tickets";
import paymentsRouter from "./routes/payments";
import dashboardRouter from "./routes/dashboard";
import uploadRouter from "./routes/upload";
import { apiKeyOrJwtMiddleware } from "./middleware/apiKeyAuth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

if (!env.corsDisabled) {
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: [...env.corsAllowMethods],
      allowedHeaders: env.corsAllowHeaders,
      maxAge: env.corsMaxAge
    })
  );
}
app.use(express.json({ limit: "1mb" }));
app.use(apiKeyOrJwtMiddleware);

fs.mkdirSync(env.uploadDir, { recursive: true });

app.use("/", rootRouter);
app.use("/auth", authRouter);
app.use("/garages", garagesRouter);
app.use("/vehicle-types", vehicleTypesRouter);
app.use("/vehicles", vehiclesRouter);
app.use("/spots", spotsRouter);
app.use("/tickets", ticketsRouter);
app.use("/payments", paymentsRouter);
app.use("/dashboard", dashboardRouter);
app.use("/upload", uploadRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
