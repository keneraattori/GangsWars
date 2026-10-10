import type { ResolvedPhaseOneAction } from '../db/phaseActions.js';

export interface PhaseOneGang {
  id: string;
  members: number;
  notoriety: number;
}

export interface PhaseOneActionInput {
  id: string;
  gangId: string;
  action: ResolvedPhaseOneAction;
  targetGangId: string | null;
}

export interface PhaseOneActionResult {
  phaseActionId: string;
  rollResult: Record<string, number>;
  outcome: Record<string, unknown>;
}

export interface PhaseOneResolution {
  memberDeltas: Record<string, number>;
  notorietyDeltas: Record<string, number>;
  actionResults: PhaseOneActionResult[];
}

export type RandomInt = (minimum: number, maximum: number) => number;

export function resolvePhase1(
  actions: PhaseOneActionInput[],
  gangs: PhaseOneGang[],
  randomInt: RandomInt = defaultRandomInt,
  activeProtectedGangIds: string[] = [],
): PhaseOneResolution {
  const gangById = new Map(gangs.map((gang) => [gang.id, gang]));
  const protectedGangIds = new Set(activeProtectedGangIds);
  const memberDeltas: Record<string, number> = {};
  const notorietyDeltas: Record<string, number> = {};
  const actionResults: PhaseOneActionResult[] = [];

  for (const action of actions) {
    const gang = gangById.get(action.gangId);
    if (!gang) throw new Error(`Unknown acting gang: ${action.gangId}`);
    const outcome: Record<string, unknown> = {};
    const rollResult: Record<string, number> = {};

    if (action.action === 'beef') {
      outcome.expandBonus = 2;
      if (action.targetGangId) outcome.targetGangId = action.targetGangId;
    } else if (action.action === 'buzinezz') {
      outcome.earnBonus = 1000;
    } else if (action.action === 'show_off') {
      outcome.recruitBonus = 5;
    } else if (action.action === 'attack') {
      if (!action.targetGangId || !gangById.has(action.targetGangId)) {
        throw new Error(`Attack target is missing or unknown for ${action.id}`);
      }
      const baseDamage = randomInt(1, 5);
      const protectionPenalty = protectedGangIds.has(action.targetGangId) ? 1 : 0;
      const damage = Math.max(0, baseDamage - protectionPenalty);
      if (protectionPenalty > 0) {
        rollResult.baseDamage = baseDamage;
        rollResult.protectionPenalty = -1;
        outcome.protectionPenalty = -1;
      }
      rollResult.damage = damage;
      if (damage > 0) {
        memberDeltas[action.targetGangId] = (memberDeltas[action.targetGangId] ?? 0) - damage;
      }
      const notorietyGained = damage > 0 ? Math.max(0, Math.min(1, 10 - gang.notoriety)) : 0;
      outcome.notorietyGained = notorietyGained;
      if (notorietyGained > 0) {
        notorietyDeltas[action.gangId] = (notorietyDeltas[action.gangId] ?? 0) + notorietyGained;
      }
      outcome.targetGangId = action.targetGangId;
      outcome.membersLost = damage;
    } else if (action.action === 'skip') {
      outcome.skipped = true;
      outcome.reason = 'phase_timeout';
    }

    actionResults.push({ phaseActionId: action.id, rollResult, outcome });
  }

  return { memberDeltas, notorietyDeltas, actionResults };
}

function defaultRandomInt(minimum: number, maximum: number): number {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}
