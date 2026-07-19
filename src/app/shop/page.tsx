import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { CatalogueCard } from "@/components/shop/CatalogueCard";
import { StartFromPhotoBand } from "@/components/shop/StartFromPhotoBand";
import { PRODUCTS } from "@/lib/products";
import { buildItemList } from "@/lib/seo/jsonld";
import { BRAND_NAME, siteUrl } from "@/lib/seo/site";

const title = "Shop the range";
const description = `The full ${BRAND_NAME} range: a hoodie, a tee, a crewneck and a tote, each printed in Cape Town with your pet's portrait. Personalise the one you will reach for most.`;

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
  // ItemList of the same four products the grid renders below, priced from the
  // same fromPriceZar, so the structured data and the page cannot disagree.
  const structuredData = buildItemList({
    baseUrl: siteUrl(),
    products: PRODUCTS,
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

          {/* Two-up on desktop with an alternating vertical offset, so the grid
              reads as a browsable catalogue rather than the home page's compact
              photo-overlay bento. */}
          <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-2 md:items-start md:gap-8">
            {PRODUCTS.map((product, index) => (
              <Reveal
                key={product.slug}
                delay={index * 0.08}
                className={index % 2 === 1 ? "md:mt-16" : ""}
              >
                <CatalogueCard product={product} />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <StartFromPhotoBand />
    </div>
  );
}
