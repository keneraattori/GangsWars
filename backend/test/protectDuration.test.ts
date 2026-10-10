import { describe, expect, it } from 'vitest';
import { getActiveProtectedGangIds } from '../src/services/protectDuration.js';

describe('getActiveProtectedGangIds', () => {
  it('includes Protect actions from the two preceding rounds only', () => {
    expect(getActiveProtectedGangIds([
      { gangId: 'gang-a', roundNumber: 4 },
      { gangId: 'gang-a', roundNumber: 5 },
      { gangId: 'gang-b', roundNumber: 6 },
      { gangId: 'gang-c', roundNumber: 7 },
    ], 7)).toEqual(['gang-a', 'gang-b']);
  });
});
