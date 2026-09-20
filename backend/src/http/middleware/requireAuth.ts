import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../../services/jwt.js";

const AUTH_COOKIE = "gw_token";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    req.userId = payload.sub;
    req.username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
}

export { AUTH_COOKIE };
