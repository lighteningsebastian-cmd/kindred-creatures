"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { useCreatureView } from "./shared";
import { Pivot } from "./Pivot";

export type DeliveryDogProps = {
  className?: string;
};

const STROKE = {
  stroke: "var(--color-ink)",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

/**
 * Side-view trotting mutt carrying a paper parcel in its mouth. Trots in from
 * off-screen left on first viewport entry, then holds a gentle trot-in-place
 * loop (legs, ears, tail, parcel bob) while visible. Static standing pose
 * under reduced motion.
 */
export function DeliveryDog({ className }: DeliveryDogProps) {
  const { ref, inView, hasEntered } = useCreatureView<HTMLDivElement>({
    amount: 0.3,
  });
  const reducedMotion = useReducedMotion() ?? false;
  const trotting = inView && !reducedMotion;
  const arrived = hasEntered || reducedMotion;

  /** Looping rotate keyframes while trotting; settle to rest otherwise. */
  const gait = (frames: number[]) => ({
    initial: false as const,
    animate: { rotate: trotting ? frames : 0 },
    transition: trotting
      ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" as const }
      : { duration: 0.3 },
  });

  const frontLegPath =
    "M 91 60 C 90 74, 89.5 86, 90.5 96 C 91 100, 93 101.6, 97 101.6";
  const rearLegPath =
    "M 54 58 C 49.5 68, 47 74, 47.5 80 C 48 88, 48 94, 48.5 97 C 49 100, 51 101.6, 55 101.6";

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      aria-hidden="true"
    >
      <motion.svg
        viewBox="0 0 170 115"
        className="h-auto w-full"
        style={{ overflow: "visible", display: "block" }}
        initial={false}
        animate={{ x: arrived ? "0%" : "-130%" }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 1.8, ease: [0.16, 1, 0.3, 1] }
        }
      >
        <ellipse
          cx={82}
          cy={105}
          rx={48}
          ry={3}
          fill="var(--color-line)"
          opacity={0.9}
        />
        {/* Whole dog bobs with each footfall; shadow stays grounded */}
        <motion.g
          initial={false}
          animate={{ y: trotting ? [0, -2, 0, -2, 0] : 0 }}
          transition={
            trotting
              ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.3 }
          }
        >
          {/* Far legs (offside): lighter, opposite phase to the near pair */}
        <g opacity={0.45}>
          <g transform="translate(-6 0)">
            <Pivot px={92} py={58} {...gait([-14, 14, -14])}>
              <path d={frontLegPath} {...STROKE} />
            </Pivot>
          </g>
          <g transform="translate(6 0)">
            <Pivot px={52} py={56} {...gait([12, -12, 12])}>
              <path d={rearLegPath} {...STROKE} />
            </Pivot>
          </g>
        </g>
        {/* Near legs: front + diagonal rear share phase (trot) */}
        <Pivot px={92} py={58} {...gait([14, -14, 14])}>
          <path d={frontLegPath} {...STROKE} />
        </Pivot>
        <Pivot px={52} py={56} {...gait([-12, 12, -12])}>
          <path d={rearLegPath} {...STROKE} />
        </Pivot>
        <g>
          {/* Body silhouette: back, rump, belly, chest */}
          <path
            d="M 98 40 C 84 33.5, 66 33.5, 52 38 C 47.5 39.5, 44.5 42, 44 46 C 43.2 52, 42.5 60, 42.5 66"
            {...STROKE}
          />
          <path d="M 56 68 C 64 63.5, 74 63.5, 84 66" {...STROKE} />
          <path d="M 104 52 C 103.5 57, 101 62.5, 95 67" {...STROKE} />
          {/* Head: neck, skull, snout, jaw, throat */}
          <path
            d="M 98 40 C 104 32, 108 25.5, 114 22 C 119 19.2, 124.5 21.5, 127.5 26 C 131 29.5, 135 31.5, 137 34 C 138.6 36, 138 37.6, 136.5 38.4 C 131 41.4, 125 42.2, 121 43.5 C 116 45.2, 109.5 50, 104 52"
            {...STROKE}
          />
          <circle cx={122.5} cy={29} r={1.7} fill="var(--color-ink)" />
          <circle cx={136.3} cy={35.2} r={2} fill="var(--color-ink)" />
          {/* Terracotta collar across the neck */}
          <path
            d="M 98.5 41.5 C 102.5 45.5, 107 48.8, 112 50 L 110.8 54.2 C 105 52.8, 99.5 49, 95.6 44.8 Z"
            fill="var(--color-accent)"
          />
          {/* Floppy ear with terracotta inner */}
          <Pivot px={116.5} py={21} {...gait([0, 7, 0, 7, 0])}>
            <path
              d="M 112.5 26 C 110 28.5, 108.8 33, 109 36.5 C 109.2 39.3, 111 39.8, 112.5 37.5 C 114 34.5, 114.2 29, 113.5 26 Z"
              fill="var(--color-accent)"
            />
            <path
              d="M 117 20.5 C 111 21.5, 106.5 27, 106 34 C 105.7 39, 108.5 42.5, 111.5 40.5 C 115 38, 116.5 30, 116.5 22.5"
              {...STROKE}
            />
          </Pivot>
        </g>
        {/* Tail curls up and wags with the gait */}
        <Pivot px={46} py={45} {...gait([4, -7, 4, -7, 4])}>
          <path
            d="M 46 45 C 40.5 41.5, 37.5 34.5, 38.5 27.5 C 38.9 24.9, 40.2 23, 42.2 22"
            {...STROKE}
          />
        </Pivot>
        {/* Paper parcel held by its string, swinging gently with the gait */}
        <Pivot px={128} py={41} {...gait([2.5, -2.5, 2.5])}>
          <path
            d="M 128 41 L 131.5 49"
            stroke="var(--color-accent)"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <rect
            x={116.5}
            y={49}
            width={30}
            height={21}
            rx={2}
            {...STROKE}
            fill="var(--color-base)"
          />
          <path
            d="M 131.5 49 L 131.5 70 M 116.5 59.5 L 146.5 59.5"
            stroke="var(--color-accent)"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={131.5} cy={49} r={1.8} fill="var(--color-accent)" />
        </Pivot>
        </motion.g>
      </motion.svg>
    </div>
  );
}
