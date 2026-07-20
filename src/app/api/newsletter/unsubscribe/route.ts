import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/order-token";
import { getNewsletterProvider, setUnsubscribed } from "@/lib/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe. The token is an HMAC of the normalised email, so the
 * link cannot be edited to opt someone else out; a bad or tampered token lands
 * on the same "invalid link" state rather than revealing whether an address
 * exists. Idempotent: unsubscribing an already-unsubscribed or unknown address
 * is a quiet success. Written as a GET so the visible link works, and RFC 8058
 * one-click POSTs hit the same handler.
 */
async function handle(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const email = verifyToken(token);

  if (email === null) {
    redirect("/unsubscribe?status=invalid");
  }

  await setUnsubscribed(email);
  const provider = await getNewsletterProvider();
  const removed = await provider.unsubscribe({ email });
  if (!removed.ok) {
    // The local status is already flipped, which is the source of truth; a
    // failed provider removal is logged, not surfaced, and never a crash.
    console.error("[newsletter] provider removal failed on unsubscribe");
  }

  redirect("/unsubscribe?status=done");
}

export async function GET(request: Request) {
  return handle(request);
}

// Gmail/Apple Mail one-click opt-out posts to the List-Unsubscribe URL.
export async function POST(request: Request) {
  return handle(request);
}
