import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { OrderLookupForm } from "@/components/order/OrderLookupForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find your order",
  // A page that takes a reference and an email is not one a crawler should be
  // indexing or following away from. The link to it is a plain, visible one in
  // the footer; search engines simply have no business here.
  robots: { index: false, follow: false },
};

/**
 * Self-service order lookup. Someone who has lost their order link (or never
 * kept the email) can find their order again with the reference and the address
 * they ordered with. Neither on its own is enough, by design.
 */
export default function OrderLookupPage() {
  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <div className="flex max-w-md flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-xs text-accent">Find your order</p>
            <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
              Lost track of your order?
            </h1>
            <p className="leading-relaxed text-muted">
              Pop in your reference and the email you ordered with, and we will
              take you straight to your order page. You will find the reference
              on your confirmation email, and again on the payment screen.
            </p>
          </div>

          <OrderLookupForm />

          <p className="text-sm leading-relaxed text-muted">
            Cannot find your reference? Reply to any email from us and a person
            will help you track it down.
          </p>
        </div>
      </Container>
    </div>
  );
}
