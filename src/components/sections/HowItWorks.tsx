import { UploadSimple, PencilSimple, Package } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";

const steps = [
  {
    icon: UploadSimple,
    title: "Upload",
    body: "Pick the photo that captures them best. Clear light and a good look at their face is all we need.",
  },
  {
    icon: PencilSimple,
    title: "Approve",
    body: "We send back portrait artwork for your yes before anything is printed.",
  },
  {
    icon: Package,
    title: "Unbox",
    body: "Your apparel arrives couriered to your door, ready to wear and hard to take off.",
  },
];

/**
 * Three verb-led steps in an asymmetric 2fr/1fr/1fr grid, each rising into view
 * on a small staggered whileInView entrance.
 */
export function HowItWorks() {
  return (
    <section className="bg-surface py-20 md:py-28">
      <Container>
        <Reveal>
          <h2 className="max-w-xl font-display text-3xl leading-[1.16] text-ink md:text-4xl">
            From your camera roll to your wardrobe
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-[2fr_1fr_1fr]">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal
                key={step.title}
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
      </Container>
    </section>
  );
}
