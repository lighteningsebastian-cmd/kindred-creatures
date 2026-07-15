"use client";

import { useRef, type RefObject } from "react";
import { useInView } from "motion/react";

type UseCreatureViewOptions = {
  /** Fraction of the element that must be visible to count as in view. */
  amount?: number;
};

export type CreatureView<T extends Element> = {
  ref: RefObject<T | null>;
  /** Live viewport state; flips false again when scrolled away. Loops key off this. */
  inView: boolean;
  /** Latches true on first entry and stays true. One-shot entrances key off this. */
  hasEntered: boolean;
};

/**
 * Shared viewport plumbing for the creature components: one ref, one live
 * in-view flag (so continuous loops pause off screen) and one latched flag
 * (so entrance choreography fires exactly once).
 */
export function useCreatureView<T extends Element = HTMLDivElement>({
  amount = 0.3,
}: UseCreatureViewOptions = {}): CreatureView<T> {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { amount });
  const hasEntered = useInView(ref, { once: true, amount });
  return { ref, inView, hasEntered };
}
