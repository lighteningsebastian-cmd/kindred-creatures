// @vitest-environment node
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { breedRequests } from "@/lib/db/schema";
import { checkCreatureName, logBreedRequest } from "./actions";

async function rowsFor(query: string) {
  const db = await getDb();
  return db.select().from(breedRequests).where(eq(breedRequests.query, query));
}

describe("logBreedRequest", () => {
  it("records a miss so the list can grow by demand", async () => {
    await logBreedRequest("shiba inu", "dog");
    expect(await rowsFor("shiba inu")).toHaveLength(1);
  });

  it("ignores blank searches", async () => {
    await logBreedRequest("   ", "dog");
    expect(await rowsFor("")).toHaveLength(0);
  });

  it("drops a species it does not offer", async () => {
    // Arrives from a browser, so it is not trusted.
    await logBreedRequest("dragon", "wyvern" as never);
    expect(await rowsFor("dragon")).toHaveLength(0);
  });

  it("never throws, whatever it is handed", async () => {
    // A failed log must not interrupt somebody buying a hoodie.
    await expect(
      logBreedRequest("x".repeat(500), "cat"),
    ).resolves.toBeUndefined();
  });
});

describe("checkCreatureName", () => {
  it("accepts ordinary and accented names", async () => {
    for (const name of ["Francis", "Zoë", "Mr O'Hara", "Jean-Luc"]) {
      expect(await checkCreatureName(name), name).toEqual({ ok: true });
    }
  });

  it("refuses a character the font cannot print", async () => {
    // The failure this prevents: a blank space on a garment already paid for.
    const emoji = await checkCreatureName("Rex 🐕");
    expect(emoji.ok).toBe(false);

    const cjk = await checkCreatureName("小白");
    expect(cjk.ok).toBe(false);
  });

  it("refuses what we would rather not print", async () => {
    expect((await checkCreatureName("Sir Shitface")).ok).toBe(false);
  });

  it("allows an empty name, which simply omits the line", async () => {
    expect(await checkCreatureName("   ")).toEqual({ ok: true });
  });
});
