import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { logout } from "@/app/admin/login/actions";

export const runtime = "nodejs";
// No admin page may ever be prerendered or cached: every one of them reads a
// session cookie and one person's orders.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin | Kindred Creatures",
  // S9 owns robots.txt; this makes the admin non-indexable regardless of it.
  robots: { index: false, follow: false },
};

/**
 * The guarded shell. Everything inside the (dashboard) route group renders
 * through here, which is the point: adding src/app/admin/(dashboard)/refunds/
 * tomorrow makes a page that is already behind requireAdmin(), with nobody
 * having had to remember anything.
 *
 * The route group has no URL segment, so these pages are still /admin and
 * /admin/orders/[id]. /admin/login lives outside the group precisely because it
 * must not inherit this guard.
 *
 * Layout protection is necessary and not sufficient. React does not re-run a
 * layout for a server action, so each action guards itself as well. This is the
 * floor, not the ceiling.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-full bg-base">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-baseline gap-3">
            <Link href="/admin" className="font-display text-lg text-ink">
              Kindred Creatures
            </Link>
            <span className="eyebrow text-[11px] text-accent">Admin</span>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="eyebrow rounded-md border border-line-strong px-3 py-1.5 text-[11px] text-ink transition-colors hover:bg-surface-alt"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}
