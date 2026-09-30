import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import {
  createGame,
  deleteAllGames,
  GameError,
  getGameSummary,
  isGameMember,
  joinGame,
  listOpenGames,
  startGame,
} from '../../db/games.js';
import { createGang, findGangForUser } from '../../db/gangs.js';
import { getGameboard } from '../../db/gameboard.js';
import {
  ActionError,
  getActionStatus,
  PHASE_ONE_ACTIONS,
  submitPhaseOneAction,
} from '../../db/phaseActions.js';
import { resolvePhaseOneForGame } from '../../db/phaseResolution.js';
import { submitPhaseTwoAction } from '../../db/phaseTwoActions.js';
import { resolvePhaseTwoForGame } from '../../db/phaseTwoResolution.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { pickTurfNames } from '../../services/turfNames.js';

const router = Router();
router.use(requireAuth);

const maxPlayersSchema = z.object({
  maxPlayers: z.number().int().min(2).max(8),
});

router.get('/open', async (_req, res, next) => {
  try {
    res.json({ games: await listOpenGames(pool) });
  } catch (error) {
    next(error);
  }
});

router.delete('/all', async (req, res, next) => {
  const confirmationSchema = z.object({ confirmation: z.literal('DELETE_ALL_GAMES') });
  const parsed = confirmationSchema.safeParse(req.body);
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: 'Explicit confirmation is required' });
    return;
  }
  try {
    const deletedCount = await deleteAllGames(pool);
    res.json({ deletedCount });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const parsed = maxPlayersSchema.safeParse(req.body);
  if (!parsed.success || !req.userId) {
    res.status(400).json({ error: 'maxPlayers must be an integer between 2 and 8' });
    return;
  }
  try {
    res.status(201).json(await createGame(pool, req.userId, parsed.data.maxPlayers));
  } catch (error) {
    next(error);
  }
});

router.post('/:gameId/join', async (req, res, next) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    res.json(await joinGame(pool, req.params.gameId, req.userId));
  } catch (error) {
    handleGameError(error, res, next);
  }
});

router.get('/:gameId', async (req, res, next) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    if (!(await isGameMember(pool, req.params.gameId, req.userId))) {
      res.status(403).json({ error: 'Join the game to view it' });
      return;
    }
    const board = await getGameboard(pool, req.params.gameId);
    if (!board) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.json(board);
  } catch (error) {
    next(error);
  }
});

router.post('/:gameId/start', async (req, res, next) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const turfNames = pickTurfNames(20);
    res.json(await startGame(pool, req.params.gameId, req.userId, turfNames));
  } catch (error) {
    handleGameError(error, res, next);
  }
});

const phaseOneActionSchema = z.object({
  action: z.enum(PHASE_ONE_ACTIONS),
  targetGangId: z.string().uuid().optional(),
});
const phaseTwoActionSchema = z.object({
  action: z.enum(['earn', 'expand', 'recruit', 'protect']),
  targetTurfId: z.string().uuid().optional(),
});

router.post('/:gameId/actions', async (req, res, next) => {
  if (!req.userId) {
    res.status(400).json({ error: 'Invalid Phase 1 action' });
    return;
  }
  try {
    const phaseTwoParsed = phaseTwoActionSchema.safeParse(req.body);
    const phaseOneParsed = phaseOneActionSchema.safeParse(req.body);
    let status;
    if (phaseTwoParsed.success) {
      status = await submitPhaseTwoAction(pool, {
        gameId: req.params.gameId,
        userId: req.userId,
        ...phaseTwoParsed.data,
      });
    } else if (phaseOneParsed.success) {
      status = await submitPhaseOneAction(pool, {
        gameId: req.params.gameId,
        userId: req.userId,
        ...phaseOneParsed.data,
      });
    } else {
      res.status(400).json({ error: 'Invalid phase action' });
      return;
    }
    let resolved = false;
    if (status.submittedCount === status.totalGangCount && status.totalGangCount > 0) {
      if (status.phase === 'phase1') await resolvePhaseOneForGame(pool, req.params.gameId);
      else await resolvePhaseTwoForGame(pool, req.params.gameId);
      status = await getActionStatus(pool, req.params.gameId, req.userId);
      resolved = true;
    }
    res.status(202).json({ accepted: true, resolved, status });
  } catch (error) {
    handleActionError(error, res, next);
  }
});

router.get('/:gameId/actions/status', async (req, res, next) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    if (!(await isGameMember(pool, req.params.gameId, req.userId))) {
      res.status(403).json({ error: 'Join the game to view action status' });
      return;
    }
    res.json(await getActionStatus(pool, req.params.gameId, req.userId));
  } catch (error) {
    handleActionError(error, res, next);
  }
});

const gangNameSchema = z.object({
  name: z.string().trim().min(3).max(30),
});

router.post('/:gameId/gangs', async (req, res, next) => {
  const parsed = gangNameSchema.safeParse(req.body);
  if (!parsed.success || !req.userId) {
    res.status(400).json({ error: 'Gang name must be between 3 and 30 characters' });
    return;
  }
  try {
    const member = await isGameMember(pool, req.params.gameId, req.userId);
    if (!member) {
      res.status(403).json({ error: 'Join the game before creating a gang' });
      return;
    }
    const game = await getGameSummary(pool, req.params.gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    if (game.status !== 'lobby') {
      res.status(409).json({ error: 'Gang creation is closed for this game' });
      return;
    }
    res.status(201).json(await createGang(pool, req.params.gameId, req.userId, parsed.data.name));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: 'You already have a gang, or that gang name is taken' });
      return;
    }
    next(error);
  }
});

router.get('/:gameId/me', async (req, res, next) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const gang = await findGangForUser(pool, req.params.gameId, req.userId);
    if (!gang) {
      res.status(404).json({ error: 'Gang not found' });
      return;
    }
    res.json(gang);
  } catch (error) {
    next(error);
  }
});

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function handleGameError(error: unknown, res: import('express').Response, next: import('express').NextFunction) {
  if (error instanceof GameError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}

function handleActionError(error: unknown, res: import('express').Response, next: import('express').NextFunction) {
  if (error instanceof ActionError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}

export default router;
