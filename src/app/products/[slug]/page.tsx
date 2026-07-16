import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ProductConfigurator } from "@/components/products/ProductConfigurator";
import { PRODUCTS, getProduct } from "@/lib/products";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) {
    return { title: "Not found | Kindred Creatures" };
  }
  return {
    title: `${product.name} | Kindred Creatures`,
    description: product.blurb,
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

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <ProductConfigurator product={product} />

        <div className="mt-16 grid gap-10 border-t border-line pt-12 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
              How your portrait happens
            </h2>
            <ol className="flex flex-col gap-3">
              {portraitSteps.map((step, index) => (
                <li key={index} className="flex gap-3 text-muted">
                  <span className="font-display font-semibold text-accent">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
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
