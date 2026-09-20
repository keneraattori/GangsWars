import type { Pool } from 'pg';
import { resolvePhaseOneForGame } from '../db/phaseResolution.js';
import { resolvePhaseTwoForGame } from '../db/phaseTwoResolution.js';

interface ExpiredGame {
  id: string;
  current_phase: 'phase1' | 'phase2';
}

export async function processExpiredPhases(pool: Pool): Promise<number> {
  const expired = await pool.query<ExpiredGame>(
    `SELECT id, current_phase FROM games
     WHERE status = 'active' AND phase_deadline IS NOT NULL AND phase_deadline <= now()
     ORDER BY phase_deadline ASC`,
  );
  let resolvedCount = 0;
  for (const game of expired.rows) {
    if (await fillMissingActionsWithSkips(pool, game.id, game.current_phase)) {
      if (game.current_phase === 'phase1') await resolvePhaseOneForGame(pool, game.id);
      else await resolvePhaseTwoForGame(pool, game.id);
      resolvedCount += 1;
    }
  }
  return resolvedCount;
}

async function fillMissingActionsWithSkips(
  pool: Pool,
  gameId: string,
  expectedPhase: 'phase1' | 'phase2',
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const game = await client.query<{
      round_number: number;
      current_phase: 'phase1' | 'phase2';
      phase_deadline: Date | null;
    }>(
      `SELECT round_number, current_phase, phase_deadline FROM games
       WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [gameId],
    );
    if (!game.rows[0] || game.rows[0].current_phase !== expectedPhase || !game.rows[0].phase_deadline || game.rows[0].phase_deadline > new Date()) {
      await client.query('ROLLBACK');
      return false;
    }

    const gangs = await client.query<{ id: string }>(
      `SELECT id FROM gangs WHERE game_id = $1`,
      [gameId],
    );
    const actions = await client.query<{ gang_id: string }>(
      `SELECT gang_id FROM phase_actions
       WHERE game_id = $1 AND round_number = $2 AND phase = $3`,
      [gameId, game.rows[0].round_number, expectedPhase],
    );
    const submitted = new Set(actions.rows.map((action) => action.gang_id));
    for (const gang of gangs.rows) {
      if (!submitted.has(gang.id)) {
        await client.query(
          `INSERT INTO phase_actions (game_id, round_number, phase, gang_id, action)
           VALUES ($1, $2, $3, $4, 'skip')`,
          [gameId, game.rows[0].round_number, expectedPhase, gang.id],
        );
      }
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
