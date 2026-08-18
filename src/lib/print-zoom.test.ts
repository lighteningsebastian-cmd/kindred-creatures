import { describe, it, expect } from "vitest";
import { PLACEMENT } from "@/lib/garments";
import {
  MAX_UPSCALE,
  TARGET_PRINT_FRACTION,
  plateCentre,
  zoomScale,
} from "./print-zoom";

const FRONT_PLATE = 600 / 818;
const BACK_PLATE_HOODIE = 900 / 1125;
const BACK_PLATE_TEE = 900 / 1080;
const PHOTO = 0.8;

describe("plateCentre", () => {
  it("finds the middle of the hoodie's chest badge", () => {
    const centre = plateCentre(PLACEMENT.hoodie.front, PHOTO, FRONT_PLATE);
    expect(centre.x).toBeCloseTo(62.5, 1);
    expect(centre.y).toBeCloseTo(37.1, 1);
  });

  it("does not hand the tee the hoodie's origin", () => {
    // The tee's back plate is 900x1080 and the hoodie's is 900x1125, because
    // the back print area is 250x300mm on a tee and 280x350 on the others.
    // Assuming one number puts the tee's zoom origin off centre by about 4% of
    // the photograph, which is a visible mis-frame once you are magnifying.
    const tee = plateCentre(PLACEMENT.tee.back, PHOTO, BACK_PLATE_TEE);
    const asIfHoodie = plateCentre(
      PLACEMENT.tee.back,
      PHOTO,
      BACK_PLATE_HOODIE,
    );
    expect(tee.y).not.toBeCloseTo(asIfHoodie.y, 1);
  });

  it("puts a centred plate on the centreline", () => {
    expect(
      plateCentre(PLACEMENT.hoodie.back, PHOTO, BACK_PLATE_HOODIE).x,
    ).toBeCloseTo(50, 5);
  });

  it("recovers the plate's height from the two shapes, not from its width", () => {
    // A plate that is 46% of the width is only 46% of the HEIGHT when the plate
    // and the photograph are the same shape, and they never are. Getting this
    // wrong frames above or below the print rather than on it.
    const square = plateCentre({ top: 20, left: 27, width: 46 }, 1, 1);
    expect(square.y).toBeCloseTo(20 + 46 / 2, 5);

    const tall = plateCentre({ top: 20, left: 27, width: 46 }, 1, 0.5);
    expect(tall.y).toBeCloseTo(20 + 92 / 2, 5);
  });
});

describe("zoomScale", () => {
  const source = 1120;

  // The lightbox box is LANDSCAPE when it frames a print, and the photographs
  // are portrait, so the photograph never fills the box's width. At 88vh on a
  // 1280x800 screen the box is 845 wide and the hoodie photo inside it is 563.
  // Every number below uses that real pair, because assuming they were equal
  // is exactly the bug this suite now guards.
  const box = 845;
  const photo = 563;

  it("fills the target fraction of the BOX, not of the photograph inside it", () => {
    // The plate is a percentage of the PHOTOGRAPH, and the photograph is
    // narrower than the box it sits in. Measuring the target against the photo
    // renders the print at 41% of the lightbox when 62% was asked for.
    const scale = zoomScale({
      plateWidthPct: 46,
      photoWidth: photo,
      boxWidth: box,
      photoSourceWidth: source,
    });
    const plateOnScreen = 0.46 * photo * scale;
    expect(plateOnScreen / box).toBeCloseTo(TARGET_PRINT_FRACTION, 2);
  });

  it("measures the upscale against the photograph, which is what gets stretched", () => {
    const scale = zoomScale({
      plateWidthPct: 13,
      photoWidth: photo,
      boxWidth: box,
      photoSourceWidth: source,
    });
    expect((photo * scale) / source).toBeLessThanOrEqual(MAX_UPSCALE + 0.001);
  });

  it("magnifies the chest badge far more than the back plate", () => {
    const front = zoomScale({
      plateWidthPct: 13,
      photoWidth: 375,
      boxWidth: 375,
      photoSourceWidth: source,
    });
    const back = zoomScale({
      plateWidthPct: 46,
      photoWidth: 375,
      boxWidth: 375,
      photoSourceWidth: source,
    });
    expect(front).toBeGreaterThan(back);
  });

  it("still magnifies the back plate, rather than opening at life size", () => {
    // 0.62 / 0.46 = 1.35. If this ever returns 1 the back view has become a
    // modal that does nothing, and it should be made un-clickable instead.
    expect(
      zoomScale({
        plateWidthPct: 46,
        photoWidth: 375,
        boxWidth: 375,
        photoSourceWidth: source,
      }),
    ).toBeCloseTo(TARGET_PRINT_FRACTION / 0.46, 2);
  });

  it("lets the ceiling bind on a wide screen and not on a phone", () => {
    const wide = zoomScale({
      plateWidthPct: 13,
      photoWidth: 1200,
      boxWidth: 1200,
      photoSourceWidth: source,
    });
    const phone = zoomScale({
      plateWidthPct: 13,
      photoWidth: 375,
      boxWidth: 375,
      photoSourceWidth: source,
    });
    expect(wide).toBeCloseTo((MAX_UPSCALE * source) / 1200, 2);
    expect(phone).toBeCloseTo(TARGET_PRINT_FRACTION / 0.13, 2);
  });

  it("never enlarges the photograph past the cap, at any width", () => {
    for (let width = 320; width <= 2560; width += 40) {
      for (const pct of [13, 46]) {
        const scale = zoomScale({
          plateWidthPct: pct,
          photoWidth: width,
          boxWidth: width,
          photoSourceWidth: source,
        });
        expect(
          (width * scale) / source,
          `box ${width}, plate ${pct}%`,
        ).toBeLessThanOrEqual(MAX_UPSCALE + 0.001);
      }
    }
  });

  it("never zooms out", () => {
    // A huge box and a small source would otherwise return a scale below 1 and
    // shrink the garment inside its own lightbox.
    expect(
      zoomScale({
        plateWidthPct: 46,
        photoWidth: 4000,
        boxWidth: 4000,
        photoSourceWidth: 400,
      }),
    ).toBeGreaterThanOrEqual(1);
  });

  it("stays at life size when there is no plate to frame", () => {
    // Fleece and profile carry no print, so there is nothing to frame on.
    expect(
      zoomScale({
        plateWidthPct: null,
        photoWidth: 900,
        boxWidth: 900,
        photoSourceWidth: source,
      }),
    ).toBe(1);
  });

  it("stays at life size before the box has been measured", () => {
    // The lightbox reads its own width after mounting, so the very first render
    // asks with zero. Answering anything but 1 would paint one frame at a
    // nonsense scale.
    expect(
      zoomScale({
        plateWidthPct: 13,
        photoWidth: 0,
        boxWidth: 0,
        photoSourceWidth: source,
      }),
    ).toBe(1);
  });
});
