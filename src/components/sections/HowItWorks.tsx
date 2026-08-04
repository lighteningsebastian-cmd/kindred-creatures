import type { Icon } from "@phosphor-icons/react";
import { ChatCircleText, PaintBrush, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { HOW_IT_WORKS_STEPS, type HowItWorksStepKey } from "@/lib/content";

// The words live in lib/content because the HowTo JSON-LD describes these exact
// steps; only the icon is this component's business.
const stepIcon: Record<HowItWorksStepKey, Icon> = {
  tell: ChatCircleText,
  draw: PaintBrush,
  approve: SealCheck,
};

/**
 * A light three-beat summary of the process: icon + verb title in a single row,
 * pointing at /how-it-works for the full four-step telling. Deliberately a
 * teaser, not a duplicate of that page, so the step bodies stay over there.
 */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-surface py-20 md:py-28">
      <Container>
        <Reveal>
          <p className="eyebrow text-[11px] text-accent">How it works</p>
          <h2 className="mt-4 max-w-xl font-display text-3xl leading-[1.16] text-ink md:text-4xl">
            From your favourite photo to something you keep
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const Icon = stepIcon[step.key];
            const number = String(index + 1).padStart(2, "0");
            return (
              <Reveal
                key={step.key}
                delay={index * 0.1}
                className="flex items-center gap-4 rounded-md border border-line bg-base p-5"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-tint text-accent">
                  <Icon size={22} />
                </span>
                <div className="flex flex-col gap-1">
                  <span
                    aria-hidden="true"
                    className="eyebrow text-[11px] text-accent-secondary"
                  >
                    {number}
                  </span>
                  <h3 className="font-display text-lg leading-[1.2] text-ink">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-10">
          <Button href="/how-it-works" variant="secondary">
            See how it happens
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
