import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
