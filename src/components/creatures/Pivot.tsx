"use client";

import type { ComponentProps, ReactNode } from "react";
import { motion } from "motion/react";

type PivotProps = Omit<ComponentProps<typeof motion.g>, "children"> & {
  /** Pivot point in viewBox units; rotations/scales apply around it. */
  px: number;
  py: number;
  children?: ReactNode;
};

/**
 * Rotates/scales an SVG subtree around an explicit viewBox point without
 * relying on CSS transform-origin support for SVG (patchy across engines and
 * absent in jsdom): translate to the pivot, apply the motion transform, then
 * translate back.
 */
export function Pivot({ px, py, children, ...motionProps }: PivotProps) {
  return (
    <g transform={`translate(${px} ${py})`}>
      <motion.g {...motionProps}>
        <g transform={`translate(${-px} ${-py})`}>{children}</g>
      </motion.g>
    </g>
  );
}
