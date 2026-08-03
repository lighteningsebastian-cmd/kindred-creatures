import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { Reveal } from "@/components/motion/Reveal";
import { BRAND_NAME } from "@/lib/seo/site";

const title = "Our story";
const description = `Why ${BRAND_NAME} makes portraits of the animals people love, hand-finished from your own photo and printed in Jeffreys Bay. The care behind every piece, and the approval step that means you only ever wear a portrait you love.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "article",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/about",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

/** A named thread in the story, rendered as a hairline-separated block. */
type Thread = { heading: string; body: string[] };

const threads: Thread[] = [
  {
    heading: "Why the animals",
    body: [
      "There is a particular way a person looks at their dog, or their cat, when they think no one is watching. Soft around the eyes. Wholly given over. We started here because that feeling deserves better than a phone screen you scroll past.",
      "So we make one thing, and we make it properly: a portrait of the creature you love, drawn from your own photo and worn on something you will actually reach for.",
    ],
  },
  {
    heading: "The portrait comes first",
    body: [
      "Every order begins as artwork, not a print run. You send us a photo, we hand-finish it into a portrait, and then we stop and send it back to you. Nothing goes to the press until you have looked at your creature and said yes.",
      "If the first pass is not quite them, we rework it until it is. You are never handed a surprise, and you never pay for a portrait you would not want to wear.",
    ],
  },
  {
    heading: "Printed in Jeffreys Bay",
    body: [
      "We hold no stock and print nothing until your portrait is approved. When it is, it goes to a print shop in Jeffreys Bay that treats each garment as a single piece of work: printed, checked over by hand, and packed to travel.",
      "From your yes, it is couriered anywhere in South Africa within 7 to 10 working days, tracked the whole way, so you always know where your creature has got to.",
    ],
  },
  {
    heading: "People, and their animals",
    body: [
      "A hoodie with your late dog on it. A tee for the friend whose cat runs the house. A crewneck bought quietly, for no reason other than love. This is what we are for.",
      "We are a small operation and we like it that way. Reply to any email from us and a person reads it, with your order reference in front of them.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="bg-base">
      {/* Intro */}
      <section className="border-b border-line py-16 md:py-24">
        <Container>
          <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
            <div className="flex flex-col items-start gap-6">
              <Reveal>
                <p className="eyebrow text-[11px] text-accent">Our story</p>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="font-display text-[40px] leading-[1.06] text-ink sm:text-5xl lg:text-[54px]">
                  We make portraits of the ones who never ask for anything back.
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="max-w-md text-lg leading-relaxed text-muted">
                  {BRAND_NAME} turns your own photo of your pet into
                  hand-finished portrait artwork, printed on a hoodie, tee,
                  crewneck or tote in Jeffreys Bay. One craft, done with care.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-2 flex flex-wrap gap-3">
                  <Button href="/products/hoodie" block>
                    Start your portrait
                  </Button>
                  <Button href="/#range" variant="secondary" block>
                    See the range
                  </Button>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.1}>
              <div className="relative mx-auto w-full max-w-md md:mx-0 md:ml-auto">
                <PhotoFrame
                  aspect="9 / 11"
                  description="portrait: a person sitting on the floor with their dog leaning into them, both at ease, warm unposed window light in a lived-in room"
                />
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* The threads */}
      <section className="py-16 md:py-24">
        <Container>
          <dl className="mx-auto flex max-w-2xl flex-col">
            {threads.map((thread, index) => (
              <Reveal key={thread.heading} delay={index * 0.05}>
                <div className="flex flex-col gap-4 border-t border-line py-10 first:border-t-0 first:pt-0 md:flex-row md:gap-10">
                  <dt className="md:w-1/3">
                    <h2 className="font-display text-2xl leading-[1.2] text-ink">
                      {thread.heading}
                    </h2>
                  </dt>
                  <dd className="flex flex-col gap-4 md:flex-1">
                    {thread.body.map((paragraph, i) => (
                      <p key={i} className="leading-relaxed text-muted">
                        {paragraph}
                      </p>
                    ))}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </Container>
      </section>

      {/* Closing band: maroon inverse, the brand's closing-CTA treatment. */}
      <section className="bg-inverse text-on-inverse">
        <Container className="flex flex-col items-start gap-6 py-16 md:items-center md:py-20 md:text-center">
          <h2 className="max-w-2xl font-display text-3xl leading-[1.16] md:text-4xl">
            Put someone you love where you can see them.
          </h2>
          <p className="max-w-xl leading-relaxed text-on-inverse/80">
            Tell us about them, and nothing is printed until you have seen the
            portrait and said yes.
          </p>
          <Button href="/products/hoodie" block>
            Start your portrait
          </Button>
        </Container>
      </section>
    </div>
  );
}
