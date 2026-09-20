import { describe, expect, it } from 'vitest';
import { pickTurfNames, TURF_NAMES } from '../src/services/turfNames.js';

describe('pickTurfNames', () => {
  it('returns 20 unique names from the configured pool', () => {
    const names = pickTurfNames(20, () => 0);
    expect(names).toHaveLength(20);
    expect(new Set(names).size).toBe(20);
    expect(names.every((name) => TURF_NAMES.includes(name))).toBe(true);
  });

  it('rejects a count larger than the pool', () => {
    expect(() => pickTurfNames(TURF_NAMES.length + 1)).toThrow();
  });
});
