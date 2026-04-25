import app from "./app";
import { pool } from "./config/db";
import { env } from "./config/env";

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.port}`);
});

const shutdown = async (): Promise<void> => {
  await pool.end();
  server.close();
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
