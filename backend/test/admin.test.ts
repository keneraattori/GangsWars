import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/http/app.js";
import { checkAdminCredentials, isAdminConfigured } from "../src/services/adminAuth.js";
import { signAuthToken } from "../src/services/jwt.js";

describe("admin credentials", () => {
  const env = { ADMIN_USERNAME: "boss", ADMIN_PASSWORD: "s3cret" };

  it("accepts the configured username and password", () => {
    expect(checkAdminCredentials("boss", "s3cret", env)).toBe(true);
  });

  it("rejects a wrong username or password", () => {
    expect(checkAdminCredentials("boss", "wrong", env)).toBe(false);
    expect(checkAdminCredentials("other", "s3cret", env)).toBe(false);
  });

  it("defaults the username to admin", () => {
    expect(checkAdminCredentials("admin", "s3cret", { ADMIN_PASSWORD: "s3cret" })).toBe(true);
  });

  it("is disabled when no password is configured", () => {
    expect(isAdminConfigured({})).toBe(false);
    expect(checkAdminCredentials("admin", "", {})).toBe(false);
  });
});

describe("admin and player routes", () => {
  it("rejects admin endpoints without an admin cookie", async () => {
    const res = await request(createApp()).get("/api/admin/players");
    expect(res.status).toBe(401);
  });

  it("does not accept a player token as admin", async () => {
    process.env.JWT_SECRET ??= "test-secret";
    const token = signAuthToken({ sub: "user-1", username: "alice", role: "player" });
    const res = await request(createApp()).get("/api/admin/players").set("Cookie", `gw_token=${token}; gw_admin_token=${token}`);
    expect(res.status).toBe(401);
  });

  it("requires a player cookie for game endpoints", async () => {
    const res = await request(createApp()).get("/api/games/open");
    expect(res.status).toBe(401);
  });

  it("validates the gang name when entering the lobby", async () => {
    const res = await request(createApp()).post("/api/auth/enter").send({ name: "x" });
    expect(res.status).toBe(400);
  });
});
