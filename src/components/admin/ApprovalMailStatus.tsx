import { cn } from "@/lib/cn";
import type { ApprovalMailState } from "@/lib/admin/orders";

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(date);
}

/**
 * Has this customer ever been told their portrait is ready?
 *
 * The one-line answer, read from the fulfilment trail, for the two screens an
 * owner opens when an order has gone quiet. "Never" is loud, because it is the
 * state in which a paid order sits forever with nobody knowing.
 *
 * SENT IS NOT ARRIVED, and the line says so. The first test order was sent,
 * accepted by the provider, and filed in spam. Whether a mail landed is the
 * Email delivery panel's question, and only once Resend's webhook reports it.
 */
export function ApprovalMailStatus({
  state,
  className,
}: {
  state: ApprovalMailState;
  className?: string;
}) {
  const { sentCount, lastSentAt, lastFailure } = state;

  if (sentCount === 0) {
    return (
      <div className={cn("text-sm leading-relaxed", className)}>
        <p className="font-medium text-signal-error">
          Approval email never sent. The customer has not been told their
          portrait is ready.
        </p>
        {lastFailure ? (
          <p className="mt-1 break-words text-muted">
            Last attempt failed {formatWhen(lastFailure.at)}
            {lastFailure.detail ? `: ${lastFailure.detail}` : "."}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <p className="text-ink">
        Approval email sent {sentCount === 1 ? "once" : `${sentCount} times`}
        {lastSentAt ? `, last ${formatWhen(lastSentAt)}` : ""}.
      </p>
      {lastFailure ? (
        <p className="mt-1 break-words text-signal-error">
          The latest attempt failed {formatWhen(lastFailure.at)}
          {lastFailure.detail ? `: ${lastFailure.detail}` : "."}
        </p>
      ) : null}
      <p className="mt-1 text-muted">
        Sent means our mail provider accepted it, not that it arrived. If they
        have not seen it, ask them to check spam.
      </p>
    </div>
  );
}
