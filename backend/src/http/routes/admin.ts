import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { getGameboard } from "../../db/gameboard.js";
import { createGame, deleteAllGames, GameError, listGames, startGame } from "../../db/games.js";
import { deletePlayer, listLobbyPlayers } from "../../db/users.js";
import { checkAdminCredentials, isAdminConfigured } from "../../services/adminAuth.js";
import { signAuthToken } from "../../services/jwt.js";
import { pickTurfNames } from "../../services/turfNames.js";
import { ADMIN_COOKIE, requireAdmin } from "../middleware/requireAuth.js";

const router = Router();

const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const ADMIN_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const loginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

router.post("/login", adminLoginRateLimit, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  if (!isAdminConfigured()) {
    res.status(503).json({ error: "Admin login is not configured on the server" });
    return;
  }
  if (!checkAdminCredentials(parsed.data.username, parsed.data.password)) {
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }

  const token = signAuthToken({ sub: "admin", username: "admin", role: "admin" });
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_COOKIE_MAX_AGE_MS,
  });
  res.json({ admin: true });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(ADMIN_COOKIE);
  res.status(204).end();
});

router.use(requireAdmin);

router.get("/me", (_req, res) => {
  res.json({ admin: true });
});

router.get("/players", async (_req, res, next) => {
  try {
    res.json({ players: await listLobbyPlayers(pool) });
  } catch (error) {
    next(error);
  }
});

router.delete("/players/:playerId", async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.playerId).success) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  try {
    const result = await deletePlayer(pool, req.params.playerId);
    if (result === "not_found") {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    if (result === "in_game") {
      res.status(409).json({ error: "Player is in a running game" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/games", async (_req, res, next) => {
  try {
    res.json({ games: await listGames(pool) });
  } catch (error) {
    next(error);
  }
});

const createGameSchema = z.object({
  maxPlayers: z.number().int().min(2).max(8),
});

router.post("/games", async (req, res, next) => {
  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "maxPlayers must be an integer between 2 and 8" });
    return;
  }
  try {
    res.status(201).json(await createGame(pool, parsed.data.maxPlayers));
  } catch (error) {
    next(error);
  }
});

router.delete("/games", async (req, res, next) => {
  const parsed = z.object({ confirmation: z.literal("DELETE_ALL_GAMES") }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Explicit confirmation is required" });
    return;
  }
  try {
    res.json({ deletedCount: await deleteAllGames(pool) });
  } catch (error) {
    next(error);
  }
});

router.get("/games/:gameId", async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.gameId).success) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  try {
    const board = await getGameboard(pool, req.params.gameId);
    if (!board) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    res.json(board);
  } catch (error) {
    next(error);
  }
});

router.post("/games/:gameId/start", async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.gameId).success) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  try {
    res.json(await startGame(pool, req.params.gameId, pickTurfNames(20)));
  } catch (error) {
    if (error instanceof GameError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
