import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import {
  getAdminOrder,
  hasPrintFiles,
  shortRef,
  type AdminOrderLine,
} from "@/lib/admin/orders";
import { formatZar } from "@/lib/products";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmailStatusChip } from "@/components/admin/EmailStatusChip";
import { OrderActions } from "@/components/admin/OrderActions";
import type { FulfillmentEvent, Order, OrderEmailKind } from "@/lib/db/schema";
import type { OrderEmailSummary } from "@/lib/email/monitoring";
import { cn } from "@/lib/cn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-md border border-line bg-surface p-5", className)}>
      <h2 className="eyebrow text-[11px] text-muted">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ShippingAddress({ order }: { order: Order }) {
  return (
    <address className="not-italic text-sm leading-relaxed text-ink">
      {order.firstName} {order.lastName}
      <br />
      {order.addressLine1}
      <br />
      {order.addressLine2 ? (
        <>
          {order.addressLine2}
          <br />
        </>
      ) : null}
      {order.suburb}
      <br />
      {order.city}, {order.province}
      <br />
      {order.postalCode}
      <div className="mt-3 flex flex-col gap-1 text-muted">
        <a href={`mailto:${order.email}`} className="break-all underline">
          {order.email}
        </a>
        <a href={`tel:${order.phone}`} className="underline">
          {order.phone}
        </a>
      </div>
    </address>
  );
}

/**
 * One line, with its artwork. The thumbnail is a signed URL that expires within
 * the hour, which is why this is a plain <img>: next/image would want to proxy
 * and cache a customer's photo behind a URL with no expiry on it.
 */
function Line({ line }: { line: AdminOrderLine }) {
  return (
    <li className="flex gap-4 border-b border-line py-4 last:border-b-0">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-line bg-base">
        {line.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={line.previewUrl}
            alt={`Portrait for ${line.productName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] text-muted">
            No art
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{line.productName}</p>
        <p className="mt-1 text-xs text-muted">
          {line.color} · Size {line.size} · Qty {line.qty} ·{" "}
          {formatZar(line.unitPriceZar)} each
        </p>
        <p className="mt-2 text-xs">
          {line.printUrl ? (
            <a
              href={line.printUrl}
              className="text-accent underline"
              target="_blank"
              rel="noreferrer"
            >
              Print file
            </a>
          ) : (
            <span className="text-muted">No print file yet</span>
          )}
          {line.artwork?.style ? (
            <span className="text-muted"> · {line.artwork.style}</span>
          ) : null}
        </p>
      </div>

      <p className="shrink-0 text-sm font-medium text-ink">
        {formatZar(line.qty * line.unitPriceZar)}
      </p>
    </li>
  );
}

/**
 * The timeline. This is the answer to "why is this one sitting here?", which is
 * the question a flagged order exists to provoke, so the failures are legible
 * rather than tidied away.
 */
function Timeline({ events }: { events: FulfillmentEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing recorded yet. Fulfilment writes here the moment it runs.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3 text-xs">
          <span
            className={cn(
              "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
              event.outcome === "ok" && "bg-signal-success",
              event.outcome === "failed" && "bg-signal-error",
              event.outcome === "skipped" && "bg-line-strong",
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-ink">
              <span className="font-medium">{event.step}</span>{" "}
              {/*
                A real space, not just the ml-2. The margin is what the eye
                reads, but copying the timeline into an email (which is how this
                gets escalated) would otherwise paste "generate-print-filefailed".
              */}
              <span
                className={cn(
                  "ml-2",
                  event.outcome === "failed" ? "text-signal-error" : "text-muted",
                )}
              >
                {event.outcome}
              </span>
            </p>
            {event.detail ? (
              <p className="mt-1 break-words text-muted">{event.detail}</p>
            ) : null}
            <p className="mt-1 text-muted">
              {new Intl.DateTimeFormat("en-ZA", {
                dateStyle: "medium",
                timeStyle: "short",
                hour12: false,
              }).format(event.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** What each order mail is called on screen. */
const EMAIL_KIND_LABEL: Record<OrderEmailKind, string> = {
  confirmation: "Order confirmation",
  "job-sheet": "Job sheet",
  shipping: "Shipping notification",
};

/**
 * What became of the order's mail, next to the buttons that send more of it.
 *
 * The bounce advice leads with the phone number because that IS the procedure:
 * the address just proved undeliverable, so re-sending to it is the one move
 * this screen must talk the owner out of. The per-send list below answers the
 * follow-up ("which mail, to whom, when") without opening Resend.
 */
function EmailDelivery({
  order,
  summary,
}: {
  order: Order;
  summary: OrderEmailSummary;
}) {
  return (
    <div className="flex flex-col gap-4">
      <EmailStatusChip status={summary.status} />

      {order.emailBouncedAt ? (
        <div className="rounded-md border border-signal-error p-4">
          <p className="eyebrow text-[11px] text-signal-error">
            Phone the customer
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            A mail about this order bounced, so the customer may not know where
            things stand. Give them a ring on{" "}
            <a href={`tel:${order.phone}`} className="underline">
              {order.phone}
            </a>{" "}
            and check the email address while you have them.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Do not re-send to the same address: it just proved undeliverable,
            and repeat sends hurt our standing with every mailbox we deliver to.
          </p>
        </div>
      ) : null}

      {summary.sends.length === 0 ? (
        <p className="text-sm text-muted">
          No order mail recorded yet. Sends are logged here the moment they go.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {summary.sends.map((send) => (
            <li key={send.id} className="text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-ink">
                  {EMAIL_KIND_LABEL[send.kind]}
                </span>
                <span
                  className={cn(
                    send.outcome === "bounced" && "text-signal-error",
                    send.outcome === "delivered" && "text-signal-success",
                    send.outcome === "sent" && "text-muted",
                  )}
                >
                  {send.outcome}
                </span>
              </div>
              <p className="mt-1 break-all text-muted">{send.recipient}</p>
              <p className="mt-1 text-muted">
                {new Intl.DateTimeFormat("en-ZA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  hour12: false,
                }).format(send.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  await requireAdmin();

  const { id } = await params;
  const detail = await getAdminOrder(id);
  if (!detail) notFound();

  const { order, lines, events, concern, emailSummary } = detail;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
      <Link href="/admin" className="text-xs text-muted underline">
        Back to orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">
          Order {order.publicRef ?? shortRef(order.id)}
        </h1>
        <StatusBadge status={order.status} concern={concern} />
      </div>

      <p className="mt-2 text-xs text-muted">
        Placed{" "}
        {new Intl.DateTimeFormat("en-ZA", {
          dateStyle: "full",
          timeStyle: "short",
          hour12: false,
        }).format(order.createdAt)}
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Panel title={`Lines (${lines.length})`}>
            <ul>
              {lines.map((line) => (
                <Line key={line.id} line={line} />
              ))}
            </ul>

            <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-ink">{formatZar(order.subtotalZar)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Shipping</dt>
                <dd className="text-ink">
                  {order.shippingZar === 0 ? "Free" : formatZar(order.shippingZar)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-medium text-ink">{formatZar(order.totalZar)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Fulfilment timeline">
            <Timeline events={events} />
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Actions">
            <OrderActions
              orderId={order.id}
              status={order.status}
              concern={concern}
              canResendJobSheet={hasPrintFiles(lines)}
            />
          </Panel>

          <Panel title="Email delivery">
            <EmailDelivery order={order} summary={emailSummary} />
          </Panel>

          <Panel title="Ship to">
            <ShippingAddress order={order} />
          </Panel>

          <Panel title="Payment">
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">PayFast reference</dt>
                <dd className="mt-1 break-all font-mono text-xs text-ink">
                  {order.payfastPaymentId ?? (
                    <span className="font-sans text-signal-error">
                      None. No payment was ever confirmed for this order.
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Tracking number</dt>
                <dd className="mt-1 break-all font-mono text-xs text-ink">
                  {order.trackingNumber ?? (
                    <span className="font-sans text-muted">Not shipped yet</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Order id</dt>
                <dd className="mt-1 break-all font-mono text-xs text-muted">
                  {order.id}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
