const BASE = "/api/auth";

export interface AuthUser {
  id: string;
  username: string;
}

async function parseJsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body;
}

export async function enter(name: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/enter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  return parseJsonOrThrow(res);
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/logout`, { method: "POST", credentials: "include" });
}

export async function me(): Promise<AuthUser | null> {
  const res = await fetch(`${BASE}/me`, { credentials: "include" });
  if (res.status === 401) return null;
  return parseJsonOrThrow(res);
}
