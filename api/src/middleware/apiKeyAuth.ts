import { NextFunction, Request, Response } from "express";
import { buildErrorPayload } from "../errors";
import { env } from "../config/env";
import { verifyAccessTokenOptional } from "../utils/jwt";

const API_KEY_HEADER = "x-api-key";

function isPublicPath(reqPath: string, method: string): boolean {
  if (reqPath === "/" && method === "GET") return true;
  if (reqPath === "/health" && method === "GET") return true;
  if (reqPath === "/auth/login" && method === "POST") return true;
  return false;
}

export function apiKeyOrJwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!env.apiKey) {
    next();
    return;
  }

  const path = req.path || req.url.split("?")[0];
  const method = req.method.toUpperCase();

  if (isPublicPath(path, method)) {
    next();
    return;
  }

  const auth = req.headers.authorization ?? req.headers.Authorization;
  if (auth && typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token && verifyAccessTokenOptional(token)) {
      next();
      return;
    }
  }

  const key =
    (req.headers[API_KEY_HEADER] as string | undefined) ??
    (req.headers["X-API-Key"] as string | undefined);
  if (key && key === env.apiKey) {
    next();
    return;
  }

  res.status(401).json(
    buildErrorPayload(
      "UNAUTHORIZED",
      "Invalid or missing authentication. Use Authorization: Bearer <token> or X-API-Key header.",
      null
    )
  );
}
