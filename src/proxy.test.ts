// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, createSessionValue } from "@/lib/admin/session";

/**
 * The optimistic guard. It is not the security boundary (the layout and the
 * actions are), but it is the thing that decides whether the owner sees a login
 * form or a flash of a dashboard, and a matcher that misses /admin entirely
 * would be a quiet regression.
 */

let HASH: string;

function request(path: string, cookie?: string): NextRequest {
  const req = new NextRequest(new URL(`https://kindredcreatures.co.za${path}`));
  if (cookie) req.cookies.set(ADMIN_COOKIE, cookie);
  return req;
}

beforeEach(async () => {
  HASH ??= await hashPassword("a-long-enough-admin-password");
  vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy", () => {
  it("sends an unauthenticated admin request to the login page", () => {
    const response = proxy(request("/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/login");
  });

  it("sends unauthenticated nested admin routes to the login page too", () => {
    for (const path of ["/admin/orders/abc", "/admin/anything/at/all"]) {
      const response = proxy(request(path));
      expect(response.headers.get("location")).toContain("/admin/login");
    }
  });

  it("lets an authenticated request through", () => {
    const response = proxy(request("/admin", createSessionValue()!));
    expect(response.headers.get("location")).toBeNull();
  });

  it("refuses a forged cookie", () => {
    const response = proxy(request("/admin", "9999999999.not-a-signature"));
    expect(response.headers.get("location")).toContain("/admin/login");
  });

  it("leaves the login page reachable, or there is no way in", () => {
    const response = proxy(request("/admin/login"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("matches every admin path and nothing else", () => {
    expect(config.matcher).toContain("/admin");
    expect(config.matcher).toContain("/admin/:path*");
    expect(config.matcher).toHaveLength(2);
  });
});
