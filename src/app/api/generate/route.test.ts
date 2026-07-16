// @vitest-environment node
import { describe, it, expect } from "vitest";
import { POST as generate } from "./route";
import { POST as upload } from "../upload/route";

// No provider mock here: the real offline mock provider runs end to end against
// an in-memory test database.

async function createArtwork(): Promise<string> {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const form = new FormData();
  form.set("file", new File([bytes], "pet.png", { type: "image/png" }));
  form.set("productSlug", "tee");
  const res = await upload(
    new Request("http://localhost/api/upload", { method: "POST", body: form }),
  );
  expect(res.status).toBe(201);
  const { artworkId } = await res.json();
  return artworkId;
}

function generateRequest(artworkId: string, style: string): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    body: JSON.stringify({ artworkId, style }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/generate", () => {
  it("produces a preview and counts down remaining tries", async () => {
    const artworkId = await createArtwork();
    const res = await generate(generateRequest(artworkId, "classic-portrait"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.previewUrl).toContain("/api/asset/");
    expect(json.regenCount).toBe(1);
    expect(json.remaining).toBe(2);
  });

  it("caps at three generations and refuses the fourth with 429", async () => {
    const artworkId = await createArtwork();

    for (let i = 1; i <= 3; i++) {
      const res = await generate(generateRequest(artworkId, "watercolor"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.regenCount).toBe(i);
      expect(json.remaining).toBe(3 - i);
    }

    const fourth = await generate(generateRequest(artworkId, "watercolor"));
    expect(fourth.status).toBe(429);
    const json = await fourth.json();
    expect(json.error).toMatch(/tries/i);
  });

  it("rejects an unknown style with 400", async () => {
    const artworkId = await createArtwork();
    const res = await generate(generateRequest(artworkId, "oil-pastel"));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown artwork with 404", async () => {
    const res = await generate(
      generateRequest("00000000-0000-0000-0000-000000000000", "watercolor"),
    );
    expect(res.status).toBe(404);
  });
});
