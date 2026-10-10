import type { GameSummary } from "./games";

export interface AdminPlayer {
  id: string;
  username: string;
  joinedAt: string;
  lastSeenAt: string;
  online: boolean;
  gameId: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

export function adminLogin(username: string, password: string): Promise<{ admin: true }> {
  return request("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function adminLogout(): Promise<void> {
  return request("/api/admin/logout", { method: "POST" });
}

export async function isAdmin(): Promise<boolean> {
  const response = await fetch("/api/admin/me", { credentials: "include" });
  return response.ok;
}

export function listPlayers(): Promise<{ players: AdminPlayer[] }> {
  return request("/api/admin/players");
}

export function removePlayer(playerId: string): Promise<void> {
  return request(`/api/admin/players/${playerId}`, { method: "DELETE" });
}

export function listAllGames(): Promise<{ games: GameSummary[] }> {
  return request("/api/admin/games");
}

export function createGame(maxPlayers: number): Promise<GameSummary> {
  return request("/api/admin/games", { method: "POST", body: JSON.stringify({ maxPlayers }) });
}

export function startGame(gameId: string): Promise<GameSummary> {
  return request(`/api/admin/games/${gameId}/start`, { method: "POST" });
}

export function deleteAllGames(): Promise<{ deletedCount: number }> {
  return request("/api/admin/games", {
    method: "DELETE",
    body: JSON.stringify({ confirmation: "DELETE_ALL_GAMES" }),
  });
}
