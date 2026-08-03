import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/**
 * Blob storage seam. Dev/test writes to the local filesystem and serves bytes
 * through a signed, short-lived URL (see src/app/api/asset/[...key]/route.ts).
 * Production uses Vercel Blob, loaded lazily so dev never needs the package.
 */
export interface StorageAdapter {
  /** Stores bytes under key. contentType is recorded for content negotiation. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** A URL that grants read access to key for ttlSec seconds. */
  getSignedUrl(key: string, ttlSec: number): Promise<string>;
  /** Reads bytes back, or null if the key is unknown. */
  getBytes(key: string): Promise<Uint8Array | null>;
}

// ---------------------------------------------------------------------------
// Signed asset tokens (local adapter). The token binds a key to an expiry with
// an HMAC so links cannot be forged or reused past their window.
// ---------------------------------------------------------------------------

function assetSecret(): string {
  return (
    process.env.ASSET_TOKEN_SECRET ??
    process.env.ORDER_TOKEN_SECRET ??
    "kindred-dev-insecure-asset-secret"
  );
}

/** HMAC signature over `${key}.${exp}`, hex encoded. */
export function signAssetToken(key: string, exp: number): string {
  return createHmac("sha256", assetSecret())
    .update(`${key}.${exp}`)
    .digest("hex");
}

/**
 * True only when sig matches key+exp AND exp is still in the future. Used by
 * the asset route to gate reads; exported so it can be unit tested directly.
 */
export function isAssetTokenValid(
  key: string,
  exp: number,
  sig: string,
): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = signAssetToken(key, exp);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Local filesystem adapter (dev/test)
// ---------------------------------------------------------------------------

const LOCAL_ROOT = resolve(process.cwd(), ".data", "uploads");

function localPath(key: string): string {
  // Keys are app-generated (uploads/<uuid>.<ext>); guard against traversal.
  const safe = key.replace(/\.\.+/g, "").replace(/^\/+/, "");
  return resolve(LOCAL_ROOT, safe);
}

class LocalStorageAdapter implements StorageAdapter {
  async put(key: string, bytes: Uint8Array): Promise<void> {
    const path = localPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async getSignedUrl(key: string, ttlSec: number): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    const sig = signAssetToken(key, exp);
    const params = new URLSearchParams({ exp: String(exp), sig });
    return `/api/asset/${key}?${params.toString()}`;
  }

  async getBytes(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(localPath(key));
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Vercel Blob adapter (production). Imported lazily and only constructed when
// the token is present, so the dev/test bundle never needs @vercel/blob.
// ---------------------------------------------------------------------------

/**
 * Exported for its contract test only. `getStorage` picks it by environment, so
 * a test that cannot construct it directly can only reach it by pretending to be
 * production, and the one behaviour worth pinning here (a missing key is null,
 * not a throw) is exactly the one that has never been reachable in development.
 */
export class VercelBlobAdapter implements StorageAdapter {
  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const specifier = "@vercel/blob";
    const blob = await import(/* @vite-ignore */ specifier);
    await blob.put(key, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
  }

  async getSignedUrl(key: string): Promise<string> {
    const specifier = "@vercel/blob";
    const blob = await import(/* @vite-ignore */ specifier);
    const { url } = await blob.head(key);
    return url;
  }

  async getBytes(key: string): Promise<Uint8Array | null> {
    const specifier = "@vercel/blob";
    const blob = await import(/* @vite-ignore */ specifier);

    let url: string;
    try {
      ({ url } = await blob.head(key));
    } catch (error) {
      // head() THROWS on a missing key rather than returning null, so without
      // this the adapter breaks its own signature and every caller that treats
      // null as an ordinary answer gets a rejected promise instead. That has now
      // cost us the same bug three times, most recently the live preview
      // freezing the moment a breed was chosen: the breed's stock illustration
      // has not been drawn yet, head() threw, and the plate stopped rendering.
      //
      // Only not-found is an answer. Anything else (a bad token, a network
      // failure) is a real fault and must keep travelling, or a
      // misconfigured store would look exactly like an empty one.
      if (error instanceof blob.BlobNotFoundError) return null;
      throw error;
    }

    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
}

let cached: StorageAdapter | null = null;

/** Returns the active storage adapter for the current environment. */
export function getStorage(): StorageAdapter {
  if (cached) return cached;
  const useBlob =
    process.env.NODE_ENV === "production" &&
    !!process.env.BLOB_READ_WRITE_TOKEN &&
    process.env.MOCK_SERVICES !== "true";
  cached = useBlob ? new VercelBlobAdapter() : new LocalStorageAdapter();
  return cached;
}
