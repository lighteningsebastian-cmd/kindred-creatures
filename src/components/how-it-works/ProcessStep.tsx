import { Reveal } from "@/components/motion/Reveal";
import type { HowItWorksPageStep } from "@/lib/content";

/**
 * One row in the numbered vertical process: a big camel varsity-block numeral
 * and the step's title on the left, its body on the right, between hairline
 * rules. With no photography, the rules and the wide gutter between title and
 * body carry the rhythm, so the four steps read as a ruled sequence rather than
 * four stacked paragraphs.
 */
export function ProcessStep({
  step,
  index,
}: {
  step: HowItWorksPageStep;
  index: number;
}) {
  const number = String(index + 1).padStart(2, "0");

  return (
    <Reveal
      as="li"
      className="grid gap-5 border-b border-line py-10 md:grid-cols-12 md:gap-8 md:py-16"
    >
      <div className="flex items-start gap-4 md:col-span-5 md:gap-6">
        <span
          aria-hidden="true"
          className="eyebrow w-14 shrink-0 text-4xl leading-none text-accent-secondary md:w-24 md:text-6xl"
        >
          {number}
        </span>
        <h2 className="font-display text-2xl leading-[1.15] text-ink md:pt-1 md:text-3xl">
          {step.title}
        </h2>
      </div>

      <p className="max-w-prose text-lg leading-relaxed text-muted md:col-span-6 md:col-start-7 md:pt-1.5">
        {step.body}
      </p>
    </Reveal>
  );
}
