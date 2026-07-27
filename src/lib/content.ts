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
      "Most orders reach you within 7 to 10 working days from the moment you approve the portrait. Everything is printed in Jeffreys Bay and couriered to your door, tracked the whole way.",
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
    title: "Meet",
    body: "Introduce us to your best friend.",
  },
  {
    key: "approve",
    title: "Create",
    body: "We craft a portrait worthy of them.",
  },
  {
    key: "unbox",
    title: "Celebrate",
    body: "Wear them. Gift them. Treasure them.",
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

/**
 * The delivery promise, stated once.
 *
 * Measured from approval, not from order, because the customer controls when
 * they approve.
 *
 * IMPORTANT: this is a typical case, never a guarantee. Every surface must say
 * "most orders" and "about", because the courier leg is not ours to promise and
 * outlying areas run longer. A missed delivery promise costs a refund, a review
 * and the referral behind it. Do not let this harden into "delivered in 5
 * working days" anywhere.
 */
export const DELIVERY_DAYS = 5;
/** "about five working days". The only phrasing of the promise anywhere. */
export const DELIVERY_WINDOW = "about five working days";

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
    title: "Share the photo that captures them best",
    body: "Good light and a clear look at their face is all we need. If you are torn between two, send both and we will tell you which one will make the better portrait.",
  },
  {
    key: "draw",
    title: "We craft their portrait",
    body: "Your photo becomes artwork in the style you choose, hand-finished and framed with care, so it looks like them and not like a filter.",
  },
  {
    key: "approve",
    title: "You say yes, or you say not quite",
    body: "The portrait comes back to you before anything is printed. If the first one is not quite them, we rework it until it is. Nothing reaches the press without your word.",
  },
  {
    key: "ship",
    title: "We make it, and send it home",
    body: `Your piece is made to order in Jeffreys Bay, finished and checked over by hand, then packed to travel. Most orders reach their door within ${DELIVERY_WINDOW}, tracked the whole way.`,
  },
];
