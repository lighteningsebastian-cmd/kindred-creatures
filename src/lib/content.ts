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

/** The delivery promise, stated once. Five working days, from approval. */
export const DELIVERY_DAYS = 5;
