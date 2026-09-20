import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);

  return app;
}
