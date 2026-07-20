import { cn } from "@/lib/cn";

/**
 * The kit's photo slot: a near-square frame filled with a subtle diagonal hatch
 * and a lowercase caption describing the shot we intend to put there. This is
 * the brand's standing placeholder treatment, used everywhere in place of stock
 * photography (the owner does not want unrelated stock filling these slots).
 *
 * PHOTOGRAPHY SHOT LIST: every `description` passed to a PhotoFrame is an
 * art-direction brief for the real shoot, written as subject + garment/colour +
 * mood/light. Swap each PhotoFrame for a real photograph once it is shot; until
 * then the frame stands in honestly rather than borrowing an unrelated image.
 *
 * Server-safe (no client JS). Space is reserved via `aspect-ratio`, so a frame
 * contributes zero layout shift. The hatch is decorative (`aria-hidden`); the
 * caption is real, visible content by design, like the kit.
 */
export type PhotoFrameProps = {
  /** The shot to put here, art-directed: subject, garment/colour, mood/light. */
  description: string;
  /** CSS aspect-ratio for the reserved box, e.g. "4 / 5". */
  aspect?: string;
  className?: string;
};

export function PhotoFrame({
  description,
  aspect = "4 / 5",
  className,
}: PhotoFrameProps) {
  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-surface",
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      {/*
        Diagonal hatch: ~1px dune-200 lines every 7px. --line resolves to
        dune-200; the 0.5 opacity keeps the lines faint enough that the caption
        stays comfortably above AA against the parchment-50 fill.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--line) 0, var(--line) 1px, transparent 1px, transparent 7px)",
          opacity: 0.5,
        }}
      />
      <p className="relative z-[1] mx-auto max-w-[28ch] px-5 text-center text-[12.5px] leading-[1.4] text-muted">
        {description}
      </p>
    </div>
  );
}
