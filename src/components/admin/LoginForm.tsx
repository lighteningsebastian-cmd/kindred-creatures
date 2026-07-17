"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login, type LoginState } from "@/app/admin/login/actions";

const INITIAL: LoginState = { error: null };

/**
 * The login form. The error it renders is whatever the action said, and the
 * action only ever says one thing, so there is no branching here that could
 * reintroduce the enumeration the action is careful to avoid.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
        autoFocus
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-signal-error px-3 py-2 text-sm text-signal-error"
        >
          {state.error}
        </p>
      ) : null}

      <Button block type="submit" disabled={pending} className="w-full">
        {pending ? "Checking" : "Sign in"}
      </Button>
    </form>
  );
}
