export interface ProtectActionHistory {
  gangId: string;
  roundNumber: number;
}

export function getActiveProtectedGangIds(
  protectActions: ProtectActionHistory[],
  currentRoundNumber: number,
): string[] {
  const activeStartRound = currentRoundNumber - 2;
  return [...new Set(protectActions
    .filter(({ roundNumber }) => roundNumber >= activeStartRound && roundNumber < currentRoundNumber)
    .map(({ gangId }) => gangId))];
}
