/**
 * A quiet email typo-catcher for the checkout net (D2). It never validates and
 * never blocks: it only whispers "did you mean gmail.com?" when the domain a
 * customer typed is one keystroke away from a mailbox provider that is common in
 * the South African market. A guest order's email is the customer's only key to
 * the order, and a mistyped domain is the one failure the owner most wants
 * softened, WITHOUT a hard verification gate.
 *
 * The rules that keep it from nagging:
 *   - It only ever suggests a domain from the known list below. It never invents
 *     a correction, so it cannot send someone to a worse address than they typed.
 *   - A domain that already IS on the known list yields null. gmail.com is not a
 *     typo of anything.
 *   - It compares only the domain part, with a Damerau-Levenshtein distance so a
 *     single adjacent transposition (gmial -> gmail) counts as one edit, and it
 *     suggests only at distance 1. That catches the everyday slips
 *     (gmial/gamil/gmail.co/iclod/outlok) while leaving unrelated domains
 *     (a company's own domain) untouched.
 */

/**
 * Mailbox providers common enough in the SA market that a near-miss is far more
 * likely a typo than a real address. Global webmail plus the local ISPs.
 */
const KNOWN_DOMAINS = [
  "gmail.com",
  "icloud.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "webmail.co.za",
  "mweb.co.za",
  "telkomsa.net",
  "vodamail.co.za",
] as const;

const KNOWN_SET = new Set<string>(KNOWN_DOMAINS);

/**
 * Optimal string alignment distance (Damerau-Levenshtein restricted to adjacent
 * transpositions). One swap of neighbouring characters costs one edit, which is
 * what makes gmial -> gmail a single, catchable slip rather than two.
 */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );

  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  return d[a.length][b.length];
}

/**
 * Suggests a corrected email when the domain looks like a one-edit typo of a
 * known provider, otherwise null.
 *
 * @param input the address as typed.
 * @returns the corrected address (original local part, lowercased known domain),
 * or null when there is nothing worth suggesting: no usable address, a domain
 * that is already correct, or one too far from any known provider to be a slip.
 */
export function suggestEmail(input: string): string | null {
  const value = input.trim();
  const at = value.lastIndexOf("@");
  // No usable split: nothing before or after the @, or no @ at all.
  if (at <= 0 || at === value.length - 1) return null;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();

  // A domain that is already a known provider is never a typo.
  if (KNOWN_SET.has(domain)) return null;

  let best: { domain: string; distance: number } | null = null;
  for (const known of KNOWN_DOMAINS) {
    const distance = editDistance(domain, known);
    if (distance === 0) return null; // exact (case-only) match, nothing to fix
    if (best === null || distance < best.distance) {
      best = { domain: known, distance };
    }
  }

  // Only a single edit away counts as a near-miss. Anything further is very
  // likely a real, different domain, and suggesting would be nagging.
  if (best && best.distance <= 1) {
    return `${local}@${best.domain}`;
  }

  return null;
}
