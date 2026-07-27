import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { AccentRule } from "@/components/ui/AccentRule";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Centered "start from a photo" band for people who have not decided on a piece
 * yet. It sits directly under the shop header, before the grid: it is the
 * highest-intent path for someone unsure what to buy. A centered moment, so it
 * carries the two-line AccentRule rather than a left-aligned eyebrow, and sends
 * them into the hoodie's product flow (a sensible default) where colour, size
 * and the portrait step all live. Carries the one start-intent label used
 * site-wide and repeats the delivery promise.
 */
export function StartFromPhotoBand() {
  return (
    <section className="border-y border-line bg-surface py-16 md:py-20">
      <Container>
        <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
          <AccentRule />
          <h2 className="font-display text-3xl leading-[1.16] text-ink md:text-4xl">
            Not sure where to start?
          </h2>
          <p className="max-w-md text-lg leading-relaxed text-muted">
            Upload a photo and see it on the piece first. Nothing prints until
            you love the portrait.
          </p>
          <Button href="/products/hoodie" block>
            Start your portrait
          </Button>
          <p className="eyebrow text-[11px] text-muted">
            Printed in Jeffreys Bay · Delivered in 7 to 10 working days
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
