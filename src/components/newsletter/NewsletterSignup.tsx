"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmailSuggestion } from "@/components/ui/EmailSuggestion";
import { trackNewsletterSignup } from "@/lib/analytics";

/**
 * The footer newsletter signup: a label-above email field and a submit, with
 * inline states so the whole exchange stays in place (no route change, no
 * toast). It POSTs to the subscribe route with source "footer"; the route owns
 * validation, idempotency and the welcome mail, so this island only has to be
 * honest about what came back.
 *
 * States: idle, submitting (field + button disabled), success ("You are on the
 * list."), already-subscribed (a warmer "You are already on the list." so a
 * repeat submit never implies a fresh join), and a retryable inline error. The
 * status line is aria-live so it reaches a screen reader without stealing focus,
 * and it uses semantic status colours that hold AA on parchment. There is no
 * animation here, so nothing to gate on reduced motion.
 */

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "already" }
  | { kind: "error"; message: string };

// The same pragmatic shape the server uses, so an obviously-empty or malformed
// address is caught before a pointless round trip. The server re-checks it.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const statusId = useId();

  const submitting = status.kind === "submitting";
  const done = status.kind === "success" || status.kind === "already";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmed = email.trim();
    if (!EMAIL.test(trimmed)) {
      setStatus({
        kind: "error",
        message: "Please enter a valid email address.",
      });
      return;
    }

    setStatus({ kind: "submitting" });

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "footer" }),
      });

      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        alreadySubscribed?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !json?.ok) {
        setStatus({
          kind: "error",
          message:
            typeof json?.error === "string"
              ? json.error
              : "We could not sign you up. Please try again.",
        });
        return;
      }

      if (json.alreadySubscribed) {
        setStatus({ kind: "already" });
        return;
      }

      // Only a genuine new join fires the event, and it carries the surface
      // only, never the address.
      trackNewsletterSignup({ source: "footer" });
      setStatus({ kind: "success" });
    } catch {
      setStatus({
        kind: "error",
        message:
          "We could not reach us just now. Please check your connection and try again.",
      });
    }
  }

  if (done) {
    return (
      <div className="max-w-xs">
        <p className="eyebrow text-xs text-accent">The newsletter</p>
        <p
          id={statusId}
          role="status"
          className="mt-3 text-sm font-medium text-signal-success"
        >
          {status.kind === "success"
            ? "You are on the list. Look out for the welcome note."
            : "You are already on the list. Nothing more to do."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xs">
      <p className="eyebrow text-xs text-accent">The newsletter</p>
      <p className="mt-3 text-sm text-muted">
        New styles, and the odd story worth your inbox. No more than that.
      </p>
      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-3">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.co.za"
          value={email}
          disabled={submitting}
          error={status.kind === "error" ? status.message : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status.kind === "error") setStatus({ kind: "idle" });
          }}
        />
        <EmailSuggestion email={email} onAccept={setEmail} />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={submitting}
          aria-busy={submitting}
          className="w-full sm:w-auto"
        >
          {submitting ? "Signing you up" : "Sign up"}
        </Button>
      </form>
    </div>
  );
}
