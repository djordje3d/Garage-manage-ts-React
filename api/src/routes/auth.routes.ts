import bcrypt from "bcryptjs";
import { Request, Router } from "express";
import { env } from "../config/env";
import { ApiError, buildErrorPayload } from "../errors";
import { createAccessToken, verifyAccessTokenOptional } from "../utils/jwt";

const router = Router();

function verifyPasswordPlain(plain: string): boolean {
  if (env.authPasswordHash) {
    try {
      return bcrypt.compareSync(plain, env.authPasswordHash);
    } catch {
      return false;
    }
  }
  if (env.authPassword != null) {
    return plain === env.authPassword;
  }
  return false;
}

function requireBearer(req: Request) {
  const auth = req.headers.authorization ?? req.headers.Authorization;
  if (!auth || typeof auth !== "string" || !auth.toLowerCase().startsWith("bearer ")) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Invalid or missing token. Use Authorization: Bearer <token> or X-API-Key.",
      null
    );
  }
  const token = auth.slice(7).trim();
  const payload = verifyAccessTokenOptional(token);
  if (!payload) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Invalid or missing token. Use Authorization: Bearer <token> or X-API-Key.",
      null
    );
  }
  return payload;
}

router.post("/login", (req, res, next) => {
  try {
    const body = req.body as { username?: string; password?: string };
    if (!env.authUsername) {
      res.status(503).json(
        buildErrorPayload(
          "AUTH_NOT_CONFIGURED",
          "Login not configured. Set AUTH_USERNAME and AUTH_PASSWORD (or AUTH_PASSWORD_HASH) in .env.",
          null
        )
      );
      return;
    }
    if (!body.username || !body.password) {
      res.status(422).json(
        buildErrorPayload("VALIDATION_ERROR", "Request validation failed.", {
          fields: [
            { field: "username", message: "Required" },
            { field: "password", message: "Required" }
          ]
        })
      );
      return;
    }
    if (body.username !== env.authUsername || !verifyPasswordPlain(body.password)) {
      res.status(401).json(
        buildErrorPayload("INVALID_CREDENTIALS", "Invalid username or password.", null)
      );
      return;
    }
    const access_token = createAccessToken(body.username);
    res.json({
      access_token,
      token_type: "bearer",
      expires_in: env.jwtExpireMinutes * 60,
      preferred_language: env.authPreferredLanguage
    });
  } catch (e) {
    next(e);
  }
});

router.get("/me", (req, res, next) => {
  try {
    const user = requireBearer(req);
    res.json({ sub: user.sub, preferred_language: env.authPreferredLanguage });
  } catch (e) {
    next(e);
  }
});

router.post("/refresh", (req, res, next) => {
  try {
    const user = requireBearer(req);
    const access_token = createAccessToken(user.sub);
    res.json({
      access_token,
      token_type: "bearer",
      expires_in: env.jwtExpireMinutes * 60
    });
  } catch (e) {
    next(e);
  }
});

export default router;
