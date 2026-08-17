import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { Reveal } from "@/components/motion/Reveal";
import { GarmentShots } from "@/components/products/GarmentShots";
import { catalogueShots } from "@/lib/garment-shots";
import {
  PRODUCTS,
  fromPriceZar,
  formatZar,
  type ProductSlug,
} from "@/lib/products";

/** Per-slug bento sizing: the hoodie and tee lead wide, the rest sit in a row. */
const cellSpan: Record<ProductSlug, string> = {
  hoodie: "md:col-span-2",
  tee: "md:col-span-2",
  crewneck: "",
  tote: "",
};

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

        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {PRODUCTS.map((product, index) => {
            const price = formatZar(fromPriceZar(product));
            const href = `/products/${product.slug}`;
            const lead = cellSpan[product.slug] !== "";
            const shots = catalogueShots(product.slug);

            return (
              <Reveal
                key={product.slug}
                delay={index * 0.08}
                className={cellSpan[product.slug]}
              >
                <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong">
                  {shots.length > 0 ? (
                    <GarmentShots
                      shots={shots}
                      slug={product.slug}
                      aspect={lead ? "3 / 2" : "4 / 3"}
                      className="p-3"
                      sizes={
                        lead
                          ? "(min-width: 768px) 50vw, 100vw"
                          : "(min-width: 768px) 25vw, 100vw"
                      }
                      preload={product.slug === "hoodie"}
                    />
                  ) : (
                    <PhotoFrame
                      aspect="4 / 3"
                      description="flatlay: the natural canvas kindred tote with a pet portrait print, propped upright, soft daylight"
                      className="rounded-none border-0"
                    />
                  )}
                  <Link
                    href={href}
                    className="flex flex-col gap-1 border-t border-line p-4"
                  >
                    <p className="font-display text-lg leading-[1.2] text-ink">
                      {product.name}
                    </p>
                    <p className="text-sm text-muted">
                      from{" "}
                      <span className="text-accent-secondary">{price}</span>
                    </p>
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-8">
          <Button href="/shop" variant="secondary">
            Shop the range
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
