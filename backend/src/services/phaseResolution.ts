import type { PhaseOneAction } from '../db/phaseActions.js';

export interface PhaseOneGang {
  id: string;
  members: number;
}

export interface PhaseOneActionInput {
  id: string;
  gangId: string;
  action: PhaseOneAction;
  targetGangId: string | null;
}

export interface PhaseOneActionResult {
  phaseActionId: string;
  rollResult: Record<string, number>;
  outcome: Record<string, string | number>;
}

export interface PhaseOneResolution {
  memberDeltas: Record<string, number>;
  actionResults: PhaseOneActionResult[];
}

export type RandomInt = (minimum: number, maximum: number) => number;

export function resolvePhase1(
  actions: PhaseOneActionInput[],
  gangs: PhaseOneGang[],
  randomInt: RandomInt = defaultRandomInt,
): PhaseOneResolution {
  const gangIds = new Set(gangs.map((gang) => gang.id));
  const memberDeltas: Record<string, number> = {};
  const actionResults: PhaseOneActionResult[] = [];

  for (const action of actions) {
    if (!gangIds.has(action.gangId)) throw new Error(`Unknown acting gang: ${action.gangId}`);
    const outcome: Record<string, string | number> = {};
    const rollResult: Record<string, number> = {};

    if (action.action === 'beef') {
      outcome.expandBonus = 2;
      if (action.targetGangId) outcome.targetGangId = action.targetGangId;
    } else if (action.action === 'buzinezz') {
      outcome.earnBonus = 1000;
    } else if (action.action === 'show_off') {
      outcome.recruitBonus = 5;
    } else if (action.action === 'attack') {
      if (!action.targetGangId || !gangIds.has(action.targetGangId)) {
        throw new Error(`Attack target is missing or unknown for ${action.id}`);
      }
      const damage = randomInt(1, 5);
      rollResult.damage = damage;
      memberDeltas[action.targetGangId] = (memberDeltas[action.targetGangId] ?? 0) - damage;
      outcome.targetGangId = action.targetGangId;
      outcome.membersLost = damage;
    }

    actionResults.push({ phaseActionId: action.id, rollResult, outcome });
  }

  return { memberDeltas, actionResults };
}

function defaultRandomInt(minimum: number, maximum: number): number {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}
