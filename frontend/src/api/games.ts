export interface GameSummary {
  id: string;
  creatorUserId: string;
  maxPlayers: number;
  status: "lobby" | "active" | "finished";
  memberCount: number;
  gangCount: number;
}

export interface GangSummary {
  id: string;
  gameId: string;
  userId: string;
  name: string;
  money: number;
  members: number;
  notoriety: number;
  turfsHeld: number;
}

export interface TurfSummary {
  id: string;
  label: string;
  ownerGangId: string | null;
  ownerGangName: string | null;
}

export interface ActionLogEntry {
  id: string;
  roundNumber: number;
  phase: "phase1" | "phase2";
  gangName: string;
  action: string;
  rollResult: Record<string, unknown>;
  outcome: Record<string, unknown>;
  resolvedAt: string;
}

export interface Gameboard {
  game: GameSummary & {
    roundNumber: number;
    currentPhase: "phase1" | "phase2";
    phaseDeadline: string | null;
    winnerGangId: string | null;
  };
  gangs: GangSummary[];
  turfs: TurfSummary[];
  neutralTurfs: number;
  actionLog: ActionLogEntry[];
}

export type PhaseOneAction = "beef" | "buzinezz" | "show_off" | "attack";
export type PhaseTwoAction = "earn" | "expand" | "recruit" | "protect";

export interface ActionStatus {
  roundNumber: number;
  phase: "phase1" | "phase2";
  submittedCount: number;
  totalGangCount: number;
  hasSubmitted: boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

export function listOpenGames(): Promise<{ games: GameSummary[] }> {
  return request("/api/games/open");
}

export function deleteAllGames(): Promise<{ deletedCount: number }> {
  return request("/api/games/all", {
    method: "DELETE",
    body: JSON.stringify({ confirmation: "DELETE_ALL_GAMES" }),
  });
}

export function createGame(maxPlayers: number): Promise<GameSummary> {
  return request("/api/games", {
    method: "POST",
    body: JSON.stringify({ maxPlayers }),
  });
}

export function getGame(gameId: string): Promise<Gameboard> {
  return request(`/api/games/${gameId}`);
}

export function joinGame(gameId: string): Promise<GameSummary> {
  return request(`/api/games/${gameId}/join`, { method: "POST" });
}

export function startGame(gameId: string): Promise<GameSummary> {
  return request(`/api/games/${gameId}/start`, { method: "POST" });
}

export function getMyGang(gameId: string): Promise<GangSummary | null> {
  return request<GangSummary>(`/api/games/${gameId}/me`).catch((error: Error) => {
    if (error.message === "Gang not found") return null;
    throw error;
  });
}

export function createGang(gameId: string, name: string): Promise<GangSummary> {
  return request(`/api/games/${gameId}/gangs`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getActionStatus(gameId: string): Promise<ActionStatus> {
  return request(`/api/games/${gameId}/actions/status`);
}

export function submitPhaseOneAction(
  gameId: string,
  action: PhaseOneAction,
  targetGangId?: string,
): Promise<{ accepted: true; resolved: boolean; status: ActionStatus }> {
  return request(`/api/games/${gameId}/actions`, {
    method: "POST",
    body: JSON.stringify({ action, ...(targetGangId ? { targetGangId } : {}) }),
  });
}

export function submitPhaseTwoAction(
  gameId: string,
  action: PhaseTwoAction,
  targetTurfId?: string,
): Promise<{ accepted: true; resolved: boolean; status: ActionStatus }> {
  return request(`/api/games/${gameId}/actions`, {
    method: "POST",
    body: JSON.stringify({ action, ...(targetTurfId ? { targetTurfId } : {}) }),
  });
}
