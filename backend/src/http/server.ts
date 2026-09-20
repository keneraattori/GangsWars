import "dotenv/config";
import { createApp } from "./app.js";
import { pool } from "../db/pool.js";
import { processExpiredPhases } from "../services/phaseTimeout.js";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

const timeoutWorker = setInterval(() => {
  void processExpiredPhases(pool).catch((error: unknown) => {
    console.error('Phase timeout worker failed', error);
  });
}, 15_000);
timeoutWorker.unref();
