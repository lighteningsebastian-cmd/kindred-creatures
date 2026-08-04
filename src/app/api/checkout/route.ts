import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isProfileComplete } from "@/lib/companion";
import { profileFromArtwork } from "@/lib/artwork-approval";
import { artworks, orderItems, orders } from "@/lib/db/schema";
import { getProduct } from "@/lib/products";
import {
  isValidQty,
  orderTotals,
  validateCustomerDetails,
  MAX_QTY,
  MIN_QTY,
} from "@/lib/checkout";
import {
  buildPaymentFields,
  payfastProcessUrl,
  redactFields,
  usingMockPayfast,
} from "@/lib/payfast";
import { signOrderToken } from "@/lib/order-token";
import { generateUniquePublicRef } from "@/lib/order-ref";
import { issueWelcomeToken } from "@/lib/account/login-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One order cannot hold more distinct portraits than this. */
const MAX_LINES = 20;

function bad(error: string, status: number) {
  return Response.json({ error }, { status });
}

/** A line as the client sends it: identity and choices only, never a price. */
type IncomingItem = {
  productSlug?: unknown;
  color?: unknown;
  size?: unknown;
  qty?: unknown;
  artworkId?: unknown;
};

/** A line once we have proven it against the catalogue and priced it ourselves. */
type PricedLine = {
  productSlug: string;
  color: string;
  size: string;
  qty: number;
  artworkId: string;
  unitPriceZar: number;
};

/**
 * Prices one line from the catalogue. The colour must be offered on the
 * product, and the size must be offered on that colour: a Natural tote has no
 * size L, and asking for one is a bad order, not a cheap one.
 */
function priceLine(
  item: IncomingItem,
): { ok: true; line: PricedLine } | { ok: false; error: string } {
  const { productSlug, color, size, qty, artworkId } = item;

  if (typeof productSlug !== "string" || !getProduct(productSlug)) {
    return { ok: false, error: "One of these garments is no longer available." };
  }
  const product = getProduct(productSlug)!;

  if (typeof artworkId !== "string" || artworkId.length === 0) {
    return { ok: false, error: "One of these lines is missing its portrait." };
  }

  const variant = product.variants.find((option) => option.color === color);
  if (!variant) {
    return {
      ok: false,
      error: `We do not make the ${product.name} in that colour.`,
    };
  }

  if (typeof size !== "string" || !variant.sizes.includes(size)) {
    return {
      ok: false,
      error: `The ${product.name} does not come in that size in ${variant.color}.`,
    };
  }

  if (!isValidQty(qty)) {
    return {
      ok: false,
      error: `Quantities run from ${MIN_QTY} to ${MAX_QTY} per portrait.`,
    };
  }

  return {
    ok: true,
    line: {
      productSlug,
      color: variant.color,
      size,
      qty,
      artworkId,
      // The price the catalogue says today, never the one the client sent.
      unitPriceZar: variant.priceZar,
    },
  };
}

/**
 * Opens a pending order from a cart and hands back the signed PayFast payload
 * that pays for it.
 *
 * Two things matter here. First, no price crosses the wire inwards: the cart is
 * persisted in the customer's own localStorage, so every rand is re-derived
 * from products.ts before anything is written. Second, an order can only be
 * placed for a portrait that actually exists and is ready to print.
 *
 * The order is written as "pending" and stays that way: this route only asks
 * for money, it never confirms it. The ITN webhook (S5) is what moves an order
 * to "paid", because a customer's browser reaching a success page proves
 * nothing about whether a payment cleared.
 *
 * The payment payload lives on this route rather than a separate
 * POST /api/payfast/redirect for one reason: a standalone endpoint would take
 * an orderId from the caller and hand back that order's name, email and total,
 * which is an unauthenticated order-lookup endpoint wearing a payment hat.
 * Guarding it would mean minting and checking ORDER_TOKEN_SECRET tokens. This
 * route already holds the order it just created and already knows the caller
 * is entitled to it, so the payload costs one extra query and no new surface.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Expected a JSON body.", 400);
  }

  const { items, shipping, email } = (body ?? {}) as {
    items?: unknown;
    shipping?: unknown;
    email?: unknown;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return bad("Your cart is empty.", 400);
  }
  if (items.length > MAX_LINES) {
    return bad(
      `An order can hold up to ${MAX_LINES} portraits. Please split this one up or get in touch.`,
      400,
    );
  }

  const details = validateCustomerDetails({
    ...((shipping ?? {}) as Record<string, unknown>),
    email,
  });
  if (!details.ok) {
    return Response.json(
      {
        error: "Please check the details below and try again.",
        fields: details.errors,
      },
      { status: 400 },
    );
  }

  const lines: PricedLine[] = [];
  for (const item of items as IncomingItem[]) {
    const priced = priceLine(item ?? {});
    if (!priced.ok) return bad(priced.error, 400);
    lines.push(priced.line);
  }

  // One artwork is one portrait, so it can only appear on one line. Two lines
  // sharing an id means a tampered or corrupted cart.
  const ids = lines.map((line) => line.artworkId);
  if (new Set(ids).size !== ids.length) {
    return bad("The same portrait appears twice in this cart.", 400);
  }

  const db = await getDb();

  let found;
  try {
    found = await db.select().from(artworks).where(inArray(artworks.id, ids));
  } catch {
    // A malformed uuid never matches a row; treat it as an unknown portrait
    // rather than surfacing a database error.
    return bad("We could not find one of these portraits.", 400);
  }

  const byId = new Map(found.map((artwork) => [artwork.id, artwork]));

  for (const line of lines) {
    const artwork = byId.get(line.artworkId);
    if (!artwork) {
      return bad(
        "We could not find one of these portraits. Please start that one again.",
        400,
      );
    }
    // WHAT THIS GUARD IS FOR NOW. It used to demand a drawn portrait, because
    // drawing happened before payment. It happens after (docs/spec-pipeline.md
    // section 1), so a line legitimately has no portrait at this point and
    // asking for one here would refuse every order in the shop.
    //
    // What must be true instead is that we can DRAW it the moment the money
    // lands: a photograph, and a profile complete enough to set a plate.
    // Anything missing here is an order that could be paid for and then stall,
    // which is the same failure as before by a different route.
    if (artwork.status === "rejected" || !artwork.uploadKey) {
      return bad(
        "We need a photo of them before you can order. Please upload one.",
        422,
      );
    }
    // There WAS a third guard here demanding artwork.style, and it refused every
    // order in the shop. Nothing has written that column since the style choice
    // was removed on 3 August (saveArtworkDetails does not set it), so the
    // question "which style did they choose" is one no customer can answer and
    // no order can pass. The same guard was already removed from fulfillment.ts
    // and artwork-drawing.ts for the same reason. The column stays: historic
    // artwork carries a real value and account/creatures.ts reads it to label a
    // reorder.
    // Re-checked server side because a browser is not a trust boundary, and
    // these are the words that get printed on a garment.
    if (!isProfileComplete(profileFromArtwork(artwork))) {
      return bad(
        "We still need a few details about them before you can order.",
        422,
      );
    }
  }

  const subtotal = lines.reduce(
    (sum, line) => sum + line.qty * line.unitPriceZar,
    0,
  );
  const { subtotalZar, shippingZar, totalZar } = orderTotals(subtotal);

  // Minted here rather than read back with .returning(): the id is ours to
  // choose, and it keeps the insert working across both drivers.
  const orderId = randomUUID();

  // The short customer-facing reference, unique before we ever write it. The
  // unique index on the column is the real backstop against a race; this loop
  // keeps the ordinary path from reaching it. A failure to find a free ref is a
  // sign the table is wedged, not a customer's fault, so it becomes the same
  // "could not open your order" as any other write failure below.
  let publicRef: string;
  try {
    publicRef = await generateUniquePublicRef(async (candidate) => {
      const [taken] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.publicRef, candidate));
      return taken !== undefined;
    });
  } catch {
    return bad("We could not open your order. Please try again.", 500);
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(orders)
        .values({
          id: orderId,
          status: "pending",
          publicRef,
          email: details.value.email,
          firstName: details.value.firstName,
          lastName: details.value.lastName,
          phone: details.value.phone,
          addressLine1: details.value.addressLine1,
          addressLine2: details.value.addressLine2 || null,
          suburb: details.value.suburb,
          city: details.value.city,
          province: details.value.province,
          postalCode: details.value.postalCode,
          subtotalZar,
          shippingZar,
          totalZar,
        });

      await tx.insert(orderItems).values(
        lines.map((line) => ({
          orderId,
          productSlug: line.productSlug,
          color: line.color,
          size: line.size,
          qty: line.qty,
          unitPriceZar: line.unitPriceZar,
          artworkId: line.artworkId,
        })),
      );
    });
  } catch {
    return bad("We could not open your order. Please try again.", 500);
  }

  // Read the order back rather than signing the totals still sitting in memory.
  // The row is the only thing the ITN webhook can later reconcile a payment
  // against, so the row is what we ask the customer to pay. An amount that
  // round-tripped through the browser, or one that drifted between this
  // process and what actually landed in the table, is not the amount owed.
  let row;
  try {
    [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  } catch {
    row = undefined;
  }
  if (!row) {
    // The order may well be sitting in the table; we just cannot prove what it
    // costs, and a payment request we cannot stand behind is worse than none.
    return bad("We could not open your order. Please try again.", 500);
  }

  // The one-time welcome login token (D3): if the buyer pays and comes back,
  // the return_url signs them straight into an account for this email. Minted
  // here because paying against an address is the proof the address is theirs;
  // the token only ever rides the return_url, which only PayFast sees and only
  // after payment. Best-effort on purpose: a checkout must never fail because
  // an auto-login could not be minted, so on any trouble the return_url is
  // simply the bare status page.
  let welcomeToken: string | undefined;
  try {
    welcomeToken = await issueWelcomeToken(row.email);
  } catch {
    welcomeToken = undefined;
  }

  // The return URL carries a signed token for this order (S5). It is minted
  // here, on the one request that has already proven the caller is entitled to
  // this order, rather than handed out by a lookup endpoint later. The token
  // unlocks a status page, never a payment: what comes back through the
  // customer's browser is a request to look, not evidence of anything.
  const fields = buildPaymentFields({
    orderId: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    totalZar: row.totalZar,
    returnToken: signOrderToken(row.id),
    welcomeToken,
  });

  // With no credentials (or MOCK_SERVICES on) the shop still runs end to end:
  // the payload is built and signed for real, but the browser is told to stay
  // here and show it rather than hand off to a gateway we cannot reach. The
  // merchant key is stripped on that path: a real form must carry it to
  // PayFast, but a payload meant to be read on screen must not.
  const mock = usingMockPayfast();

  return Response.json(
    {
      orderId,
      publicRef: row.publicRef,
      totalZar: row.totalZar,
      mock,
      processUrl: payfastProcessUrl(),
      fields: mock ? redactFields(fields) : fields,
    },
    { status: 201 },
  );
}
