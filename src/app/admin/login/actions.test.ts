// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { login, logout, type LoginState } from "./actions";
import { hashPassword } from "@/lib/admin/password";
import { resetThrottle } from "@/lib/admin/rate-limit";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/admin/session";

/**
 * The login action, which is the only code in the shop that turns a password
 * into access. The cases that matter are the ones where it says too much: a
 * different sentence for a wrong email than for a wrong password turns "guess
 * the password" into "guess the password of a known account".
 */

const EMAIL = "owner@kindredcreatures.co.za";
const PASSWORD = "a-long-enough-admin-password";
let HASH: string;

const cookieSet = vi.fn();
const cookieStore = { set: cookieSet, get: vi.fn(), delete: vi.fn() };

/** Stands in for next/navigation's redirect, which throws to unwind the render. */
class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`);
  }
}

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
}));

// The escalating delay is real, and a test that sat through it would spend
// twenty seconds proving something rate-limit.test already proves directly
// (throttleFor returns the growing delay). Everything else about the throttle
// here is the real module: only the stall is skipped.
vi.mock("@/lib/admin/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/rate-limit")>()),
  sleep: async () => {},
}));

/** Runs the action, turning the redirect-throw into a value we can assert on. */
async function attempt(
  email: string,
  password: string,
): Promise<{ state?: LoginState; redirectedTo?: string }> {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  try {
    return { state: await login({ error: null }, form) };
  } catch (error) {
    if (error instanceof RedirectError) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(async () => {
  HASH ??= await hashPassword(PASSWORD);
  resetThrottle();
  cookieSet.mockClear();
  vi.stubEnv("ADMIN_EMAIL", EMAIL);
  vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("login", () => {
  it("authenticates the correct credentials and sets a valid session", async () => {
    const { redirectedTo } = await attempt(EMAIL, PASSWORD);

    expect(redirectedTo).toBe("/admin");
    expect(cookieSet).toHaveBeenCalledOnce();

    const [name, value, options] = cookieSet.mock.calls[0];
    expect(name).toBe(ADMIN_COOKIE);
    expect(verifySessionValue(value)).toBe(true);
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/admin");
  });

  it("accepts the email case-insensitively, because email is not case-sensitive", async () => {
    const { redirectedTo } = await attempt(EMAIL.toUpperCase(), PASSWORD);
    expect(redirectedTo).toBe("/admin");
  });

  it("rejects the wrong password and sets no cookie", async () => {
    const { state } = await attempt(EMAIL, "wrong-password");
    expect(state?.error).toBe("Those details do not match.");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("rejects an unknown email and sets no cookie", async () => {
    const { state } = await attempt("someone@else.com", PASSWORD);
    expect(state?.error).toBe("Those details do not match.");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("does not enumerate: wrong email and wrong password read identically", async () => {
    const wrongEmail = await attempt("someone@else.com", PASSWORD);
    const wrongPassword = await attempt(EMAIL, "wrong-password");
    const bothWrong = await attempt("someone@else.com", "wrong-password");

    expect(wrongEmail.state).toEqual(wrongPassword.state);
    expect(wrongPassword.state).toEqual(bothWrong.state);
  });

  it("is closed when ADMIN_PASSWORD_HASH is unset, even with the right email", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");

    const { state, redirectedTo } = await attempt(EMAIL, PASSWORD);

    expect(redirectedTo).toBeUndefined();
    expect(state?.error).toBe("Those details do not match.");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("is closed when ADMIN_EMAIL is unset", async () => {
    vi.stubEnv("ADMIN_EMAIL", "");

    const { state } = await attempt("", PASSWORD);

    expect(state?.error).toBe("Those details do not match.");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("says the same thing to an unconfigured admin as to a wrong password", async () => {
    const configured = await attempt(EMAIL, "wrong-password");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    const unconfigured = await attempt(EMAIL, PASSWORD);

    expect(unconfigured.state).toEqual(configured.state);
  });

  it("locks out after ten failures, and stops considering the real password", async () => {
    for (let i = 0; i < 10; i++) await attempt(EMAIL, "wrong-password");

    const { state, redirectedTo } = await attempt(EMAIL, PASSWORD);

    expect(redirectedTo).toBeUndefined();
    expect(state?.error).toContain("Too many attempts");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("never echoes the password or the hash back to the caller", async () => {
    const { state } = await attempt(EMAIL, "wrong-password");
    const rendered = JSON.stringify(state);
    expect(rendered).not.toContain(HASH);
    expect(rendered).not.toContain("wrong-password");
  });
});

describe("logout", () => {
  it("clears the session cookie and returns to the login page", async () => {
    await expect(logout()).rejects.toThrow("REDIRECT:/admin/login");

    const [name, value, options] = cookieSet.mock.calls[0];
    expect(name).toBe(ADMIN_COOKIE);
    expect(value).toBe("");
    expect(options.maxAge).toBe(0);
  });
});
