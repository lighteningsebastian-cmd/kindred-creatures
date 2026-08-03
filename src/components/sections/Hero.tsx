import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PhotoFrame } from "@/components/ui/PhotoFrame";

/**
 * Asymmetric editorial split: varsity-block eyebrow, Young Serif display
 * headline and a tight body-lg subcopy on the left; a lifestyle portrait with a
 * small overlapping second frame on the right, both near-square. Left-aligned,
 * top-weighted (pt within space-8), sized to sit within a single viewport. The
 * two CTAs carry the two site-wide intents: start (oxblood) and browse (outline).
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
          <PhotoFrame
            aspect="9 / 11"
            description="lifestyle hero: a person outdoors hugging their golden retriever close, wearing the blue kindred hoodie with the dog's portrait print, soft warm morning light"
          />
          {/* Small overlapping second frame, in the kit's stacked style. Purely
              decorative composition; hidden on the narrowest screens so the hero
              stays calm and within the viewport on mobile. */}
          <div className="absolute -bottom-6 -left-6 hidden w-[42%] sm:block">
            <div className="rounded-lg bg-base p-1.5">
              <PhotoFrame
                aspect="1 / 1"
                description="close-up: a cat's face in the printed portrait, soft studio light"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
