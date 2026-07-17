/**
 * PayFast, the outbound half: turning a pending order into a signed payload the
 * browser can POST to the gateway. Nothing here touches the database or React,
 * so every signature rule below is unit-testable on its own.
 *
 * The inbound half (the ITN webhook that actually confirms payment) is not here.
 * `verifyItnSignature` is the one hook it needs, and it lives here because it
 * shares the same base-string rules as the outbound signature.
 */

import { createHash, timingSafeEqual } from "node:crypto";

/** PayFast's own hosts. Which one we use is decided by PAYFAST_SANDBOX. */
const SANDBOX_PROCESS_URL = "https://sandbox.payfast.co.za/eng/process";
const LIVE_PROCESS_URL = "https://www.payfast.co.za/eng/process";

/** What shows up on the customer's PayFast screen and bank statement. */
export const ITEM_NAME = "Kindred Creatures order";

/**
 * Whole rands to PayFast's "R.CC" string: 899 becomes "899.00". Money is stored
 * in whole rands everywhere in this codebase, matching products.ts. This is the
 * only place that conversion happens, and it happens at the PayFast boundary.
 */
export function toAmountString(zar: number): string {
  if (!Number.isFinite(zar)) {
    throw new TypeError("An order total must be a finite number of rands.");
  }
  return zar.toFixed(2);
}

/**
 * PHP's urlencode(), which is what PayFast signs against.
 *
 * PayFast posts the payment form as application/x-www-form-urlencoded and
 * builds its comparison signature with PHP's urlencode(), so we have to match
 * it byte for byte:
 *   - space becomes "+", not "%20"
 *   - hex escapes are UPPERCASE ("%2F", never "%2f")
 *   - only A-Z a-z 0-9 - _ . survive unescaped
 *
 * encodeURIComponent() is close but leaves !'()*~ alone and uses %20 for space,
 * so those seven characters are patched up by hand. Getting this wrong is the
 * classic cause of "signature mismatch" against a payload that looks correct.
 */
function urlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(
      /[!'()*~]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

/**
 * Builds the MD5 signature PayFast expects.
 *
 * The rules, in the order they are applied:
 *
 * 1. ORDER. Fields are signed in the order they appear in the payment form,
 *    NOT sorted alphabetically. (Alphabetical sorting is a PayFast API rule; it
 *    is not the payment-request rule, and mixing the two is the single most
 *    common reason a correct-looking payload gets rejected.) A JS object keeps
 *    string keys in insertion order, so the order `fields` is built in IS the
 *    order it is signed in. `buildPaymentFields` is where that order is set.
 * 2. TRIM. Values are trimmed of surrounding whitespace.
 * 3. SKIP EMPTIES. A field whose value is empty after trimming is left out of
 *    the base string entirely, rather than signed as "key=".
 * 4. ENCODE. Values are urlEncode()d as above. Keys are not encoded: they are
 *    all plain ASCII field names.
 * 5. JOIN as `key=value` pairs separated by `&`.
 * 6. PASSPHRASE. When the merchant account has one, `&passphrase=<encoded>` is
 *    appended last. When it does not, nothing is appended: an empty passphrase
 *    is not the same as `&passphrase=`.
 * 7. MD5 the result, lowercase hex.
 */
export function buildSignature(
  fields: Record<string, string>,
  passphrase?: string,
): string {
  const pairs: string[] = [];

  for (const [key, rawValue] of Object.entries(fields)) {
    const value = (rawValue ?? "").trim();
    if (value === "") continue;
    pairs.push(`${key}=${urlEncode(value)}`);
  }

  let base = pairs.join("&");

  const secret = (passphrase ?? "").trim();
  if (secret !== "") {
    base += `&passphrase=${urlEncode(secret)}`;
  }

  return createHash("md5").update(base).digest("hex");
}

/**
 * Checks the signature on an ITN payload. PayFast signs the posted fields in
 * the order they were received, excluding `signature` itself, under the same
 * rules as the outbound signature.
 *
 * Callers must preserve the posted order when building `fields` (iterate the
 * body, do not sort it), because the order is part of what is signed.
 *
 * This proves the payload was signed by someone holding the passphrase. It does
 * NOT prove the payload came from PayFast's servers or that the amount matches
 * the order: the webhook (S5) still owes a source-IP or server-confirmation
 * check and its own comparison against orders.totalZar.
 */
export function verifyItnSignature(
  fields: Record<string, string>,
  passphrase?: string,
): boolean {
  const { signature, ...signed } = fields;
  if (typeof signature !== "string" || signature.trim() === "") return false;

  const expected = buildSignature(signed, passphrase);
  const given = signature.trim().toLowerCase();

  // Both are fixed-length MD5 hex, but a hostile payload can send any length.
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** The merchant credentials and site URL a payment payload is built from. */
export interface PayfastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase?: string;
  siteUrl: string;
}

function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  // Local dev has no site URL set; PayFast never calls back in mock mode, so a
  // localhost default keeps the flow runnable rather than throwing.
  return (configured || "http://localhost:3000").replace(/\/+$/, "");
}

/** Reads the PayFast config out of the environment. Server-side only. */
export function payfastConfig(): PayfastConfig {
  return {
    merchantId: process.env.PAYFAST_MERCHANT_ID?.trim() ?? "",
    merchantKey: process.env.PAYFAST_MERCHANT_KEY?.trim() ?? "",
    passphrase: process.env.PAYFAST_PASSPHRASE?.trim() || undefined,
    siteUrl: siteUrl(),
  };
}

/** True once we hold enough credentials to talk to the real gateway. */
export function payfastConfigured(): boolean {
  const { merchantId, merchantKey } = payfastConfig();
  return merchantId !== "" && merchantKey !== "";
}

/**
 * True when we should show the on-site mock instead of handing off to PayFast:
 * MOCK_SERVICES is on, or nobody has supplied credentials. Mirrors
 * usingMockProvider() in src/lib/images, so the whole shop runs with no keys.
 */
export function usingMockPayfast(): boolean {
  return process.env.MOCK_SERVICES === "true" || !payfastConfigured();
}

/** Sandbox or live, decided by PAYFAST_SANDBOX. */
export function payfastProcessUrl(): string {
  return process.env.PAYFAST_SANDBOX === "true"
    ? SANDBOX_PROCESS_URL
    : LIVE_PROCESS_URL;
}

/**
 * Everything a payment payload needs about the order. These come from the
 * orders row read back out of the database, never from the request body: the
 * amount we sign is the amount we stored.
 */
export interface PaymentInput {
  orderId: string;
  firstName: string;
  lastName: string;
  email: string;
  totalZar: number;
  itemName?: string;
}

/**
 * Builds the full, signed field set for a PayFast payment form.
 *
 * Key order here is load-bearing: it is the order PayFast documents for the
 * payment form, and therefore the order buildSignature() signs in. Do not
 * alphabetise it, and do not insert new fields in the middle without checking
 * them against PayFast's documented sequence.
 */
export function buildPaymentFields(
  input: PaymentInput,
  config: PayfastConfig = payfastConfig(),
): Record<string, string> {
  const { siteUrl: site } = config;

  const fields: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: `${site}/checkout/complete`,
    cancel_url: `${site}/checkout/cancelled`,
    notify_url: `${site}/api/payfast/notify`,
    name_first: input.firstName,
    name_last: input.lastName,
    email_address: input.email,
    m_payment_id: input.orderId,
    amount: toAmountString(input.totalZar),
    item_name: input.itemName ?? ITEM_NAME,
  };

  return { ...fields, signature: buildSignature(fields, config.passphrase) };
}

/**
 * Hides the merchant key so a payload can be shown to a human. Only the mock
 * panel uses this: a real payment form has to carry merchant_key to PayFast, but
 * a mock payload is there to be read, and a secret on screen is a secret leaked.
 */
export function redactFields(
  fields: Record<string, string>,
): Record<string, string> {
  const safe = { ...fields };
  if ("merchant_key" in safe) safe.merchant_key = "(hidden)";
  return safe;
}
