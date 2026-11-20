// @vitest-environment node
import { describe, it, expect } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  BACKFILL_FIT_SQL,
  artworks,
  breedRequests,
  orderItems,
  orders,
} from "@/lib/db/schema";

/**
 * The auto-DDL runs the ALTER statements on every boot, so the one thing worth
 * checking is that a profile actually round-trips. If a column is missing or
 * misspelled this fails at the insert, which is the whole point.
 */
describe("companion profile columns", () => {
  it("round-trips a full profile", async () => {
    const db = await getDb();
    const [row] = await db
      .insert(artworks)
      .values({
        uploadKey: "uploads/test.png",
        productSlug: "hoodie",
        creatureName: "Francis",
        species: "dog",
        breedId: "yorkshire-terrier",
        temperament: JSON.stringify(["confident", "affectionate", "spirited"]),
        togetherSince: 2021,
        frontKey: "plates/front.png",
        backKey: "plates/back.png",
      })
      .returning();

    expect(row!.creatureName).toBe("Francis");
    expect(JSON.parse(row!.temperament!)).toHaveLength(3);
    expect(row!.togetherSince).toBe(2021);
    // Defaults, not nulls: revisions start at zero and nothing is approved yet.
    expect(row!.revisionCount).toBe(0);
    expect(row!.approvedAt).toBeNull();
  });

  it("accepts a profile with no name and no year", async () => {
    // The plate omits rows it has no value for, so these must be optional all
    // the way down rather than defaulted to something printable.
    const db = await getDb();
    const [row] = await db
      .insert(artworks)
      .values({
        uploadKey: "uploads/test2.png",
        productSlug: "tee",
        species: "dog",
        breedId: "one-of-one-dog-black",
      })
      .returning();

    expect(row!.creatureName).toBeNull();
    expect(row!.togetherSince).toBeNull();
  });

  it("has no end-date column beside togetherSince", () => {
    // Two dates under a name is a headstone. This is a schema-level guarantee,
    // not a UI decision: see docs/spec-print-layout.md section 3.
    const columns = Object.keys(artworks);
    expect(columns).toContain("togetherSince");
    expect(
      columns.filter((c) => /until|end|died|passed|death/i.test(c)),
    ).toEqual([]);
  });

  it("logs a breed request", async () => {
    const db = await getDb();
    const [row] = await db
      .insert(breedRequests)
      .values({ query: "shiba inu", species: "dog" })
      .returning();

    expect(row!.query).toBe("shiba inu");
    const found = await db
      .select()
      .from(breedRequests)
      .where(eq(breedRequests.id, row!.id));
    expect(found).toHaveLength(1);
  });
});

describe("backfilling the fit onto orders placed before the ranges split", () => {
  /*
   * WHAT EACH CUSTOMER WAS ACTUALLY SHOWN, which is the only honest source for
   * a value nobody recorded at the time.
   *
   * Before the split there was one crewneck, labelled "Women's fit", offered
   * in White, Peach, Grey and Olive. Two of those four were photographs of the
   * MEN'S sweater: the importer had stripped the fit out of their filenames,
   * so Grey and Olive were the men's garment under a women's label. White and
   * Peach were the women's. The tee was labelled unisex and its photographs
   * were the men's block throughout. The hoodie and the tote have one cut.
   *
   * So the mapping is decided by the colour, and this pins it.
   */
  async function seedLine(productSlug: string, color: string) {
    const db = await getDb();
    const [order] = await db
      .insert(orders)
      .values({
        status: "paid",
        email: "thandi@example.co.za",
        firstName: "Thandi",
        lastName: "Mokoena",
        phone: "082 123 4567",
        addressLine1: "14 Loop Street",
        suburb: "Gardens",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        subtotalZar: 799,
        shippingZar: 99,
        totalZar: 898,
      })
      .returning();
    const [artwork] = await db
      .insert(artworks)
      .values({ productSlug })
      .returning();
    const [line] = await db
      .insert(orderItems)
      .values({
        orderId: order!.id,
        productSlug,
        color,
        size: "M",
        qty: 1,
        unitPriceZar: 799,
        artworkId: artwork!.id,
      })
      .returning();
    return line!.id;
  }

  it("reads each historical line's cut off the photograph it was sold under", async () => {
    const db = await getDb();
    const ids = {
      greyCrewneck: await seedLine("crewneck", "Grey"),
      oliveCrewneck: await seedLine("crewneck", "Olive"),
      whiteCrewneck: await seedLine("crewneck", "White"),
      peachCrewneck: await seedLine("crewneck", "Peach"),
      tee: await seedLine("tee", "Heritage Blue"),
      hoodie: await seedLine("hoodie", "Blue"),
      tote: await seedLine("tote", "Natural"),
    };

    // They start with nothing, because nothing recorded it.
    const before = await db.select().from(orderItems);
    expect(before.every((line) => line.fit === null)).toBe(true);

    await db.execute(sql.raw(BACKFILL_FIT_SQL));

    const after = new Map(
      (await db.select().from(orderItems)).map((line) => [line.id, line.fit]),
    );
    expect(after.get(ids.greyCrewneck)).toBe("mens");
    expect(after.get(ids.oliveCrewneck)).toBe("mens");
    expect(after.get(ids.whiteCrewneck)).toBe("womens");
    expect(after.get(ids.peachCrewneck)).toBe("womens");
    expect(after.get(ids.tee)).toBe("mens");
    expect(after.get(ids.hoodie)).toBe("unisex");
    expect(after.get(ids.tote)).toBe("unisex");
  });

  it("leaves a line that already names its fit alone", async () => {
    // It runs on every boot, so it has to be a no-op the second time and every
    // time after. Only a null can be a pre-split row: checkout has required a
    // fit since the day the column arrived.
    const db = await getDb();
    const id = await seedLine("crewneck", "Grey");
    await db
      .update(orderItems)
      .set({ fit: "womens" })
      .where(eq(orderItems.id, id));

    await db.execute(sql.raw(BACKFILL_FIT_SQL));

    const [line] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, id));
    expect(line!.fit).toBe("womens");
  });
});
