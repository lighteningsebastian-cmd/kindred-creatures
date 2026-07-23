/**
 * Verifying Resend's delivery webhooks (D4).
 *
 * Resend signs webhooks the Svix way: three headers (svix-id, svix-timestamp,
 * svix-signature), an HMAC-SHA256 over "id.timestamp.payload" using the
 * base64-decoded signing secret (the part after the "whsec_" prefix), and the
 * signature header carrying one or more space-separated "version,base64sig"
 * entries. This module implements that scheme with node crypto and nothing
 * else: no SDK, constant-time comparison, and a timestamp window so a captured
 * request cannot be replayed at us next week.
 *
 * It is pure on purpose (no env reads, no db): the route owns configuration
 * and the tests can drive every rejection without a server.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * How far a webhook's clock may sit from ours, either way. Five minutes is
 * Svix's own default: enough for real clock skew and queue latency, far too
 * little for a replayed capture to be useful.
 */
export const WEBHOOK_TOLERANCE_SEC = 5 * 60;

export type ResendWebhookHeaders = {
  /** svix-id: the delivery's unique id. Part of the signed content. */
  id: string | null;
  /** svix-timestamp: seconds since epoch, as text. Signed and window-checked. */
  timestamp: string | null;
  /** svix-signature: space-separated "v1,<base64>" entries. */
  signature: string | null;
};

/**
 * The signing key bytes inside a "whsec_..." secret. The prefix is cosmetic
 * (it tells a human which kind of secret they are holding); the key is the
 * base64 that follows it.
 */
function keyBytes(secret: string): Buffer {
  const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Buffer.from(encoded, "base64");
}

/** One candidate signature from the header, base64-decoded, or null. */
function candidateBytes(entry: string): Buffer | null {
  // Entries look like "v1,dGhlIHNpZ25hdHVyZQ==". Only v1 (HMAC-SHA256) is a
  // scheme we implement; an unknown version is not a near-miss, it is noise.
  const comma = entry.indexOf(",");
  if (comma <= 0) return null;
  if (entry.slice(0, comma) !== "v1") return null;
  const decoded = Buffer.from(entry.slice(comma + 1), "base64");
  return decoded.length > 0 ? decoded : null;
}

/**
 * True only for a webhook Resend genuinely signed, recently.
 *
 * Every rejection is a plain false: which check failed is for our logs, not
 * for the caller on the wire, and the route treats them all identically
 * anyway. The comparison is timingSafeEqual, after a length check because
 * timingSafeEqual demands equal lengths (a wrong-length signature is already
 * wrong; the constant-time property matters only between equal-length guesses).
 *
 * @param payload the raw request body, byte-for-byte as received.
 * @param headers the three svix headers, null when absent.
 * @param secret the signing secret from the Resend dashboard ("whsec_...").
 * @param nowMs the clock, injectable for tests. Defaults to Date.now().
 */
export function verifyResendWebhook(
  payload: string,
  headers: ResendWebhookHeaders,
  secret: string,
  nowMs: number = Date.now(),
): boolean {
  const id = headers.id?.trim() ?? "";
  const timestamp = headers.timestamp?.trim() ?? "";
  const signatureHeader = headers.signature?.trim() ?? "";
  if (!id || !timestamp || !signatureHeader) return false;

  // The timestamp must be a plain integer of seconds, inside the window. A
  // stale one is the replay case; a far-future one is a clock we should not
  // trust either.
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const skewSec = Math.abs(nowMs / 1000 - Number(timestamp));
  if (skewSec > WEBHOOK_TOLERANCE_SEC) return false;

  const key = keyBytes(secret);
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest();

  // The header may carry several signatures (Svix does this across secret
  // rotations). Any one genuine signature is enough.
  for (const entry of signatureHeader.split(/\s+/)) {
    const candidate = candidateBytes(entry);
    if (!candidate) continue;
    if (candidate.length !== expected.length) continue;
    if (timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}
