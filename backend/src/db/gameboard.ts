import type { Pool } from 'pg';
import { getActiveProtectedGangIds } from '../services/protectDuration.js';
import type { GangSummary } from './gangs.js';
import type { GameSummary } from './games.js';

export interface TurfSummary {
  id: string;
  label: string;
  ownerGangId: string | null;
  ownerGangName: string | null;
}

export interface ActionLogEntry {
  id: string;
  roundNumber: number;
  phase: 'phase1' | 'phase2';
  gangName: string;
  action: string;
  rollResult: Record<string, unknown>;
  outcome: Record<string, unknown>;
  resolvedAt: string;
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
  protectedGangIds: string[];
  neutralTurfs: number;
  actionLog: ActionLogEntry[];
}

export interface PublicGameboard extends Omit<Gameboard, 'gangs'> {
  gangs: Omit<GangSummary, 'gameId' | 'userId'>[];
  submittedCount: number;
  totalGangCount: number;
}

interface GameBoardRow {
  id: string;
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
  character_id: number;
}

interface TurfRow {
  id: string;
  label: string;
  owner_gang_id: string | null;
  owner_gang_name: string | null;
}

interface ActionLogRow {
  id: string;
  round_number: number;
  phase: 'phase1' | 'phase2';
  gang_name: string;
  action: string;
  roll_result: Record<string, unknown>;
  outcome: Record<string, unknown>;
  resolved_at: Date;
}

export async function getGameboard(pool: Pool, gameId: string): Promise<Gameboard | null> {
  const gameResult = await pool.query<GameBoardRow>(
    `SELECT g.id, g.max_players, g.status, g.round_number,
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
  const game = gameResult.rows[0];

  const gangsResult = await pool.query<GangRow>(
    `SELECT ga.id, ga.game_id, ga.user_id, ga.name, ga.money, ga.members, ga.notoriety,
      COUNT(t.id)::text AS turfs_held, ga.character_id
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

  let protectedGangIds: string[] = [];
  if (game.status === 'active') {
    const protectActionsResult = await pool.query<{ gang_id: string; round_number: number }>(
      `SELECT gang_id, round_number
       FROM phase_actions
       WHERE game_id = $1 AND phase = 'phase2' AND action = 'protect'
         AND round_number >= $2 AND round_number < $3`,
      [gameId, Math.max(1, game.round_number - 2), game.round_number],
    );
    protectedGangIds = getActiveProtectedGangIds(protectActionsResult.rows.map((action) => ({
      gangId: action.gang_id,
      roundNumber: action.round_number,
    })), game.round_number);
  }

  const actionLogResult = await pool.query<ActionLogRow>(
    `SELECT ar.id, pa.round_number, pa.phase, ga.name AS gang_name, pa.action,
      ar.roll_result, ar.outcome, ar.resolved_at
     FROM action_results ar
     JOIN phase_actions pa ON pa.id = ar.phase_action_id
     JOIN gangs ga ON ga.id = pa.gang_id
     WHERE pa.game_id = $1
     ORDER BY ar.resolved_at DESC, ar.id DESC`,
    [gameId],
  );

  const gangs = gangsResult.rows.map((gang) => ({
    id: gang.id,
    gameId: gang.game_id,
    userId: gang.user_id,
    name: gang.name,
    money: gang.money,
    members: gang.members,
    notoriety: gang.notoriety,
    turfsHeld: Number(gang.turfs_held),
    characterId: gang.character_id,
  }));
  const turfs = turfsResult.rows.map((turf) => ({
    id: turf.id,
    label: turf.label,
    ownerGangId: turf.owner_gang_id,
    ownerGangName: turf.owner_gang_name,
  }));
  const actionLog = actionLogResult.rows.map((entry) => ({
    id: entry.id,
    roundNumber: entry.round_number,
    phase: entry.phase,
    gangName: entry.gang_name,
    action: entry.action,
    rollResult: entry.roll_result,
    outcome: entry.outcome,
    resolvedAt: entry.resolved_at.toISOString(),
  }));

  return {
    game: {
      id: game.id,
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
    protectedGangIds,
    neutralTurfs: turfs.filter((turf) => turf.ownerGangId === null).length,
    actionLog,
  };
}

export async function getPublicGameboard(pool: Pool, gameId: string): Promise<PublicGameboard | null> {
  const board = await getGameboard(pool, gameId);
  if (!board) return null;

  const actionCountResult = await pool.query<{ submitted_count: string }>(
    `SELECT COUNT(*)::text AS submitted_count
     FROM phase_actions
     WHERE game_id = $1 AND round_number = $2 AND phase = $3`,
    [gameId, board.game.roundNumber, board.game.currentPhase],
  );

  return {
    ...board,
    gangs: board.gangs.map((gang) => ({
      id: gang.id,
      name: gang.name,
      money: gang.money,
      members: gang.members,
      notoriety: gang.notoriety,
      turfsHeld: gang.turfsHeld,
      characterId: gang.characterId,
    })),
    submittedCount: Number(actionCountResult.rows[0].submitted_count),
    totalGangCount: board.game.gangCount,
  };
}
