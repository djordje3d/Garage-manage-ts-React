import dotenv from "dotenv";
import path from "path";

dotenv.config();

function envInt(name: string, defaultValue: number): number {
  const raw = (process.env[name] ?? String(defaultValue)).trim();
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return defaultValue;
  return Math.max(0, n);
}

function envBool(name: string, defaultValue = false): boolean {
  const v = (process.env[name] ?? (defaultValue ? "true" : "false")).toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function isValidCorsOrigin(origin: string): boolean {
  if (!origin || origin.includes(" ") || origin.includes("*")) return false;
  if (!origin.startsWith("http://") && !origin.startsWith("https://")) return false;
  const afterScheme = origin.split("://", 2)[1] ?? "";
  if (afterScheme.includes("/")) return false;
  return true;
}

function normalizeCorsOrigins(raw: string): { valid: string[]; invalid: string[] } {
  const entries = raw.split(",").map((o) => o.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const o of entries) {
    const normalized = o.replace(/\/$/, "");
    if (!isValidCorsOrigin(normalized)) {
      invalid.push(o);
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      valid.push(normalized);
    }
  }
  return { valid, invalid };
}

const isProduction =
  ["production", "prod"].includes((process.env.ENVIRONMENT ?? "").toLowerCase()) ||
  ["production", "prod"].includes((process.env.ENV ?? "").toLowerCase());

const corsDisabled = envBool("CORS_DISABLED", false);
const corsRaw = (process.env.CORS_ORIGINS ?? "").trim();
const { valid: corsValid, invalid: corsInvalid } = normalizeCorsOrigins(corsRaw);

if (corsInvalid.length > 0) {
  for (const inv of corsInvalid) {
    // eslint-disable-next-line no-console
    console.warn(`CORS: invalid origin skipped (use http:// or https://, no path): ${JSON.stringify(inv)}`);
  }
}

if (isProduction && !corsDisabled && !corsRaw) {
  throw new Error(
    "In production, CORS_ORIGINS must be set to your frontend origin(s). " +
      "Set ENVIRONMENT=production only when CORS_ORIGINS is set, or set CORS_DISABLED=true."
  );
}

if (isProduction && corsInvalid.length > 0) {
  throw new Error(
    "CORS_ORIGINS has invalid entries in production; fix or remove them: " +
      corsInvalid.map((e) => JSON.stringify(e)).join(", ")
  );
}

const defaultCorsOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173"
];

export const corsOrigins = corsValid.length > 0 ? corsValid : defaultCorsOrigins;

const projectRoot = path.resolve(__dirname, "..", "..");
const defaultUploadDir = path.join(projectRoot, "static", "uploads");

export const env = {
  port: envInt("PORT", 4000),
  databaseUrl:
    process.env.DATABASE_URL?.trim() ||
    "postgres://postgres:postgres@localhost:5432/garaza",
  dbConnectTimeoutSeconds: envInt("DB_CONNECT_TIMEOUT", 5),

  apiKey: process.env.API_KEY?.trim() || null,

  jwtSecretKey: process.env.JWT_SECRET_KEY ?? process.env.JWT_SECRET ?? "change-me-in-production",
  jwtAlgorithm: (process.env.JWT_ALGORITHM ?? "HS256") as "HS256",
  jwtExpireMinutes: envInt("JWT_EXPIRE_MINUTES", 60 * 24),

  authUsername: process.env.AUTH_USERNAME?.trim() || null,
  authPassword: process.env.AUTH_PASSWORD ?? null,
  authPasswordHash: process.env.AUTH_PASSWORD_HASH?.trim() || null,
  authPreferredLanguage: process.env.AUTH_PREFERRED_LANGUAGE?.trim() || "en",

  useApiFeeCalculation: envBool("USE_API_FEE_CALCULATION", false),
  useApiPaymentStatus: envBool("USE_API_PAYMENT_STATUS", false),

  corsDisabled,
  corsMaxAge: envInt("CORS_MAX_AGE", 600),
  corsAllowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const,
  corsAllowHeaders: ["Content-Type", "Accept", "Authorization", "X-API-Key"],

  uploadDir: process.env.UPLOAD_DIR?.trim() || defaultUploadDir,
  uploadTicketImageMaxBytes: envInt("UPLOAD_TICKET_IMAGE_MAX_BYTES", 5 * 1024 * 1024),

  isProduction
};
