import { cn } from "@/lib/cn";
import { STATUS_LABEL, type Concern } from "@/lib/admin/orders";
import type { OrderStatus } from "@/lib/db/schema";

/**
 * The status badge, in the brand's varsity-block language but sized for a dense
 * table rather than a hero.
 *
 * A flagged order does NOT get one badge. It gets "Never paid" or "Print failed"
 * depending on its concern, because "Flagged" alone is the word that hides the
 * only distinction on this screen that costs money. See lib/admin/orders.ts.
 *
 * IT TAKES NO className, deliberately. cn() is a plain string joiner with no
 * tailwind-merge, so a class passed in here would not override the ones below,
 * it would sit next to them and let CSS source order decide. For a display
 * utility that resolves the wrong way round: Tailwind emits `.inline-flex` after
 * `.hidden`, so `hidden` loses and a badge told to disappear does not. Callers
 * that need this positioned or hidden should wrap it in an element of their own.
 */

const TONES = {
  // Money is owed to us and nothing was received: the loudest thing on the page.
  danger: "border-signal-error text-signal-error",
  // We owe the customer a garment. Worth doing, not alarming.
  action: "border-accent text-accent",
  // Ticking along; only interesting if it stays this way.
  hold: "border-signal-hold text-signal-hold",
  done: "border-signal-success text-signal-success",
  quiet: "border-line-strong text-muted",
} as const;

type Tone = keyof typeof TONES;

function present(
  status: OrderStatus,
  concern: Concern | null,
): { label: string; tone: Tone } {
  if (concern === "never-paid") return { label: "Never paid", tone: "danger" };
  if (concern === "print-failed") return { label: "Print failed", tone: "action" };
  if (concern === "awaiting-print") return { label: "Paid, not printed", tone: "hold" };
  if (status === "shipped") return { label: STATUS_LABEL.shipped, tone: "done" };
  return { label: STATUS_LABEL[status], tone: "quiet" };
}

export function StatusBadge({
  status,
  concern,
}: {
  status: OrderStatus;
  concern: Concern | null;
}) {
  const { label, tone } = present(status, concern);

  return (
    <span
      className={cn(
        "eyebrow inline-flex shrink-0 items-center rounded-sm border px-2 py-1 text-[10px]",
        TONES[tone],
      )}
    >
      {label}
    </span>
  );
}
