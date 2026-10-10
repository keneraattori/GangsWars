import type { NextFunction, Request, Response } from "express";
import { pool } from "../../db/pool.js";
import { touchPlayer } from "../../db/users.js";
import { verifyAuthToken } from "../../services/jwt.js";

const AUTH_COOKIE = "gw_token";
const ADMIN_COOKIE = "gw_admin_token";

function readToken(req: Request, cookie: string) {
  const token = req.cookies?.[cookie];
  if (!token) return null;
  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}

// Players have no credentials: the cookie is issued when they enter their gang name.
export async function requirePlayer(req: Request, res: Response, next: NextFunction) {
  const payload = readToken(req, AUTH_COOKIE);
  if (!payload || payload.role === "admin") {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    // Also rejects players that were removed from the lobby.
    const player = await touchPlayer(pool, payload.sub);
    if (!player) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    req.userId = player.id;
    req.username = player.username;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const payload = readToken(req, ADMIN_COOKIE);
  if (!payload || payload.role !== "admin") {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

export { ADMIN_COOKIE, AUTH_COOKIE };
