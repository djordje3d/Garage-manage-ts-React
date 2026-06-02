import type { AccessTokenPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      /** Set by routes that require Bearer JWT (e.g. /auth/me). */
      bearerUser?: AccessTokenPayload;
    }
  }
}

export {};
