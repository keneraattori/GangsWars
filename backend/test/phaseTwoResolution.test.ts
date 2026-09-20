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
      { id: 'gang-a', members: 20 },
      { id: 'gang-b', members: 20 },
    ], [], [
      { gangId: 'gang-a', action: 'buzinezz', targetGangId: null },
      { gangId: 'gang-b', action: 'show_off', targetGangId: null },
    ], {
      randomInt: () => 4000,
      rollDice: () => 8,
    });

    expect(result.moneyDeltas).toEqual({ 'gang-a': 5000 });
    expect(result.memberDeltas).toEqual({ 'gang-b': 13 });
    expect(result.actionResults[2].outcome).toEqual({ protectionNextRound: -2 });
  });

  it('captures a neutral Turf and grants 1d6 members on success', () => {
    const result = resolvePhase2([
      { id: 'expand-action', gangId: 'gang-a', action: 'expand', targetTurfId: 'turf-1' },
    ], [{ id: 'gang-a', members: 20 }], [{ id: 'turf-1', ownerGangId: null }], [], random);

    expect(result.turfOwners).toEqual({ 'turf-1': 'gang-a' });
    expect(result.memberDeltas).toEqual({ 'gang-a': 4 });
    expect(result.actionResults[0].outcome).toMatchObject({ success: true, membersGained: 4 });
  });

  it('gives the larger gang +1 in a neutral Turf roll-off', () => {
    const result = resolvePhase2([
      { id: 'expand-a', gangId: 'gang-a', action: 'expand', targetTurfId: 'turf-1' },
      { id: 'expand-b', gangId: 'gang-b', action: 'expand', targetTurfId: 'turf-1' },
    ], [
      { id: 'gang-a', members: 21 },
      { id: 'gang-b', members: 20 },
    ], [{ id: 'turf-1', ownerGangId: null }], [], {
      randomInt: () => 4,
      rollDice: (() => {
        const rolls = [5, 5, 8];
        return () => rolls.shift() ?? 8;
      })(),
    });

    expect(result.turfOwners).toEqual({ 'turf-1': 'gang-a' });
  });
});
