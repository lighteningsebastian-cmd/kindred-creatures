import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listAdminOrders,
  parseFilter,
  shortRef,
  type OrderFilter,
  type OrderListRow,
} from "@/lib/admin/orders";
import { getSubscriberCounts } from "@/lib/admin/subscribers";
import { formatZar } from "@/lib/products";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { cn } from "@/lib/cn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

/** Dense and unambiguous. The owner reads this on a phone in a queue. */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function FilterTabs({ active }: { active: OrderFilter }) {
  const tabs: { value: OrderFilter; label: string }[] = [
    { value: "attention", label: "Needs attention" },
    { value: "all", label: "All orders" },
  ];

  return (
    <div className="flex gap-2" role="group" aria-label="Filter orders">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.value === "attention" ? "/admin" : "/admin?filter=all"}
          aria-current={active === tab.value ? "page" : undefined}
          className={cn(
            "eyebrow rounded-sm border px-3 py-1.5 text-[11px] transition-colors",
            active === tab.value
              ? "border-accent bg-accent-tint text-accent"
              : "border-line-strong text-muted hover:bg-surface",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * One order. A row on a desk, a card on a phone: same markup, and the layout
 * flips at 768px rather than there being two components to keep in step.
 */
function OrderRow({ order }: { order: OrderListRow }) {
  return (
    <li>
      <Link
        href={`/admin/orders/${order.id}`}
        className={cn(
          "flex flex-col gap-3 border-b border-line p-4 transition-colors hover:bg-surface",
          "md:grid md:grid-cols-[7rem_6rem_minmax(0,1fr)_9rem_3rem_7rem] md:items-center md:gap-4",
          // A never-paid order carries a spine of colour, so it is findable in a
          // list at a glance and never reads as routine.
          order.concern === "never-paid" && "border-l-2 border-l-signal-error",
          order.concern === "print-failed" && "border-l-2 border-l-accent",
        )}
      >
        <div className="flex items-center justify-between gap-3 md:block">
          <span className="font-mono text-xs text-ink">{shortRef(order.id)}</span>
          {/*
            The badge is hidden by the WRAPPER, never by a class on the badge.
            cn() is a plain string joiner (no tailwind-merge), so a `hidden`
            passed to StatusBadge would land alongside the `inline-flex` the
            badge already carries, and Tailwind emits `.inline-flex` after
            `.hidden`: the later rule wins and the badge stays visible. That is
            silent at desktop width (the md: rules come later still) and shows
            up only as two badges on a phone. A wrapper with no display class of
            its own has nothing to lose the fight to.
          */}
          <span className="md:hidden">
            <StatusBadge status={order.status} concern={order.concern} />
          </span>
        </div>

        <span className="text-xs text-muted">{formatDate(order.createdAt)}</span>

        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{order.customerName}</p>
          <p className="truncate text-xs text-muted">{order.email}</p>
        </div>

        <span className="hidden md:inline">
          <StatusBadge status={order.status} concern={order.concern} />
        </span>

        <span className="text-xs text-muted md:text-right">
          {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
        </span>

        <div className="flex items-baseline justify-between gap-3 md:block md:text-right">
          <span className="text-sm font-medium text-ink">
            {formatZar(order.totalZar)}
          </span>
          {order.trackingNumber ? (
            <span className="block truncate font-mono text-[11px] text-muted">
              {order.trackingNumber}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function Empty({ filter }: { filter: OrderFilter }) {
  return (
    <div className="border-t border-line p-10 text-center">
      <p className="font-display text-lg text-ink">
        {filter === "attention" ? "Nothing needs you." : "No orders yet."}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {filter === "attention" ? (
          <>
            No flagged orders and nothing paid waiting on a print file.{" "}
            <Link href="/admin?filter=all" className="text-accent underline">
              See all orders
            </Link>
            .
          </>
        ) : (
          "Orders appear here the moment someone checks out."
        )}
      </p>
    </div>
  );
}

/**
 * The newsletter list at a glance: how many are on it, how many have left, and
 * the one action the admin has here (take the list away as a CSV). Read only by
 * design; Resend owns sending, so there is no campaign UI to build. The download
 * is a plain anchor, not a Link, because it navigates to an API route that
 * answers with a file rather than a page.
 */
function SubscriberPanel({
  active,
  unsubscribed,
}: {
  active: number;
  unsubscribed: number;
}) {
  return (
    <section
      aria-labelledby="subscribers-heading"
      className="mt-6 rounded-md border border-line bg-base p-4 md:p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px] text-accent">Newsletter</span>
          <h2 id="subscribers-heading" className="font-display text-lg text-ink">
            Subscribers
          </h2>
        </div>

        <div className="flex items-center gap-8">
          <div>
            <p className="font-display text-2xl text-ink">{active}</p>
            <p className="text-xs text-muted">Active</p>
          </div>
          <div>
            <p className="font-display text-2xl text-muted">{unsubscribed}</p>
            <p className="text-xs text-muted">Unsubscribed</p>
          </div>

          <a
            href="/api/admin/subscribers/export"
            download="subscribers.csv"
            className="eyebrow rounded-md border border-line-strong px-3 py-1.5 text-[11px] text-ink transition-colors hover:bg-surface-alt"
          >
            Export CSV
          </a>
        </div>
      </div>
    </section>
  );
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  await requireAdmin();

  const filter = parseFilter((await searchParams).filter);
  const [rows, subscriberCounts] = await Promise.all([
    listAdminOrders(filter),
    getSubscriberCounts(),
  ]);
  const urgent = rows.filter((row) => row.concern === "never-paid").length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Orders</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} {filter === "attention" ? "needing attention" : "in total"}
            {urgent > 0 ? ` · ${urgent} never paid` : ""}
          </p>
        </div>
        <FilterTabs active={filter} />
      </div>

      <SubscriberPanel
        active={subscriberCounts.active}
        unsubscribed={subscriberCounts.unsubscribed}
      />

      <div className="mt-6 rounded-md border border-line bg-base">
        {rows.length === 0 ? (
          <Empty filter={filter} />
        ) : (
          <>
            <div className="eyebrow hidden border-b border-line px-4 py-2 text-[10px] text-muted md:grid md:grid-cols-[7rem_6rem_minmax(0,1fr)_9rem_3rem_7rem] md:gap-4">
              <span>Ref</span>
              <span>Placed</span>
              <span>Customer</span>
              <span>Status</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Total</span>
            </div>
            <ul>
              {rows.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
