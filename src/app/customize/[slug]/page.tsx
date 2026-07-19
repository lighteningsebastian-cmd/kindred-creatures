import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ProductFlow } from "@/components/products/ProductFlow";
import { getProduct } from "@/lib/products";

type CustomizePageProps = {
  params: Promise<{ slug: string }>;
  // Colour and size ride along from the product page CTA; both are hints, and
  // the Customizer re-validates them against the product's real variants.
  searchParams: Promise<{ color?: string; size?: string }>;
};

export async function generateMetadata({
  params,
}: CustomizePageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  return {
    title: `Customise ${product.name}`,
    description: `Upload a photo of your pet and see their portrait on ${product.name} before you order.`,
    // Not indexed, on purpose. This is a tool in the middle of a flow, not a
    // landing page: it needs an upload before it says anything, and its content
    // and keywords duplicate /products/[slug], which is the entry point we want
    // people arriving on. `follow` stays true so the links out of here still
    // count, and it is not disallowed in robots.txt because a crawler has to be
    // allowed to fetch the page in order to read this noindex at all.
    robots: { index: false, follow: true },
  };
}

export default async function CustomizePage({
  params,
  searchParams,
}: CustomizePageProps) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const { color, size } = await searchParams;

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        {/* Interim: this route becomes a redirect into /products/[slug] in the
            next commit. */}
        <ProductFlow product={product} initialColor={color} initialSize={size} />

        <div className="mt-16 border-t border-line pt-12">
          <h2 className="font-display text-2xl leading-[1.2] text-ink">
            Good to know
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3 md:gap-8">
            <li className="max-w-md leading-relaxed text-muted">
              The preview carries a watermark. The print file we make after you
              order does not.
            </li>
            <li className="max-w-md leading-relaxed text-muted">
              You get three portrait tries per photo, so take your time picking
              the one that looks most like them.
            </li>
            <li className="max-w-md leading-relaxed text-muted">
              A clear, well-lit photo where their face is easy to see gives the
              best portrait every time.
            </li>
          </ul>
        </div>
      </Container>
    </div>
  );
}
