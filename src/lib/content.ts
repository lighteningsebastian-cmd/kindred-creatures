/**
 * Real, customer-facing copy that more than one surface needs to agree on.
 *
 * The landing page renders these; the JSON-LD builders in lib/seo/jsonld.ts
 * describe them to search engines and answer engines. Keeping one source means
 * the structured data cannot drift into claiming something the page does not
 * say, which is the whole point: markup that disagrees with the page is both a
 * lie and a penalty.
 *
 * S10's /faq and /how-it-works pages should read from here too rather than
 * restating any of it.
 */
import type { ArtStyle } from "@/lib/images/provider";

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * Answers are written to survive being lifted out of context: an answer engine
 * quoting one of these without its question should still say something true and
 * complete. Every fact here is stated somewhere on the site already (the
 * delivery promise, the how-it-works steps, the product range).
 */
export const FAQS: FaqEntry[] = [
  {
    question: "What can I put my pet on?",
    answer:
      "A hoodie, a tee, a crewneck or a tote. Dogs and cats mostly, but we will put whoever you love on any of the four.",
  },
  {
    question: "How good does my photo need to be?",
    answer:
      "A clear, well-lit photo of your pet's face is plenty, no studio shoot required. We will ask you for another one if the shot you send will not print well.",
  },
  {
    question: "What if I do not like the artwork?",
    answer:
      "You approve the portrait before anything is printed, and we will rework it until you are happy.",
  },
  {
    question: "How long until it arrives?",
    answer:
      "Five working days from the moment you approve the portrait. Every order is printed in Cape Town and couriered to your door, tracked the whole way.",
  },
];

export type HowItWorksStepKey = "upload" | "approve" | "unbox";

export interface HowItWorksStep {
  key: HowItWorksStepKey;
  title: string;
  body: string;
}

/** The three steps, in order, exactly as the landing page states them. */
export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    key: "upload",
    title: "Upload",
    body: "Pick the photo that captures them best. Clear light and a good look at their face is all we need.",
  },
  {
    key: "approve",
    title: "Approve",
    body: "We send back portrait artwork for your yes before anything is printed.",
  },
  {
    key: "unbox",
    title: "Unbox",
    body: "Your apparel arrives couriered to your door, ready to wear and hard to take off.",
  },
];

/**
 * One-line description of each portrait style, stated once.
 *
 * The customizer's StylePicker renders these next to each style, and the
 * /how-it-works styles showcase renders them again. Keeping the copy here means
 * the two surfaces cannot drift into describing the same style differently.
 * Keyed by ArtStyle so both readers stay exhaustive if a style is ever added.
 */
export const ART_STYLE_DESCRIPTIONS: Record<ArtStyle, string> = {
  "classic-portrait": "Warm, painterly, framed like a keepsake.",
  "line-sketch": "Clean single-line ink, quiet and modern.",
  watercolor: "Soft washes with a hand-painted feel.",
};

export type HowItWorksPageStepKey = "upload" | "draw" | "approve" | "ship";

export interface HowItWorksPageStep {
  key: HowItWorksPageStepKey;
  title: string;
  body: string;
}

/**
 * The four-step telling used by the full /how-it-works trust page. The home
 * teaser (HOW_IT_WORKS_STEPS above) stays a lighter three-step summary on
 * purpose, so the page and the teaser do not read as duplicates; this longer
 * version splits "we draw the portrait" out as its own considered step and is
 * the source both the visible page and its HowTo JSON-LD render from.
 *
 * The drawing step is framed as human, hand-finished work; it never says
 * "AI-generated".
 */
export const HOW_IT_WORKS_PAGE_STEPS: HowItWorksPageStep[] = [
  {
    key: "upload",
    title: "Upload a photo",
    body: "Pick the one that captures them best. Good light and a clear look at their face is all we need, and you can send a spare if you are torn between two.",
  },
  {
    key: "draw",
    title: "We draw the portrait",
    body: "Your photo becomes artwork in the style you choose, hand-finished and framed with care so it looks like them, not like a filter.",
  },
  {
    key: "approve",
    title: "You approve it",
    body: "We send the portrait back for your yes, and nothing goes to the press until you give it. If the first pass is not quite them, we rework it until it is right.",
  },
  {
    key: "ship",
    title: "We print and ship",
    body: "Once you approve it, we print your piece in Cape Town, check it by hand and courier it to your door, tracked the whole way, in five working days.",
  },
];

/** The delivery promise, stated once. Five working days, from approval. */
export const DELIVERY_DAYS = 5;
