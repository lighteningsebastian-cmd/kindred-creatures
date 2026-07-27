import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ProductFlow } from "@/components/products/ProductFlow";
import { TrackProductView } from "@/components/analytics/TrackProductView";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  PRODUCTS,
  formatZar,
  fromPriceZar,
  getProduct,
  type Product,
} from "@/lib/products";
import { buildBreadcrumbList, buildProduct } from "@/lib/seo/jsonld";
import { BRAND_NAME, siteUrl } from "@/lib/seo/site";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
  // Colour and size can ride in on the URL (`?color=&size=`): the retired
  // /customize deep links redirect here preserving them, and both preselect
  // the flow. When both are present the portrait step is active on load. The
  // canonical URL carries no params, so indexing and metadata are unaffected.
  searchParams: Promise<{ color?: string; size?: string }>;
};

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

/**
 * The description a person reads under our result in Google, and the sentence
 * an answer engine is most likely to lift. So it says the three things someone
 * searching "custom pet hoodie South Africa" wants confirmed: it is their own
 * pet, it is printed here, and this is what it costs.
 *
 * The brand suffix comes from the root layout's title template, so the title
 * here is bare.
 */
function productDescription(product: Product): string {
  return `${product.name}, printed with a portrait made from your own photo of your pet. Printed in Jeffreys Bay and couriered to your door within 7 to 10 working days. From ${formatZar(fromPriceZar(product))}.`;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) {
    // This slug is about to notFound(). Nothing to canonicalise or index.
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  const path = `/products/${product.slug}`;
  const description = productDescription(product);
  // No OG image: real product photography does not exist yet (the page renders
  // hatched PhotoFrame placeholders), so a share card carries the title and
  // description rather than a fabricated stock image. Restore `images` here when
  // the shoot lands.

  return {
    title: product.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      // siteName and locale are restated rather than inherited: metadata merges
      // per top-level field, so declaring `openGraph` here replaces the root
      // layout's object whole and silently drops anything it does not repeat.
      siteName: BRAND_NAME,
      locale: "en_ZA",
      url: path,
      title: product.name,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
    },
  };
}

const portraitSteps = [
  "Upload a favourite photo of your pet, no studio shoot required.",
  "We hand-finish it into portrait artwork and send it for your approval.",
  "Once you say yes, we print it, check it over and send it on its way.",
];

const goodToKnow = [
  "The preview carries a watermark. The print file we make after you order does not.",
  "You get three portrait tries per photo, so take your time picking the one that looks most like them.",
  "A clear, well-lit photo where their face is easy to see gives the best portrait every time.",
];

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const { color, size } = await searchParams;

  // The Offer quotes the cheapest variant, which is what the page's own
  // "from R x" label means. No rating or review markup: we have no reviews.
  const structuredData = [
    buildProduct({
      baseUrl: siteUrl(),
      product,
      // No images: the page shows PhotoFrame placeholders, not photographs.
      // schema.org allows Product without image; restore when the shoot lands.
    }),
    buildBreadcrumbList(siteUrl(), [
      { name: "Kindred Creatures", path: "/" },
      { name: product.name, path: `/products/${product.slug}` },
    ]),
  ];

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <JsonLd data={structuredData} />
        <TrackProductView slug={product.slug} priceZar={fromPriceZar(product)} />
        <ProductFlow
          product={product}
          initialColor={color}
          initialSize={size}
        />

        <div className="mt-16 grid gap-10 border-t border-line pt-12 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-2xl leading-[1.2] text-ink">
              How your portrait happens
            </h2>
            <ol className="flex flex-col gap-3">
              {portraitSteps.map((step, index) => (
                <li key={index} className="flex gap-3 text-muted">
                  <span className="font-block font-black text-accent-secondary tabular-nums">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-display text-2xl leading-[1.2] text-ink">
              Delivery
            </h2>
            {/* PLACEHOLDER: R 99 flat courier rate pending logistics confirmation. */}
            <p className="max-w-md leading-relaxed text-muted">
              Printed in Jeffreys Bay and couriered anywhere in South Africa
              within 7 to 10 working days, tracked the whole way, for a flat R
              99.
            </p>
          </div>
        </div>

        <div className="mt-16 border-t border-line pt-12">
          <h2 className="font-display text-2xl leading-[1.2] text-ink">
            Good to know
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3 md:gap-8">
            {goodToKnow.map((note, index) => (
              <li key={index} className="max-w-md leading-relaxed text-muted">
                {note}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </div>
  );
}
