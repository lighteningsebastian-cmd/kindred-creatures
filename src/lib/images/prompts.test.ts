// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  COMPOSITION,
  CONSTRAINTS,
  PROMPT_VERSION,
  STYLE_CLAUSE,
  SUBJECT,
  type PortraitSide,
} from "./prompts";
import { buildPortraitPrompt } from "./openai";

/**
 * The prompt is the product. These tests do not judge whether the words are
 * good (only real photographs can do that, see spec-portrait-prompting section
 * 6); they pin the SHAPE, so a well-meaning edit cannot quietly drop the clause
 * that keeps the likeness or the one that keeps the background transparent.
 */

const SIDES: PortraitSide[] = ["front", "back"];

describe("prompt clauses", () => {
  it("has a style and a composition clause for each side of the garment", () => {
    for (const side of SIDES) {
      expect(STYLE_CLAUSE[side]).toBeTruthy();
      expect(COMPOSITION[side]).toBeTruthy();
    }
    expect(Object.keys(STYLE_CLAUSE).sort()).toEqual([...SIDES].sort());
    expect(Object.keys(COMPOSITION).sort()).toEqual([...SIDES].sort());
  });

  it("draws the front in colour and the back in graphite", () => {
    // The back sits inside an archival plate of typeset rules and data, and
    // colour there fights the type. Two sides that came back looking the same
    // would be the defect nobody notices until a garment is printed.
    expect(STYLE_CLAUSE.back.toLowerCase()).toContain("graphite");
    expect(STYLE_CLAUSE.back.toLowerCase()).toContain("monochrome");
    expect(STYLE_CLAUSE.front.toLowerCase()).toContain("palette");
  });

  it("asks the back for a strict side profile and the front for face on", () => {
    // The profile has to be inferred from a face-on photograph, so the ask has
    // to be unambiguous: a model given room drifts straight back to face-on,
    // and a three-quarter view in an archival plate reads as a mistake.
    expect(COMPOSITION.back.toLowerCase()).toContain("side profile");
    expect(COMPOSITION.back.toLowerCase()).toContain("not facing the viewer");
    expect(COMPOSITION.front.toLowerCase()).toContain("facing the viewer");
  });

  it("asks for the animal in the photograph, not a handsome example of the breed", () => {
    // The single biggest cause of a portrait that is lovely and not theirs.
    expect(SUBJECT).toMatch(/THIS SPECIFIC animal/);
    expect(SUBJECT).toMatch(/markings/i);
    expect(SUBJECT).toMatch(/likeness/i);
  });

  it("forbids the things that get printed onto a garment by accident", () => {
    for (const forbidden of [
      "no frame",
      "no border",
      "no text",
      "no lettering",
      "no signature",
      "no watermark",
      "no human hands",
    ]) {
      expect(CONSTRAINTS.toLowerCase()).toContain(forbidden);
    }
  });

  it("asks for a transparent background, which is what fabric printing needs", () => {
    expect(CONSTRAINTS.toLowerCase()).toContain("transparent background");
  });

  it("leaves a generous margin on both sides, so nothing is cropped at the print edge", () => {
    for (const side of SIDES) {
      expect(COMPOSITION[side].toLowerCase()).toContain("margin");
    }
  });

  it("carries a version that can be recorded against an artwork", () => {
    expect(PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});

describe("buildPortraitPrompt", () => {
  it("composes subject, style, composition and constraints in that order", () => {
    const prompt = buildPortraitPrompt("front");

    expect(prompt).toContain(SUBJECT);
    expect(prompt).toContain(STYLE_CLAUSE.front);
    expect(prompt).toContain(COMPOSITION.front);
    expect(prompt).toContain(CONSTRAINTS);

    // Order matters: the fixed clauses bracket the ones that vary, and the
    // nature fragment (spec section 5) will one day sit in the gap between the
    // style clause and the composition clause.
    expect(prompt.indexOf(SUBJECT)).toBeLessThan(
      prompt.indexOf(STYLE_CLAUSE.front),
    );
    expect(prompt.indexOf(STYLE_CLAUSE.front)).toBeLessThan(
      prompt.indexOf(COMPOSITION.front),
    );
    expect(prompt.indexOf(COMPOSITION.front)).toBeLessThan(
      prompt.indexOf(CONSTRAINTS),
    );
  });

  it("keeps the subject and the constraints identical across both sides", () => {
    // What changes between front and back is how it is drawn and which way it
    // faces. Who it is, and what must never appear, do not move.
    const prompts = SIDES.map((side) => buildPortraitPrompt(side));
    for (const prompt of prompts) {
      expect(prompt).toContain(SUBJECT);
      expect(prompt).toContain(CONSTRAINTS);
    }
    expect(new Set(prompts).size).toBe(SIDES.length);
  });

  it("never asks for a frame, which the model would draw and we would print", () => {
    // "museum framing" was in the old single-sentence prompt and is exactly the
    // instruction that puts a picture frame on a hoodie.
    for (const side of SIDES) {
      expect(buildPortraitPrompt(side).toLowerCase()).not.toContain(
        "museum framing",
      );
    }
  });
});
