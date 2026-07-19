// TODO(P3): replace with the full trust page per docs/superpowers/plans/distinct-pages.md
// (numbered process with images, styles showcase, trust/quality section, process
// FAQ with FAQPage JSON-LD, HowTo JSON-LD, closing CTA band, and sitemap
// registration). This interim version exists only so the nav link resolves to a
// real, honest page between P1 and P3. It is deliberately not in the sitemap yet.
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { BRAND_NAME } from "@/lib/seo/site";

const title = "How it works";
const description = `From your photo to your door: how ${BRAND_NAME} turns a picture of your pet into portrait artwork, gets your approval, and prints it in Cape Town within five working days.`;

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

// Four plain steps. The full P3 page will render these as big numbered blocks
// with images and pull the wording into lib/content; kept inline here so the
// interim page stands on its own without pretending to be the finished thing.
const STEPS = [
  {
    title: "Upload a photo",
    body: "Pick the one that captures them best. Clear light and a good look at their face is all we need.",
  },
  {
    title: "We draw the portrait",
    body: "Our portrait process turns your photo into artwork in the style you choose.",
  },
  {
    title: "You approve it",
    body: "Nothing prints until you say yes. We rework the portrait until it is right.",
  },
  {
    title: "We print and ship",
    body: "Printed in Cape Town and couriered to your door, tracked the whole way, in five working days.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-base py-16 md:py-24">
      <Container>
        <Reveal>
          <p className="eyebrow text-[11px] text-accent">How it works</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-4 max-w-2xl font-display text-3xl leading-[1.12] text-ink md:text-4xl">
            From your camera roll to your wardrobe
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-4 max-w-xl leading-relaxed text-muted">
            Four steps, one portrait. Here is exactly what happens between the
            photo you send and the parcel that arrives.
          </p>
        </Reveal>

        <ol className="mt-12 flex flex-col gap-6">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 0.08}>
              <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6 sm:flex-row sm:gap-6">
                <span className="eyebrow text-2xl text-accent-secondary sm:w-12">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="font-display text-xl leading-[1.2] text-ink">
                    {step.title}
                  </h2>
                  <p className="max-w-xl leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.1} className="mt-12">
          <Button href="/customize/hoodie" block>
            Start your portrait
          </Button>
        </Reveal>
      </Container>
    </div>
  );
}
