// @vitest-environment node
import { describe, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { backPlate, composePlate, frontPlate } from "./plate";
import { MockImageProvider } from "@/lib/images/mock";
import { emptyProfile, type CompanionProfile } from "@/lib/companion";

/**
 * Writes sample plates to .plates/ so the typography can actually be looked at.
 * The spec's checks are things no assertion settles: whether the arc sits well,
 * whether the plate reads as a catalogue entry rather than a headstone.
 *
 *   RENDER_PLATES=1 npx vitest run src/lib/print/sample.test.ts
 *
 * Off by default: the rest of the suite has no business writing files.
 */
const OUT = ".plates";
const enabled = process.env.RENDER_PLATES === "1";

const W = 900;
const H = 1125;

function profile(over: Partial<CompanionProfile>): CompanionProfile {
  return { ...emptyProfile("dog"), ...over };
}

describe("sample plates", () => {
  it.skipIf(!enabled)("renders the cases the spec asks to eyeball", async () => {
    mkdirSync(OUT, { recursive: true });
    const provider = new MockImageProvider();
    const { portraitBytes } = await provider.generatePortrait({
      uploadKey: "x",
      style: "classic-portrait",
    });

    const full = profile({
      name: "Francis",
      breedId: "yorkshire-terrier",
      temperament: ["confident", "affectionate", "spirited"],
      togetherSince: 2021,
    });

    const cases: [string, CompanionProfile, string | null][] = [
      ["full", full, "KC-01248"],
      ["no-name", { ...full, name: null }, "KC-01248"],
      ["no-year-no-temperament", { ...full, togetherSince: null, temperament: [] }, "KC-01248"],
      ["one-of-one", { ...full, breedId: "one-of-one-dog-large" }, "KC-01249"],
      ["long-breed", { ...full, breedId: "staffordshire-bull-terrier" }, "KC-01250"],
      [
        "other-species",
        profile({
          name: "Bramble",
          species: "other",
          breedId: null,
          temperament: [],
          togetherSince: 2019,
          otherKind: "Horse",
          otherBreed: "Nooitgedachter",
          otherOrigin: "The Karoo",
        }),
        "KC-01251",
      ],
    ];

    for (const [label, p, ref] of cases) {
      const back = await composePlate(backPlate(p, ref, W, H), portraitBytes, W, H);
      writeFileSync(`${OUT}/plate-back-${label}.png`, back);
    }

    for (const [label, p] of [["with-name", full], ["no-name", { ...full, name: null }]] as const) {
      const front = await composePlate(
        frontPlate(p as CompanionProfile, 600, 600),
        portraitBytes,
        600,
        600,
      );
      writeFileSync(`${OUT}/plate-front-${label}.png`, front);
    }

    // Over a dark ground, to prove the alpha is real rather than white pixels.
    const back = await composePlate(backPlate(full, "KC-01248", W, H), portraitBytes, W, H);
    const onDark = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 30, g: 26, b: 22, alpha: 1 } },
    })
      .composite([{ input: Buffer.from(back) }])
      .png()
      .toBuffer();
    writeFileSync(`${OUT}/plate-back-on-dark.png`, onDark);
  });
});
