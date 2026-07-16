"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

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
  const reducedMotion = useReducedMotion() ?? false;
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
