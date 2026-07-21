import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LoginForm } from "@/components/account/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * Passwordless sign-in. Enter an email, get a one-time link. The full account
 * (creatures + orders) lives at /account behind the session this mints.
 */
export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <div className="flex max-w-md flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-xs text-accent">Your account</p>
            <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
              Sign in to see your creatures.
            </h1>
            <p className="leading-relaxed text-muted">
              No password to remember. Enter your email and we will send a link
              that signs you in and brings up every portrait you have had made.
            </p>
          </div>
          <LoginForm expired={error === "expired"} />
        </div>
      </Container>
    </div>
  );
}
