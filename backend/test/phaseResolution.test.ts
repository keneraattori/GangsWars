import { describe, expect, it } from 'vitest';
import { resolvePhase1 } from '../src/services/phaseResolution.js';

const gangs = [
  { id: 'gang-a', members: 20, notoriety: 0 },
  { id: 'gang-b', members: 20, notoriety: 0 },
];

describe('resolvePhase1', () => {
  it('records Beef, Buzinezz, and Show off! bonuses without changing members', () => {
    const result = resolvePhase1([
      { id: 'action-1', gangId: 'gang-a', action: 'beef', targetGangId: 'gang-b' },
      { id: 'action-2', gangId: 'gang-b', action: 'buzinezz', targetGangId: null },
      { id: 'action-3', gangId: 'gang-a', action: 'show_off', targetGangId: null },
    ], gangs, () => 3);

    expect(result.memberDeltas).toEqual({});
    expect(result.notorietyDeltas).toEqual({});
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
    expect(result.notorietyDeltas).toEqual({ 'gang-a': 1 });
    expect(result.actionResults[0]).toEqual({
      phaseActionId: 'action-1',
      rollResult: { damage: 4 },
      outcome: { notorietyGained: 1, targetGangId: 'gang-b', membersLost: 4 },
    });
  });

  it('reduces Attack damage by 1 against a gang with active Protect', () => {
    const result = resolvePhase1([
      { id: 'action-1', gangId: 'gang-a', action: 'attack', targetGangId: 'gang-b' },
    ], gangs, () => 4, ['gang-b']);

    expect(result.memberDeltas).toEqual({ 'gang-b': -3 });
    expect(result.notorietyDeltas).toEqual({ 'gang-a': 1 });
    expect(result.actionResults[0]).toMatchObject({
      rollResult: { baseDamage: 4, protectionPenalty: -1, damage: 3 },
      outcome: { protectionPenalty: -1, membersLost: 3, notorietyGained: 1 },
    });
  });

  it('allows Protect to reduce Attack damage to zero without awarding Notoriety', () => {
    const result = resolvePhase1([
      { id: 'action-1', gangId: 'gang-a', action: 'attack', targetGangId: 'gang-b' },
    ], gangs, () => 1, ['gang-b']);

    expect(result.memberDeltas).toEqual({});
    expect(result.notorietyDeltas).toEqual({});
    expect(result.actionResults[0]).toMatchObject({
      rollResult: { baseDamage: 1, protectionPenalty: -1, damage: 0 },
      outcome: { protectionPenalty: -1, membersLost: 0, notorietyGained: 0 },
    });
  });

  it('increments notoriety to 10 and stops at the cap', () => {
    const action = [
      { id: 'action-1', gangId: 'gang-a', action: 'attack', targetGangId: 'gang-b' },
    ] as const;
    const underCap = resolvePhase1(
      [...action],
      [{ ...gangs[0], notoriety: 9 }, gangs[1]],
      () => 4,
    );
    const atCap = resolvePhase1(
      [...action],
      [{ ...gangs[0], notoriety: 10 }, gangs[1]],
      () => 4,
    );

    expect(underCap.notorietyDeltas).toEqual({ 'gang-a': 1 });
    expect(atCap.notorietyDeltas).toEqual({});
    expect(atCap.actionResults[0].outcome).toMatchObject({ notorietyGained: 0 });
  });

  it('rejects an Attack without a valid target', () => {
    expect(() => resolvePhase1([
      { id: 'action-1', gangId: 'gang-a', action: 'attack', targetGangId: null },
    ], gangs, () => 4)).toThrow(/target/);
  });
});
