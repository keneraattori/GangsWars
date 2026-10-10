import type { Pool } from 'pg';
import { ActionError, getActionStatus, type PhaseTwoAction } from './phaseActions.js';
import { PHASE_TWO_RECRUIT_COST } from '../services/phaseTwoResolution.js';

interface GameRow {
  status: 'lobby' | 'active' | 'finished';
  round_number: number;
  current_phase: 'phase1' | 'phase2';
}

export async function submitPhaseTwoAction(
  pool: Pool,
  input: {
    gameId: string;
    userId: string;
    action: PhaseTwoAction;
    targetTurfId?: string;
  },
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const game = await client.query<GameRow>(
      `SELECT status, round_number, current_phase FROM games WHERE id = $1 FOR UPDATE`,
      [input.gameId],
    );
    if (!game.rows[0]) throw new ActionError('Game not found', 404);
    if (game.rows[0].status !== 'active') throw new ActionError('Game is not active', 409);
    if (game.rows[0].current_phase !== 'phase2') throw new ActionError('Phase 2 is not active', 409);

    const gang = await client.query<{ id: string; money: number }>(
      `SELECT ga.id, ga.money FROM gangs ga
       JOIN game_members gm ON gm.game_id = ga.game_id AND gm.user_id = ga.user_id
       WHERE ga.game_id = $1 AND ga.user_id = $2`,
      [input.gameId, input.userId],
    );
    if (!gang.rows[0]) throw new ActionError('Create a gang before selecting an action', 403);
    if (input.action === 'recruit' && gang.rows[0].money < PHASE_TWO_RECRUIT_COST) {
      throw new ActionError('Recruit requires at least $3,000', 400);
    }

    const existing = await client.query(
      `SELECT 1 FROM phase_actions
       WHERE game_id = $1 AND round_number = $2 AND phase = 'phase2' AND gang_id = $3`,
      [input.gameId, game.rows[0].round_number, gang.rows[0].id],
    );
    if (existing.rowCount) throw new ActionError('You already selected an action for this phase', 409);

    if (input.action === 'expand') {
      if (!input.targetTurfId) throw new ActionError('Select a Turf to expand into', 400);
      const target = await client.query<{ owner_gang_id: string | null }>(
        `SELECT owner_gang_id FROM turfs WHERE id = $1 AND game_id = $2`,
        [input.targetTurfId, input.gameId],
      );
      if (!target.rows[0]) throw new ActionError('Target Turf is not in this game', 400);
      if (target.rows[0].owner_gang_id === gang.rows[0].id) {
        throw new ActionError('You cannot expand into your own Turf', 400);
      }
    } else if (input.targetTurfId) {
      throw new ActionError('This action does not accept a Turf target', 400);
    }

    await client.query(
      `INSERT INTO phase_actions (game_id, round_number, phase, gang_id, action, target_turf_id)
       VALUES ($1, $2, 'phase2', $3, $4, $5)`,
      [input.gameId, game.rows[0].round_number, gang.rows[0].id, input.action, input.targetTurfId ?? null],
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
