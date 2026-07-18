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
  strokeWidth: 3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

/**
 * A chibi cat peeks over the top of the heading, paws draped on the word like
 * it is peering over a wall. It sits still and cute (a slow blink, a soft ear
 * twitch) and, on entry and on hover, lifts one paw and bats the last word,
 * which springs. The whole body never moves; only the swatting paw does. Under
 * reduced motion it is a still, fully drawn cat with its paw resting on the word.
 *
 * Tuning: the cat's size and vertical overlap with the heading are set on the
 * <svg> (`width`, `bottom`). Nudge those two values to sit it higher or lower.
 */
export function CatSwat({ word, children, className, as = "h2" }: CatSwatProps) {
  const Tag = as;
  const { ref, inView, hasEntered } = useCreatureView<HTMLHeadingElement>({
    amount: 0.6,
  });
  const reducedMotion = useReducedMotion() ?? false;
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const running = useRef(false);

  const swat = useCallback(async () => {
    if (running.current || reducedMotion || !scope.current) return;
    running.current = true;
    try {
      // Paw lifts off the word...
      await animate(
        "[data-swipe]",
        { rotate: -38 },
        { type: "spring", stiffness: 260, damping: 16 },
      );
      // ...then snaps down and bats the word, which recoils and springs back.
      const bat = animate(
        "[data-swipe]",
        { rotate: 14 },
        { type: "spring", stiffness: 520, damping: 12 },
      );
      const knock = animate(
        "[data-word]",
        { rotate: [0, -9, 0], y: [0, 3, 0] },
        { duration: 0.7, ease: "easeOut", times: [0, 0.2, 1] },
      );
      await bat;
      // Paw settles back onto the word.
      await animate(
        "[data-swipe]",
        { rotate: 0 },
        { type: "spring", stiffness: 300, damping: 18 },
      );
      await knock;
    } finally {
      running.current = false;
    }
  }, [animate, reducedMotion, scope]);

  // Entrance swat, once the heading scrolls in.
  useEffect(() => {
    if (!hasEntered || reducedMotion) return;
    const timer = setTimeout(() => void swat(), 500);
    return () => clearTimeout(timer);
  }, [hasEntered, reducedMotion, swat]);

  // Idle life: a slow blink and an occasional ear twitch, paused off screen.
  useEffect(() => {
    if (!inView || reducedMotion || !scope.current) return;
    const controls = [
      animate(
        "[data-eyes]",
        { scaleY: [1, 1, 0.1, 1] },
        {
          duration: 4.5,
          times: [0, 0.86, 0.92, 1],
          repeat: Infinity,
          ease: "easeInOut",
        },
      ),
      animate(
        "[data-ear]",
        { rotate: [0, 0, -7, 0, 0] },
        {
          duration: 6,
          times: [0, 0.5, 0.56, 0.62, 1],
          repeat: Infinity,
          ease: "easeInOut",
        },
      ),
    ];
    return () => controls.forEach((c) => c.stop());
  }, [inView, reducedMotion, animate, scope]);

  return (
    <Tag
      ref={ref}
      onMouseEnter={() => void swat()}
      className={cn("font-display leading-[1.16] text-ink", className)}
    >
      {children}{" "}
      <span ref={scope} className="relative inline-block">
        <span data-word className="inline-block" style={{ transformOrigin: "50% 0%" }}>
          {word}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 120 104"
          className="pointer-events-none absolute left-1/2"
          style={{
            bottom: "calc(100% - 0.62em)",
            width: "3.4em",
            height: "2.95em",
            transform: "translateX(-50%)",
            overflow: "visible",
          }}
        >
          {/* Ears (twitch as a pair) */}
          <g data-ear style={{ transformOrigin: "60px 34px" }}>
            <path d="M39 40 C36 22 40 15 46 16 C52 17 55 24 56 33" {...STROKE} fill="var(--color-base)" />
            <path d="M44 30 C43 24 45 21 48 22 C50 23 51 27 51 31 Z" fill="var(--color-accent)" />
            <path d="M81 40 C84 22 80 15 74 16 C68 17 65 24 64 33" {...STROKE} fill="var(--color-base)" />
            <path d="M76 30 C77 24 75 21 72 22 C70 23 69 27 69 31 Z" fill="var(--color-accent)" />
          </g>

          {/* Head (gentle, filled so the text does not show through) */}
          <g data-head>
            <path
              d="M33 55 C33 37 45 30 60 30 C75 30 87 37 87 55 C87 71 76 82 60 82 C44 82 33 71 33 55 Z"
              {...STROKE}
              fill="var(--color-base)"
            />
            {/* Cheek blush */}
            <ellipse cx={43} cy={64} rx={5} ry={3} fill="var(--color-accent)" opacity={0.28} />
            <ellipse cx={77} cy={64} rx={5} ry={3} fill="var(--color-accent)" opacity={0.28} />
            {/* Eyes (blink as a pair) with a soft highlight */}
            <g data-eyes style={{ transformOrigin: "60px 55px" }}>
              <circle cx={49} cy={55} r={6} fill="var(--color-ink)" />
              <circle cx={71} cy={55} r={6} fill="var(--color-ink)" />
              <circle cx={47} cy={53} r={1.9} fill="var(--color-base)" />
              <circle cx={69} cy={53} r={1.9} fill="var(--color-base)" />
            </g>
            {/* Nose + soft mouth */}
            <path d="M56 65 L64 65 L60 70 Z" fill="var(--color-accent)" />
            <path d="M60 70 C60 74 56 75 53 73 M60 70 C60 74 64 75 67 73" {...STROKE} strokeWidth={2.2} />
            {/* Whiskers */}
            <path d="M31 62 C23 61 17 61 12 63 M31 68 C23 68 17 69 12 71" {...STROKE} strokeWidth={1.6} />
            <path d="M89 62 C97 61 103 61 108 63 M89 68 C97 68 103 69 108 71" {...STROKE} strokeWidth={1.6} />
          </g>

          {/* Resting paw, draped over the word */}
          <path d="M34 104 C34 90 54 90 54 104" {...STROKE} fill="var(--color-base)" />
          <path d="M41 104 L41 96 M47 104 L47 96" {...STROKE} strokeWidth={2} />

          {/* Swatting paw: pivots from the shoulder, bats the word */}
          <g data-swipe style={{ transformOrigin: "80px 86px" }}>
            <path d="M66 104 C66 90 86 90 86 104" {...STROKE} fill="var(--color-base)" />
            <ellipse cx={76} cy={100} rx={3.4} ry={2.6} fill="var(--color-accent)" />
            <circle cx={71} cy={103} r={1.5} fill="var(--color-accent)" />
            <circle cx={81} cy={103} r={1.5} fill="var(--color-accent)" />
          </g>
        </svg>
      </span>
    </Tag>
  );
}
