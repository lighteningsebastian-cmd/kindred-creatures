import { notFound, permanentRedirect } from "next/navigation";
import { getProduct } from "@/lib/products";

type CustomizePageProps = {
  params: Promise<{ slug: string }>;
  // Preserved on the way through so a deep link still lands on the portrait
  // step of the product flow.
  searchParams: Promise<{ color?: string; size?: string }>;
};

/**
 * The customizer used to be its own page; it now lives inside the product page
 * as one continuous flow. This route is kept only to redirect old links and
 * bookmarks into `/products/[slug]`, carrying the colour/size hints along so a
 * deep link still opens on the portrait step.
 *
 * A permanent (308) redirect, so search engines and clients update the target.
 * An unknown slug still 404s rather than redirecting to a product that is not
 * there. There is no metadata or HTML: the request never renders a page.
 */
export default async function CustomizeRedirect({
  params,
  searchParams,
}: CustomizePageProps) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const { color, size } = await searchParams;
  const query = new URLSearchParams();
  if (color) query.set("color", color);
  if (size) query.set("size", size);
  const qs = query.toString();

  permanentRedirect(`/products/${product.slug}${qs ? `?${qs}` : ""}`);
}
