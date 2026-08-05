import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { ClearCartOnPaid } from "@/components/order/ClearCartOnPaid";
import { TrackPurchase } from "@/components/analytics/TrackPurchase";
import { getDb } from "@/lib/db/client";
import { orderItems, orders, type Order, type OrderStatus } from "@/lib/db/schema";
import { verifyOrderToken } from "@/lib/order-token";
import { getCustomer } from "@/lib/account/auth";
import { formatZar, getProduct, type ProductSlug } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order",
  // One person's order, reachable by anyone holding the link. Search engines
  // are exactly the sort of thing that follows a link it was never given.
  robots: { index: false, follow: false },
};

type OrderPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ welcome?: string | string[] }>;
};

/**
 * How each order status reads to the person who placed it.
 *
 * Every one of these is written for a real customer having a real moment, so
 * none of them shouts. "pending" in particular is the trap: the customer has
 * just paid, from their point of view it worked, and the honest thing to say is
 * that we have not heard yet, warmly, without either lying that it succeeded or
 * implying they have lost their money.
 */
type Presentation = {
  eyebrow: string;
  heading: string;
  body: string;
  /** Payment is settled, so the cart it came from is spent. */
  confirmed: boolean;
};

const PRESENTATION: Record<OrderStatus, Presentation> = {
  // "paid" means DRAWN OR DRAWING, not printing. Generation moved to after
  // payment (owner, 2 August), so at this status nothing has been sent
  // anywhere and an approval mail is on its way instead. Anything here that
  // promises the press is a lie told to somebody who has just paid R999, and
  // it is the one lie that costs the whole relationship.
  paid: {
    eyebrow: "Payment confirmed",
    heading: "Thank you. We are drawing your creature now.",
    body: "PayFast has confirmed your payment. Drawing them takes a few minutes, and then an email lands in your inbox with both sides of your piece for you to look at. Nothing is printed until you are happy with it. Once you say yes, it goes to our print shop in Jeffreys Bay and reaches you within 7 to 10 working days from that moment.",
    confirmed: true,
  },
  sent_to_printer: {
    eyebrow: "At the print shop",
    heading: "Your portrait is on the press.",
    body: "Your payment is settled and your portrait is with our print shop in Jeffreys Bay. Once it is printed and checked over, it goes straight to the courier, and your tracking number follows by email.",
    confirmed: true,
  },
  printed: {
    eyebrow: "Printed",
    heading: "Printed, checked, and waiting for the courier.",
    body: "Your garment is printed and has passed our once-over. It is packed and waiting for its collection, and you will have a tracking number by email as soon as it is on the road.",
    confirmed: true,
  },
  shipped: {
    eyebrow: "On the road",
    heading: "Your creature is on the way to you.",
    body: "Your order has left our print shop and is with the courier. Your tracking details are in your inbox, and the driver will call the number you gave us on delivery day.",
    confirmed: true,
  },
  pending: {
    eyebrow: "Waiting on PayFast",
    heading: "Your order is safe. We have not heard from PayFast yet.",
    body: "PayFast confirms payments to us in the background, and that message usually arrives within a minute or two of you paying. Refreshing this page in a moment is usually all it takes. Nothing is lost either way: your order is saved exactly as you placed it, and we email you the moment payment lands.",
    confirmed: false,
  },
  flagged: {
    eyebrow: "We are checking this one",
    heading: "Give us a moment with this order.",
    body: "Something in the payment notification did not line up with your order, so one of us is looking at it by hand rather than letting a computer guess. There is nothing you need to do. We will email you today either way, and you have not been charged twice.",
    confirmed: false,
  },
};

function productName(slug: string): string {
  return getProduct(slug as ProductSlug)?.name ?? slug;
}

type Line = {
  id: string;
  productSlug: string;
  color: string;
  size: string;
  qty: number;
  unitPriceZar: number;
};

/** The order summary, priced from the row rather than from anything in the URL. */
function OrderSummary({ order, lines }: { order: Order; lines: Line[] }) {
  return (
    <aside className="h-fit rounded-lg border border-line bg-surface p-6">
      <h2 className="eyebrow text-xs text-muted">Your order</h2>

      <dl className="mt-5 flex flex-col gap-3 border-b border-line pb-5 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-muted">Reference</dt>
          <dd className="break-all font-mono text-sm text-ink">
            {order.publicRef ?? order.id}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted">Confirmation sent to</dt>
          <dd className="break-all text-ink">{order.email}</dd>
        </div>
      </dl>

      <ul className="mt-5 flex flex-col gap-4 border-b border-line pb-5">
        {lines.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {productName(line.productSlug)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {line.color} · Size {line.size} · Qty {line.qty}
              </p>
            </div>
            <p className="shrink-0 text-sm font-medium text-ink">
              {formatZar(line.qty * line.unitPriceZar)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-5 flex flex-col gap-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Subtotal</dt>
          <dd className="font-medium text-ink">{formatZar(order.subtotalZar)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Shipping</dt>
          <dd className="font-medium text-ink">
            {order.shippingZar === 0 ? "Free" : formatZar(order.shippingZar)}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-4">
          <dt className="font-medium text-ink">Total</dt>
          <dd className="text-lg font-medium text-ink">
            {formatZar(order.totalZar)}
          </dd>
        </div>
      </dl>

      <p className="mt-5 text-xs leading-relaxed text-muted">
        Keep this page bookmarked · the link stays live and always shows where
        your order has got to.
      </p>
    </aside>
  );
}

/**
 * The order page, and the thing PayFast's return_url points at.
 *
 * It is NOT a receipt, and the difference is the whole design. Arriving here
 * means a browser followed a redirect, which anyone can do to any URL they
 * hold. So the token gets us as far as "which order is this", and then the
 * status on the screen is read out of the database, where only the verified ITN
 * webhook can have written it. A customer who pays and lands here before the
 * ITN does is told the truth: we have not heard yet.
 */
export default async function OrderPage({
  params,
  searchParams,
}: OrderPageProps) {
  const { token } = await params;
  const { welcome } = (searchParams ? await searchParams : {}) as {
    welcome?: string | string[];
  };

  // A welcome parameter is the one-time auto-login minted at checkout and
  // carried back on PayFast's return_url (D3). A cookie cannot be set while a
  // server component renders, so the token is spent by a route handler that
  // signs the buyer in (or silently does not) and lands right back here with
  // the parameter gone. Valid or not, the page that then renders is this same
  // page: the only difference a session makes is the account teaser below.
  if (typeof welcome === "string" && welcome !== "") {
    redirect(
      `/api/account/welcome?token=${encodeURIComponent(welcome)}&order=${encodeURIComponent(token)}`,
    );
  }

  const orderId = verifyOrderToken(token);
  // A forged, edited or expired-secret token is simply not an order. Same 404
  // as an order that does not exist, because telling the two apart out loud
  // turns this page into a way to ask which order ids are real.
  if (!orderId) notFound();

  const db = await getDb();

  let order: Order | undefined;
  try {
    [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  } catch {
    order = undefined;
  }
  if (!order) notFound();

  const lines = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  // The session, if the browser carries one: set moments ago by the welcome
  // handler, or on any earlier sign-in. Read-only. This page never grants a
  // login itself, and the order-status token in the URL is never enough to
  // create one: anyone can hold this link, and holding it proves nothing.
  const customer = await getCustomer();

  const view = PRESENTATION[order.status] ?? PRESENTATION.pending;

  return (
    <div className="bg-base py-14 md:py-20">
      {view.confirmed ? <ClearCartOnPaid /> : null}
      {/* purchase is reported only on a genuinely paid order, off the DB status,
          never on the browser having landed here. */}
      {order.status === "paid" ? (
        <TrackPurchase orderRef={order.id} totalZar={order.totalZar} />
      ) : null}

      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
          <div className="flex flex-col items-start gap-5">
            <p className="eyebrow text-xs text-accent">{view.eyebrow}</p>
            <h1 className="max-w-xl font-display text-3xl leading-[1.1] text-ink md:text-4xl">
              {view.heading}
            </h1>
            <p className="max-w-xl leading-relaxed text-muted">{view.body}</p>

            {order.trackingNumber ? (
              <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink">
                Tracking number{" "}
                <span className="font-mono text-xs">{order.trackingNumber}</span>
              </p>
            ) : null}

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Button block href="/products/hoodie" size="md" variant="secondary">
                Shop the range
              </Button>
            </div>

            {customer ? (
              <div className="mt-4 w-full max-w-xl rounded-lg border border-line bg-surface p-6">
                <p className="eyebrow text-xs text-accent">Your creatures</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  You are signed in as{" "}
                  <span className="text-ink">{customer.email}</span>. Every
                  portrait we draw for you is saved to your account, ready to
                  wear again on a different garment whenever the mood takes
                  you.
                </p>
                <div className="mt-4">
                  <Button href="/account" size="md" variant="secondary">
                    See your creatures
                  </Button>
                </div>
              </div>
            ) : null}

            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Questions about this order? Reply to your confirmation email with
              the reference alongside and you will reach a human.
            </p>
          </div>

          <OrderSummary order={order} lines={lines} />
        </div>
      </Container>
    </div>
  );
}
