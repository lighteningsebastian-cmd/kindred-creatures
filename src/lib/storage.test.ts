import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The Blob adapter reaches @vercel/blob through a dynamic import, so `head` is
// replaced at the module boundary: an ESM namespace object cannot be spied on.
const { head } = vi.hoisted(() => ({ head: vi.fn() }));
vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vercel/blob")>()),
  head,
}));

// Point the local adapter at a throwaway directory before importing it.
let workDir: string;
let originalCwd: () => string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "kindred-storage-"));
  originalCwd = process.cwd;
  process.cwd = () => workDir;
});

afterAll(async () => {
  process.cwd = originalCwd;
  await rm(workDir, { recursive: true, force: true });
});

describe("local storage adapter", () => {
  it("round-trips bytes through put and getBytes", async () => {
    const { getStorage } = await import("./storage");
    const storage = getStorage();
    const bytes = new Uint8Array([1, 2, 3, 4, 250]);
    await storage.put("uploads/round-trip.png", bytes, "image/png");
    const read = await storage.getBytes("uploads/round-trip.png");
    expect(read).not.toBeNull();
    expect(Array.from(read!)).toEqual([1, 2, 3, 4, 250]);
  });

  it("returns null for an unknown key", async () => {
    const { getStorage } = await import("./storage");
    const read = await getStorage().getBytes("uploads/missing.png");
    expect(read).toBeNull();
  });
});

/**
 * The Blob adapter's contract, against a key that is not there.
 *
 * This is the difference that has bitten three times: the local adapter is
 * tolerant of a missing key and the Blob adapter was not, so the whole shop
 * behaved one way in development and another in production, and nothing between
 * the two ever ran. `getStorage` picks the adapter by environment, so the class
 * is constructed directly here rather than by pretending to be production.
 */
describe("vercel blob adapter", () => {
  it("returns null for a key the store does not have", async () => {
    const { BlobNotFoundError } = await vi.importActual<
      typeof import("@vercel/blob")
    >("@vercel/blob");
    head.mockRejectedValue(new BlobNotFoundError());

    const { VercelBlobAdapter } = await import("./storage");
    await expect(
      new VercelBlobAdapter().getBytes("stock/yorkshire-terrier.png"),
    ).resolves.toBeNull();
  });

  it("still throws when the store itself is the problem", async () => {
    // A missing key is an answer; a broken store is not. Swallowing both would
    // make a bad token look exactly like an empty library, which is how a
    // production outage gets mistaken for work not yet done.
    head.mockRejectedValue(new Error("No token found"));

    const { VercelBlobAdapter } = await import("./storage");
    await expect(
      new VercelBlobAdapter().getBytes("stock/yorkshire-terrier.png"),
    ).rejects.toThrow("No token found");
  });
});

describe("signed asset tokens", () => {
  it("accepts a freshly signed, unexpired token", async () => {
    const { signAssetToken, isAssetTokenValid } = await import("./storage");
    const key = "uploads/abc.png";
    const exp = Math.floor(Date.now() / 1000) + 300;
    const sig = signAssetToken(key, exp);
    expect(isAssetTokenValid(key, exp, sig)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const { signAssetToken, isAssetTokenValid } = await import("./storage");
    const key = "uploads/abc.png";
    const exp = Math.floor(Date.now() / 1000) - 1; // already past
    const sig = signAssetToken(key, exp);
    expect(isAssetTokenValid(key, exp, sig)).toBe(false);
  });

  it("rejects a tampered key", async () => {
    const { signAssetToken, isAssetTokenValid } = await import("./storage");
    const exp = Math.floor(Date.now() / 1000) + 300;
    const sig = signAssetToken("uploads/original.png", exp);
    expect(isAssetTokenValid("uploads/other.png", exp, sig)).toBe(false);
  });

  it("getSignedUrl produces a URL that verifies", async () => {
    const { getStorage, isAssetTokenValid } = await import("./storage");
    const url = await getStorage().getSignedUrl("uploads/signed.png", 120);
    const parsed = new URL(url, "http://localhost");
    const exp = Number(parsed.searchParams.get("exp"));
    const sig = parsed.searchParams.get("sig")!;
    expect(parsed.pathname).toBe("/api/asset/uploads/signed.png");
    expect(isAssetTokenValid("uploads/signed.png", exp, sig)).toBe(true);
  });

  it("getSignedUrl honours a short ttl (expired when ttl already lapsed)", async () => {
    const { getStorage, isAssetTokenValid } = await import("./storage");
    const url = await getStorage().getSignedUrl("uploads/ttl.png", 1);
    const parsed = new URL(url, "http://localhost");
    const exp = Number(parsed.searchParams.get("exp"));
    const sig = parsed.searchParams.get("sig")!;
    // Move wall clock past the 1s ttl; the same token must now be rejected.
    vi.useFakeTimers();
    vi.setSystemTime((exp + 2) * 1000);
    expect(isAssetTokenValid("uploads/ttl.png", exp, sig)).toBe(false);
    vi.useRealTimers();
  });
});
