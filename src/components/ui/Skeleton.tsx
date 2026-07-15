import { cn } from "@/lib/cn";

export type SkeletonProps = {
  className?: string;
};

/**
 * Placeholder block for loading states. The shimmer is a gentle opacity pulse
 * (see .kc-skeleton in globals.css) that only animates when the user has not
 * requested reduced motion. Default radius matches the 16px card rule.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "kc-skeleton rounded-[16px] bg-surface",
        className,
      )}
    />
  );
}
