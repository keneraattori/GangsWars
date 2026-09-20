import type { Pool } from 'pg';

export interface GangSummary {
  id: string;
  gameId: string;
  userId: string;
  name: string;
  money: number;
  members: number;
  notoriety: number;
  turfsHeld: number;
}

interface GangRow {
  id: string;
  game_id: string;
  user_id: string;
  name: string;
  money: number;
  members: number;
  notoriety: number;
  turfs_held: string;
}

function toGang(row: GangRow): GangSummary {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    name: row.name,
    money: row.money,
    members: row.members,
    notoriety: row.notoriety,
    turfsHeld: Number(row.turfs_held),
  };
}

export async function createGang(
  pool: Pool,
  gameId: string,
  userId: string,
  name: string,
): Promise<GangSummary> {
  const result = await pool.query<GangRow>(
    `INSERT INTO gangs (game_id, user_id, name)
     VALUES ($1, $2, $3)
     RETURNING id, game_id, user_id, name, money, members, notoriety, 0::text AS turfs_held`,
    [gameId, userId, name],
  );
  return toGang(result.rows[0]);
}

export async function findGangForUser(
  pool: Pool,
  gameId: string,
  userId: string,
): Promise<GangSummary | null> {
  const result = await pool.query<GangRow>(
    `SELECT ga.id, ga.game_id, ga.user_id, ga.name, ga.money, ga.members, ga.notoriety,
      COUNT(t.id)::text AS turfs_held
     FROM gangs ga
     LEFT JOIN turfs t ON t.owner_gang_id = ga.id
     WHERE ga.game_id = $1 AND ga.user_id = $2
     GROUP BY ga.id`,
    [gameId, userId],
  );
  return result.rows[0] ? toGang(result.rows[0]) : null;
}
