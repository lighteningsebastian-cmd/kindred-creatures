import { describe, expect, it } from "vitest";
import {
  outlineText,
  outlineTextOnArc,
  pathElement,
  svgDocument,
} from "./text-to-path";

const WORDMARK = { role: "wordmark", sizePx: 64 } as const;

/** Smallest signed distance between two angles, so comparisons survive wrapping. */
function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

describe("outlineText", () => {
  it("returns outlines and never a font reference", () => {
    const run = outlineText("KINDRED CREATURES", WORDMARK);

    expect(run.d).toMatch(/^M/);
    expect(run.d).not.toContain("<text");
    expect(run.d).not.toMatch(/font-family/i);
    expect(run.width).toBeGreaterThan(0);
    expect(run.ascent).toBeGreaterThan(0);
    expect(run.descent).toBeGreaterThan(0);
  });

  it("measures letterspacing between glyphs but not after the last one", () => {
    const plain = outlineText("ABC", WORDMARK);
    const spaced = outlineText("ABC", { ...WORDMARK, letterSpacingPx: 10 });

    // Three glyphs, two gaps. A trailing gap would make it 30 and push every
    // centred line half a space off centre.
    expect(spaced.width - plain.width).toBeCloseTo(20, 6);
  });

  it("handles an empty string without producing marks", () => {
    const run = outlineText("", WORDMARK);
    expect(run.d).toBe("");
    expect(run.width).toBe(0);
  });

  it("scales with size", () => {
    const small = outlineText("Francis", { role: "frontName", sizePx: 32 });
    const large = outlineText("Francis", { role: "frontName", sizePx: 64 });
    expect(large.width).toBeCloseTo(small.width * 2, 6);
  });
});

describe("outlineTextOnArc", () => {
  const ARC = {
    ...WORDMARK,
    letterSpacingPx: 8,
    radiusPx: 400,
    centreX: 500,
    centreY: 600,
  } as const;

  it("places every glyph exactly on the circle", () => {
    const arc = outlineTextOnArc("KINDRED CREATURES", ARC);

    expect(arc.glyphs.length).toBeGreaterThan(0);
    for (const glyph of arc.glyphs) {
      const distance = Math.hypot(
        glyph.x - ARC.centreX,
        glyph.y - ARC.centreY,
      );
      expect(distance).toBeCloseTo(ARC.radiusPx, 6);
    }
  });

  it("turns each glyph to the tangent at its own point, not a shared angle", () => {
    const arc = outlineTextOnArc("KINDRED CREATURES", ARC);

    // Differentiate the circle numerically and compare directions. This is the
    // check that separates real text on a path from glyph boxes rotated by one
    // angle, which the spec forbids.
    const h = 1e-6;
    for (const glyph of arc.glyphs) {
      const ax = ARC.centreX + ARC.radiusPx * Math.cos(glyph.angleRad - h);
      const ay = ARC.centreY + ARC.radiusPx * Math.sin(glyph.angleRad - h);
      const bx = ARC.centreX + ARC.radiusPx * Math.cos(glyph.angleRad + h);
      const by = ARC.centreY + ARC.radiusPx * Math.sin(glyph.angleRad + h);
      const tangent = Math.atan2(by - ay, bx - ax);

      expect(angleDelta(glyph.rotationRad, tangent)).toBeCloseTo(0, 6);
    }
  });

  it("gives every glyph a distinct, advancing rotation", () => {
    const arc = outlineTextOnArc("KINDRED CREATURES", ARC);
    const rotations = arc.glyphs.map((g) => g.rotationRad);

    for (let i = 1; i < rotations.length; i += 1) {
      expect(rotations[i]).toBeGreaterThan(rotations[i - 1]);
    }
    // A single shared rotation is precisely the failure mode being ruled out.
    expect(new Set(rotations).size).toBe(rotations.length);
  });

  it("centres the run on the top of the circle", () => {
    const arc = outlineTextOnArc("KINDRED CREATURES", ARC);
    const first = arc.glyphs[0]!;
    const last = arc.glyphs[arc.glyphs.length - 1]!;
    // Measure the run's outer edges, not its outermost glyph CENTRES: the first
    // and last glyphs have different advances, so their centres are not
    // symmetric about the top even when the run is.
    const leading = first.angleRad - first.advance / 2 / ARC.radiusPx;
    const trailing = last.angleRad + last.advance / 2 / ARC.radiusPx;

    // Straight up in SVG axes, so the arc reads as a rainbow over the portrait.
    expect(angleDelta((leading + trailing) / 2, -Math.PI / 2)).toBeCloseTo(0, 9);
    expect(trailing - leading).toBeCloseTo(arc.spanRad, 9);
    // Every glyph sits above the circle centre, which is what "curving upward" means.
    for (const glyph of arc.glyphs) {
      expect(glyph.y).toBeLessThan(ARC.centreY);
    }
  });

  it("subtends less angle on a wider curve", () => {
    const tight = outlineTextOnArc("KINDRED CREATURES", ARC);
    const wide = outlineTextOnArc("KINDRED CREATURES", {
      ...ARC,
      radiusPx: 800,
    });

    expect(wide.spanRad).toBeLessThan(tight.spanRad);
    // Same text at the same size measures the same however it is bent.
    expect(wide.width).toBeCloseTo(tight.width, 6);
  });

  it("produces different geometry from the same text set straight", () => {
    const straight = outlineText("KINDRED CREATURES", {
      ...WORDMARK,
      letterSpacingPx: 8,
    });
    const arc = outlineTextOnArc("KINDRED CREATURES", ARC);

    expect(arc.d).not.toBe(straight.d);
    expect(arc.d).toMatch(/^M/);
  });
});

describe("svg assembly", () => {
  it("carries outlines and no text elements or background", () => {
    const arc = outlineTextOnArc("KINDRED CREATURES", {
      ...WORDMARK,
      radiusPx: 400,
      centreX: 500,
      centreY: 600,
    });
    const name = outlineText("Francis", { role: "frontName", sizePx: 40 });
    const svg = svgDocument(
      1000,
      1000,
      pathElement(arc.d, "#2c2620") + pathElement(name.d, "#2c2620"),
    );

    // The entire point of the compositor: nothing in the output asks a
    // rasteriser to find a font, so nothing can be silently substituted.
    expect(svg).not.toContain("<text");
    expect(svg).not.toMatch(/font-family/i);
    expect(svg).toContain("<path");
    // No background rectangle: an opaque backing prints as a block of ink.
    expect(svg).not.toContain("<rect");
  });
});
