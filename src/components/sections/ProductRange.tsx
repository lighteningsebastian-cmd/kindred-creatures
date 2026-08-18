import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { Reveal } from "@/components/motion/Reveal";
import { GarmentShots } from "@/components/products/GarmentShots";
import { colourwayShots } from "@/lib/garment-shots";
import { PRODUCTS, fromPriceZar, formatZar } from "@/lib/products";

/**
 * FOUR EQUAL SQUARES, AND THE BENTO IS GONE. It used to span the hoodie and
 * tee across two columns at 3/2 while the others sat at 4/3.
 *
 * Two problems with one cause killed it. The tiles asked for landscape boxes
 * and every garment photograph is portrait, so the inner box shrank to fit the
 * height and left 47% of a lead tile as bare parchment — 64% of the grid used,
 * on average. And once the dots started cycling COLOURWAYS rather than views,
 * the shoot's inconsistency became visible: the tee's White is portrait at
 * 0.832 and its Heritage Blue and Olive are landscape at 1.26, so the garment
 * changed size mid-cycle in any box that was not square.
 *
 * A square sits almost exactly between 0.80 and 1.26, so both extremes fit it
 * about equally: the tee's jump falls from 29 points to 4, and the grid's
 * average usage rises to 83%. A two-column square would be twice the height of
 * a one-column square, so the old spans could not survive alongside it. Calmer
 * and more catalogue-like, less editorial — and it reads correctly against this
 * section's own headline. Owner decision, 18 August.
 */
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

        <div className="mt-10 grid gap-5 sm:grid-cols-2 md:grid-cols-4">
          {PRODUCTS.map((product, index) => {
            const price = formatZar(fromPriceZar(product));
            const href = `/products/${product.slug}`;
            const shots = colourwayShots(product.slug);

            return (
              <Reveal key={product.slug} delay={index * 0.08}>
                <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong">
                  {shots.length > 0 ? (
                    <GarmentShots
                      shots={shots}
                      slug={product.slug}
                      aspect="1 / 1"
                      className="p-3"
                      sizes="(min-width: 768px) 25vw, (min-width: 640px) 50vw, 100vw"
                      preload={product.slug === "hoodie"}
                    />
                  ) : (
                    <PhotoFrame
                      aspect="1 / 1"
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
