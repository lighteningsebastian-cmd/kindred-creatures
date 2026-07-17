import { requireAdmin } from "@/lib/admin/auth";

/** Placeholder. The order list lands here in the next commit. */
export default async function AdminDashboardPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
      <h1 className="font-display text-2xl text-ink">Orders</h1>
    </div>
  );
}
