import type { Pool } from 'pg';

export const PHASE_ONE_ACTIONS = ['beef', 'buzinezz', 'show_off', 'attack'] as const;
export type PhaseOneAction = (typeof PHASE_ONE_ACTIONS)[number];

export interface ActionStatus {
  roundNumber: number;
  phase: 'phase1' | 'phase2';
  submittedCount: number;
  totalGangCount: number;
  hasSubmitted: boolean;
}

interface GameActionRow {
  status: 'lobby' | 'active' | 'finished';
  round_number: number;
  current_phase: 'phase1' | 'phase2';
}

export async function submitPhaseOneAction(
  pool: Pool,
  input: {
    gameId: string;
    userId: string;
    action: PhaseOneAction;
    targetGangId?: string;
  },
): Promise<ActionStatus> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const game = await client.query<GameActionRow>(
      `SELECT status, round_number, current_phase FROM games WHERE id = $1 FOR UPDATE`,
      [input.gameId],
    );
    if (!game.rows[0]) throw new ActionError('Game not found', 404);
    if (game.rows[0].status !== 'active') throw new ActionError('Game is not active', 409);
    if (game.rows[0].current_phase !== 'phase1') throw new ActionError('Phase 1 is not active', 409);

    const gang = await client.query<{ id: string }>(
      `SELECT ga.id FROM gangs ga
       JOIN game_members gm ON gm.game_id = ga.game_id AND gm.user_id = ga.user_id
       WHERE ga.game_id = $1 AND ga.user_id = $2`,
      [input.gameId, input.userId],
    );
    if (!gang.rows[0]) throw new ActionError('Create a gang before selecting an action', 403);

    const existing = await client.query(
      `SELECT 1 FROM phase_actions
       WHERE game_id = $1 AND round_number = $2 AND phase = 'phase1' AND gang_id = $3`,
      [input.gameId, game.rows[0].round_number, gang.rows[0].id],
    );
    if (existing.rowCount) throw new ActionError('You already selected an action for this phase', 409);

    if (input.action === 'beef' || input.action === 'attack') {
      if (!input.targetGangId || input.targetGangId === gang.rows[0].id) {
        throw new ActionError('Select another gang as the target', 400);
      }
      const target = await client.query(
        `SELECT 1 FROM gangs WHERE id = $1 AND game_id = $2`,
        [input.targetGangId, input.gameId],
      );
      if (!target.rowCount) throw new ActionError('Target gang is not in this game', 400);
    } else if (input.targetGangId) {
      throw new ActionError('This action does not accept a target', 400);
    }

    await client.query(
      `INSERT INTO phase_actions (game_id, round_number, phase, gang_id, action, target_gang_id)
       VALUES ($1, $2, 'phase1', $3, $4, $5)`,
      [input.gameId, game.rows[0].round_number, gang.rows[0].id, input.action, input.targetGangId ?? null],
    );
    await client.query('COMMIT');
    return getActionStatus(pool, input.gameId, input.userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getActionStatus(pool: Pool, gameId: string, userId: string): Promise<ActionStatus> {
  const result = await pool.query<{
    round_number: number;
    current_phase: 'phase1' | 'phase2';
    submitted_count: string;
    total_gang_count: string;
    has_submitted: boolean;
  }>(
    `SELECT g.round_number, g.current_phase,
      (SELECT COUNT(*) FROM phase_actions pa
       WHERE pa.game_id = g.id AND pa.round_number = g.round_number AND pa.phase = g.current_phase)::text AS submitted_count,
      (SELECT COUNT(*) FROM gangs ga WHERE ga.game_id = g.id)::text AS total_gang_count,
      EXISTS (
        SELECT 1 FROM phase_actions pa
        JOIN gangs ga ON ga.id = pa.gang_id
        WHERE pa.game_id = g.id AND pa.round_number = g.round_number
          AND pa.phase = g.current_phase AND ga.user_id = $2
      ) AS has_submitted
     FROM games g WHERE g.id = $1`,
    [gameId, userId],
  );
  if (!result.rows[0]) throw new ActionError('Game not found', 404);
  return {
    roundNumber: result.rows[0].round_number,
    phase: result.rows[0].current_phase,
    submittedCount: Number(result.rows[0].submitted_count),
    totalGangCount: Number(result.rows[0].total_gang_count),
    hasSubmitted: result.rows[0].has_submitted,
  };
}

export class ActionError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
  }
}
