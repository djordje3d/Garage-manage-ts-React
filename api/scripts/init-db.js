const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const sql = fs.readFileSync(path.resolve(__dirname, "../db/schema.sql"), "utf8");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initDb() {
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log("Database initialized.");
  await pool.end();
}

initDb().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Database initialization failed:", error);
  await pool.end();
  process.exit(1);
});
