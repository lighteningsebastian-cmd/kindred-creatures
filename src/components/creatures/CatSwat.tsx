"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { useCreatureView } from "./shared";

export type CatSwatProps = {
  /** The swattable word, appended to the heading text. */
  word: string;
  /** Heading text preceding the word. */
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
};

const STROKE = {
  stroke: "var(--color-ink)",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

/**
 * Cat x offsets inside the svg (viewBox units). The cat sits visibly at REST
 * (peek) with its paw just past the word, and reaches in to bat the word on a
 * swat, then settles back to the same visible resting pose. It is never hidden:
 * the whole point is that the reader sees a cat doing the swatting.
 */
const CAT_CONTACT = -24; // paw crosses onto the word
const CAT_PEEK = 0; // resting pose: whole cat visible, paw beside the word

/**
 * Heading whose final word hangs like a tag toy: a cat leans in from the right,
 * head and shoulder clearing the edge, and bats the word with a reaching paw;
 * the word swings on a springy pendulum. The cat lingers at full stretch so the
 * eye catches it doing the swatting, then slinks back out. Swats once on
 * viewport entry and again on hover. Under reduced motion the cat sits still,
 * fully visible, paw resting by the word.
 */
export function CatSwat({ word, children, className, as = "h2" }: CatSwatProps) {
  const Tag = as;
  const { ref, hasEntered } = useCreatureView<HTMLHeadingElement>({
    amount: 0.6,
  });
  const reducedMotion = useReducedMotion() ?? false;
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const running = useRef(false);

  const swat = useCallback(async () => {
    if (running.current || reducedMotion || !scope.current) return;
    running.current = true;
    try {
      // From its resting pose beside the word, the cat reaches its paw across...
      await animate(
        "[data-paw]",
        { x: CAT_CONTACT },
        { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
      );
      // ...knocks the word off its hook...
      const knock = animate(
        "[data-swat-word]",
        { rotate: -13 },
        { duration: 0.13, ease: "easeOut" },
      );
      // ...lingers at full stretch, then draws the paw back to its resting pose
      // (still fully visible) while the word swings itself out.
      const retreat = animate(
        "[data-paw]",
        { x: CAT_PEEK },
        { duration: 0.55, ease: "easeInOut", delay: 0.7 },
      );
      await knock;
      await animate(
        "[data-swat-word]",
        { rotate: 0 },
        { type: "spring", stiffness: 150, damping: 5 },
      );
      await retreat;
    } finally {
      running.current = false;
    }
  }, [animate, reducedMotion, scope]);

  useEffect(() => {
    if (!hasEntered) return;
    const timer = setTimeout(() => void swat(), 450);
    return () => clearTimeout(timer);
  }, [hasEntered, swat]);

  return (
    <Tag
      ref={ref}
      onMouseEnter={() => void swat()}
      className={cn("font-display leading-[1.16] text-ink", className)}
    >
      {children}{" "}
      <span ref={scope} className="relative inline-block">
        <span
          data-swat-word
          className="inline-block"
          style={{ transformOrigin: "50% -0.35em" }}
        >
          {word}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 152 96"
          className="pointer-events-none absolute"
          style={{
            left: "calc(100% - 0.6em)",
            top: "50%",
            width: "6.5em",
            height: "4.1em",
            transform: "translateY(-60%)",
            overflow: "visible",
          }}
        >
          <g
            data-paw
            style={{
              transform: `translateX(${CAT_PEEK}px)`,
              opacity: 1,
            }}
          >
            {/* Ears (outer outline + oxblood inner) */}
            <path d="M 88 27 L 90 6 L 105 25" {...STROKE} />
            <path d="M 92 23 L 93 12 L 101 23 Z" fill="var(--color-accent)" />
            <path d="M 112 25 L 127 6 L 129 27" {...STROKE} />
            <path d="M 116 23 L 124 12 L 125 23 Z" fill="var(--color-accent)" />
            {/* Head / face outline */}
            <path
              d="M 84 46 C 82 33, 88 24, 98 22 C 104 21, 112 21, 118 22 C 128 24, 134 33, 132 46 C 131 59, 123 69, 108 71 C 92 69, 85 59, 84 46 Z"
              {...STROKE}
            />
            {/* Eyes */}
            <ellipse cx={99} cy={44} rx={3.2} ry={4.2} fill="var(--color-ink)" />
            <ellipse cx={117} cy={44} rx={3.2} ry={4.2} fill="var(--color-ink)" />
            {/* Nose (oxblood) + mouth */}
            <path d="M 104.5 53 L 111.5 53 L 108 57.5 Z" fill="var(--color-accent)" />
            <path
              d="M 108 57.5 C 108 61, 105 62, 102.5 61 M 108 57.5 C 108 61, 111 62, 113.5 61"
              {...STROKE}
              strokeWidth={2}
            />
            {/* Whiskers on the edge side */}
            <path
              d="M 132 50 C 140 49, 146 49, 150 51 M 132 55 C 140 55, 146 56, 150 58"
              {...STROKE}
              strokeWidth={1.4}
            />
            {/* Foreleg + reaching paw (single silhouette) */}
            <path
              d="M 96 56 C 72 58, 48 61, 34 66 C 26 69, 18 71, 16 76 C 15 79.5, 17 82.5, 21 82.5 C 23 83.5, 25 82.5, 26.5 80.5 C 28.5 82.5, 31 82.5, 32.5 80.5 C 34.5 82, 37.5 81, 38.5 79 C 43 80, 49 79, 55 77 C 73 72, 88 68, 96 62"
              {...STROKE}
            />
            {/* Oxblood paw pads, facing the word */}
            <ellipse cx={24} cy={76} rx={4} ry={3.2} fill="var(--color-accent)" />
            <circle cx={19} cy={80.5} r={1.8} fill="var(--color-accent)" />
            <circle cx={26} cy={81} r={1.8} fill="var(--color-accent)" />
            <circle cx={33} cy={79} r={1.8} fill="var(--color-accent)" />
          </g>
        </svg>
      </span>
    </Tag>
  );
}
