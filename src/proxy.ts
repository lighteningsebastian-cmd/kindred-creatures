import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/admin/session";

/**
 * Was middleware.ts before Next 16 renamed it. Same job, and in Next 16 it runs
 * on the Node.js runtime by default, so the same node:crypto session check the
 * rest of the app uses works here unchanged.
 *
 * THIS IS NOT THE SECURITY BOUNDARY, and it is important that nobody maintaining
 * it later believes otherwise. Next's own guidance is that proxy runs on every
 * request including prefetches and should do optimistic checks only; the real
 * refusal belongs next to the data. So:
 *
 *   - This file: bounces a logged-out browser to the login page, so the owner
 *     gets a login form instead of a flash of an empty dashboard.
 *   - src/app/admin/(dashboard)/layout.tsx: requireAdmin() before rendering any
 *     page in the group, which is what makes a NEW admin page protected the
 *     moment it is created rather than when someone remembers to protect it.
 *   - Every server action: its own requireAdmin(), because an action is a POST
 *     endpoint that anyone can call directly and a layout has never run for it.
 *
 * Delete this file and the admin is still shut. That is the test it has to pass.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page is the one admin path that must stay open, or there is no way
  // in. It does its own redirect the other way when a session is already valid.
  if (pathname === "/admin/login") return NextResponse.next();

  if (verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const login = new URL("/admin/login", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything under /admin, including /admin itself. Nothing else: the shop is
  // public and must not pay for a cookie check on every product page.
  matcher: ["/admin", "/admin/:path*"],
};
