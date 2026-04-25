import fs from "fs";
import cors from "cors";
import express from "express";
import path from "path";
import { env, corsOrigins } from "./config/env";
import rootRouter from "./routes/root.routes";
import authRouter from "./routes/auth.routes";
import garagesRouter from "./routes/garages.routes";
import vehicleTypesRouter from "./routes/vehicleTypes.routes";
import vehiclesRouter from "./routes/vehicles.routes";
import spotsRouter from "./routes/spots.routes";
import ticketsRouter from "./routes/tickets.routes";
import paymentsRouter from "./routes/payments.routes";
import dashboardRouter from "./routes/dashboard.routes";
import uploadRouter from "./routes/upload.routes";
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
app.use("/uploads", express.static(path.resolve(env.uploadDir)));

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
