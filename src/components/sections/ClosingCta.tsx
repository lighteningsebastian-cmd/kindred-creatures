import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { AccentRule } from "@/components/ui/AccentRule";
import { Reveal } from "@/components/motion/Reveal";

/**
 * The one closing moment, shared by the home page and the shop so the two never
 * diverge: a centered AccentRule, a Young Serif question, and the single
 * start-intent CTA. Reuses the exact START YOUR PORTRAIT label and destination
 * used everywhere the start intent appears.
 */
export function ClosingCta() {
  return (
    <section className="bg-base py-20 md:py-28">
      <Container>
        <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
          <AccentRule />
          <h2 className="font-display text-3xl leading-[1.16] text-ink md:text-4xl">
            Ready to start their portrait?
          </h2>
          <p className="max-w-md text-lg leading-relaxed text-muted">
            Tell us about them, see their piece on the garment, and nothing is
            printed until you say yes.
          </p>
          <Button href="/products/hoodie" block>
            Start your portrait
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
