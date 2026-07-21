import type { Metadata } from "next";
import { PawPrint, Package } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { requireCustomer } from "@/lib/account/auth";
import {
  listCreaturesForCustomer,
  listOrdersForCustomer,
  type CustomerCreature,
  type CustomerOrderRow,
} from "@/lib/account/creatures";
import { formatZar } from "@/lib/products";
import { logout } from "./actions";

export const runtime = "nodejs";
// One person's creatures and orders, read from a session cookie. Never cached,
// never prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

/** A returning customer's home: the portraits they own, and their orders. */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** The first word of a claimed name, for a warm but not over-familiar greeting. */
function firstName(name: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

function CreatureCard({ creature }: { creature: CustomerCreature }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="relative aspect-square w-full overflow-hidden bg-surface-alt">
        {creature.previewUrl ? (
          // Plain img, not next/image: the source is a short-lived signed URL
          // that changes every hour, so there is nothing for the optimizer to
          // cache and proxying it would only leak it further. Same call the
          // admin order page makes.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creature.previewUrl}
            alt={`${creature.styleLabel} portrait`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-muted"
          >
            <PawPrint weight="regular" size={32} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="eyebrow text-[11px] text-accent">{creature.styleLabel}</p>
          <p className="text-sm text-muted">
            First made {formatDate(creature.firstOrderedAt)}
          </p>
        </div>
        {/* B4 provides /account/reorder/[artworkId]; until it lands this link
            404s. It carries only the artworkId, and B4 authorizes ownership
            server-side (customerOwnsArtwork) before adding anything to a cart. */}
        <Button
          href={`/account/reorder/${creature.artworkId}`}
          size="sm"
          className="mt-auto w-full"
        >
          Wear this again
        </Button>
      </div>
    </li>
  );
}

function CreaturesSection({ creatures }: { creatures: CustomerCreature[] }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="eyebrow text-xs text-accent">Your creatures</p>
        <h2 className="font-display text-2xl leading-[1.15] text-ink md:text-3xl">
          Every portrait you have had made.
        </h2>
      </div>

      {creatures.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10">
          <p className="text-base font-medium text-ink">
            Your first creature will appear here.
          </p>
          <p className="max-w-md leading-relaxed text-muted">
            Once you have ordered a portrait, it lives here for good, ready to
            put on anything else in the range without uploading a thing.
          </p>
          <Button href="/shop" size="sm" variant="secondary" className="mt-3">
            Start a creature
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {creatures.map((creature) => (
            <CreatureCard key={creature.artworkId} creature={creature} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OrdersSection({ orders }: { orders: CustomerOrderRow[] }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="eyebrow text-xs text-accent">Your orders</p>
        <h2 className="font-display text-2xl leading-[1.15] text-ink md:text-3xl">
          Where everything you have ordered stands.
        </h2>
      </div>

      {orders.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-8 text-muted">
          <Package weight="regular" size={22} />
          <p className="leading-relaxed">
            No orders yet. When you place one, its progress shows up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4"
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-ink">
                  Order {order.ref}
                </p>
                <p className="text-sm text-muted">
                  {formatDate(order.createdAt)} · {order.itemCount}{" "}
                  {order.itemCount === 1 ? "item" : "items"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="eyebrow text-[11px] text-accent">
                  {order.statusLabel}
                </p>
                <p className="text-sm font-medium text-ink">
                  {formatZar(order.totalZar)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AccountPage() {
  // The guard comes first: a request with no valid session is redirected to
  // login before any query runs, so nothing below ever reads a stranger's data.
  const customer = await requireCustomer();

  const [creatures, orders] = await Promise.all([
    listCreaturesForCustomer(customer.id),
    listOrdersForCustomer(customer.id),
  ]);

  const name = firstName(customer.name);

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <div className="flex flex-col gap-14">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-3">
              <p className="eyebrow text-xs text-accent">Your account</p>
              <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
                {name ? `Welcome back, ${name}.` : "Welcome back."}
              </h1>
              <p className="leading-relaxed text-muted">
                Signed in as {customer.email}.
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="eyebrow rounded-md border border-line-strong px-3 py-1.5 text-[11px] text-ink transition-colors hover:bg-surface-alt"
              >
                Sign out
              </button>
            </form>
          </header>

          <CreaturesSection creatures={creatures} />
          <OrdersSection orders={orders} />
        </div>
      </Container>
    </div>
  );
}
