import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import {
  PRODUCTS,
  fromPriceZar,
  formatZar,
  productPhoto,
  type ProductSlug,
} from "@/lib/products";

/** Per-slug bento sizing: the hoodie leads, the tee runs wide beneath it. */
const cellSpan: Record<ProductSlug, string> = {
  hoodie: "md:col-span-2 md:row-span-2",
  tee: "md:col-span-2",
  crewneck: "",
  tote: "",
};

/** Slugs rendered as photo-filled cells with an overlaid label. */
const photoFilled: ProductSlug[] = ["hoodie", "tee"];

export function ProductRange() {
  return (
    <section id="range" className="scroll-mt-24 bg-base py-20 md:py-28">
      <Container>
        <Reveal>
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-[11px] text-accent">The range</p>
            <h2 className="font-display text-3xl leading-[1.16] text-ink md:text-4xl">
              Four pieces, one portrait
            </h2>
            <p className="max-w-md text-muted">
              Pick the one you will reach for most.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid auto-rows-[minmax(180px,1fr)] gap-5 md:grid-cols-4">
          {PRODUCTS.map((product, index) => {
            const price = formatZar(fromPriceZar(product));
            const isFilled = photoFilled.includes(product.slug);
            const href = `/products/${product.slug}`;

            if (isFilled) {
              return (
                <Reveal
                  key={product.slug}
                  delay={index * 0.08}
                  className={cellSpan[product.slug]}
                >
                  <Link
                    href={href}
                    className="group relative flex h-full min-h-[220px] items-end overflow-hidden rounded-lg border border-line bg-surface"
                  >
                    <Image
                      src={productPhoto(product.slug, 1000, 1000)}
                      alt={`${product.name} carrying a pet portrait`}
                      fill
                      sizes="(max-width: 768px) 90vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="relative m-4 rounded-md border border-line bg-base/95 px-4 py-3">
                      <p className="font-display text-lg leading-[1.2] text-ink">
                        {product.name}
                      </p>
                      <p className="text-sm text-muted">
                        from <span className="text-accent-secondary">{price}</span>
                      </p>
                    </div>
                  </Link>
                </Reveal>
              );
            }

            return (
              <Reveal
                key={product.slug}
                delay={index * 0.08}
                className={cellSpan[product.slug]}
              >
                <Link
                  href={href}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image
                      src={productPhoto(product.slug, 700, 525)}
                      alt={`${product.name} carrying a pet portrait`}
                      fill
                      sizes="(max-width: 768px) 90vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex flex-col gap-1 p-4">
                    <p className="font-display text-lg leading-[1.2] text-ink">
                      {product.name}
                    </p>
                    <p className="text-sm text-muted">
                      from <span className="text-accent-secondary">{price}</span>
                    </p>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
