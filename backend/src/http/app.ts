import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/games.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/games", gameRoutes);

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
