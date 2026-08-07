import type { Metadata } from "next";
import { LegalPage, OwnerTodo } from "@/components/legal/LegalPage";
import { BRAND_EMAIL, BRAND_NAME } from "@/lib/seo/site";

const title = "Contact";
const description = `How to reach ${BRAND_NAME}: the email address a person actually reads, where we are, how to find an existing order, and what to include so we can help on the first reply.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/contact",
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
 * The page a worried customer and a payment provider's reviewer both look for,
 * for opposite reasons: one wants to reach a person, the other wants proof that
 * a person can be reached. One address, one email, one honest reply time.
 */
export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="Contact"
      title="A person reads every one of these."
      intro="We are a small operation, which is the good news: there is no queue and no ticket number, and the person who replies is the person who makes the thing."
      updated="7 August 2026"
    >
      <h2>Email</h2>
      <p>
        <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>
      </p>
      <p>
        This is the address to use for everything: a question before you order,
        a change to an order, a delivery that has gone quiet, a portrait that is
        not quite them, or a request about your own information. You can also
        just reply to any email we have sent you and it lands in the same place.
      </p>

      <h2>What to include, so the first reply is a useful one</h2>
      <ul>
        <li>
          <strong>Your order reference,</strong> if you have ordered. It is on
          your confirmation email and it looks like KC-2608-K4M9P.
        </li>
        <li>
          <strong>A photograph,</strong> if there is something to see. A parcel
          that arrived damaged, or the part of a portrait that is not right.
        </li>
        <li>
          <strong>The email address you ordered with,</strong> if it is not the
          one you are writing from.
        </li>
      </ul>

      <h2>Where we are</h2>
      <p>
        Every piece is made and printed in Jeffreys Bay, in the Eastern Cape,
        and posted from there.
      </p>

      <OwnerTodo>
        <p>
          The full physical address goes here, and it is not optional: the
          Electronic Communications and Transactions Act requires a physical
          address and a telephone number, and a payment provider will look for
          both. A postal address is not a substitute.
        </p>
        <p>
          If a home address is not one you want published, a registered business
          address or a postal box at Jeffreys Bay is the usual answer, but the
          address for service of legal documents has to be a real place.
        </p>
      </OwnerTodo>

      <h2>When you will hear back</h2>
      <p>
        There is no queue and no automated first reply. Your email goes to the
        person who makes the pieces, and if you have ordered, they will have
        your order in front of them when they answer.
      </p>

      <OwnerTodo>
        <p>
          How quickly do you undertake to reply? The paragraph above says how it
          works and stops short of a number, because a reply time is a promise
          and this one is not yours yet. One working day is what a small shop is
          normally judged against.
        </p>
        <p>
          Say only what you will keep on a bad week. A broken promise of a
          same-day reply does more damage than a modest one kept.
        </p>
      </OwnerTodo>

      <h2>Already ordered?</h2>
      <p>
        Two things are quicker than writing to us.{" "}
        <a href="/order-lookup">Find my order</a> shows where your order has got
        to, using your reference and the email address you used. Your{" "}
        <a href="/account">account</a> holds every creature you have had drawn,
        ready to be put on something else.
      </p>

      <h2>Press, stockists and everything else</h2>
      <p>
        Same address. Say what you are after in the first line and it will reach
        the right person, which is to say the only person.
      </p>
    </LegalPage>
  );
}
