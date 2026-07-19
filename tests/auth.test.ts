import { describe, expect, it } from "vitest";

import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import { hashIp, issueToken, hashToken, safeEqual } from "@/lib/auth/tokens";

/**
 * Auth primitive tests.
 *
 * These cover the pure cryptographic layer. The scope rules that decide who can
 * see which child are exercised against a real database in tests/scope.test.ts.
 */

describe("token issuance", () => {
  it("never returns the raw token as the stored value", () => {
    const { token, hash } = issueToken();
    // If these were ever equal, the database would hold usable session tokens.
    expect(hash).not.toBe(token);
    expect(hash).toBe(hashToken(token));
  });

  it("produces 256 bits of entropy per token", () => {
    const { token } = issueToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("does not collide across many issuances", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) seen.add(issueToken().token);
    expect(seen.size).toBe(1000);
  });

  it("is url-safe, so it survives being emailed as a link", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(issueToken().token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe("safeEqual", () => {
  it("matches identical strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });

  it("rejects different strings of equal length", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
  });

  it("rejects different lengths without throwing", () => {
    // timingSafeEqual throws on length mismatch; the wrapper must not.
    expect(() => safeEqual("short", "much-longer-value")).not.toThrow();
    expect(safeEqual("short", "much-longer-value")).toBe(false);
  });
});

describe("ip hashing", () => {
  it("never returns the raw address", () => {
    const hashed = hashIp("192.168.1.50", "secret");
    expect(hashed).not.toContain("192.168");
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is stable for the same address, so abuse can still be correlated", () => {
    expect(hashIp("10.0.0.1", "secret")).toBe(hashIp("10.0.0.1", "secret"));
  });

  it("differs under a different secret, defeating precomputed tables", () => {
    expect(hashIp("10.0.0.1", "secret-a")).not.toBe(
      hashIp("10.0.0.1", "secret-b"),
    );
  });

  it("returns null for a missing address rather than hashing an empty string", () => {
    expect(hashIp(null, "secret")).toBeNull();
    expect(hashIp(undefined, "secret")).toBeNull();
  });
});

describe("password hashing", () => {
  it("uses argon2id, not argon2i or argon2d", async () => {
    const hash = await hashPassword("a-sufficiently-long-password");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("encodes the OWASP-recommended cost parameters", async () => {
    const hash = await hashPassword("a-sufficiently-long-password");
    expect(hash).toContain("m=19456");
    expect(hash).toContain("t=2");
    expect(hash).toContain("p=1");
  });

  it("salts, so identical passwords do not produce identical hashes", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password-here"),
      hashPassword("same-password-here"),
    ]);
    expect(a).not.toBe(b);
  });

  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword(hash, "correct-horse-battery")).toBe(true);
    expect(await verifyPassword(hash, "correct-horse-batteru")).toBe(false);
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    // A corrupt row must read as "wrong password", not crash the sign-in route.
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
    expect(await verifyPassword("", "anything")).toBe(false);
  });

  it("flags weaker legacy hashes for upgrade", () => {
    expect(needsRehash("$argon2id$v=19$m=4096,t=2,p=1$abc$def")).toBe(true);
    expect(needsRehash("$2b$12$somethingbcryptshaped")).toBe(true);
  });

  it("does not flag hashes at current parameters", async () => {
    expect(needsRehash(await hashPassword("a-sufficiently-long-password"))).toBe(
      false,
    );
  });
});
