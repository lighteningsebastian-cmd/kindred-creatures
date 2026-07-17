import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ProductConfigurator } from "@/components/products/ProductConfigurator";
import { TrackProductView } from "@/components/analytics/TrackProductView";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  PRODUCTS,
  formatZar,
  fromPriceZar,
  getProduct,
  productPhoto,
  type Product,
} from "@/lib/products";
import { buildBreadcrumbList, buildProduct } from "@/lib/seo/jsonld";
import { BRAND_NAME, siteUrl } from "@/lib/seo/site";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

/** The shots this page renders: one per colourway, as the configurator shows them. */
function productImages(product: Product): string[] {
  return product.variants.map((variant) =>
    productPhoto(product.slug, 900, 1125, variant.color),
  );
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
  return `${product.name}, printed with a portrait made from your own photo of your pet. Printed in Cape Town and couriered to your door in 5 working days. From ${formatZar(fromPriceZar(product))}.`;
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
  const image = productPhoto(product.slug, 1200, 630);
  const alt = `${product.name} carrying a pet portrait`;

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
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: [{ url: image, alt }],
    },
  };
}

const portraitSteps = [
  "Upload a favourite photo of your pet, no studio shoot required.",
  "We hand-finish it into portrait artwork and send it for your approval.",
  "Once you say yes, we print and courier it, ready in 5 working days.",
];

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  // The Offer quotes the cheapest variant, which is what the page's own
  // "from R x" label means. No rating or review markup: we have no reviews.
  const structuredData = [
    buildProduct({
      baseUrl: siteUrl(),
      product,
      images: productImages(product),
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
        <ProductConfigurator product={product} />

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
              Printed in Cape Town and couriered anywhere in South Africa in 5
              working days, tracked the whole way, for a flat R 99.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
