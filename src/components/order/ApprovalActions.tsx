"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { NOTE_MAX, REVISION_LABELS, REVISION_REASONS } from "@/lib/revision";
import { StandoutField } from "@/components/products/StandoutField";
import type { ApprovalState } from "@/app/approve/[token]/actions";

const chip =
  "rounded-md border px-4 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-base";

/**
 * Yes, or not quite.
 *
 * The two actions are deliberately unequal. Approving is the primary button;
 * asking for a change is a quiet link underneath. Not to discourage it, but
 * because most people are happy and the page should not open by suggesting
 * they should not be.
 *
 * The revision panel offers a different photograph FIRST. When a portrait does
 * not look like someone's dog, the photograph is usually the reason, and it is
 * the one fix that reliably works.
 */
export function ApprovalActions({
  token,
  approvedAt,
  standoutDetail = null,
  onApprove,
  onRevise,
}: {
  token: string;
  approvedAt: string | null;
  /** What they told us stands out about their animal, when they answered. */
  standoutDetail?: string | null;
  onApprove: (token: string) => Promise<ApprovalState>;
  onRevise: (
    token: string,
    reasons: string[],
    note: string,
    standoutDetail?: string | null,
  ) => Promise<ApprovalState>;
}) {
  const [state, setState] = useState<ApprovalState>(
    approvedAt ? { state: "approved" } : { state: "idle" },
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState<string | null>(standoutDetail);
  const [pending, startTransition] = useTransition();

  if (state.state === "approved") {
    return (
      <div className="flex flex-col gap-2" role="status">
        <p className="font-display text-2xl text-ink">
          Thank you. We are making it now.
        </p>
        <p className="text-muted">
          Your piece goes to the press today. We will email you when it is on
          its way.
        </p>
      </div>
    );
  }

  if (state.state === "queued") {
    return (
      <div className="flex flex-col gap-2" role="status">
        <p className="font-display text-2xl text-ink">
          Thank you, we are on it.
        </p>
        <p className="text-muted">
          We will draw them again and send you another look shortly.
        </p>
      </div>
    );
  }

  if (state.state === "handed-over") {
    return (
      <div className="flex flex-col gap-2" role="status">
        {/* The ladder ran out of automated rounds. The customer is not told
            that; they are told a person is looking, which is both true and
            better than a counter. */}
        <p className="font-display text-2xl text-ink">
          Let me look at this one myself.
        </p>
        <p className="text-muted">I will be in touch today.</p>
      </div>
    );
  }

  const toggle = (reason: string) =>
    setReasons((current) =>
      current.includes(reason)
        ? current.filter((r) => r !== reason)
        : [...current, reason],
    );

  return (
    <div className="flex flex-col gap-5">
      {state.state === "error" ? (
        <p role="alert" className="text-sm font-medium text-btn">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col items-start gap-3">
        <Button
          block
          disabled={pending}
          onClick={() =>
            startTransition(async () => setState(await onApprove(token)))
          }
        >
          Yes, print it
        </Button>

        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          className="text-sm text-muted underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          Something is not quite right
        </button>
      </div>

      {panelOpen ? (
        <div className="flex flex-col gap-6 border-t border-line pt-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-xl text-ink">
              Use a different photo
            </h3>
            <p className="text-sm text-muted">
              This is usually the quickest fix. Good light and a clear look at
              their face is all we need.
            </p>
            {/* ponytail: the dropzone is not wired here yet. Re-uploading has to
                replace the artwork's upload and trigger a fresh drawing, which
                is the same path step 7 builds when generation moves after
                payment. Wiring it twice would mean unwiring it once. */}
            <p className="text-sm text-muted">
              Reply to your email with a new photo and we will use that one.
            </p>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="font-display text-xl text-ink">
              What is not right?
            </legend>
            <div className="flex flex-wrap gap-2">
              {REVISION_REASONS.map((reason) => {
                const on = reasons.includes(reason);
                return (
                  <button
                    key={reason}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(reason)}
                    className={cn(
                      chip,
                      on
                        ? "border-ink bg-ink text-base"
                        : "border-line text-ink hover:bg-surface",
                    )}
                  >
                    {REVISION_LABELS[reason]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/*
            THE ONE FIELD ON THIS SCREEN THAT REACHES THE MODEL, and it is above
            the note rather than below it so the difference between the two is
            visible: this one changes the drawing, the note below reaches a
            person. Somebody whose detail was misread can reword it here, which
            is the entire reason for letting them say it in the first place —
            without this, their only recourse would be writing it in the note
            and hoping somebody acted on it.
          */}
          <div className="border-t border-line pt-5">
            <StandoutField
              id="revision-standout"
              value={detail}
              onChange={setDetail}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="revision-note"
              className="font-display text-xl text-ink"
            >
              Anything else you would like us to know?
            </label>
            <textarea
              id="revision-note"
              value={note}
              maxLength={NOTE_MAX}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-line bg-base px-3 py-2 text-base text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
              placeholder="Optional"
            />
            <p className="text-sm text-muted">
              A person reads every one of these.
            </p>
          </div>

          <Button
            variant="secondary"
            disabled={pending || reasons.length === 0}
            onClick={() =>
              startTransition(async () =>
                setState(await onRevise(token, reasons, note, detail)),
              )
            }
          >
            Send this back to us
          </Button>
        </div>
      ) : null}
    </div>
  );
}
