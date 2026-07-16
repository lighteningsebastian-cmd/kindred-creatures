import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/**
 * Asymmetric split hero: copy on the left, a tall lifestyle portrait on the
 * right with a smaller cat shot spilling past the frame edge for variance. No
 * eyebrow, no trust strip, no scroll cue. Sized to sit within a single viewport
 * with its content vertically centred.
 */
export function Hero() {
  return (
    <section className="bg-base">
      <Container className="flex min-h-[100dvh] items-center py-16 pt-20 md:py-20">
        <div className="grid w-full items-center gap-12 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
          <div className="flex flex-col items-start gap-6">
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Wear the one who owns your heart
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted">
              Send us a favourite photo. We turn it into hand-finished portrait
              artwork and print it on apparel made to last.
            </p>
            <Button href="/products/hoodie" size="md" className="mt-2">
              Create theirs
            </Button>
          </div>

          <div className="relative mx-auto w-full max-w-md md:mx-0 md:ml-auto">
            <div className="relative aspect-[9/11] w-full overflow-hidden rounded-2xl border border-line bg-surface">
              <Image
                src="https://picsum.photos/seed/golden-retriever-owner-hug/900/1100"
                alt="A person holding their golden retriever close, both looking calm and content"
                fill
                priority
                sizes="(max-width: 768px) 90vw, 42vw"
                className="object-cover"
              />
            </div>
            {/* Second photo offset beyond the frame edge for asymmetric variance */}
            <div className="absolute -bottom-8 -left-6 w-32 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm sm:w-40 md:-left-10">
              <div className="relative aspect-square w-full">
                <Image
                  src="https://picsum.photos/seed/tabby-cat-window-light/400/400"
                  alt="A tabby cat resting in soft window light"
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
