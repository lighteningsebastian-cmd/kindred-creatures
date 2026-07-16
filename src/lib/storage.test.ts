import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
