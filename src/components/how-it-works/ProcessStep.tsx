import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { Reveal } from "@/components/motion/Reveal";
import type { HowItWorksPageStep, HowItWorksPageStepKey } from "@/lib/content";

/** The shot each process step reserves, art-directed per step. */
const stepShot: Record<HowItWorksPageStepKey, string> = {
  upload:
    "candid: a hand holding a phone showing a favourite photo of a dog, warm indoor light over a kitchen table",
  draw: "detail: an artist hand-finishing a pet portrait on a tablet, the reference photo pinned alongside, focused desk light",
  approve:
    "over-the-shoulder: someone smiling at the finished portrait on a laptop, an approval email open, soft window light",
  ship: "detail: a printed kindred hoodie folded into kraft packaging with a courier label, Jeffreys Bay print studio, soft daylight",
};

/**
 * One block in the numbered vertical process: a big camel varsity-block numeral,
 * the step's title and body, and a placeholder photo. Rows alternate the image
 * from side to side (and shift the text/image column ratio) so the four steps
 * read as a considered sequence rather than four identical stripes.
 */
export function ProcessStep({
  step,
  index,
}: {
  step: HowItWorksPageStep;
  index: number;
}) {
  const number = String(index + 1).padStart(2, "0");
  // Even rows: text left, image right. Odd rows: image left, text right.
  const imageRight = index % 2 === 0;
  // Nudge the column ratio per row so the rhythm is not a fixed 50/50 grid.
  const ratio = imageRight ? "md:grid-cols-[1.05fr_0.95fr]" : "md:grid-cols-[0.95fr_1.05fr]";

  return (
    <Reveal
      as="li"
      className={`grid items-center gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 md:gap-12 md:py-14 ${ratio}`}
    >
      <div className={imageRight ? "" : "md:order-2"}>
        <div className="flex items-start gap-4 md:gap-6">
          <span
            aria-hidden="true"
            className="eyebrow shrink-0 text-4xl leading-none text-accent-secondary md:text-6xl"
          >
            {number}
          </span>
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-2xl leading-[1.15] text-ink md:text-3xl">
              {step.title}
            </h2>
            <p className="max-w-prose text-lg leading-relaxed text-muted">
              {step.body}
            </p>
          </div>
        </div>
      </div>

      <div className={imageRight ? "" : "md:order-1"}>
        <PhotoFrame aspect="4 / 3" description={stepShot[step.key]} />
      </div>
    </Reveal>
  );
}
