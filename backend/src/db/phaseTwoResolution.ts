import type { Pool } from 'pg';
import { resolvePhase2, type PhaseTwoRandom } from '../services/phaseTwoResolution.js';
import { getActiveProtectedGangIds } from '../services/protectDuration.js';
import { ActionError } from './phaseActions.js';

interface GameRow {
  status: 'lobby' | 'active' | 'finished';
  round_number: number;
  current_phase: 'phase1' | 'phase2';
}

interface GangRow {
  id: string;
  members: number;
  money: number;
}

interface TurfRow {
  id: string;
  owner_gang_id: string | null;
}

interface PhaseTwoActionRow {
  id: string;
  gang_id: string;
  action: 'earn' | 'expand' | 'recruit' | 'protect' | 'skip';
  target_turf_id: string | null;
}

interface PhaseOneBonusRow {
  gang_id: string;
  action: 'beef' | 'buzinezz' | 'show_off';
  target_gang_id: string | null;
}

interface ProtectActionRow {
  gang_id: string;
  round_number: number;
}

export interface PhaseTwoResolutionSummary {
  roundNumber: number;
  actionCount: number;
  nextRoundNumber: number;
  moneyDeltas: Record<string, number>;
  memberDeltas: Record<string, number>;
  winnerGangId: string | null;
}

export async function resolvePhaseTwoForGame(
  pool: Pool,
  gameId: string,
  random?: PhaseTwoRandom,
): Promise<PhaseTwoResolutionSummary> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gameResult = await client.query<GameRow>(
      `SELECT status, round_number, current_phase FROM games WHERE id = $1 FOR UPDATE`,
      [gameId],
    );
    if (!gameResult.rows[0]) throw new ActionError('Game not found', 404);
    const game = gameResult.rows[0];
    if (game.status !== 'active' || game.current_phase !== 'phase2') {
      throw new ActionError('Phase 2 is not active', 409);
    }

    const gangsResult = await client.query<GangRow>(
      `SELECT id, members, money FROM gangs WHERE game_id = $1`,
      [gameId],
    );
    const turfsResult = await client.query<TurfRow>(
      `SELECT id, owner_gang_id FROM turfs WHERE game_id = $1`,
      [gameId],
    );
    const actionsResult = await client.query<PhaseTwoActionRow>(
      `SELECT id, gang_id, action, target_turf_id
       FROM phase_actions
       WHERE game_id = $1 AND round_number = $2 AND phase = 'phase2'
       ORDER BY submitted_at ASC, id ASC`,
      [gameId, game.round_number],
    );
    if (actionsResult.rowCount !== gangsResult.rowCount) {
      throw new ActionError('Not every gang has selected a Phase 2 action', 409);
    }

    const bonusesResult = await client.query<PhaseOneBonusRow>(
      `SELECT gang_id, action, target_gang_id
       FROM phase_actions
       WHERE game_id = $1 AND round_number = $2 AND phase = 'phase1'
         AND action IN ('beef', 'buzinezz', 'show_off')`,
      [gameId, game.round_number],
    );
    const protectActionsResult = await client.query<ProtectActionRow>(
      `SELECT gang_id, round_number
       FROM phase_actions
       WHERE game_id = $1 AND phase = 'phase2' AND action = 'protect'
         AND round_number >= $2 AND round_number < $3`,
      [gameId, Math.max(1, game.round_number - 2), game.round_number],
    );
    const resolution = resolvePhase2(
      actionsResult.rows.map((action) => ({
        id: action.id,
        gangId: action.gang_id,
        action: action.action,
        targetTurfId: action.target_turf_id,
      })),
      gangsResult.rows,
      turfsResult.rows.map((turf) => ({ id: turf.id, ownerGangId: turf.owner_gang_id })),
      bonusesResult.rows.map((bonus) => ({
        gangId: bonus.gang_id,
        action: bonus.action,
        targetGangId: bonus.target_gang_id,
      })),
      random,
      getActiveProtectedGangIds(protectActionsResult.rows.map((action) => ({
        gangId: action.gang_id,
        roundNumber: action.round_number,
      })), game.round_number),
    );

    for (const [gangId, delta] of Object.entries(resolution.moneyDeltas)) {
      await client.query(`UPDATE gangs SET money = money + $1 WHERE id = $2`, [delta, gangId]);
    }
    for (const [gangId, delta] of Object.entries(resolution.memberDeltas)) {
      await client.query(`UPDATE gangs SET members = members + $1 WHERE id = $2`, [delta, gangId]);
    }
    for (const [turfId, gangId] of Object.entries(resolution.turfOwners)) {
      await client.query(`UPDATE turfs SET owner_gang_id = $1 WHERE id = $2`, [gangId, turfId]);
    }
    for (const result of resolution.actionResults) {
      await client.query(
        `INSERT INTO action_results (phase_action_id, roll_result, outcome)
         VALUES ($1, $2, $3)`,
        [result.phaseActionId, result.rollResult, result.outcome],
      );
    }

    const winnerResult = await client.query<{ id: string }>(
      `SELECT owner_gang_id AS id FROM turfs
       WHERE game_id = $1 AND owner_gang_id IS NOT NULL
       GROUP BY owner_gang_id HAVING COUNT(*) >= 12
       ORDER BY COUNT(*) DESC LIMIT 1`,
      [gameId],
    );
    const winnerGangId = winnerResult.rows[0]?.id ?? null;
    const nextRoundNumber = game.round_number + 1;
    if (winnerGangId) {
      await client.query(
        `UPDATE games SET status = 'finished', round_number = $1, current_phase = 'phase1',
          phase_deadline = NULL, winner_gang_id = $2 WHERE id = $3`,
        [nextRoundNumber, winnerGangId, gameId],
      );
    } else {
      await client.query(
        `UPDATE games SET round_number = $1, current_phase = 'phase1',
          phase_deadline = now() + interval '10 minutes' WHERE id = $2`,
        [nextRoundNumber, gameId],
      );
    }
    await client.query('COMMIT');
    return {
      roundNumber: game.round_number,
      actionCount: resolution.actionResults.length,
      nextRoundNumber,
      moneyDeltas: resolution.moneyDeltas,
      memberDeltas: resolution.memberDeltas,
      winnerGangId,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
