import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/**
 * Asymmetric editorial split: varsity-block eyebrow, Young Serif display
 * headline and a tight body-lg subcopy on the left; a lifestyle photograph with
 * a small overlapping second frame on the right, both near-square. Left-aligned,
 * top-weighted (pt within space-8), sized to sit within a single viewport. The
 * two CTAs carry the two site-wide intents: start (oxblood) and browse (outline).
 *
 * THE TWO FRAMES HOLD REAL PHOTOGRAPHY, not the hatched PhotoFrame placeholder
 * the rest of the site still uses. PhotoFrame's own note says to swap it for the
 * photograph once the shot exists; these two exist, so it is swapped. The frame
 * treatment (hairline border, parchment surface, rounded-lg) is kept so a real
 * photograph and a pending placeholder read as the same slot down the page.
 *
 * EACH FRAME IS THE PHOTOGRAPH'S OWN SHAPE. The lifestyle shot is 1400x1120, so
 * its frame is 5/4 and nothing is cropped; the folded hoodie is square, so its
 * frame is 1/1. The earlier 9/11 brief was written before the shoot came back
 * landscape, and forcing this frame back to it would cut a third of the width
 * off, either the dog's face on the left or the printed portrait on the right,
 * which is the one thing the picture is there to prove.
 */
export function Hero() {
  return (
    <section className="bg-base">
      <Container className="grid min-h-[calc(100svh-7rem)] items-center gap-10 pt-8 pb-16 md:grid-cols-[1.1fr_0.9fr] md:gap-16 md:pt-12">
        <div className="flex flex-col items-start gap-6">
          <p className="eyebrow text-[11px] text-accent">
            Made from your photo, printed in South Africa
          </p>
          <h1 className="font-display text-[40px] leading-[1.06] text-ink sm:text-5xl lg:text-[58px]">
            Your best friend, worn like art.
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-muted">
            Tell us about them and see their piece take shape. We draw a
            hand-finished portrait and print it on a hoodie in Jeffreys Bay.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button href="/products/hoodie" block>
              Start your portrait
            </Button>
            <Button href="/shop" variant="secondary" block>
              Shop the range
            </Button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md md:mx-0 md:ml-auto">
          {/* The LCP element on the home page: preloaded, and the only image
              here that is. `preload`, not `priority`: Next 16 deprecated the
              latter (see the image guide in node_modules/next/dist/docs/). */}
          <HeroFrame
            src="/hero/dog-hoodie-lifestyle.webp"
            alt="A woman outdoors at golden hour, her cheek against her golden retriever, wearing a blue Kindred Creatures hoodie printed with his portrait and his name, Buddy."
            aspect="5 / 4"
            sizes="(min-width: 480px) 448px, 100vw"
            preload
          />
          {/* Small overlapping second frame, in the kit's stacked style: the
              lifestyle shot says who it is for, this one says what arrives.
              Hidden on the narrowest screens so the hero stays calm and within
              the viewport on mobile. */}
          <div className="absolute -bottom-6 -left-6 hidden w-[42%] sm:block">
            <div className="rounded-lg bg-base p-1.5">
              <HeroFrame
                src="/hero/cat-hoodie-back.webp"
                alt="A white Kindred Creatures hoodie folded to show the back print: a pencil portrait of a tabby cat above a companion profile and the name Rufus."
                aspect="1 / 1"
                sizes="(min-width: 480px) 188px, 40vw"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * A photograph in the kit's frame. Local to the hero because the hero is the
 * only place with real photography so far; when the rest of the shoot lands,
 * this is the shape the shared component should take.
 */
function HeroFrame({
  src,
  alt,
  aspect,
  sizes,
  preload = false,
}: {
  src: string;
  alt: string;
  /** CSS aspect-ratio for the frame. Always the photograph's own shape. */
  aspect: string;
  sizes: string;
  preload?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-line bg-surface"
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        className="object-cover"
      />
    </div>
  );
}
