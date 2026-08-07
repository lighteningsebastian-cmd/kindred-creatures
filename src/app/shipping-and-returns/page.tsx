import type { Metadata } from "next";
import { LegalPage, OwnerTodo } from "@/components/legal/LegalPage";
import {
  FREE_SHIPPING_THRESHOLD_ZAR,
  SHIPPING_FLAT_ZAR,
} from "@/lib/checkout";
import { formatZar } from "@/lib/products";
import { BRAND_EMAIL, BRAND_NAME } from "@/lib/seo/site";

const title = "Shipping & returns";
const description = `How ${BRAND_NAME} gets your piece to you: what delivery costs, how long it takes from the day you approve your portrait, and what happens if a parcel arrives damaged, wrong, or not what you approved.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/shipping-and-returns" },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/shipping-and-returns",
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
 * Delivery and the returns position.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT DO is state a legal position on the
 * cooling-off right. These are personalised goods that cannot be resold, and
 * the customer has approved the artwork before it printed, which is exactly the
 * territory where the Consumer Protection Act, the Electronic Communications
 * and Transactions Act and their exemptions have to be read together by
 * somebody qualified to read them. So the page says what we will do, which we
 * know, and asks the question it cannot answer. Copying a position off another
 * store's page would be inventing law.
 */
export default function ShippingAndReturnsPage() {
  return (
    <LegalPage
      eyebrow="Shipping & returns"
      title="Getting it to you, and what happens if it is not right."
      intro="Your piece is made after you order it and printed only once you have seen the portrait and said yes. Here is what that means for when it arrives, what it costs to send, and where you stand if something is wrong."
      updated="7 August 2026"
    >
      <h2>When it arrives</h2>
      <p>
        Nothing is printed until you approve your portrait, so the clock starts
        on your yes rather than on your payment. From that moment, most orders
        reach their door within 7 to 10 working days, tracked the whole way.
      </p>
      <p>
        The days before that are yours: we draw the portrait within a few
        minutes of your payment and email it to you, and it then waits until you
        have looked at it. An order that sits unapproved for a while is nothing
        to worry about and nothing is lost.
      </p>

      <h2>What delivery costs</h2>
      <ul>
        <li>
          <strong>{formatZar(SHIPPING_FLAT_ZAR)}</strong> anywhere in South
          Africa, whatever is in the parcel.
        </li>
        <li>
          <strong>Free</strong> once your order passes{" "}
          {formatZar(FREE_SHIPPING_THRESHOLD_ZAR)}.
        </li>
      </ul>
      <p>
        We deliver within South Africa only for now. Outlying areas can run a
        little longer than the window above, and where we know a parcel is going
        to be slow we tell you rather than let you wonder.
      </p>

      <OwnerTodo>
        <p>
          Locker collection or door delivery? The rate above is the flat figure
          the checkout charges today, and BOARD-REVIEW.md has this decision open:
          a locker service priced by parcel size runs cheaper, but it is a
          collection rather than a delivery, and every other page on this site
          promises a door.
        </p>
        <p>
          Decide it before launch, because it changes this page, the checkout
          rate, and the word &quot;door&quot; in about six other places.
        </p>
      </OwnerTodo>

      <h2>Before it is printed: the approval step</h2>
      <p>
        This is the part that makes most returns unnecessary, and it is the
        reason it exists. When your portrait is ready, both sides of it come to
        you by email. You look at your creature and you either say yes or you
        say not quite.
      </p>
      <p>
        If it is not quite them, tell us what is wrong, or send a different
        photograph, and we draw it again. If it is still not right after that, a
        person here takes it on personally and gets in touch. Nothing reaches
        the press without your word, and there is no limit on this that will be
        held over you.
      </p>

      <h2>If it arrives damaged, faulty or wrong</h2>
      <p>
        We replace it. That covers a piece that arrives damaged, a garment with
        a fault in it, the wrong size or colour against what you ordered, and a
        print that is not the artwork you approved.
      </p>
      <p>
        Email <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> with your
        order reference and a photograph of the problem. We do not ask you to
        post it back before we believe you, and you are never out of pocket for
        our mistake.
      </p>

      <OwnerTodo>
        <p>
          How long after delivery may somebody report damage or a fault, and
          does that differ for the two? State a window here that you will
          actually honour.
        </p>
      </OwnerTodo>

      <h2>If you change your mind</h2>
      <p>
        Every piece is made for one person: your animal, their name, the words
        you chose, on the garment and colour you picked. It cannot be sold to
        anybody else, and it is printed only after you have seen the artwork and
        approved it.
      </p>
      <p>
        If you want to stop an order, email us as soon as you can and we will
        tell you exactly where it has got to and what we can do. Before your
        approval, nothing has been printed.
      </p>

      <OwnerTodo>
        <p>
          <strong>
            For a South African commercial attorney. This is the one question on
            these pages that must not be answered by guessing.
          </strong>
        </p>
        <p>
          Where does a customer stand on cancelling an order for personalised
          goods that they have already approved? Specifically: does the
          seven-day cooling-off right for electronic transactions apply to what
          we sell, and what exactly do the exemptions for goods made to a
          consumer&apos;s own specification cover? The Consumer Protection Act
          position needs reading alongside it.
        </p>
        <p>
          Whatever the answer, it should be written into this section in plain
          words, along with the refund method and how long a refund takes. Until
          then this page states what we do and claims nothing about the law.
        </p>
      </OwnerTodo>
    </LegalPage>
  );
}
