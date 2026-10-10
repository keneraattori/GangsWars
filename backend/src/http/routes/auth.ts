import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { createPlayer, deletePlayer } from "../../db/users.js";
import { signAuthToken } from "../../services/jwt.js";
import { AUTH_COOKIE, requirePlayer } from "../middleware/requireAuth.js";

const router = Router();

const enterRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches JWT expiry

export const gangNameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} _'.!&-]*$/u, "Gang name contains unsupported characters");

const enterSchema = z.object({ name: gangNameSchema });

router.post("/enter", enterRateLimit, async (req, res, next) => {
  const parsed = enterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Gang name must be 3-30 letters, numbers, spaces, or _ ' . ! & -" });
    return;
  }

  try {
    const player = await createPlayer(pool, parsed.data.name);
    if (!player) {
      res.status(409).json({ error: "That gang name is already taken" });
      return;
    }
    const token = signAuthToken({ sub: player.id, username: player.username, role: "player" });
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE_MS,
    });
    res.status(201).json({ id: player.id, username: player.username });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "That gang name is already taken" });
      return;
    }
    next(error);
  }
});

router.post("/logout", requirePlayer, async (req, res, next) => {
  try {
    // Frees the gang name, unless the player is in a running game that still needs the gang.
    if (req.userId) await deletePlayer(pool, req.userId);
    res.clearCookie(AUTH_COOKIE);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/me", requirePlayer, (req, res) => {
  res.json({ id: req.userId, username: req.username });
});

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

export default router;
