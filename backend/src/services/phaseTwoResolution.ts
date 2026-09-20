import type { ResolvedPhaseTwoAction } from '../db/phaseActions.js';

export interface PhaseTwoGang {
  id: string;
  members: number;
}

export interface PhaseTwoTurf {
  id: string;
  ownerGangId: string | null;
}

export interface PhaseTwoActionInput {
  id: string;
  gangId: string;
  action: ResolvedPhaseTwoAction;
  targetTurfId: string | null;
}

export interface PhaseOneBonusInput {
  gangId: string;
  action: 'beef' | 'buzinezz' | 'show_off';
  targetGangId: string | null;
}

export interface PhaseTwoActionResult {
  phaseActionId: string;
  rollResult: Record<string, unknown>;
  outcome: Record<string, unknown>;
}

export interface PhaseTwoResolution {
  moneyDeltas: Record<string, number>;
  memberDeltas: Record<string, number>;
  turfOwners: Record<string, string>;
  actionResults: PhaseTwoActionResult[];
}

export interface PhaseTwoRandom {
  randomInt: (minimum: number, maximum: number) => number;
  rollDice: (count: number, sides: number) => number;
}

export function resolvePhase2(
  actions: PhaseTwoActionInput[],
  gangs: PhaseTwoGang[],
  turfs: PhaseTwoTurf[],
  phaseOneBonuses: PhaseOneBonusInput[],
  random: PhaseTwoRandom = defaultRandom,
): PhaseTwoResolution {
  const gangById = new Map(gangs.map((gang) => [gang.id, gang]));
  const turfById = new Map(turfs.map((turf) => [turf.id, turf]));
  const moneyDeltas: Record<string, number> = {};
  const memberDeltas: Record<string, number> = {};
  const turfOwners: Record<string, string> = {};
  const actionResults: PhaseTwoActionResult[] = [];
  const bonusByGang = new Map<string, PhaseOneBonusInput>();

  for (const bonus of phaseOneBonuses) bonusByGang.set(bonus.gangId, bonus);
  for (const action of actions) {
    if (!gangById.has(action.gangId)) throw new Error(`Unknown acting gang: ${action.gangId}`);
    if (action.action === 'expand' && (!action.targetTurfId || !turfById.has(action.targetTurfId))) {
      throw new Error(`Expand target is missing or unknown for ${action.id}`);
    }
  }

  const expandActions = actions.filter((action) => action.action === 'expand');
  const neutralGroups = groupByNeutralTarget(expandActions, turfById);
  const contestedWinners = new Map<string, PhaseTwoActionInput>();
  for (const [turfId, contenders] of neutralGroups) {
    if (contenders.length === 1) {
      contestedWinners.set(turfId, contenders[0]);
      continue;
    }
    let remaining = contenders;
    while (remaining.length > 1) {
      const rolls = remaining.map((action) => ({
        action,
        roll: random.rollDice(2, 6) + memberAdvantage(action, remaining, gangById),
      }));
      const highest = Math.max(...rolls.map((entry) => entry.roll));
      remaining = rolls.filter((entry) => entry.roll === highest).map((entry) => entry.action);
    }
    contestedWinners.set(turfId, remaining[0]);
  }

  for (const action of actions) {
    const rollResult: Record<string, unknown> = {};
    const outcome: Record<string, unknown> = {};
    const bonus = bonusByGang.get(action.gangId);

    if (action.action === 'earn') {
      const base = random.randomInt(2000, 5000);
      const bonusAmount = bonus?.action === 'buzinezz' ? 1000 : 0;
      rollResult.amount = base;
      outcome.moneyGained = base + bonusAmount;
      if (bonusAmount) outcome.buzinezzBonus = bonusAmount;
      moneyDeltas[action.gangId] = (moneyDeltas[action.gangId] ?? 0) + base + bonusAmount;
    } else if (action.action === 'recruit') {
      const base = random.rollDice(2, 6);
      const bonusAmount = bonus?.action === 'show_off' ? 5 : 0;
      rollResult.members = base;
      outcome.membersGained = base + bonusAmount;
      if (bonusAmount) outcome.showOffBonus = bonusAmount;
      memberDeltas[action.gangId] = (memberDeltas[action.gangId] ?? 0) + base + bonusAmount;
    } else if (action.action === 'protect') {
      outcome.protectionNextRound = -2;
    } else if (action.action === 'expand') {
      const turf = turfById.get(action.targetTurfId as string) as PhaseTwoTurf;
      const currentOwner = turfOwners[turf.id] ?? turf.ownerGangId;
      const targetGangId = currentOwner;
      if (turf.ownerGangId === null) {
        if (contestedWinners.get(turf.id) !== action) {
          outcome.contestLost = true;
          actionResults.push({ phaseActionId: action.id, rollResult, outcome });
          continue;
        }
        const roll = random.rollDice(2, 6);
        rollResult.total = roll;
        outcome.targetTurfId = turf.id;
        outcome.threshold = 6;
        if (roll >= 6) captureTurf(action, turf.id, 0, turfOwners, memberDeltas, outcome, random);
        else outcome.success = false;
      } else {
        if (targetGangId === action.gangId) throw new Error(`Gang cannot expand into its own Turf: ${turf.id}`);
        const beefBonus = bonus?.action === 'beef' && bonus.targetGangId === targetGangId ? 2 : 0;
        const roll = random.rollDice(2, 6);
        const total = roll + beefBonus;
        rollResult.base = roll;
        rollResult.bonus = beefBonus;
        rollResult.total = total;
        outcome.targetTurfId = turf.id;
        outcome.threshold = 8;
        if (total >= 8) captureTurf(action, turf.id, beefBonus, turfOwners, memberDeltas, outcome, random);
        else outcome.success = false;
      }
    }

    actionResults.push({ phaseActionId: action.id, rollResult, outcome });
  }

  return { moneyDeltas, memberDeltas, turfOwners, actionResults };
}

function groupByNeutralTarget(
  actions: PhaseTwoActionInput[],
  turfById: Map<string, PhaseTwoTurf>,
): Map<string, PhaseTwoActionInput[]> {
  const groups = new Map<string, PhaseTwoActionInput[]>();
  for (const action of actions) {
    const turf = turfById.get(action.targetTurfId as string);
    if (!turf || turf.ownerGangId !== null) continue;
    const entries = groups.get(turf.id) ?? [];
    entries.push(action);
    groups.set(turf.id, entries);
  }
  return groups;
}

function memberAdvantage(
  action: PhaseTwoActionInput,
  contenders: PhaseTwoActionInput[],
  gangs: Map<string, PhaseTwoGang>,
): number {
  const members = gangs.get(action.gangId)?.members ?? 0;
  const maxMembers = Math.max(...contenders.map((contender) => gangs.get(contender.gangId)?.members ?? 0));
  return members === maxMembers && contenders.some((contender) => contender.gangId !== action.gangId && (gangs.get(contender.gangId)?.members ?? 0) < members) ? 1 : 0;
}

function captureTurf(
  action: PhaseTwoActionInput,
  turfId: string,
  beefBonus: number,
  turfOwners: Record<string, string>,
  memberDeltas: Record<string, number>,
  outcome: Record<string, unknown>,
  random: PhaseTwoRandom,
): void {
  const membersGained = random.randomInt(1, 6);
  turfOwners[turfId] = action.gangId;
  memberDeltas[action.gangId] = (memberDeltas[action.gangId] ?? 0) + membersGained;
  outcome.success = true;
  outcome.membersGained = membersGained;
  if (beefBonus) outcome.beefBonus = beefBonus;
}

const defaultRandom: PhaseTwoRandom = {
  randomInt: (minimum, maximum) => Math.floor(Math.random() * (maximum - minimum + 1)) + minimum,
  rollDice: (count, sides) => Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
    .reduce((total, roll) => total + roll, 0),
};
