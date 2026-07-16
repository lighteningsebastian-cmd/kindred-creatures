// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

// Control the provider's moderation verdict per test; the route under test uses
// a real in-memory database (test env) so we exercise the actual DB writes.
let nextVerdict: { ok: boolean; reason?: string } = { ok: true };

vi.mock("@/lib/images", () => ({
  getImageProvider: async () => ({
    moderate: async () => nextVerdict,
    generatePreview: async () => ({ previewBytes: new Uint8Array([1]) }),
    generatePrintFile: async () => ({ printBytes: new Uint8Array([1]) }),
  }),
}));

import { POST } from "./route";
import { getDb } from "@/lib/db/client";
import { artworks } from "@/lib/db/schema";

function pngFile(): File {
  // Minimal non-empty PNG-signature payload; content is not inspected here.
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], "pet.png", { type: "image/png" });
}

function uploadRequest(file: File | null, productSlug: string): Request {
  const form = new FormData();
  if (file) form.set("file", file);
  form.set("productSlug", productSlug);
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: form,
  });
}

beforeEach(() => {
  nextVerdict = { ok: true };
});

describe("POST /api/upload", () => {
  it("stores a clean photo and opens an artwork row", async () => {
    const res = await POST(uploadRequest(pngFile(), "tee"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.artworkId).toBeTruthy();
    expect(json.uploadKey).toContain("uploads/");

    const db = await getDb();
    const rows = await db.select().from(artworks);
    const row = rows.find((r) => r.id === json.artworkId);
    expect(row?.status).toBe("uploaded");
    expect(row?.productSlug).toBe("tee");
  });

  it("rejects a moderated photo with 422 and creates no artwork", async () => {
    nextVerdict = { ok: false, reason: "We could not accept this photo." };
    const db = await getDb();
    const before = (await db.select().from(artworks)).length;

    const res = await POST(uploadRequest(pngFile(), "tee"));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("We could not accept this photo.");

    const after = (await db.select().from(artworks)).length;
    expect(after).toBe(before);
  });

  it("rejects an unknown product with 400", async () => {
    const res = await POST(uploadRequest(pngFile(), "spaceship"));
    expect(res.status).toBe(400);
  });

  it("rejects a missing file with 400", async () => {
    const res = await POST(uploadRequest(null, "tee"));
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported file type with 415", async () => {
    const gif = new File([new Uint8Array([1, 2, 3])], "x.gif", {
      type: "image/gif",
    });
    const res = await POST(uploadRequest(gif, "tee"));
    expect(res.status).toBe(415);
  });
});
