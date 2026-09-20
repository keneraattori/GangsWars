import { describe, expect, it } from "vitest";
import { signAuthToken, verifyAuthToken } from "../src/services/jwt.js";

const TEST_SECRET = "test-secret";

describe("auth token", () => {
  it("round-trips the payload", () => {
    const token = signAuthToken({ sub: "user-1", username: "alice" }, TEST_SECRET);
    const payload = verifyAuthToken(token, TEST_SECRET);
    expect(payload.sub).toBe("user-1");
    expect(payload.username).toBe("alice");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signAuthToken({ sub: "user-1", username: "alice" }, TEST_SECRET);
    expect(() => verifyAuthToken(token, "different-secret")).toThrow();
  });

  it("throws when no secret is configured", () => {
    expect(() => signAuthToken({ sub: "user-1", username: "alice" }, undefined)).toThrow(
      /JWT_SECRET/,
    );
  });
});
