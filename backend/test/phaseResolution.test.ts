import { describe, expect, it } from 'vitest';
import { resolvePhase1 } from '../src/services/phaseResolution.js';

const gangs = [
  { id: 'gang-a', members: 20 },
  { id: 'gang-b', members: 20 },
];

describe('resolvePhase1', () => {
  it('records Beef, Buzinezz, and Show off! bonuses without changing members', () => {
    const result = resolvePhase1([
      { id: 'action-1', gangId: 'gang-a', action: 'beef', targetGangId: 'gang-b' },
      { id: 'action-2', gangId: 'gang-b', action: 'buzinezz', targetGangId: null },
      { id: 'action-3', gangId: 'gang-a', action: 'show_off', targetGangId: null },
    ], gangs, () => 3);

    expect(result.memberDeltas).toEqual({});
    expect(result.actionResults).toEqual([
      {
        phaseActionId: 'action-1',
        rollResult: {},
        outcome: { expandBonus: 2, targetGangId: 'gang-b' },
      },
      {
        phaseActionId: 'action-2',
        rollResult: {},
        outcome: { earnBonus: 1000 },
      },
      {
        phaseActionId: 'action-3',
        rollResult: {},
        outcome: { recruitBonus: 5 },
      },
    ]);
  });

  it('applies injected Attack damage to the target gang', () => {
    const result = resolvePhase1([
      { id: 'action-1', gangId: 'gang-a', action: 'attack', targetGangId: 'gang-b' },
    ], gangs, () => 4);

    expect(result.memberDeltas).toEqual({ 'gang-b': -4 });
    expect(result.actionResults[0]).toEqual({
      phaseActionId: 'action-1',
      rollResult: { damage: 4 },
      outcome: { targetGangId: 'gang-b', membersLost: 4 },
    });
  });

  it('rejects an Attack without a valid target', () => {
    expect(() => resolvePhase1([
      { id: 'action-1', gangId: 'gang-a', action: 'attack', targetGangId: null },
    ], gangs, () => 4)).toThrow(/target/);
  });
});
