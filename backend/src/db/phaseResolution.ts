import type { Pool } from 'pg';
import { resolvePhase1, type RandomInt } from '../services/phaseResolution.js';
import { ActionError } from './phaseActions.js';

interface GameRow {
  status: 'lobby' | 'active' | 'finished';
  round_number: number;
  current_phase: 'phase1' | 'phase2';
}

interface GangRow {
  id: string;
  members: number;
}

interface ActionRow {
  id: string;
  gang_id: string;
  action: 'beef' | 'buzinezz' | 'show_off' | 'attack' | 'skip';
  target_gang_id: string | null;
}

export interface PhaseResolutionSummary {
  roundNumber: number;
  actionCount: number;
  memberDeltas: Record<string, number>;
}

export async function resolvePhaseOneForGame(
  pool: Pool,
  gameId: string,
  randomInt?: RandomInt,
): Promise<PhaseResolutionSummary> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gameResult = await client.query<GameRow>(
      `SELECT status, round_number, current_phase FROM games WHERE id = $1 FOR UPDATE`,
      [gameId],
    );
    if (!gameResult.rows[0]) throw new ActionError('Game not found', 404);
    const game = gameResult.rows[0];
    if (game.status !== 'active' || game.current_phase !== 'phase1') {
      throw new ActionError('Phase 1 is not active', 409);
    }

    const gangsResult = await client.query<GangRow>(
      `SELECT id, members FROM gangs WHERE game_id = $1`,
      [gameId],
    );
    const actionsResult = await client.query<ActionRow>(
      `SELECT id, gang_id, action, target_gang_id
       FROM phase_actions
       WHERE game_id = $1 AND round_number = $2 AND phase = 'phase1'
       ORDER BY submitted_at ASC, id ASC`,
      [gameId, game.round_number],
    );
    if (actionsResult.rowCount !== gangsResult.rowCount) {
      throw new ActionError('Not every gang has selected a Phase 1 action', 409);
    }

    const resolution = resolvePhase1(
      actionsResult.rows.map((action) => ({
        id: action.id,
        gangId: action.gang_id,
        action: action.action,
        targetGangId: action.target_gang_id,
      })),
      gangsResult.rows,
      randomInt,
    );

    for (const [gangId, delta] of Object.entries(resolution.memberDeltas)) {
      await client.query(`UPDATE gangs SET members = members + $1 WHERE id = $2`, [delta, gangId]);
    }
    for (const result of resolution.actionResults) {
      await client.query(
        `INSERT INTO action_results (phase_action_id, roll_result, outcome)
         VALUES ($1, $2, $3)`,
        [result.phaseActionId, result.rollResult, result.outcome],
      );
    }
    await client.query(
      `UPDATE games
       SET current_phase = 'phase2', phase_deadline = now() + interval '10 minutes'
       WHERE id = $1`,
      [gameId],
    );
    await client.query('COMMIT');
    return {
      roundNumber: game.round_number,
      actionCount: resolution.actionResults.length,
      memberDeltas: resolution.memberDeltas,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
