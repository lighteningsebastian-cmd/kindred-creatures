import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import {
  FIT_LABELS,
  formatZar,
  fromPriceZar,
  type Product,
} from "@/lib/products";

/** Art-directed flatlay per product, reserved until the real shoot. */
const catalogueShot: Record<string, string> = {
  hoodie:
    "flatlay: the blue kindred hoodie pressed and squared to camera, a dog portrait print on the chest, soft daylight on a warm parchment backdrop",
  tee: "flatlay: the white kindred tee pressed flat, a cat portrait print centred, gentle overhead light, warm parchment backdrop",
  crewneck:
    "flatlay: the peach kindred crewneck laid flat, a pet portrait print centred, soft daylight, warm parchment backdrop",
  tote: "flatlay: the natural canvas kindred tote squared to camera, a pet portrait print centred, soft daylight, warm parchment backdrop",
};

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

  // Sizes available, as a plain range: "XS to XXL" for apparel, "One size" for
  // the tote. Built from the variants so the hint can never drift from stock.
  const sizes = Array.from(
    new Set(product.variants.flatMap((variant) => variant.sizes)),
  );
  const sizesHint =
    sizes.length === 1 ? sizes[0] : `${sizes[0]} to ${sizes[sizes.length - 1]}`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <Link href={href} className="block">
        <PhotoFrame
          aspect="5 / 4"
          description={catalogueShot[product.slug]}
          className="rounded-none border-0"
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
          <span className="text-sm text-muted">Sizes {sizesHint}</span>
          {/* The crewneck is the women's cut and runs one size shorter, so the
              fit belongs next to the size range rather than buried in the
              blurb: it is the thing that decides whether someone orders. */}
          {product.fit ? (
            <span className="text-sm text-muted">{FIT_LABELS[product.fit]}</span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button href={href} block className="w-full sm:w-auto">
            Personalise
          </Button>
          <p className="text-sm text-muted">Printed after your approval.</p>
        </div>
      </div>
    </article>
  );
}
