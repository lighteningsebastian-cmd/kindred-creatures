import { issueLoginToken } from "@/lib/account/login-tokens";
import { sendMagicLink } from "@/lib/email";
import { siteUrl } from "@/lib/seo/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The one response every path returns, whatever actually happened. Whether the
// address has an account, whether a link was just sent, whether the mail
// bounced: the requester learns none of it, so this endpoint cannot be used to
// discover who has an account.
const GENERIC = {
  ok: true,
  message:
    "If that address can sign in, a link is on its way. Check your inbox.",
} as const;

/**
 * Requests a magic sign-in link. Mints a single-use token, emails the link, and
 * answers identically no matter what, so it leaks nothing. A bad email format is
 * the only 400: it is a client mistake, not an account fact.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const email = (body as { email?: unknown })?.email;
  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return Response.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const issued = await issueLoginToken(email);
  if (issued.ok) {
    const loginUrl = `${siteUrl()}/api/account/callback?token=${encodeURIComponent(issued.rawToken)}`;
    const sent = await sendMagicLink(email.trim(), loginUrl);
    if (!sent.ok) {
      // Logged, never surfaced: a mail failure must not become an account oracle.
      console.error("[account] magic link email failed to send");
    }
  }
  // Rate-limited requests fall through to the same generic answer with no send.

  return Response.json(GENERIC, { status: 200 });
}
