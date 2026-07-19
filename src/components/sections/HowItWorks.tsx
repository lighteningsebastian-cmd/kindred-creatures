import type { Icon } from "@phosphor-icons/react";
import { UploadSimple, PencilSimple, Package } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { HOW_IT_WORKS_STEPS, type HowItWorksStepKey } from "@/lib/content";

// The words live in lib/content because the HowTo JSON-LD describes these exact
// steps; only the icon is this component's business.
const stepIcon: Record<HowItWorksStepKey, Icon> = {
  upload: UploadSimple,
  approve: PencilSimple,
  unbox: Package,
};

/**
 * Three verb-led steps in an asymmetric 2fr/1fr/1fr grid, each rising into view
 * on a small staggered whileInView entrance.
 */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-surface py-20 md:py-28">
      <Container>
        <Reveal>
          <p className="eyebrow text-[11px] text-accent">How it works</p>
          <h2 className="mt-4 max-w-xl font-display text-3xl leading-[1.16] text-ink md:text-4xl">
            From your camera roll to your wardrobe
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-[2fr_1fr_1fr]">
          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const Icon = stepIcon[step.key];
            return (
              <Reveal
                key={step.key}
                delay={index * 0.1}
                className="flex flex-col gap-4 rounded-lg border border-line bg-base p-7"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-accent-tint text-accent">
                  <Icon size={24} />
                </span>
                <h3 className="font-display text-xl leading-[1.2] text-ink">
                  {step.title}
                </h3>
                <p className="text-muted">{step.body}</p>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-10">
          <Button href="/how-it-works" variant="ghost">
            See how it works
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
