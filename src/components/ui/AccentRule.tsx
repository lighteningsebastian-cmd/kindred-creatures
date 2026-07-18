import { cn } from "@/lib/cn";

/**
 * The kit's brand flourish: two short stacked rules, oxblood over camel,
 * centered. Reserved for centered "moments" (testimonials, the footer, story
 * pages). It deliberately does NOT sit above the left-aligned functional
 * sections, which carry eyebrow labels instead, so the two never compete.
 */
export function AccentRule({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex w-full flex-col items-center gap-[3px]", className)}
    >
      <span className="block h-[3px] w-16 bg-accent" />
      <span className="block h-[3px] w-16 bg-accent-secondary" />
    </div>
  );
}
