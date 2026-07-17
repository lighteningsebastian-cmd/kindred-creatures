import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { LoginForm } from "@/components/admin/LoginForm";
import { isAdminRequest } from "@/lib/admin/auth";
import { adminConfigured } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in | Kindred Creatures",
  // S9 owns robots.txt. This is the belt to its braces: the admin is not a
  // place a crawler has any business being, and saying so on the page itself
  // means a future robots.txt edit cannot quietly expose it.
  robots: { index: false, follow: false },
};

/**
 * The login page. It sits OUTSIDE the (dashboard) route group on purpose: that
 * group's layout redirects anyone without a session here, and a login page that
 * redirected to itself would be a loop.
 */
export default async function AdminLoginPage() {
  // Already signed in? Then this page is not the one you wanted.
  if (await isAdminRequest()) redirect("/admin");

  const configured = adminConfigured();
  const showSetupHelp = !configured && process.env.NODE_ENV !== "production";

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <div className="mx-auto w-full max-w-sm">
          <p className="eyebrow text-xs text-accent">Kindred Creatures</p>
          <h1 className="mt-3 font-display text-3xl leading-[1.1] text-ink">
            Admin sign in
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Orders and fulfilment. Staff only.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>

          {showSetupHelp ? (
            <div className="mt-8 rounded-md border border-line-strong bg-surface p-4">
              <p className="eyebrow text-[11px] text-muted">Not configured</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">
                Admin is closed. ADMIN_EMAIL and ADMIN_PASSWORD_HASH are not both
                set, so no password can match and nobody can sign in.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                To open it, generate a hash and put both values in .env.local:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-sm border border-line bg-base p-3 font-mono text-xs text-ink">
                node scripts/hash-admin-password.ts
              </pre>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                This notice appears in development only.
              </p>
            </div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
