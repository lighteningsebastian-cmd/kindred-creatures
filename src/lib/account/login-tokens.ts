/**
 * Magic-link tokens: minting one, and spending it exactly once.
 *
 * The raw token exists only in the emailed link. At rest we hold only its
 * SHA-256, so this table leaking cannot be replayed into a login. A token is
 * single-use (usedAt flips once) and short-lived (~15 min), and issuing a new
 * one for an address supersedes any earlier outstanding one so a forwarded old
 * link cannot linger as a second key.
 */

import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { loginTokens } from "@/lib/db/schema";
import { normaliseEmail } from "@/lib/newsletter";

const TOKEN_TTL_MS = 15 * 60 * 1000;
// A fresh link within this window reuses nothing but is simply refused, so a
// double-submit or an impatient retry cannot spray a mailbox with links.
const MIN_REISSUE_MS = 45 * 1000;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type IssueResult =
  | { ok: true; rawToken: string }
  | { ok: false; reason: "rate-limited" };

/**
 * Mints a single-use login token for an email and returns the RAW token (to go
 * in the link) once. Supersedes any earlier outstanding token for the address,
 * and refuses if one was just issued (rate limit). The caller emails the link on
 * ok and, either way, tells the requester nothing that distinguishes the cases.
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
        isNull(loginTokens.usedAt),
        gt(loginTokens.createdAt, new Date(now - MIN_REISSUE_MS)),
      ),
    );
  if (recent.length > 0) return { ok: false, reason: "rate-limited" };

  // Supersede any older outstanding token for this address.
  await db
    .update(loginTokens)
    .set({ usedAt: new Date(now) })
    .where(and(eq(loginTokens.email, e), isNull(loginTokens.usedAt)));

  const rawToken = randomBytes(32).toString("base64url");
  await db.insert(loginTokens).values({
    email: e,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(now + TOKEN_TTL_MS),
    // Set explicitly (not the DB default) so `now` fully controls this row's
    // clock: the rate-limit window compares against it.
    createdAt: new Date(now),
  });

  return { ok: true, rawToken };
}

/**
 * Spends a raw token: if it is unexpired and unused, marks it used and returns
 * the email it authenticates. Everything else (unknown, expired, already used,
 * malformed) returns null, indistinguishably. The used-flip is conditional on
 * usedAt still being null in the UPDATE, so two clicks of one link cannot both
 * win.
 */
export async function consumeLoginToken(
  rawToken: unknown,
  now: number = Date.now(),
): Promise<string | null> {
  if (typeof rawToken !== "string" || rawToken === "") return null;
  const db = await getDb();
  const consumed = await db
    .update(loginTokens)
    .set({ usedAt: new Date(now) })
    .where(
      and(
        eq(loginTokens.tokenHash, hashToken(rawToken)),
        isNull(loginTokens.usedAt),
        gt(loginTokens.expiresAt, new Date(now)),
      ),
    )
    .returning();
  return consumed[0]?.email ?? null;
}
