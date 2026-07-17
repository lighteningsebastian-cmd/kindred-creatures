// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hashPassword, safeEqual, verifyPassword } from "./password";
import {
  ADMIN_COOKIE,
  adminConfigured,
  createSessionValue,
  sessionCookieOptions,
  verifySessionValue,
  SESSION_TTL_SEC,
} from "./session";
import {
  recordFailure,
  recordSuccess,
  resetThrottle,
  throttleFor,
} from "./rate-limit";

/**
 * The admin door. Every test here is a way in that should not exist: a forged
 * cookie, a session that outlived its password, an unconfigured shop that
 * accidentally opens rather than closes.
 *
 * Nothing here touches the network or the database. The password hashing is
 * real scrypt, which is why the hashes are computed once in beforeAll rather
 * than per case.
 */

const PASSWORD = "a-long-enough-admin-password";
let HASH: string;

beforeEach(async () => {
  HASH ??= await hashPassword(PASSWORD);
  resetThrottle();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("password hashing", () => {
  it("verifies the password it was made from", async () => {
    await expect(verifyPassword(PASSWORD, HASH)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    await expect(verifyPassword("not-the-password", HASH)).resolves.toBe(false);
  });

  it("salts: the same password hashes differently every time", async () => {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    expect(a).not.toEqual(b);
    // ...and both still verify.
    await expect(verifyPassword(PASSWORD, a)).resolves.toBe(true);
    await expect(verifyPassword(PASSWORD, b)).resolves.toBe(true);
  });

  it("stores no plaintext", () => {
    expect(HASH).not.toContain(PASSWORD);
  });

  it("carries its cost parameters, so raising the cost cannot lock the owner out", async () => {
    // A hash generated at a lower cost keeps verifying at ITS cost.
    const [scheme, N, r, p] = HASH.split("$");
    expect(scheme).toBe("scrypt");
    expect(Number(N)).toBeGreaterThanOrEqual(16384);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
  });

  it("fails closed on a missing or malformed hash rather than throwing", async () => {
    await expect(verifyPassword(PASSWORD, undefined)).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, "")).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, "scrypt$1$1$1$$")).resolves.toBe(false);
    // A cost that would blow the heap is refused, not attempted.
    await expect(
      verifyPassword(PASSWORD, "scrypt$99999999$8$1$AAAA$AAAA"),
    ).resolves.toBe(false);
  });
});

describe("safeEqual", () => {
  it("matches identical strings and nothing else", () => {
    expect(safeEqual("owner@example.com", "owner@example.com")).toBe(true);
    expect(safeEqual("owner@example.com", "other@example.com")).toBe(false);
    // Length mismatch must be false, not a throw.
    expect(safeEqual("short", "a-much-longer-string")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("admin configuration", () => {
  it("is closed when nothing is set", () => {
    expect(adminConfigured()).toBe(false);
  });

  it("is closed when only the email is set", () => {
    vi.stubEnv("ADMIN_EMAIL", "owner@example.com");
    expect(adminConfigured()).toBe(false);
  });

  it("is closed when only the hash is set", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    expect(adminConfigured()).toBe(false);
  });

  it("is open only with both", () => {
    vi.stubEnv("ADMIN_EMAIL", "owner@example.com");
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    expect(adminConfigured()).toBe(true);
  });
});

describe("session cookie", () => {
  it("mints nothing when ADMIN_PASSWORD_HASH is unset", () => {
    expect(createSessionValue()).toBeNull();
  });

  it("round-trips a freshly minted session", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    const value = createSessionValue();
    expect(value).not.toBeNull();
    expect(verifySessionValue(value)).toBe(true);
  });

  it("refuses every session when the hash goes away (fail closed)", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    const value = createSessionValue();
    expect(verifySessionValue(value)).toBe(true);

    // The env var is removed, e.g. a deploy that lost its secret. A browser
    // still holding a valid cookie must NOT keep its access.
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    expect(verifySessionValue(value)).toBe(false);
  });

  it("invalidates sessions signed under a previous password", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    const value = createSessionValue();

    const newHash = await hashPassword("a-completely-different-password");
    vi.stubEnv("ADMIN_PASSWORD_HASH", newHash);

    expect(verifySessionValue(value)).toBe(false);
  });

  it("refuses an expired session", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    const now = Date.now();
    const value = createSessionValue(now);

    expect(verifySessionValue(value, now + SESSION_TTL_SEC * 1000 - 1000)).toBe(
      true,
    );
    expect(verifySessionValue(value, now + SESSION_TTL_SEC * 1000 + 1000)).toBe(
      false,
    );
  });

  it("refuses a forged or edited cookie", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    const value = createSessionValue()!;
    const [exp, sig] = value.split(".");

    // An expiry pushed into the far future, keeping the original signature.
    expect(verifySessionValue(`${Number(exp) + 999999}.${sig}`)).toBe(false);
    // A plausible but wrong signature of the right length.
    expect(verifySessionValue(`${exp}.${"A".repeat(sig.length)}`)).toBe(false);
    // Junk of every shape.
    expect(verifySessionValue("")).toBe(false);
    expect(verifySessionValue(".")).toBe(false);
    expect(verifySessionValue(exp)).toBe(false);
    expect(verifySessionValue(`.${sig}`)).toBe(false);
    expect(verifySessionValue(undefined)).toBe(false);
    expect(verifySessionValue(null)).toBe(false);
    expect(verifySessionValue(42)).toBe(false);
    expect(verifySessionValue({ toString: () => value })).toBe(false);
  });

  it("carries no identity or secret in the cookie value", () => {
    vi.stubEnv("ADMIN_EMAIL", "owner@example.com");
    vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
    const value = createSessionValue()!;
    expect(value).not.toContain("owner@example.com");
    expect(value).not.toContain(HASH);
    expect(value).not.toContain(PASSWORD);
  });

  it("scopes the cookie to /admin, httpOnly, and TLS-only in production", () => {
    const options = sessionCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/admin");
    expect(options.sameSite).toBe("lax");
    expect(ADMIN_COOKIE).toBeTruthy();

    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions().secure).toBe(true);
  });
});

describe("login throttling", () => {
  it("does not stall a caller with no history", () => {
    expect(throttleFor("1.2.3.4")).toEqual({ locked: false, delayMs: 0 });
  });

  it("grows the delay with each failure", () => {
    const ip = "1.2.3.4";
    recordFailure(ip);
    expect(throttleFor(ip).delayMs).toBe(250);
    recordFailure(ip);
    expect(throttleFor(ip).delayMs).toBe(500);
    recordFailure(ip);
    expect(throttleFor(ip).delayMs).toBe(1000);
  });

  it("caps the delay rather than growing without bound", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 6; i++) recordFailure(ip);
    expect(throttleFor(ip).delayMs).toBe(4000);
  });

  it("locks out after ten failures", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 9; i++) recordFailure(ip);
    expect(throttleFor(ip).locked).toBe(false);
    recordFailure(ip);
    expect(throttleFor(ip).locked).toBe(true);
  });

  it("forgets a caller once the window passes", () => {
    const ip = "1.2.3.4";
    const now = Date.now();
    for (let i = 0; i < 10; i++) recordFailure(ip, now);
    expect(throttleFor(ip, now).locked).toBe(true);
    expect(throttleFor(ip, now + 16 * 60 * 1000).locked).toBe(false);
  });

  it("clears the record on a successful login", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) recordFailure(ip);
    recordSuccess(ip);
    expect(throttleFor(ip)).toEqual({ locked: false, delayMs: 0 });
  });

  it("throttles each caller separately", () => {
    recordFailure("1.2.3.4");
    recordFailure("1.2.3.4");
    expect(throttleFor("5.6.7.8").delayMs).toBe(0);
  });
});
