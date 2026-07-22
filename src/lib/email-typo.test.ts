import { describe, it, expect } from "vitest";
import { suggestEmail } from "./email-typo";

describe("suggestEmail", () => {
  describe("catches near-miss typos of common providers", () => {
    const cases: Array<[string, string]> = [
      ["thandi@gmial.com", "thandi@gmail.com"],
      ["thandi@gamil.com", "thandi@gmail.com"],
      ["thandi@gmail.co", "thandi@gmail.com"],
      ["thandi@gmail.con", "thandi@gmail.com"],
      ["thandi@gmail.cm", "thandi@gmail.com"],
      ["thandi@iclod.com", "thandi@icloud.com"],
      ["thandi@iclould.com", "thandi@icloud.com"],
      ["thandi@outlok.com", "thandi@outlook.com"],
      ["thandi@hotmial.com", "thandi@hotmail.com"],
      ["thandi@yaho.com", "thandi@yahoo.com"],
      ["thandi@webmail.co.z", "thandi@webmail.co.za"],
      ["thandi@mweb.co.z", "thandi@mweb.co.za"],
      ["thandi@telkomsa.ne", "thandi@telkomsa.net"],
      ["thandi@vodamail.co.z", "thandi@vodamail.co.za"],
    ];

    it.each(cases)("%s -> %s", (input, expected) => {
      expect(suggestEmail(input)).toBe(expected);
    });

    it("preserves the local part exactly and only lowercases the domain", () => {
      expect(suggestEmail("Thandi.M@GMial.com")).toBe("Thandi.M@gmail.com");
    });
  });

  describe("stays quiet on addresses that need no help", () => {
    const correct = [
      "thandi@gmail.com",
      "thandi@icloud.com",
      "thandi@outlook.com",
      "thandi@hotmail.com",
      "thandi@yahoo.com",
      "thandi@webmail.co.za",
      "thandi@mweb.co.za",
      "thandi@telkomsa.net",
      "thandi@vodamail.co.za",
    ];

    it.each(correct)("does not suggest for the correct domain %s", (email) => {
      expect(suggestEmail(email)).toBeNull();
    });

    it("does not suggest for a correct domain typed in mixed case", () => {
      expect(suggestEmail("thandi@GMail.Com")).toBeNull();
    });

    const unrelated = [
      "thandi@kindredcreatures.co.za",
      "thandi@company.com",
      "thandi@redbull.co.za",
      "thandi@university.ac.za",
      "thandi@proton.me",
      "thandi@fastmail.com",
    ];

    it.each(unrelated)(
      "does not suggest for an unrelated valid domain %s",
      (email) => {
        expect(suggestEmail(email)).toBeNull();
      },
    );
  });

  describe("returns null for anything it cannot work with", () => {
    const junk = ["", "   ", "thandi", "thandi@", "@gmail.com", "thandigmail.com"];

    it.each(junk)("returns null for %j", (input) => {
      expect(suggestEmail(input)).toBeNull();
    });
  });
});
