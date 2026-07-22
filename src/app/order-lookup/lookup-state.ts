/**
 * The plain constants and types the lookup form and its server action share.
 *
 * These live outside actions.ts because a "use server" module may only export
 * async functions: a type, an initial state and a couple of message constants
 * would be rejected there. Keeping them here lets both the client form and the
 * action import them without pulling server code into the client bundle.
 */

/**
 * The state the lookup form renders from. On a match the action redirects and
 * never returns, so a state only ever carries the one generic miss, or nothing.
 */
export type LookupState = {
  error: string | null;
  /** Bumped on each miss so the client can react to repeated identical states. */
  attempt: number;
};

export const INITIAL_LOOKUP_STATE: LookupState = { error: null, attempt: 0 };

/**
 * The single sentence every miss returns, whatever actually failed: unknown
 * reference, wrong email, or both. One message, no enumeration.
 */
export const LOOKUP_MISS =
  "We could not match that reference and email. Check both and try again, or reply to any of our emails.";

/**
 * The brute-force damper, in milliseconds. A short, constant wait on every miss
 * turns "a script can try thousands of references a second" into "a couple". It
 * runs on the miss path only, so a genuine match never waits, and it is applied
 * identically to every failure mode so the wait cannot be timed to tell them
 * apart either.
 */
export const MISS_DELAY_MS = 500;
