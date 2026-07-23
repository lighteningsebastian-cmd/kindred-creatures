/**
 * Single-use login tokens: minting one, and spending it exactly once.
 *
 * Two flows share this table, told apart by `purpose`:
 *
 *   - "magic-link" (B1): the emailed sign-in link. ~15 min, rate-limited so a
 *     double-submit cannot spray a mailbox.
 *   - "welcome" (D3): the one-time auto-login appended to the PayFast
 *     return_url at checkout, so a buyer who comes back from paying lands
 *     already signed in. ~30 min (PayFast can hold someone a while), NOT
 *     rate-limited (a checkout must never fail because one was just minted).
 *
 * In both cases the raw token exists only in the link. At rest we hold only
 * its SHA-256, so this table leaking cannot be replayed into a login. A token
 * is single-use (usedAt flips once), and issuing a new one for an address
 * supersedes any earlier outstanding one OF THE SAME PURPOSE, so a forwarded
 * old link cannot linger as a second key. Consumption is purpose-scoped: a
 * welcome token pasted into the magic-link callback (or the reverse) spends
 * nothing and signs in nobody.
 */

import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { loginTokens, type LoginTokenPurpose } from "@/lib/db/schema";
import { normaliseEmail } from "@/lib/newsletter";

const TOKEN_TTL_MS = 15 * 60 * 1000;
/** Welcome tokens live longer: the PayFast hop plus a slow payment screen can
 * eat a quarter hour on its own, and an expired token only costs the auto-login
 * (the page still renders), so generosity here is cheap. */
const WELCOME_TTL_MS = 30 * 60 * 1000;
// A fresh link within this window reuses nothing but is simply refused, so a
// double-submit or an impatient retry cannot spray a mailbox with links.
const MIN_REISSUE_MS = 45 * 1000;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Marks every outstanding token of this purpose for this email as spent. */
async function supersedeOutstanding(
  email: string,
  purpose: LoginTokenPurpose,
  now: number,
): Promise<void> {
  const db = await getDb();
  await db
    .update(loginTokens)
    .set({ usedAt: new Date(now) })
    .where(
      and(
        eq(loginTokens.email, email),
        eq(loginTokens.purpose, purpose),
        isNull(loginTokens.usedAt),
      ),
    );
}

export type IssueResult =
  | { ok: true; rawToken: string }
  | { ok: false; reason: "rate-limited" };

/**
 * Mints a single-use magic-link token for an email and returns the RAW token
 * (to go in the link) once. Supersedes any earlier outstanding magic-link token
 * for the address, and refuses if one was just issued (rate limit). The caller
 * emails the link on ok and, either way, tells the requester nothing that
 * distinguishes the cases.
 */
export async function issueLoginToken(
  email: string,
  now: number = Date.now(),
): Promise<IssueResult> {
  const e = normaliseEmail(email);
  const db = await getDb();

  const recent = await db
    .select({ id: loginTokens.id })
    .from(loginTokens)
    .where(
      and(
        eq(loginTokens.email, e),
        eq(loginTokens.purpose, "magic-link"),
        isNull(loginTokens.usedAt),
        gt(loginTokens.createdAt, new Date(now - MIN_REISSUE_MS)),
      ),
    );
  if (recent.length > 0) return { ok: false, reason: "rate-limited" };

  await supersedeOutstanding(e, "magic-link", now);

  const rawToken = randomBytes(32).toString("base64url");
  await db.insert(loginTokens).values({
    email: e,
    tokenHash: hashToken(rawToken),
    purpose: "magic-link",
    expiresAt: new Date(now + TOKEN_TTL_MS),
    // Set explicitly (not the DB default) so `now` fully controls this row's
    // clock: the rate-limit window compares against it.
    createdAt: new Date(now),
  });

  return { ok: true, rawToken };
}

/**
 * Mints the one-time welcome token a checkout appends to the PayFast
 * return_url. No rate limit: this is minted by our own checkout route, not on
 * request, and opening an order must never fail because another one just did.
 * A new checkout supersedes any earlier outstanding welcome token for the same
 * email, so at most one such URL is live per address; the superseded buyer's
 * return page still renders identically, just without the auto-login.
 */
export async function issueWelcomeToken(
  email: string,
  now: number = Date.now(),
): Promise<string> {
  const e = normaliseEmail(email);
  const db = await getDb();

  await supersedeOutstanding(e, "welcome", now);

  const rawToken = randomBytes(32).toString("base64url");
  await db.insert(loginTokens).values({
    email: e,
    tokenHash: hashToken(rawToken),
    purpose: "welcome",
    expiresAt: new Date(now + WELCOME_TTL_MS),
    createdAt: new Date(now),
  });

  return rawToken;
}

/**
 * Spends a raw token of the given purpose: if it is unexpired, unused and of
 * that purpose, marks it used and returns the email it authenticates.
 * Everything else (unknown, expired, already used, wrong purpose, malformed)
 * returns null, indistinguishably. The used-flip is conditional on usedAt still
 * being null in the UPDATE, so two clicks of one link cannot both win.
 */
async function consumeToken(
  rawToken: unknown,
  purpose: LoginTokenPurpose,
  now: number,
): Promise<string | null> {
  if (typeof rawToken !== "string" || rawToken === "") return null;
  const db = await getDb();
  const consumed = await db
    .update(loginTokens)
    .set({ usedAt: new Date(now) })
    .where(
      and(
        eq(loginTokens.tokenHash, hashToken(rawToken)),
        eq(loginTokens.purpose, purpose),
        isNull(loginTokens.usedAt),
        gt(loginTokens.expiresAt, new Date(now)),
      ),
    )
    .returning();
  return consumed[0]?.email ?? null;
}

/** Spends a magic-link token. See consumeToken for the guarantees. */
export async function consumeLoginToken(
  rawToken: unknown,
  now: number = Date.now(),
): Promise<string | null> {
  return consumeToken(rawToken, "magic-link", now);
}

/** Spends a welcome token from the PayFast return_url. See consumeToken. */
export async function consumeWelcomeToken(
  rawToken: unknown,
  now: number = Date.now(),
): Promise<string | null> {
  return consumeToken(rawToken, "welcome", now);
}
