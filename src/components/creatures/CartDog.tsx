"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { Pivot } from "./Pivot";

export type CartDogState = "idle" | "peeking" | "popped";

export type CartDogProps = {
  /** Cart item count; when it increases the dog pops up to celebrate. */
  count?: number;
  /** True while the parent control is hovered or focused: the dog peeks. */
  engaged?: boolean;
  className?: string;
};

const STROKE = {
  stroke: "var(--color-ink)",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

/** How long the celebratory pop holds before the dog ducks back down. */
const POP_MS = 1200;

/**
 * Head vertical offset per state (viewBox units). idle parks the (enlarged)
 * head fully below the rim so the clip hides it; peeking and popped lift it
 * further out than before so more of the face clears the basket and it reads
 * as a dog.
 */
const HEAD_Y: Record<CartDogState, number> = {
  idle: 19.5,
  peeking: 3,
  popped: -3,
};

/**
 * The head artwork is drawn small (historical viewBox coords); scale it up
 * about its own centre so the dog reads clearly without redrawing every path.
 */
const HEAD_SCALE = "translate(20 14) scale(1.32) translate(-20 -14)";

const HEAD_SPRING: Record<CartDogState, object> = {
  idle: { type: "spring", stiffness: 220, damping: 26 },
  peeking: { type: "spring", stiffness: 280, damping: 22 },
  popped: { type: "spring", stiffness: 500, damping: 20 },
};

/**
 * A shopping basket with a dog hiding inside. Hover/focus coaxes the head up
 * for a peek and a blink; an increase in `count` triggers a brief ears-perked
 * pop. Head movement is disabled under reduced motion; the badge still works.
 */
export function CartDog({ count = 0, engaged = false, className }: CartDogProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const clipId = useId();
  const [popped, setPopped] = useState(false);
  const prevCount = useRef(count);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (count > prevCount.current) {
      setPopped(true);
      if (popTimer.current) clearTimeout(popTimer.current);
      popTimer.current = setTimeout(() => setPopped(false), POP_MS);
    }
    prevCount.current = count;
  }, [count]);

  useEffect(
    () => () => {
      if (popTimer.current) clearTimeout(popTimer.current);
    },
    [],
  );

  const state: CartDogState = popped ? "popped" : engaged ? "peeking" : "idle";

  return (
    <span
      data-state={state}
      className={cn("relative inline-flex", className)}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        className="h-6 w-6"
        style={{ overflow: "visible", display: "block" }}
      >
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          {/* Everything above the basket rim; the dog vanishes behind it. */}
          <rect x={-14} y={-30} width={68} height={50.5} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <motion.g
            initial={false}
            animate={{ y: reducedMotion ? HEAD_Y.idle : HEAD_Y[state] }}
            transition={
              reducedMotion ? { duration: 0 } : HEAD_SPRING[state]
            }
          >
           <g transform={HEAD_SCALE}>
            {/* Ears perk when popped */}
            <Pivot
              px={14}
              py={7.8}
              initial={false}
              animate={{ rotate: state === "popped" ? -24 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <path
                d="M 12.8 9.8 C 11.4 10.8, 10.8 12.8, 11 14.4 C 11.2 15.8, 12.4 15.9, 13.1 14.4 C 13.7 13, 13.7 10.9, 13.4 9.8 Z"
                fill="var(--color-accent)"
              />
              <path
                d="M 14.2 7.2 C 10.8 8.2, 9.2 11.5, 9.6 15 C 9.9 17.4, 12 17.8, 13.4 15.6 C 14.5 13.5, 14.8 9.8, 14.5 7.5"
                {...STROKE}
              />
            </Pivot>
            <Pivot
              px={26}
              py={7.8}
              initial={false}
              animate={{ rotate: state === "popped" ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <path
                d="M 27.2 9.8 C 28.6 10.8, 29.2 12.8, 29 14.4 C 28.8 15.8, 27.6 15.9, 26.9 14.4 C 26.3 13, 26.3 10.9, 26.6 9.8 Z"
                fill="var(--color-accent)"
              />
              <path
                d="M 25.8 7.2 C 29.2 8.2, 30.8 11.5, 30.4 15 C 30.1 17.4, 28 17.8, 26.6 15.6 C 25.5 13.5, 25.2 9.8, 25.5 7.5"
                {...STROKE}
              />
            </Pivot>
            {/* Skull dome; sides run down behind the rim */}
            <path
              d="M 12.5 24 C 12 9.5, 15 5.5, 20 5.5 C 25 5.5, 28 9.5, 27.5 24"
              {...STROKE}
            />
            {/* Eyes blink once mid-peek */}
            <Pivot
              px={20}
              py={13.2}
              initial={false}
              animate={
                state === "peeking" && !reducedMotion
                  ? { scaleY: [1, 1, 0.1, 1] }
                  : { scaleY: 1 }
              }
              transition={
                state === "peeking" && !reducedMotion
                  ? { duration: 0.7, times: [0, 0.55, 0.75, 1] }
                  : { duration: 0.15 }
              }
            >
              <circle cx={16.3} cy={13.2} r={1.6} fill="var(--color-ink)" />
              <circle cx={23.7} cy={13.2} r={1.6} fill="var(--color-ink)" />
            </Pivot>
            <path
              d="M 18.4 16.2 C 18.9 15.5, 21.1 15.5, 21.6 16.2 C 21.4 17.6, 20.7 18.3, 20 18.3 C 19.3 18.3, 18.6 17.6, 18.4 16.2 Z"
              fill="var(--color-ink)"
            />
           </g>
          </motion.g>
        </g>
        <g>
          {/* Basket: tapered body, weave marks, rim bar drawn last */}
          <path
            d="M 8.5 20 L 11.2 30.8 C 11.5 32.1, 12.4 32.9, 13.7 32.9 L 26.3 32.9 C 27.6 32.9, 28.5 32.1, 28.8 30.8 L 31.5 20"
            {...STROKE}
          />
          <path
            d="M 15 24 L 15.8 29 M 20 24 L 20 29 M 25 24 L 24.2 29"
            {...STROKE}
            strokeWidth={2}
            opacity={0.55}
          />
          <path d="M 6.8 20 L 33.2 20" {...STROKE} />
        </g>
      </svg>
      {count > 0 ? (
        <span className="absolute -right-1.5 top-[11px] inline-flex min-w-[16px] items-center justify-center rounded-full bg-btn px-1 text-[10px] font-semibold leading-[15px] text-base">
          {count}
        </span>
      ) : null}
    </span>
  );
}
