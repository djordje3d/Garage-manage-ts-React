import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AccessTokenPayload = {
  sub: string;
  iat?: number;
  exp?: number;
};

export function createAccessToken(username: string): string {
  const expiresInSeconds = env.jwtExpireMinutes * 60;
  return jwt.sign({ sub: username }, env.jwtSecretKey, {
    algorithm: env.jwtAlgorithm,
    expiresIn: expiresInSeconds
  });
}

export function verifyAccessTokenOptional(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.jwtSecretKey, {
      algorithms: [env.jwtAlgorithm]
    }) as jwt.JwtPayload;
    if (!payload?.sub || typeof payload.sub !== "string") return null;
    return { sub: payload.sub, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const p = verifyAccessTokenOptional(token);
  if (!p) {
    const err = new Error("Invalid token");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  return p;
}
