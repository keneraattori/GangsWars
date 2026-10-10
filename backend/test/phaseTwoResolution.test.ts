import { describe, expect, it } from 'vitest';
import { resolvePhase2 } from '../src/services/phaseTwoResolution.js';

const random = {
  randomInt: () => 4,
  rollDice: () => 8,
};

describe('resolvePhase2', () => {
  it('applies Earn and Recruit bonuses from Phase 1', () => {
    const result = resolvePhase2([
      { id: 'earn-action', gangId: 'gang-a', action: 'earn', targetTurfId: null },
      { id: 'recruit-action', gangId: 'gang-b', action: 'recruit', targetTurfId: null },
      { id: 'protect-action', gangId: 'gang-a', action: 'protect', targetTurfId: null },
    ], [
      { id: 'gang-a', members: 20, money: 10000 },
      { id: 'gang-b', members: 20, money: 3000 },
    ], [], [
      { gangId: 'gang-a', action: 'buzinezz', targetGangId: null },
      { gangId: 'gang-b', action: 'show_off', targetGangId: null },
    ], {
      randomInt: () => 4000,
      rollDice: () => 8,
    });

    expect(result.moneyDeltas).toEqual({ 'gang-a': 5000, 'gang-b': -3000 });
    expect(result.memberDeltas).toEqual({ 'gang-b': 13 });
    expect(result.actionResults[1].outcome).toMatchObject({ moneySpent: 3000, membersGained: 13 });
    expect(result.actionResults[2].outcome).toEqual({ expandPenalty: -2 });
  });

  it('rejects Recruit when the gang cannot afford it', () => {
    expect(() => resolvePhase2([
      { id: 'recruit-action', gangId: 'gang-a', action: 'recruit', targetTurfId: null },
    ], [{ id: 'gang-a', members: 20, money: 2999 }], [], [], random))
      .toThrow('Insufficient funds for Recruit: gang-a');
  });

  it('captures a neutral Turf and removes 1d6 members on success', () => {
    const result = resolvePhase2([
      { id: 'expand-action', gangId: 'gang-a', action: 'expand', targetTurfId: 'turf-1' },
    ], [{ id: 'gang-a', members: 20, money: 10000 }], [{ id: 'turf-1', ownerGangId: null }], [], random);

    expect(result.turfOwners).toEqual({ 'turf-1': 'gang-a' });
    expect(result.memberDeltas).toEqual({ 'gang-a': -4 });
    expect(result.actionResults[0].outcome).toMatchObject({ success: true, membersLost: 4 });
  });

  it('records the former owner when successfully capturing an opponent Turf', () => {
    const result = resolvePhase2([
      { id: 'expand-action', gangId: 'gang-a', action: 'expand', targetTurfId: 'turf-1' },
    ], [
      { id: 'gang-a', members: 20, money: 10000 },
      { id: 'gang-b', members: 20, money: 10000 },
    ], [{ id: 'turf-1', ownerGangId: 'gang-b' }], [], random);

    expect(result.turfOwners).toEqual({ 'turf-1': 'gang-a' });
    expect(result.actionResults[0].outcome).toMatchObject({
      success: true,
      targetGangId: 'gang-b',
      targetTurfId: 'turf-1',
    });
  });

  it('gives the larger gang +1 in a neutral Turf roll-off', () => {
    const result = resolvePhase2([
      { id: 'expand-a', gangId: 'gang-a', action: 'expand', targetTurfId: 'turf-1' },
      { id: 'expand-b', gangId: 'gang-b', action: 'expand', targetTurfId: 'turf-1' },
    ], [
      { id: 'gang-a', members: 21, money: 10000 },
      { id: 'gang-b', members: 20, money: 10000 },
    ], [{ id: 'turf-1', ownerGangId: null }], [], {
      randomInt: () => 4,
      rollDice: (() => {
        const rolls = [5, 5, 8];
        return () => rolls.shift() ?? 8;
      })(),
    });

    expect(result.turfOwners).toEqual({ 'turf-1': 'gang-a' });
  });

  it('applies a -2 penalty to an expansion targeting a protecting gang', () => {
    const result = resolvePhase2([
      { id: 'protect-b', gangId: 'gang-b', action: 'protect', targetTurfId: null },
      { id: 'expand-a', gangId: 'gang-a', action: 'expand', targetTurfId: 'turf-1' },
    ], [
      { id: 'gang-a', members: 20, money: 10000 },
      { id: 'gang-b', members: 20, money: 10000 },
    ], [{ id: 'turf-1', ownerGangId: 'gang-b' }], [], random, ['gang-b']);

    expect(result.turfOwners).toEqual({});
    expect(result.actionResults[1].rollResult).toEqual({
      base: 8,
      bonus: 0,
      protectionPenalty: -2,
      total: 6,
    });
    expect(result.memberDeltas).toEqual({});
    expect(result.actionResults[1].outcome).toMatchObject({
      success: false,
      targetGangId: 'gang-b',
      targetTurfId: 'turf-1',
      threshold: 8,
    });
  });

  it('does not apply newly chosen Protect until a future round', () => {
    const result = resolvePhase2([
      { id: 'protect-b', gangId: 'gang-b', action: 'protect', targetTurfId: null },
      { id: 'expand-a', gangId: 'gang-a', action: 'expand', targetTurfId: 'turf-1' },
    ], [
      { id: 'gang-a', members: 20, money: 10000 },
      { id: 'gang-b', members: 20, money: 10000 },
    ], [{ id: 'turf-1', ownerGangId: 'gang-b' }], [], random);

    expect(result.actionResults[1].rollResult.protectionPenalty).toBe(0);
  });
});
