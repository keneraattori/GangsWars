import type { Pool } from 'pg';
import type { GangSummary } from './gangs.js';
import type { GameSummary } from './games.js';

export interface TurfSummary {
  id: string;
  label: string;
  ownerGangId: string | null;
  ownerGangName: string | null;
}

export interface Gameboard {
  game: GameSummary & {
    roundNumber: number;
    currentPhase: 'phase1' | 'phase2';
    phaseDeadline: string | null;
    winnerGangId: string | null;
  };
  gangs: GangSummary[];
  turfs: TurfSummary[];
  neutralTurfs: number;
}

interface GameBoardRow {
  id: string;
  creator_user_id: string;
  max_players: number;
  status: GameSummary['status'];
  round_number: number;
  current_phase: 'phase1' | 'phase2';
  phase_deadline: Date | null;
  winner_gang_id: string | null;
  member_count: string;
  gang_count: string;
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

interface TurfRow {
  id: string;
  label: string;
  owner_gang_id: string | null;
  owner_gang_name: string | null;
}

export async function getGameboard(pool: Pool, gameId: string): Promise<Gameboard | null> {
  const gameResult = await pool.query<GameBoardRow>(
    `SELECT g.id, g.creator_user_id, g.max_players, g.status, g.round_number,
      g.current_phase, g.phase_deadline, g.winner_gang_id,
      COUNT(DISTINCT gm.user_id)::text AS member_count,
      COUNT(DISTINCT ga.id)::text AS gang_count
     FROM games g
     LEFT JOIN game_members gm ON gm.game_id = g.id
     LEFT JOIN gangs ga ON ga.game_id = g.id
     WHERE g.id = $1
     GROUP BY g.id`,
    [gameId],
  );
  if (!gameResult.rows[0]) return null;

  const gangsResult = await pool.query<GangRow>(
    `SELECT ga.id, ga.game_id, ga.user_id, ga.name, ga.money, ga.members, ga.notoriety,
      COUNT(t.id)::text AS turfs_held
     FROM gangs ga
     LEFT JOIN turfs t ON t.owner_gang_id = ga.id
     WHERE ga.game_id = $1
     GROUP BY ga.id
     ORDER BY ga.name ASC`,
    [gameId],
  );

  const turfsResult = await pool.query<TurfRow>(
    `SELECT t.id, t.label, t.owner_gang_id, ga.name AS owner_gang_name
     FROM turfs t
     LEFT JOIN gangs ga ON ga.id = t.owner_gang_id
     WHERE t.game_id = $1
     ORDER BY t.label ASC`,
    [gameId],
  );

  const game = gameResult.rows[0];
  const gangs = gangsResult.rows.map((gang) => ({
    id: gang.id,
    gameId: gang.game_id,
    userId: gang.user_id,
    name: gang.name,
    money: gang.money,
    members: gang.members,
    notoriety: gang.notoriety,
    turfsHeld: Number(gang.turfs_held),
  }));
  const turfs = turfsResult.rows.map((turf) => ({
    id: turf.id,
    label: turf.label,
    ownerGangId: turf.owner_gang_id,
    ownerGangName: turf.owner_gang_name,
  }));

  return {
    game: {
      id: game.id,
      creatorUserId: game.creator_user_id,
      maxPlayers: game.max_players,
      status: game.status,
      memberCount: Number(game.member_count),
      gangCount: Number(game.gang_count),
      roundNumber: game.round_number,
      currentPhase: game.current_phase,
      phaseDeadline: game.phase_deadline?.toISOString() ?? null,
      winnerGangId: game.winner_gang_id,
    },
    gangs,
    turfs,
    neutralTurfs: turfs.filter((turf) => turf.ownerGangId === null).length,
  };
}
