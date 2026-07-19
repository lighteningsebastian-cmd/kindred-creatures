import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { AccentRule } from "@/components/ui/AccentRule";
import { Reveal } from "@/components/motion/Reveal";
import { DELIVERY_DAYS } from "@/lib/content";

/**
 * Centered "start from a photo" band for people who have not decided on a piece
 * yet. A centered moment, so it carries the two-line AccentRule rather than a
 * left-aligned eyebrow. Sends them into the customizer on the hoodie, a sensible
 * default, and repeats the delivery promise.
 */
export function StartFromPhotoBand() {
  return (
    <section className="bg-surface py-20 md:py-28">
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
          <Button href="/customize/hoodie" block>
            Upload a photo
          </Button>
          <p className="eyebrow text-[11px] text-muted">
            Printed in Cape Town · Delivered in {DELIVERY_DAYS} working days
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
