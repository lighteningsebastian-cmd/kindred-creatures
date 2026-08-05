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
 * whether the temperament line breathes, whether the plate reads as a catalogue
 * entry rather than a headstone.
 *
 *   RENDER_PLATES=1 npx vitest run src/lib/print/sample.test.ts
 *
 * Off by default: the rest of the suite has no business writing files.
 */
const OUT = ".plates";
const enabled = process.env.RENDER_PLATES === "1";

const W = 900;
const H = 1125;

/**
 * The front at TRUE PRINT SIZE: 110 by 150mm at 300 DPI. It used to be rendered
 * here as a 600px square, which is neither the shape nor the scale of the real
 * thing, so the two questions the front actually raises (is the wordmark heavy
 * enough, does a long name fit) could not be answered from the output.
 */
const FRONT_W = 1299;
const FRONT_H = 1772;

function profile(over: Partial<CompanionProfile>): CompanionProfile {
  return { ...emptyProfile("dog"), ...over };
}

describe("sample plates", () => {
  it.skipIf(!enabled)("renders the cases the spec asks to eyeball", async () => {
    mkdirSync(OUT, { recursive: true });
    const provider = new MockImageProvider();
    const front = await provider.generatePortrait({ uploadKey: "x", side: "front" });
    const back = await provider.generatePortrait({ uploadKey: "x", side: "back" });

    const full = profile({
      name: "Francis",
      breedId: "yorkshire-terrier",
      temperament: ["confident", "affectionate", "spirited"],
      togetherSince: 2021,
    });

    const cases: [string, CompanionProfile, string | null][] = [
      ["full", full, "KC-01248"],
      ["no-name", { ...full, name: null }, "KC-01248"],
      // The temperament line: one word and three. The line has to centre, the
      // rule has to sit the same distance below it either way, and the portrait
      // must not overlap either.
      ["one-trait", { ...full, temperament: ["gentle"] }, "KC-01248"],
      ["two-traits", { ...full, temperament: ["gentle", "watchful"] }, "KC-01248"],
      // No line and no gap: the portrait grows back into the space.
      ["no-traits", { ...full, temperament: [] }, "KC-01248"],
      // A one-row table, and the plate still has to look deliberate.
      ["no-traits-no-year", { ...full, temperament: [], togetherSince: null }, "KC-01248"],
      ["one-of-one", { ...full, breedId: "one-of-one-dog-large" }, "KC-01249"],
      ["long-breed", { ...full, breedId: "staffordshire-bull-terrier" }, "KC-01250"],
      // THE EMPTY TABLE. A breed they typed themselves and no year leaves the
      // table with nothing in it at all: their word is the heading, and the rule
      // above and the name below have to carry the plate on their own. This is
      // the case that has to be looked at rather than reasoned about.
      [
        "empty-table",
        profile({
          name: "Bruno",
          breedId: null,
          otherBreed: "Boerboel cross",
          temperament: ["loyal", "watchful"],
          togetherSince: null,
        }),
        "KC-01252",
      ],
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
      const png = await composePlate(
        backPlate(p, ref, W, H),
        back.portraitBytes,
        W,
        H,
      );
      writeFileSync(`${OUT}/plate-back-${label}.png`, png);
    }

    // The front, at print size. BARTHOLOMEW is the name that decides whether the
    // shrink-to-fit works; the wordmark is what decides whether SemiBold was the
    // right call, and neither question can be answered at 600px square.
    const fronts: [string, CompanionProfile][] = [
      ["with-name", full],
      ["no-name", { ...full, name: null }],
      ["long-name", { ...full, name: "Bartholomew" }],
      ["longest-name", { ...full, name: "Constantinopoulos" }],
    ];
    for (const [label, p] of fronts) {
      const png = await composePlate(
        frontPlate(p, FRONT_W, FRONT_H),
        front.portraitBytes,
        FRONT_W,
        FRONT_H,
      );
      writeFileSync(`${OUT}/plate-front-${label}.png`, png);
    }

    // Over a dark ground, to prove the alpha is real rather than white pixels.
    const onDarkSource = await composePlate(
      backPlate(full, "KC-01248", W, H),
      back.portraitBytes,
      W,
      H,
    );
    const onDark = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 30, g: 26, b: 22, alpha: 1 } },
    })
      .composite([{ input: Buffer.from(onDarkSource) }])
      .png()
      .toBuffer();
    writeFileSync(`${OUT}/plate-back-on-dark.png`, onDark);
  });
});
