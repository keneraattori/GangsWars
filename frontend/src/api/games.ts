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

export function createGame(maxPlayers: number): Promise<GameSummary> {
  return request("/api/games", {
    method: "POST",
    body: JSON.stringify({ maxPlayers }),
  });
}

export function getGame(gameId: string): Promise<GameSummary> {
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
