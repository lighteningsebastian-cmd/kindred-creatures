"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * "Are we past hydration yet." The server snapshot is false and the client
 * snapshot is true, which is exactly the question, and the answer never
 * changes afterwards — so subscribe is a no-op rather than a real
 * subscription.
 */
const subscribe = () => () => {};

export type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger offset in seconds when several reveals share a section. */
  delay?: number;
  /** Direction the content drifts up from; defaults to a small rise. */
  y?: number;
  as?: "div" | "li" | "section" | "article";
};

/**
 * One-shot entrance wrapper: fades and lifts its children into place the first
 * time they scroll into view. Transform/opacity only, fires once, and collapses
 * to a static render (no offset) when the viewer prefers reduced motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  as = "div",
}: RevealProps) {
  const prefersReduced = useReducedMotion() ?? false;

  /**
   * WHY THIS IS NOT SIMPLY `if (prefersReduced)`, which is what it used to be.
   *
   * useReducedMotion() answers null on the server and true in a browser with
   * Reduce Motion switched on. Branching on it during the FIRST render
   * therefore made the server send the animated markup — opacity:0, waiting to
   * be scrolled into view — while the client rendered the static one. React
   * does not patch up style mismatches during hydration; it says so in the
   * warning. So the server's `opacity: 0` stayed on the element while the
   * client sat on the branch that never animates anything, and every Reveal on
   * the page was invisible. Permanently, and only for the people who asked for
   * less motion: the whole home page below the hero, the whole shop, gone.
   *
   * The first client render has to match the server's. The static path is only
   * safe once hydration is behind us, so it waits for that.
   */
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const reducedMotion = prefersReduced && hydrated;

  const MotionTag = motion[as];

  if (reducedMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}
