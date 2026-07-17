import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Payment cancelled",
  robots: { index: false, follow: false },
};

/**
 * Where PayFast sends someone who backed out (cancel_url).
 *
 * Nothing happens here on purpose. The cart is untouched, because it was never
 * touched at handoff (see CheckoutForm) and this is precisely the person that
 * decision was made for. The pending order stays pending and simply never gets
 * an ITN, which is what pending is for. No apology, no guilt, no "are you
 * sure": they changed their mind at a payment screen, which is allowed.
 */
export default function CheckoutCancelledPage() {
  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <div className="flex max-w-xl flex-col items-start gap-5">
          <p className="eyebrow text-xs text-muted">Payment cancelled</p>
          <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
            No payment was taken. Your cart is exactly where you left it.
          </h1>
          <p className="leading-relaxed text-muted">
            You stepped back from PayFast, so nothing was charged. Your
            portraits are still in your cart, still sized and still in the
            colours you chose, ready whenever you are.
          </p>

          <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button block href="/cart" size="md">
              Back to your cart
            </Button>
            <Button block href="/products/hoodie" size="md" variant="secondary">
              Keep looking
            </Button>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-muted">
            If something went wrong at the payment step rather than you changing
            your mind, tell us what you saw and we will sort it out.
          </p>
        </div>
      </Container>
    </div>
  );
}
