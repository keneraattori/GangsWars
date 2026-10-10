import { createHash, timingSafeEqual } from "node:crypto";

export interface AdminEnv {
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

// Admin login is disabled until ADMIN_PASSWORD is configured.
export function isAdminConfigured(env: AdminEnv = process.env): boolean {
  return Boolean(env.ADMIN_PASSWORD);
}

export function checkAdminCredentials(username: string, password: string, env: AdminEnv = process.env): boolean {
  if (!env.ADMIN_PASSWORD) return false;
  // Hashing first gives equal-length buffers, so the comparison does not leak the length.
  const usernameOk = timingSafeEqual(digest(username), digest(env.ADMIN_USERNAME ?? "admin"));
  const passwordOk = timingSafeEqual(digest(password), digest(env.ADMIN_PASSWORD));
  return usernameOk && passwordOk;
}
