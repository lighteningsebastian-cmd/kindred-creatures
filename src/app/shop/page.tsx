import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { CatalogueCard } from "@/components/shop/CatalogueCard";
import { StartFromPhotoBand } from "@/components/shop/StartFromPhotoBand";
import { ClosingCta } from "@/components/sections/ClosingCta";
import { stockDisclosure } from "@/lib/companion";
import { PRODUCTS, fitsFor } from "@/lib/products";
import { buildItemList } from "@/lib/seo/jsonld";
import { BRAND_NAME, siteUrl } from "@/lib/seo/site";

const title = "Shop the range";
const description = `The full ${BRAND_NAME} range: a hoodie, a tee, a crewneck and a tote, each printed in Jeffreys Bay with your pet's portrait. Personalise the one you will reach for most.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/shop" },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/shop",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function ShopPage() {
  /*
   * ONE CARD PER GARMENT AND FIT, not per product. The men's and the women's
   * crewneck are different garments at different prices behind different
   * photographs, so a single card would have to choose whose picture to show
   * and whose price to quote.
   *
   * The ItemList is built from this same list, priced the same way, so the
   * structured data and the page cannot disagree about what is for sale.
   */
  const cards = PRODUCTS.flatMap((product) =>
    fitsFor(product).map((fit) => ({ product, fit })),
  );

  const structuredData = buildItemList({
    baseUrl: siteUrl(),
    entries: cards,
    name: `The ${BRAND_NAME} range`,
  });

  return (
    <div className="bg-base">
      <JsonLd data={structuredData} />

      <section className="py-16 md:py-24">
        <Container>
          <div className="max-w-2xl">
            <Reveal>
              <p className="eyebrow text-[11px] text-accent">The range</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-4 font-display text-4xl leading-[1.1] text-ink md:text-5xl">
                Four canvases for your creature
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                One portrait, four ways to wear it. Pick the piece you will
                reach for and we will put them on it.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* The highest-intent path for someone unsure what to buy, so it sits
          before the grid rather than closing the page. */}
      <StartFromPhotoBand />

      <section className="py-16 md:py-24">
        <Container>
          {/* Two-up on desktop with an alternating vertical offset, so the grid
              reads as a browsable catalogue rather than the home page's compact
              photo-overlay bento. */}
          <div className="grid gap-6 md:grid-cols-2 md:items-start md:gap-8">
            {cards.map(({ product, fit }, index) => (
              <Reveal
                key={`${product.slug}-${fit}`}
                delay={index * 0.08}
                className={index % 2 === 1 ? "md:mt-16" : ""}
              >
                <CatalogueCard product={product} fit={fit} />
              </Reveal>
            ))}
          </div>

          {/*
            Every card shows the same demo companion. stockDisclosure exists
            because a stand-in illustration has to be named as one, and a
            catalogue card's dog is a stand-in by definition. Once, beneath the
            grid: four repetitions of the same sentence is noise, and none is a
            claim about an animal that is not the customer's.
          */}
          <p className="mt-10 max-w-prose text-sm leading-relaxed text-muted">
            {stockDisclosure("German Shepherd")}
          </p>
        </Container>
      </section>

      <ClosingCta />
    </div>
  );
}
