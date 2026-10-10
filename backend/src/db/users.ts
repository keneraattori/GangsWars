import type { Pool } from "pg";

export interface Player {
  id: string;
  username: string;
}

export interface LobbyPlayer extends Player {
  joinedAt: string;
  lastSeenAt: string;
  online: boolean;
  gameId: string | null;
}

// Players poll every couple of seconds, but background tabs are throttled to about once a minute.
const ONLINE_WINDOW_SECONDS = 90;

// Returns null when another player already uses the name (case-insensitive).
export async function createPlayer(pool: Pool, name: string): Promise<Player | null> {
  const result = await pool.query<Player>(
    `INSERT INTO users (username)
     SELECT $1::text WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(username) = lower($1::text))
     RETURNING id, username`,
    [name],
  );
  return result.rows[0] ?? null;
}

// Returns the player if it still exists and records that it is active.
export async function touchPlayer(pool: Pool, userId: string): Promise<Player | null> {
  const result = await pool.query<Player>(
    `UPDATE users SET last_seen_at = now() WHERE id = $1 RETURNING id, username`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function listLobbyPlayers(pool: Pool): Promise<LobbyPlayer[]> {
  const result = await pool.query<{
    id: string;
    username: string;
    created_at: Date;
    last_seen_at: Date;
    online: boolean;
    game_id: string | null;
  }>(
    `SELECT u.id, u.username, u.created_at, u.last_seen_at,
      u.last_seen_at > now() - make_interval(secs => $1) AS online,
      (SELECT gm.game_id FROM game_members gm
        JOIN games g ON g.id = gm.game_id
        WHERE gm.user_id = u.id AND g.status <> 'finished'
        ORDER BY gm.joined_at DESC LIMIT 1) AS game_id
     FROM users u
     ORDER BY u.created_at ASC`,
    [ONLINE_WINDOW_SECONDS],
  );
  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    joinedAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    online: row.online,
    gameId: row.game_id,
  }));
}

// A player that is part of a running game cannot be removed without corrupting that game.
export async function deletePlayer(pool: Pool, userId: string): Promise<"deleted" | "in_game" | "not_found"> {
  const result = await pool.query(
    `DELETE FROM users u
     WHERE u.id = $1
       AND NOT EXISTS (
         SELECT 1 FROM game_members gm JOIN games g ON g.id = gm.game_id
         WHERE gm.user_id = u.id AND g.status = 'active'
       )`,
    [userId],
  );
  if (result.rowCount) return "deleted";
  const exists = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [userId]);
  return exists.rowCount ? "in_game" : "not_found";
}
