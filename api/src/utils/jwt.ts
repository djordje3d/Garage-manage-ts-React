import jwt from "jsonwebtoken";
import { env } from "../config/env";

type TokenPayload = {
  sub: string;
  username: string;
};

export const signAccessToken = (payload: TokenPayload): string => {
  const expiresIn = env.jwtExpiresIn as jwt.SignOptions["expiresIn"];

  return jwt.sign(payload, env.jwtSecret, {
    expiresIn
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
};
