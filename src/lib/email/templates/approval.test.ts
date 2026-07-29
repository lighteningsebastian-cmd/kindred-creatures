import { describe, it, expect } from "vitest";
import {
  approvedEmail,
  artworkReadyEmail,
  revisionReadyEmail,
} from "./approval";

const base = {
  firstName: "Thandi",
  creatureName: "Fenn",
  approveUrl: "https://example.test/approve/tok",
};

const approved = {
  firstName: "Thandi",
  creatureName: "Fenn",
  orderRef: "KC-2607-04821",
  orderUrl: "https://example.test/order/tok",
};

describe("subjects", () => {
  it("uses the name we were given", () => {
    expect(artworkReadyEmail(base).subject).toBe("Fenn is ready to see");
    expect(revisionReadyEmail(base).subject).toBe("Another look at Fenn");
    expect(approvedEmail(approved).subject).toBe("Fenn is going to print");
  });

  it("falls back to them and your companion, never to a blank", () => {
    const noName = { ...base, creatureName: null };
    expect(artworkReadyEmail(noName).subject).toBe(
      "Your companion is ready to see",
    );
    expect(revisionReadyEmail(noName).subject).toBe("Another look at them");
    expect(approvedEmail({ ...approved, creatureName: null }).subject).toBe(
      "Your companion is going to print",
    );
  });

  it("treats an empty name as no name", () => {
    expect(artworkReadyEmail({ ...base, creatureName: "  " }).subject).toBe(
      "Your companion is ready to see",
    );
  });
});

describe("the rule that every line must survive a loss", () => {
  const all = [
    artworkReadyEmail(base),
    artworkReadyEmail({ ...base, creatureName: null }),
    revisionReadyEmail(base),
    approvedEmail(approved),
  ];

  it("never speaks of the animal in the future tense", () => {
    // A share of these orders are placed within a week of a loss. What is in
    // the future is the portrait and the parcel, never the creature.
    const banned = [
      /bring(ing)? (them|him|her|it) to life/i,
      /can.?t wait to meet/i,
      /look(ing)? forward to meeting/i,
      /will love (them|him|her|it)/i,
      /they will be/i,
      /your (new )?best friend will/i,
    ];
    for (const mail of all) {
      for (const pattern of banned) {
        expect(mail.subject, mail.subject).not.toMatch(pattern);
        expect(mail.text, mail.subject).not.toMatch(pattern);
        expect(mail.html, mail.subject).not.toMatch(pattern);
      }
    }
  });

  it("never says AI, generated or pet", () => {
    for (const mail of all) {
      expect(mail.text.toLowerCase()).not.toMatch(/\bai\b|generated|generate/);
      expect(mail.subject.toLowerCase()).not.toContain("your pet");
    }
  });

  it("carries the link in both halves, so neither is decorative", () => {
    const mail = artworkReadyEmail(base);
    expect(mail.html).toContain(base.approveUrl);
    expect(mail.text).toContain(base.approveUrl);
  });

  it("promises that nothing prints before they say so", () => {
    const mail = artworkReadyEmail(base);
    expect(mail.text).toMatch(/nothing goes to the press until you say so/i);
  });

  it("never puts the approval link in the approved mail", () => {
    // Once it is approved that link has done its job, and the order-status
    // link is the one that keeps working.
    const mail = approvedEmail(approved);
    expect(mail.html).not.toContain("/approve/");
    expect(mail.html).toContain(approved.orderUrl);
  });
});
