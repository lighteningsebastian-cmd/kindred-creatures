"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmailSuggestion } from "@/components/ui/EmailSuggestion";
import { trackAccountLoginRequested } from "@/lib/analytics";

type State = "idle" | "submitting" | "sent" | "error";

/**
 * The passwordless sign-in form. It never reports whether an address has an
 * account: a valid submit always lands on the same "check your email" state, so
 * the UI cannot be used to probe who is a customer. The only inline error is a
 * malformed email, which is the browser's to catch.
 */
export function LoginForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    try {
      const res = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      trackAccountLoginRequested();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="flex flex-col gap-3" role="status">
        <h2 className="font-display text-2xl leading-[1.15] text-ink">
          Check your inbox.
        </h2>
        <p className="leading-relaxed text-muted">
          If that address can sign in, a link is on its way. It works once and
          expires in fifteen minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {expired ? (
        <p className="text-sm leading-relaxed text-btn" role="alert">
          That sign-in link has expired or already been used. Ask for a fresh one
          and we will send it over.
        </p>
      ) : null}
      <Input
        id="account-email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={
          state === "error"
            ? "Something went wrong. Please try again in a moment."
            : undefined
        }
      />
      <EmailSuggestion email={email} onAccept={setEmail} />
      <Button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Sending the link" : "Email me a link"}
      </Button>
    </form>
  );
}
