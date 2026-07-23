import { cn } from "@/lib/cn";
import type { OrderEmailStatus } from "@/lib/email/monitoring";

/**
 * The one-word answer to "did our mail about this order arrive?", in the same
 * varsity-block language as StatusBadge and sized for the same tables.
 *
 * The worst outcome wins the chip (lib/email/monitoring.ts ranks it): one
 * bounce reads "Email bounced" however many other mails landed, because the
 * bounce is the one that needs a human and a phone. Renders nothing for null
 * (no recorded mail): absence of delivery data is not a state worth a badge,
 * and most pre-launch orders would otherwise wear a meaningless grey chip.
 *
 * Takes no className, for the same reason StatusBadge refuses one: cn() is a
 * plain joiner and a caller's display class would fight the ones below on
 * source order. Wrap it to position or hide it.
 */

const PRESENT: Record<OrderEmailStatus, { label: string; tone: string }> = {
  // The address ate our mail and someone must pick up a phone: loud.
  bounced: { label: "Email bounced", tone: "border-signal-error text-signal-error" },
  delivered: { label: "Email delivered", tone: "border-signal-success text-signal-success" },
  // Handed to the provider; no word back yet. Routine.
  sent: { label: "Email sent", tone: "border-line-strong text-muted" },
};

export function EmailStatusChip({ status }: { status: OrderEmailStatus | null }) {
  if (!status) return null;
  const { label, tone } = PRESENT[status];

  return (
    <span
      className={cn(
        "eyebrow inline-flex shrink-0 items-center rounded-sm border px-2 py-1 text-[10px]",
        tone,
      )}
    >
      {label}
    </span>
  );
}
