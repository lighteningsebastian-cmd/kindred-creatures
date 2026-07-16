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

/** Paw x offsets inside the svg (viewBox units). */
const PAW_PARKED = 115;
const PAW_CONTACT = -16;
const PAW_PEEK = 55;

/**
 * Heading whose final word hangs like a tag toy: a cat paw sneaks in from the
 * right, bats it, and the word swings on a springy pendulum until it settles.
 * Swats once on viewport entry and again on hover. Under reduced motion the
 * word sits still and the paw peeks in statically.
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
      // Paw darts in from the right edge...
      await animate(
        "[data-paw]",
        { opacity: 1, x: [PAW_PARKED, PAW_CONTACT] },
        {
          duration: 0.3,
          ease: [0.16, 1, 0.3, 1],
          opacity: { duration: 0.05 },
        },
      );
      // ...knocks the word off its hook...
      const knock = animate(
        "[data-swat-word]",
        { rotate: -13 },
        { duration: 0.13, ease: "easeOut" },
      );
      // ...and slinks away while the word swings.
      const retreat = animate(
        "[data-paw]",
        { x: PAW_PARKED, opacity: 0 },
        {
          duration: 0.45,
          ease: "easeIn",
          delay: 0.1,
          opacity: { delay: 0.35, duration: 0.15 },
        },
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
      className={cn(
        "font-display font-semibold tracking-tight text-ink",
        className,
      )}
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
          viewBox="0 0 120 60"
          className="pointer-events-none absolute"
          style={{
            left: "calc(100% - 0.5em)",
            top: "50%",
            width: "3.5em",
            height: "1.75em",
            transform: "translateY(-54%)",
            overflow: "visible",
          }}
        >
          <g
            data-paw
            style={{
              transform: `translateX(${reducedMotion ? PAW_PEEK : PAW_PARKED}px)`,
              opacity: reducedMotion ? 1 : 0,
            }}
          >
            {/* Terracotta pads on the underside */}
            <path
              d="M 22.5 33 C 26 30, 31.5 31.2, 33 35 C 34.2 38.2, 31 41.4, 26.8 40.6 C 22.8 39.8, 20.5 35.4, 22.5 33 Z"
              fill="var(--color-accent)"
            />
            <circle cx={19.5} cy={39} r={2} fill="var(--color-accent)" />
            <circle cx={30} cy={42.5} r={2} fill="var(--color-accent)" />
            <circle cx={40} cy={42} r={2} fill="var(--color-accent)" />
            {/* Foreleg: toes, toe bumps, fur notches, elbow-down droop */}
            <path
              d="M 120 10 C 102 9, 86 10, 72 12.5 C 58 15, 46 18, 38 19.5 C 32 20.6, 27 21, 23.5 23.5 C 15 29, 11.5 35, 14 40.5 C 16.2 45, 22 46.5, 26 43 C 28 46.5, 34 47.3, 37.5 43.6 C 40 46.6, 45.5 46.6, 48.5 43 C 53 45, 58 44.8, 62 42.5 L 68 48.5 L 73 41 L 78.5 47.5 L 83 41.5 C 92 46.5, 100 48.8, 108 47 C 112 46, 116 44.5, 120 44"
              {...STROKE}
              strokeWidth={3}
            />
          </g>
        </svg>
      </span>
    </Tag>
  );
}
