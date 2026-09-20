import jwt from "jsonwebtoken";

export interface AuthTokenPayload {
  sub: string; // user id
  username: string;
}

const EXPIRES_IN = "7d";

function requireSecret(secret?: string): string {
  const value = secret ?? process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET is not set");
  }
  return value;
}

export function signAuthToken(payload: AuthTokenPayload, secret?: string): string {
  return jwt.sign(payload, requireSecret(secret), { expiresIn: EXPIRES_IN });
}

export function verifyAuthToken(token: string, secret?: string): AuthTokenPayload {
  return jwt.verify(token, requireSecret(secret)) as AuthTokenPayload;
}
