import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { AccentRule } from "@/components/ui/AccentRule";
import { Reveal } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProcessStep } from "@/components/how-it-works/ProcessStep";
import { StyleCard } from "@/components/how-it-works/StyleCard";
import {
  DELIVERY_DAYS,
  FAQS,
  HOW_IT_WORKS_PAGE_STEPS,
} from "@/lib/content";
import { ART_STYLES } from "@/lib/images/provider";
import { buildFaqPage, buildHowTo } from "@/lib/seo/jsonld";
import { BRAND_EMAIL, BRAND_NAME } from "@/lib/seo/site";

const title = "How it works";
const description = `From your photo to your door: how ${BRAND_NAME} turns a picture of your pet into portrait artwork, gets your approval, and prints it in Cape Town within ${DELIVERY_DAYS} working days.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/how-it-works",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

// The three FAQ entries that speak to the process itself: photo quality, artwork
// approval and turnaround. Selected from the shared FAQS by question so both the
// visible list and the FAQPage JSON-LD below render the exact same copy.
const PROCESS_FAQ_QUESTIONS = [
  "How good does my photo need to be?",
  "What if I do not like the artwork?",
  "How long until it arrives?",
];
const processFaqs = FAQS.filter((faq) =>
  PROCESS_FAQ_QUESTIONS.includes(faq.question),
);

// Trust points, built from the same delivery promise the rest of the site uses.
const trustPoints = [
  {
    heading: "Approval before print",
    body: "Nothing goes to the press until you have seen the portrait and said yes. If it is not quite them, we rework it first.",
  },
  {
    heading: "Printed in South Africa",
    body: "Every piece is printed in Cape Town on premium blanks, then checked over by hand before it is packed to travel.",
  },
  {
    heading: `Delivered in ${DELIVERY_DAYS} working days`,
    body: "Couriered to your door from the day you approve your portrait, tracked the whole way so you always know where it is.",
  },
];

export default function HowItWorksPage() {
  // HowTo + FAQPage structured data, both built from the same constants the page
  // renders below, so the markup can never claim something the page does not say.
  const structuredData = [
    buildHowTo({
      name: `How ${BRAND_NAME} works`,
      description,
      steps: HOW_IT_WORKS_PAGE_STEPS,
    }),
    buildFaqPage(processFaqs),
  ];

  return (
    <div className="bg-base">
      <JsonLd data={structuredData} />

      {/* Header */}
      <section className="py-16 md:py-24">
        <Container>
          <div className="max-w-2xl">
            <Reveal>
              <p className="eyebrow text-[11px] text-accent">How it works</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-4 font-display text-4xl leading-[1.08] text-ink md:text-5xl">
                From your camera roll to a portrait you love
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                Four steps stand between the photo you send and the parcel that
                arrives. Here is exactly what happens at each one, and why you
                never pay for a portrait you would not want to wear.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Numbered process */}
      <section className="pb-4 md:pb-8">
        <Container>
          <ol className="flex flex-col">
            {HOW_IT_WORKS_PAGE_STEPS.map((step, index) => (
              <ProcessStep key={step.key} step={step} index={index} />
            ))}
          </ol>
        </Container>
      </section>

      {/* Styles showcase */}
      <section className="bg-surface py-16 md:py-24">
        <Container>
          <div className="max-w-2xl">
            <Reveal>
              <p className="eyebrow text-[11px] text-accent">The styles</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 font-display text-3xl leading-[1.16] text-ink md:text-4xl">
                Three ways to draw them
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                Pick the one that suits them best. You will see the portrait in
                your chosen style before anything is printed.
              </p>
            </Reveal>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 md:mt-12 md:grid-cols-3">
            {ART_STYLES.map((style, index) => (
              <Reveal key={style} delay={index * 0.08}>
                <StyleCard style={style} />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Trust / quality: a centered moment, so it carries the AccentRule. */}
      <section className="py-16 md:py-24">
        <Container>
          <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
            <AccentRule />
            <h2 className="font-display text-3xl leading-[1.16] text-ink md:text-4xl">
              Made carefully, and only once you say so
            </h2>
            <p className="text-lg leading-relaxed text-muted">
              We hold no stock and print nothing on spec. Your piece is made to
              order, the moment you approve the portrait.
            </p>
          </Reveal>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {trustPoints.map((point, index) => (
              <Reveal
                key={point.heading}
                delay={index * 0.08}
                className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-7"
              >
                <h3 className="font-display text-xl leading-[1.2] text-ink">
                  {point.heading}
                </h3>
                <p className="leading-relaxed text-muted">{point.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1} className="mt-10 text-center">
            <p className="text-muted">
              Questions before you start? Email a real person at{" "}
              <a
                href={`mailto:${BRAND_EMAIL}`}
                className="text-accent underline underline-offset-4 hover:text-accent-hover"
              >
                {BRAND_EMAIL}
              </a>
              , with your order in front of them.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Process FAQ */}
      <section className="bg-surface py-16 md:py-24">
        <Container>
          <div className="max-w-2xl">
            <Reveal>
              <p className="eyebrow text-[11px] text-accent">Good to know</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 font-display text-3xl leading-[1.16] text-ink md:text-4xl">
                The questions people ask first
              </h2>
            </Reveal>
          </div>

          <dl className="mx-auto mt-10 flex max-w-2xl flex-col md:mt-12">
            {processFaqs.map((faq, index) => (
              <Reveal key={faq.question} delay={index * 0.05}>
                <div className="flex flex-col gap-3 border-t border-line py-8 first:border-t-0 first:pt-0">
                  <dt>
                    <h3 className="font-display text-xl leading-[1.25] text-ink">
                      {faq.question}
                    </h3>
                  </dt>
                  <dd className="leading-relaxed text-muted">{faq.answer}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </Container>
      </section>

      {/* Closing CTA band: a centered moment with the AccentRule. */}
      <section className="py-20 md:py-28">
        <Container>
          <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
            <AccentRule />
            <h2 className="font-display text-3xl leading-[1.16] text-ink md:text-4xl">
              Ready to start their portrait?
            </h2>
            <p className="text-lg leading-relaxed text-muted">
              Upload a favourite photo and see them drawn before you part with
              anything.
            </p>
            <Button href="/customize/hoodie" block>
              Start your portrait
            </Button>
            <p className="eyebrow text-[11px] text-muted">
              Printed in Cape Town · Delivered in {DELIVERY_DAYS} working days
            </p>
          </Reveal>
        </Container>
      </section>
    </div>
  );
}
