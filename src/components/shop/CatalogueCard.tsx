import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  fromPriceZar,
  formatZar,
  productPhoto,
  type Product,
} from "@/lib/products";

/**
 * One large catalogue card for /shop: a generous flatlay, the name and "from"
 * price on one editorial line, a blurb, the colours it comes in, and a single
 * primary CTA. Deliberately bigger and calmer than the home ProductRange tiles,
 * which are a compact photo-overlay bento; this is a two-up product card built
 * for browsing the range, not a teaser.
 */
export function CatalogueCard({ product }: { product: Product }) {
  const href = `/products/${product.slug}`;
  const price = formatZar(fromPriceZar(product));
  const colours = product.variants.map((variant) => variant.color).join(", ");

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface">
      {/* TODO: real photo */}
      <Link
        href={href}
        className="group relative block aspect-[5/4] overflow-hidden"
      >
        <Image
          src={productPhoto(product.slug, 900, 720)}
          alt={`${product.name}, printed with a pet portrait`}
          fill
          sizes="(max-width: 768px) 92vw, 46vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-2xl leading-[1.15] text-ink">
            {product.name}
          </h2>
          <p className="whitespace-nowrap text-muted">
            from <span className="text-accent-secondary">{price}</span>
          </p>
        </div>

        <p className="max-w-prose leading-relaxed text-muted [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
          {product.blurb}
        </p>

        <div
          className="flex items-center gap-2"
          role="img"
          aria-label={`Available in ${colours}`}
        >
          {product.variants.map((variant) => (
            <span
              key={variant.color}
              title={variant.color}
              className="h-4 w-4 rounded-full border border-black/10"
              style={{ backgroundColor: variant.colorHex }}
            />
          ))}
        </div>

        <div className="mt-auto pt-2">
          <Button href={href} block className="w-full sm:w-auto">
            Personalise
          </Button>
        </div>
      </div>
    </article>
  );
}
