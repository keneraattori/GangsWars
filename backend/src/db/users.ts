import type { Pool } from "pg";
import type { User } from "../models/user.js";

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  created_at: Date;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export async function createUser(
  pool: Pool,
  input: { username: string; email: string | null; passwordHash: string },
): Promise<User> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, password_hash, created_at`,
    [input.username, input.email, input.passwordHash],
  );
  return toUser(result.rows[0]);
}

export async function findUserByUsername(pool: Pool, username: string): Promise<User | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, username, email, password_hash, created_at FROM users WHERE username = $1`,
    [username],
  );
  return result.rows[0] ? toUser(result.rows[0]) : null;
}

export async function findUserByEmail(pool: Pool, email: string): Promise<User | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, username, email, password_hash, created_at FROM users WHERE email = $1`,
    [email],
  );
  return result.rows[0] ? toUser(result.rows[0]) : null;
}
