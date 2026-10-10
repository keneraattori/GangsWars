import { createApp } from "./app.js";
import { pool } from "../db/pool.js";
import { processExpiredPhases } from "../services/phaseTimeout.js";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const host = "127.0.0.1";
const app = createApp();

app.listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port}`);
});

const timeoutWorker = setInterval(() => {
  void processExpiredPhases(pool).catch((error: unknown) => {
    console.error('Phase timeout worker failed', error);
  });
}, 15_000);
timeoutWorker.unref();
