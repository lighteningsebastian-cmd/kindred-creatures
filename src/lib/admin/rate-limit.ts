/**
 * Slowing down repeated failed logins.
 *
 * WHAT THIS IS AND IS NOT. It is an in-process counter: one Map, no database, no
 * Redis. It survives neither a restart nor a second instance. That is a real
 * limitation and it is the right one here, because the thing it defends is a
 * single scrypt-hashed password on a shop with one admin, and scrypt is already
 * the expensive part of guessing it. The delay exists to turn "a script can try
 * a thousand passwords a second" into "a script can try a few an hour", and an
 * in-memory counter does that for every attacker who is not deliberately racing
 * a deploy. A shared store would buy strictness we do not need and an
 * availability dependency on the login path, which is a bad trade for one user.
 *
 * The delay is applied BEFORE the answer, so a caller cannot tell a throttled
 * failure from an ordinary one by the shape of the response, only by the wait.
 */

/** After this many consecutive failures, attempts stop being answered at all. */
const LOCK_AFTER = 10;

/** How long a lockout lasts, and how long an idle record lives before it lapses. */
const WINDOW_MS = 15 * 60 * 1000;

/** Delay growth: 250ms, 500ms, 1s, 2s, 4s, then flat. */
const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 4000;

type Record_ = { failures: number; last: number };

const attempts = new Map<string, Record_>();

/** Drops records that have gone quiet, so the Map cannot grow without bound. */
function prune(now: number): void {
  for (const [key, record] of attempts) {
    if (now - record.last > WINDOW_MS) attempts.delete(key);
  }
}

function current(key: string, now: number): Record_ {
  const record = attempts.get(key);
  if (!record || now - record.last > WINDOW_MS) return { failures: 0, last: now };
  return record;
}

export type Throttle = {
  /** True when this key has failed too often and should not be answered. */
  locked: boolean;
  /** How long to wait before answering, in milliseconds. */
  delayMs: number;
};

/**
 * What the next attempt from this key has earned.
 *
 * @param key an identifier for the caller, typically their IP address.
 * @returns whether they are locked out, and how long to stall them.
 */
export function throttleFor(key: string, now: number = Date.now()): Throttle {
  prune(now);
  const { failures } = current(key, now);
  if (failures >= LOCK_AFTER) return { locked: true, delayMs: 0 };
  if (failures === 0) return { locked: false, delayMs: 0 };
  const delayMs = Math.min(BASE_DELAY_MS * 2 ** (failures - 1), MAX_DELAY_MS);
  return { locked: false, delayMs };
}

/** Records a failed attempt. */
export function recordFailure(key: string, now: number = Date.now()): void {
  const record = current(key, now);
  attempts.set(key, { failures: record.failures + 1, last: now });
}

/** Clears the record. Called on a successful login: the owner is not a threat. */
export function recordSuccess(key: string): void {
  attempts.delete(key);
}

/** Test seam. Nothing in the app calls this. */
export function resetThrottle(): void {
  attempts.clear();
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
