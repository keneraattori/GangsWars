import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { createUser, findUserByUsername } from "../../db/users.js";
import { hashPassword, verifyPassword } from "../../services/password.js";
import { signAuthToken } from "../../services/jwt.js";
import { AUTH_COOKIE, requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches JWT expiry

function setAuthCookie(res: import("express").Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "username may only contain letters, numbers, and underscores"),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  password: z.string().min(8).max(200),
});

router.post("/register", authRateLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { username, email, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    const user = await createUser(pool, { username, email: email || null, passwordHash });
    const token = signAuthToken({ sub: user.id, username: user.username });
    setAuthCookie(res, token);
    res.status(201).json({ id: user.id, username: user.username });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "Username or email already in use" });
      return;
    }
    throw err;
  }
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", authRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { username, password } = parsed.data;

  const user = await findUserByUsername(pool, username);
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !passwordOk) {
    // Same message for "no such user" and "wrong password" to avoid user enumeration.
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = signAuthToken({ sub: user.id, username: user.username });
  setAuthCookie(res, token);
  res.json({ id: user.id, username: user.username });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ id: req.userId, username: req.username });
});

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

export default router;
