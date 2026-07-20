import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PhotoFrame } from "@/components/ui/PhotoFrame";

/**
 * Asymmetric editorial split: varsity-block eyebrow, Young Serif display
 * headline and body-lg subcopy on the left; a single lifestyle portrait with a
 * near-square radius on the right. Left-aligned, top-weighted (pt within
 * space-8), sized to sit within a single viewport.
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
            Upload a favourite photo. We turn it into a hand-finished portrait
            and print it on a hoodie made in Cape Town, ready to wear and hard
            to take off.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button href="/products/hoodie" block>
              Start your portrait
            </Button>
            <Button href="/products/hoodie" variant="secondary" block>
              Shop the range
            </Button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md md:mx-0 md:ml-auto">
          <PhotoFrame
            aspect="9 / 11"
            description="lifestyle hero: a person outdoors hugging their golden retriever close, wearing the stone kindred hoodie with the dog's portrait print, soft warm morning light"
          />
        </div>
      </Container>
    </section>
  );
}
