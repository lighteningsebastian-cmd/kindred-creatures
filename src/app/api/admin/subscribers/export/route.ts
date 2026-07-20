import { isAdminRequest } from "@/lib/admin/auth";
import {
  listSubscribersForExport,
  subscribersToCsv,
} from "@/lib/admin/subscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Downloads the whole subscriber list as a CSV. Same gate as the rest of
 * /admin, checked with the exact primitive requireAdmin() uses: an unsigned or
 * expired session gets a 401, never a byte of the list. It answers 401 rather
 * than redirecting to the login HTML because a download that quietly returns a
 * page is worse than one that plainly fails; either way the data stays behind
 * the gate. The columns match CSV_HEADER, one row per subscriber, escaped so no
 * address or source can break the file.
 */
export async function GET(): Promise<Response> {
  if (!(await isAdminRequest())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rows = await listSubscribersForExport();
  const csv = subscribersToCsv(rows);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="subscribers.csv"',
      // A subscriber list is not something a shared cache should ever hold.
      "Cache-Control": "no-store",
    },
  });
}
