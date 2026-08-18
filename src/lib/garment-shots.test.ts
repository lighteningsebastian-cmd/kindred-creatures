import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS } from "@/lib/products";
import { catalogueShots, heroColour } from "./garment-shots";

const PUBLIC = join(process.cwd(), "public");

describe("catalogue shots", () => {
  it("leads with the back, because the plate is the product", () => {
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue;
      expect(catalogueShots(product.slug)[0]!.view, product.slug).toBe("back");
    }
  });

  it("offers the hoodie three aspects and the tee and crewneck two", () => {
    expect(catalogueShots("hoodie").map((shot) => shot.view)).toEqual([
      "back",
      "front",
      "fleece",
    ]);
    expect(catalogueShots("tee").map((shot) => shot.view)).toEqual([
      "back",
      "front",
    ]);
    expect(catalogueShots("crewneck").map((shot) => shot.view)).toEqual([
      "back",
      "front",
    ]);
  });

  it("offers no three-quarter shot, though the photographs exist", () => {
    // Owner decision, 18 August: every view a card offers should be selling
    // the thing that is printed, and the profile shows a blank garment. The
    // files are still on disk and garments.ts still knows their shape, so this
    // is a manifest decision and not a deletion.
    for (const product of PRODUCTS) {
      const views = catalogueShots(product.slug).map((shot) => shot.view);
      expect(views, product.slug).not.toContain("profile");
    }
  });

  it("offers the tote nothing, so its card keeps the placeholder", () => {
    // Deferred by docs/spec-print-layout.md. No shoot, no plate, no card image.
    expect(catalogueShots("tote")).toEqual([]);
  });

  it("points every shot at a file that really exists", () => {
    // The manifest lists only views that exist, never an aspiration, which is
    // what lets this be an unconditional assertion. `worn` is in the view
    // vocabulary and in no product's manifest: there is no on-model
    // photography yet. Adding the files and the manifest line is the whole of
    // the work to light it up.
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        expect(existsSync(join(PUBLIC, shot.url)), shot.url).toBe(true);
      }
    }
  });

  it("prints only on the two sides a plate can go on", () => {
    // A plate floated over a three-quarter garment sits on air, and you cannot
    // see a chest print from the side.
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        const printable = shot.view === "front" || shot.view === "back";
        expect(shot.printed, `${product.slug}/${shot.view}`).toBe(printable);
      }
    }
  });

  it("gives a printed shot a plate to overlay and an unprinted shot none", () => {
    for (const product of PRODUCTS) {
      for (const shot of catalogueShots(product.slug)) {
        if (shot.printed) expect(shot.plateUrl).toMatch(/^\/demo\/plate-/);
        else expect(shot.plateUrl).toBeNull();
      }
    }
  });

  it("writes alt text a person would recognise, never a filename", () => {
    const shots = catalogueShots("hoodie");
    expect(shots[0]!.alt).toBe(
      "The Kindred hoodie in Blue from the back, printed with a companion profile plate",
    );
    expect(shots[2]!.alt).toBe(
      "The brushed fleece inside of the Kindred hoodie in Blue",
    );
    for (const shot of shots) expect(shot.alt).not.toMatch(/\.webp|\//);
  });

  it("leads each card on a portrait colourway so the grid does not fight itself", () => {
    // The tee's Heritage Blue and Olive shots are LANDSCAPE. Leading with one
    // drops a wide garment into a grid of tall ones.
    expect(heroColour("hoodie")).toBe("Blue");
    expect(heroColour("crewneck")).toBe("Peach");
    expect(heroColour("tee")).toBe("White");
    for (const product of PRODUCTS) {
      if (product.slug === "tote") continue;
      const hero = heroColour(product.slug);
      expect(
        product.variants.some((variant) => variant.color === hero),
        `${product.slug} hero ${hero} is not a real colourway`,
      ).toBe(true);
      for (const shot of catalogueShots(product.slug)) {
        expect(shot.aspect, `${product.slug}/${shot.view}`).toBeGreaterThan(0);
      }
    }
  });
});
