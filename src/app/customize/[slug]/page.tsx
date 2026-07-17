import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Customizer } from "@/components/customizer/Customizer";
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
    return { title: "Not found | Kindred Creatures" };
  }
  return {
    title: `Customise ${product.name} | Kindred Creatures`,
    description: `Upload a photo of your pet and see their portrait on ${product.name} before you order.`,
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
        <Customizer product={product} initialColor={color} initialSize={size} />

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
