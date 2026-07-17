/**
 * The admin password hash, and the only code that checks a password against it.
 *
 * WHY SCRYPT AND NOT BCRYPT. The brief said bcrypt or argon2, meaning "a real
 * memory-hard KDF, not a bare SHA". scrypt is exactly that, it is in node:crypto,
 * and it needs no dependency. This shop has one admin and one password; adding a
 * native build (bcrypt) or a 10k-line JS reimplementation (bcryptjs) to hash a
 * single string once per login buys nothing that scrypt does not already give.
 *
 * THE PARAMETERS LIVE IN THE HASH, not in this file. A stored hash records the
 * cost it was made with, so raising the cost later cannot lock out the existing
 * password: old hashes keep verifying with their own parameters, and the next
 * generated hash gets the new ones.
 *
 * Nothing here logs. Not the password, not the hash, not a prefix of either. A
 * failure is a boolean, because anything richer is a thing that ends up in a log
 * aggregator.
 */

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * promisify picks scrypt's three-argument overload and loses the options
 * parameter, which is where the cost lives. The cast names the overload we
 * actually call; the callback form does accept options.
 */
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Cost parameters for hashes we generate now. N is the memory/CPU knob: 16384
 * keeps a login around 50-100ms on the sort of box this ships to, which is
 * irrelevant to the one human who logs in and expensive for anyone guessing.
 */
const COST = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 32;
const SALT_LEN = 16;

/** scrypt's memory use is ~128 * N * r bytes; node caps it unless told otherwise. */
function maxmem(N: number, r: number): number {
  return 256 * N * r;
}

/**
 * `scrypt$<N>$<r>$<p>$<salt-b64>$<key-b64>`. Self-describing on purpose: see the
 * header. The $ separator cannot collide with base64.
 */
function encode(
  N: number,
  r: number,
  p: number,
  salt: Buffer,
  key: Buffer,
): string {
  return [
    "scrypt",
    N,
    r,
    p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

type Parsed = { N: number; r: number; p: number; salt: Buffer; key: Buffer };

/** Strict parse. Anything unexpected is null, never a throw and never a log. */
function parse(stored: string): Parsed | null {
  const parts = stored.trim().split("$");
  if (parts.length !== 6) return null;
  const [scheme, rawN, rawR, rawP, rawSalt, rawKey] = parts;
  if (scheme !== "scrypt") return null;

  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  // Bounded so a hostile or fat-fingered env var cannot ask this process to
  // allocate gigabytes on the login path. 2^20 is far above what we generate.
  if (!Number.isInteger(N) || N < 2 || N > 1048576) return null;
  if (!Number.isInteger(r) || r < 1 || r > 32) return null;
  if (!Number.isInteger(p) || p < 1 || p > 16) return null;

  const salt = Buffer.from(rawSalt, "base64");
  const key = Buffer.from(rawKey, "base64");
  if (salt.length === 0 || key.length === 0) return null;

  return { N, r, p, salt, key };
}

/**
 * Hashes a password for ADMIN_PASSWORD_HASH. Used by
 * `scripts/hash-admin-password.ts` and by the tests; the app itself only ever
 * verifies.
 *
 * @param password the plaintext to hash.
 * @returns the encoded hash, safe to paste into an env file.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scrypt(password, salt, KEY_LEN, {
    ...COST,
    maxmem: maxmem(COST.N, COST.r),
  });
  return encode(COST.N, COST.r, COST.p, salt, key);
}

/**
 * Checks a password against a stored hash in constant time.
 *
 * @param password the plaintext offered at the login form.
 * @param stored the ADMIN_PASSWORD_HASH value.
 * @returns true only on a match. A malformed or empty hash is false, never a
 * throw: a broken env var must fail closed, not 500 in a way that tells the
 * person at the form that they found something.
 */
export async function verifyPassword(
  password: string,
  stored: string | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parsed = parse(stored);
  if (!parsed) return false;

  try {
    const key = await scrypt(password, parsed.salt, parsed.key.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: maxmem(parsed.N, parsed.r),
    });
    // Equal lengths by construction (we asked for parsed.key.length), so this
    // cannot throw, and it does not leak the answer through timing.
    return timingSafeEqual(key, parsed.key);
  } catch {
    return false;
  }
}

/**
 * Constant-time string compare for the admin email.
 *
 * The email is not a secret, but comparing it with === gives an attacker a free
 * oracle for "is this the admin address" that returns faster on the first wrong
 * character. Cheap to close, so it is closed.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
