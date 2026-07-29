// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  COMPOSITION,
  CONSTRAINTS,
  PROMPT_VERSION,
  STYLE_CLAUSE,
  SUBJECT,
} from "./prompts";
import { buildPortraitPrompt } from "./openai";
import { ART_STYLES } from "./provider";

/**
 * The prompt is the product. These tests do not judge whether the words are
 * good (only real photographs can do that, see spec-portrait-prompting section
 * 6); they pin the SHAPE, so a well-meaning edit cannot quietly drop the clause
 * that keeps the likeness or the one that keeps the background transparent.
 */

describe("prompt clauses", () => {
  it("has a style clause for every style a customer can pick", () => {
    for (const style of ART_STYLES) {
      expect(STYLE_CLAUSE[style]).toBeTruthy();
    }
    expect(Object.keys(STYLE_CLAUSE).sort()).toEqual([...ART_STYLES].sort());
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

  it("leaves a generous margin, so nothing is cropped at the print edge", () => {
    expect(COMPOSITION.toLowerCase()).toContain("margin");
  });

  it("carries a version that can be recorded against an artwork", () => {
    expect(PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});

describe("buildPortraitPrompt", () => {
  it("composes subject, style, composition and constraints in that order", () => {
    const prompt = buildPortraitPrompt("watercolor");

    expect(prompt).toContain(SUBJECT);
    expect(prompt).toContain(STYLE_CLAUSE.watercolor);
    expect(prompt).toContain(COMPOSITION);
    expect(prompt).toContain(CONSTRAINTS);

    // Order matters: the fixed clauses bracket the one that varies, and the
    // nature fragment (spec section 5) will one day sit in the gap between the
    // style clause and the composition clause.
    expect(prompt.indexOf(SUBJECT)).toBeLessThan(
      prompt.indexOf(STYLE_CLAUSE.watercolor),
    );
    expect(prompt.indexOf(STYLE_CLAUSE.watercolor)).toBeLessThan(
      prompt.indexOf(COMPOSITION),
    );
    expect(prompt.indexOf(COMPOSITION)).toBeLessThan(prompt.indexOf(CONSTRAINTS));
  });

  it("changes only the style clause between styles", () => {
    const prompts = ART_STYLES.map((style) => buildPortraitPrompt(style));
    for (const prompt of prompts) {
      expect(prompt).toContain(SUBJECT);
      expect(prompt).toContain(COMPOSITION);
      expect(prompt).toContain(CONSTRAINTS);
    }
    // Three genuinely different prompts, differing only in how it is drawn.
    expect(new Set(prompts).size).toBe(ART_STYLES.length);
  });

  it("never asks for a frame, which the model would draw and we would print", () => {
    // "museum framing" was in the old single-sentence prompt and is exactly the
    // instruction that puts a picture frame on a hoodie.
    for (const style of ART_STYLES) {
      expect(buildPortraitPrompt(style).toLowerCase()).not.toContain(
        "museum framing",
      );
    }
  });
});
