// TEMPORARY placeholder so the Shop nav link resolves between P1 and P2. P2
// replaces this wholesale with the merchandised catalogue per
// docs/superpowers/plans/distinct-pages.md. Not in the sitemap until P2 lands.
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { BRAND_NAME } from "@/lib/seo/site";

const title = "Shop";
const description = `The ${BRAND_NAME} range: a hoodie, a tee, a crewneck and a tote, each printed with your pet's portrait.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return (
    <div className="bg-base py-16 md:py-24">
      <Container>
        <Reveal>
          <p className="eyebrow text-[11px] text-accent">The range</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-4 font-display text-3xl leading-[1.12] text-ink md:text-4xl">
            The full catalogue is on its way
          </h1>
        </Reveal>
        <Reveal delay={0.1} className="mt-8">
          <Button href="/#range" variant="ghost">
            See the range on the home page
          </Button>
        </Reveal>
      </Container>
    </div>
  );
}
