import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { BRAND_NAME } from "@/lib/seo/site";

const title = "Journal";
const description = `The ${BRAND_NAME} journal: notes on the creatures we have drawn, how a good portrait happens, and life at a small Jeffreys Bay print operation. New, and filling up soon.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/journal" },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/journal",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

/**
 * A scaffold, honestly labelled. There are no posts yet, so rather than invent
 * dated stories we do not have, the page says plainly that the journal is new.
 * When real posts exist, they slot in below this intro and their URLs join the
 * sitemap the way products do.
 */
export default function JournalPage() {
  return (
    <div className="bg-base py-16 md:py-24">
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col items-start gap-6">
          <Reveal>
            <p className="eyebrow text-[11px] text-accent">The journal</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-[44px] md:leading-[1.08]">
              Stories are on their way.
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-xl text-lg leading-relaxed text-muted">
              This is where we will write about the creatures we have drawn,
              what makes a portrait feel like the real thing, and the small
              details of printing apparel by hand in Jeffreys Bay. We are only just
              starting, so there is nothing here yet. That will change.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-2 flex flex-col gap-4 rounded-lg border border-line bg-surface p-8">
              <p className="leading-relaxed text-muted">
                In the meantime, the best story we have is the one you make: your
                own creature, drawn from your photo and worn like art.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button href="/products/hoodie" block>
                  Start your portrait
                </Button>
                <Button href="/about" variant="secondary" block>
                  Read our story
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </div>
  );
}
