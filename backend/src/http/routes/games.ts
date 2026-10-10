import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import {
  findCurrentGameForUser,
  GameError,
  getGameSummary,
  isGameMember,
  joinGame,
  listOpenGames,
} from '../../db/games.js';
import { createGang, findGangForUser } from '../../db/gangs.js';
import { getGameboard, getPublicGameboard } from '../../db/gameboard.js';
import {
  ActionError,
  getActionStatus,
  PHASE_ONE_ACTIONS,
  submitPhaseOneAction,
} from '../../db/phaseActions.js';
import { resolvePhaseOneForGame } from '../../db/phaseResolution.js';
import { submitPhaseTwoAction } from '../../db/phaseTwoActions.js';
import { resolvePhaseTwoForGame } from '../../db/phaseTwoResolution.js';
import { requirePlayer } from '../middleware/requireAuth.js';

const router = Router();

router.get('/public/:gameId', async (req, res, next) => {
  try {
    const board = await getPublicGameboard(pool, req.params.gameId);
    if (!board) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.json(board);
  } catch (error) {
    next(error);
  }
});

router.use(requirePlayer);

router.get('/open', async (_req, res, next) => {
  try {
    res.json({ games: await listOpenGames(pool) });
  } catch (error) {
    next(error);
  }
});

router.get('/mine', async (req, res, next) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    res.json({ game: await findCurrentGameForUser(pool, req.userId) });
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

const gangSchema = z.object({
  characterId: z.number().int().min(1).max(21),
});

router.post('/:gameId/gangs', async (req, res, next) => {
  const parsed = gangSchema.safeParse(req.body);
  if (!parsed.success || !req.userId || !req.username) {
    res.status(400).json({ error: 'Character selection is required' });
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
    res.status(201).json(await createGang(pool, req.params.gameId, req.userId, req.username, parsed.data.characterId));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: 'You already have a gang in this game, or the character is taken' });
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
