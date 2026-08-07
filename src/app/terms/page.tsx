import type { Metadata } from "next";
import { LegalPage, OwnerTodo } from "@/components/legal/LegalPage";
import {
  FREE_SHIPPING_THRESHOLD_ZAR,
  SHIPPING_FLAT_ZAR,
} from "@/lib/checkout";
import { PRODUCTS, formatZar, fromPriceZar } from "@/lib/products";
import { BRAND_EMAIL, BRAND_NAME } from "@/lib/seo/site";

const title = "Terms of sale";
const description = `The terms you buy on from ${BRAND_NAME}: who we are, what a piece costs, when your order becomes an agreement, the approval step before anything is printed, and what happens if something goes wrong.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/terms",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

/**
 * Terms of sale, carrying the supplier disclosures an electronic transaction
 * has to make (Electronic Communications and Transactions Act, section 43).
 *
 * PRICES ARE READ FROM THE CATALOGUE, never typed in here. A terms page that
 * states a price the shop no longer charges is the one document a customer
 * will quote back at you, so it reads from products.ts and checkout.ts and
 * cannot drift from what the checkout actually takes.
 */
export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of sale"
      title="The terms you buy on."
      intro="Plain terms for a small shop that makes one thing at a time. What you are buying, what it costs, when it becomes an agreement between us, and what happens on the days it does not go to plan."
      updated="7 August 2026"
    >
      <h2>Who you are buying from</h2>
      <p>
        {BRAND_NAME} makes portrait apparel to order in Jeffreys Bay, South
        Africa, and sells it from this site. Email{" "}
        <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> and a person will
        answer. There is no shop counter to walk into: every piece is made after
        it is ordered.
      </p>

      <OwnerTodo>
        <p>
          The Electronic Communications and Transactions Act, section 43,
          requires this section to carry, in full:
        </p>
        <ul>
          <li>the registered company name and its legal status</li>
          <li>the registration number</li>
          <li>the names of the directors or members</li>
          <li>the physical address, and a physical address for service of legal documents</li>
          <li>a telephone number</li>
          <li>VAT registration status, and the number if registered</li>
          <li>membership of any self-regulatory body, if any</li>
        </ul>
        <p>
          None of that is known yet, and none of it may be guessed. This is the
          first thing a payment provider&apos;s reviewer looks for.
        </p>
      </OwnerTodo>

      <h2>What we sell, and what it costs</h2>
      <p>
        Every piece carries a portrait made from a photograph you send us, so no
        two orders are the same garment. Prices in South African rand:
      </p>
      <ul>
        {PRODUCTS.map((product) => (
          <li key={product.slug}>
            <strong>{product.name}</strong>, from{" "}
            {formatZar(fromPriceZar(product))}
          </li>
        ))}
      </ul>
      <p>
        Delivery anywhere in South Africa is {formatZar(SHIPPING_FLAT_ZAR)}, and
        it is free once an order passes{" "}
        {formatZar(FREE_SHIPPING_THRESHOLD_ZAR)}. The price you are shown at
        checkout is the whole of what you pay: there is nothing added
        afterwards. Prices can change, but never on an order already placed.
      </p>

      <OwnerTodo>
        <p>
          Do the prices above include VAT, or is the business below the
          registration threshold? The answer changes one sentence here and the
          wording on every invoice, and it cannot be left implied.
        </p>
      </OwnerTodo>

      <h2>How an order happens</h2>
      <ul>
        <li>You choose a garment, a colour and a size.</li>
        <li>You tell us about your companion and send a photograph.</li>
        <li>You pay. Your order is confirmed by email within a few minutes.</li>
        <li>We draw the portrait, and email it to you.</li>
        <li>
          <strong>Nothing is printed until you say yes.</strong> If it is not
          quite them, you tell us so and we rework it. If it is still not right,
          a person here takes it on personally.
        </li>
        <li>Once you approve it, we print it, check it and send it to you.</li>
      </ul>
      <p>
        We accept your order when we confirm your payment. Until then nothing is
        made and nothing is owed. If we cannot make what you ordered, for any
        reason at all, we say so and refund you in full.
      </p>

      <h2>Paying</h2>
      <p>
        Payment is taken by PayFast, a South African payment provider. Your card
        details are entered on their pages and are never seen or stored by us.
        Orders are priced and totalled on our own server from the catalogue
        above, so the amount you are charged is never something a browser can
        change.
      </p>

      <h2>What we print, and what we will not</h2>
      <p>
        By sending a photograph you confirm it is yours to send. We will not
        print anything unlawful, anything hateful, or anything that is somebody
        else&apos;s work to sell. If we turn an order down on those grounds we
        refund it in full and tell you why.
      </p>
      <p>
        The name you give is printed as you typed it. Check the spelling before
        you approve the artwork: after that it is what goes to the press.
      </p>

      <h2>Delivery, and changing your mind</h2>
      <p>
        Both have a page of their own:{" "}
        <a href="/shipping-and-returns">Shipping and returns</a> covers what
        delivery costs, how long it takes, what happens if a parcel arrives
        damaged or wrong, and where you stand on cancelling.
      </p>

      <h2>If something goes wrong</h2>
      <p>
        Tell us. Email <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> with
        your order reference and a photograph if there is something to see. If a
        piece arrives damaged, faulty, or not what you approved, we replace it
        and we pay the postage both ways.
      </p>

      <OwnerTodo>
        <p>
          Section 43 also asks for the dispute route when we cannot settle it
          between us: which alternative dispute resolution forum or ombud, and
          how to reach it. Name one here.
        </p>
      </OwnerTodo>

      <h2>The law that applies</h2>
      <p>
        These terms are governed by South African law, and nothing in them takes
        away a right the Consumer Protection Act or the Electronic
        Communications and Transactions Act gives you.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We amend this page from time to time, and the date at the top says when
        it last changed. The terms that apply to your order are the ones
        published on the day you placed it.
      </p>
    </LegalPage>
  );
}
