import type { Pool, PoolClient } from 'pg';

export interface GameSummary {
  id: string;
  creatorUserId: string;
  maxPlayers: number;
  status: 'lobby' | 'active' | 'finished';
  memberCount: number;
  gangCount: number;
}

interface GameRow {
  id: string;
  creator_user_id: string;
  max_players: number;
  status: GameSummary['status'];
  member_count: string;
  gang_count: string;
}

function toSummary(row: GameRow): GameSummary {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    maxPlayers: row.max_players,
    status: row.status,
    memberCount: Number(row.member_count),
    gangCount: Number(row.gang_count),
  };
}

const summaryQuery = `
  SELECT g.id, g.creator_user_id, g.max_players, g.status,
    COUNT(DISTINCT gm.user_id)::text AS member_count,
    COUNT(DISTINCT ga.id)::text AS gang_count
  FROM games g
  LEFT JOIN game_members gm ON gm.game_id = g.id
  LEFT JOIN gangs ga ON ga.game_id = g.id
`;

export async function createGame(
  pool: Pool,
  userId: string,
  maxPlayers: number,
): Promise<GameSummary> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const game = await client.query<{ id: string }>(
      `INSERT INTO games (creator_user_id, max_players) VALUES ($1, $2) RETURNING id`,
      [userId, maxPlayers],
    );
    await client.query(
      `INSERT INTO game_members (game_id, user_id) VALUES ($1, $2)`,
      [game.rows[0].id, userId],
    );
    await client.query('COMMIT');
    const summary = await getGameSummary(pool, game.rows[0].id);
    if (!summary) throw new Error('Created game could not be loaded');
    return summary;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getGameSummary(pool: Pool, gameId: string): Promise<GameSummary | null> {
  const result = await pool.query<GameRow>(
    `${summaryQuery} WHERE g.id = $1 GROUP BY g.id`,
    [gameId],
  );
  return result.rows[0] ? toSummary(result.rows[0]) : null;
}

export async function listOpenGames(pool: Pool): Promise<GameSummary[]> {
  const result = await pool.query<GameRow>(
    `${summaryQuery} WHERE g.status = 'lobby' GROUP BY g.id ORDER BY g.created_at ASC`,
  );
  return result.rows.map(toSummary);
}

export async function joinGame(pool: Pool, gameId: string, userId: string): Promise<GameSummary> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const game = await client.query<{ status: GameSummary['status']; max_players: number }>(
      `SELECT status, max_players FROM games WHERE id = $1 FOR UPDATE`,
      [gameId],
    );
    if (!game.rows[0]) throw new GameError('Game not found', 404);
    if (game.rows[0].status !== 'lobby') throw new GameError('Game is no longer open', 409);

    const existing = await client.query(
      `SELECT 1 FROM game_members WHERE game_id = $1 AND user_id = $2`,
      [gameId, userId],
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return getGameSummary(pool, gameId) as Promise<GameSummary>;
    }

    const count = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM game_members WHERE game_id = $1`,
      [gameId],
    );
    if (Number(count.rows[0].count) >= game.rows[0].max_players) {
      throw new GameError('Game is full', 409);
    }
    await client.query(
      `INSERT INTO game_members (game_id, user_id) VALUES ($1, $2)`,
      [gameId, userId],
    );
    await client.query('COMMIT');
    return getGameSummary(pool, gameId) as Promise<GameSummary>;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function isGameMember(pool: Pool, gameId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM game_members WHERE game_id = $1 AND user_id = $2`,
    [gameId, userId],
  );
  return Boolean(result.rowCount);
}

export async function startGame(
  pool: Pool,
  gameId: string,
  userId: string,
  turfNames: string[],
): Promise<GameSummary> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const game = await client.query<{ status: GameSummary['status']; creator_user_id: string }>(
      `SELECT status, creator_user_id FROM games WHERE id = $1 FOR UPDATE`,
      [gameId],
    );
    if (!game.rows[0]) throw new GameError('Game not found', 404);
    if (game.rows[0].creator_user_id !== userId) throw new GameError('Only the creator can start the game', 403);
    if (game.rows[0].status !== 'lobby') throw new GameError('Game has already started', 409);

    const members = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM game_members WHERE game_id = $1`,
      [gameId],
    );
    if (Number(members.rows[0].count) < 2) throw new GameError('At least 2 players are required', 409);
    if (turfNames.length !== 20) throw new Error('A game must start with exactly 20 Turfs');

    for (const label of turfNames) {
      await client.query(`INSERT INTO turfs (game_id, label) VALUES ($1, $2)`, [gameId, label]);
    }
    await client.query(
      `UPDATE games SET status = 'active', started_at = now(), phase_deadline = now() + interval '10 minutes' WHERE id = $1`,
      [gameId],
    );
    await client.query('COMMIT');
    return getGameSummary(pool, gameId) as Promise<GameSummary>;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export class GameError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
  }
}

export type { PoolClient };
