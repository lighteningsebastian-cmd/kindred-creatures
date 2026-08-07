import type { Metadata } from "next";
import { LegalPage, OwnerTodo } from "@/components/legal/LegalPage";
import { BRAND_EMAIL, BRAND_NAME } from "@/lib/seo/site";

const title = "Privacy";
const description = `What ${BRAND_NAME} collects when you order, why we collect it, who else ever sees it, how long we keep it, and how to ask for a copy or have it deleted. Written to the Protection of Personal Information Act.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_ZA",
    url: "/privacy",
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
 * The POPIA page. Every claim on it is checked against what the code actually
 * does: the columns in src/lib/db/schema.ts, the recipients in
 * src/lib/email/templates/job-sheet.ts, the cookies in src/lib/account/session.ts
 * and the analytics gate in src/components/analytics/Analytics.tsx. A privacy
 * policy that describes a different system to the one running is worse than
 * none, because it is a written record of a promise nobody is keeping.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="What we hold, and why we hold it."
      intro="You hand us a photograph of someone you love, your address and your money. This page says plainly what happens to each of those, who else ever sees them, and how to ask for them back."
      updated="7 August 2026"
    >
      <h2>Who we are</h2>
      <p>
        {BRAND_NAME} makes portrait apparel to order in Jeffreys Bay, South
        Africa. Under the Protection of Personal Information Act (POPIA) we are
        the responsible party for everything described on this page. You can
        reach us at{" "}
        <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>.
      </p>

      <OwnerTodo>
        <p>
          The registered company name, registration number and physical address
          go in the paragraph above once the company is registered.
        </p>
        <p>
          POPIA also requires a named Information Officer, registered with the
          Information Regulator. Who is it, and what address should complaints
          be sent to? Nothing here can name one until that registration exists.
        </p>
      </OwnerTodo>

      <h2>What we collect, and why</h2>
      <ul>
        <li>
          <strong>Your name, email address, phone number and delivery address.</strong>{" "}
          To take the order, to keep you posted on it, and to get the parcel to
          the right door.
        </li>
        <li>
          <strong>The photograph you send us.</strong> It is the whole basis of
          the portrait. We use it for that and for nothing else.
        </li>
        <li>
          <strong>What you tell us about your companion:</strong> their name,
          what they are, their breed, the words you chose for them and the year
          they came into your life. Most of it is printed on the piece.
        </li>
        <li>
          <strong>What you tell us when a portrait is not right.</strong> Your
          own words, which go to a person here who reads them.
        </li>
        <li>
          <strong>Your email address, if you ask for our newsletter.</strong>{" "}
          Kept on the mailing list until you unsubscribe.
        </li>
        <li>
          <strong>Ordinary web measurement,</strong> where it is switched on:
          which pages were visited, from roughly where, on what kind of device.
        </li>
      </ul>
      <p>
        <strong>We never see your card.</strong> Payment is taken on PayFast.
        Card numbers are typed in there, not here, and no card detail of yours
        is ever stored by us.
      </p>

      <h2>Who else sees it</h2>
      <p>
        Making a thing and posting it involves other people. This is all of
        them, and there is nobody else:
      </p>
      <ul>
        <li>
          <strong>PayFast,</strong> our payment provider, who takes the money
          and tells us whether it went through.
        </li>
        <li>
          <strong>The print shop in Jeffreys Bay</strong> that prints your
          piece. Its job sheet carries your name, delivery address and phone
          number, because a parcel cannot be addressed without them.
        </li>
        <li>
          <strong>The courier,</strong> for the same reason.
        </li>
        <li>
          <strong>The service that sends our email,</strong> so that
          confirmations, approval links and tracking numbers reach you.
        </li>
        <li>
          <strong>Our hosting and file storage,</strong> where this site runs
          and where your photograph and your artwork are kept.
        </li>
        <li>
          <strong>The specialist image service</strong> your photograph passes
          through while the portrait is being made. It operates outside South
          Africa.
        </li>
      </ul>
      <p>
        Several of those operate outside South Africa, which POPIA treats as a
        transfer across the border. We do not sell your information to anybody,
        we do not hand it to advertisers, and none of it is used for anything
        other than the order you placed.
      </p>

      <OwnerTodo>
        <p>
          For the attorney: should each of those be named outright, in
          particular the image service the photograph passes through, and what
          does section 72 of POPIA require us to say about that transfer?
        </p>
        <p>
          There is a genuine pull in two directions here. The site&apos;s copy
          rules keep the making of a portrait in human terms, and POPIA wants
          plainness about who processes a customer&apos;s photograph. Which one
          gives way on this page is a legal call, not a copy call.
        </p>
      </OwnerTodo>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Order records.</strong> For as long as South African tax and
          company law requires us to keep them.
        </li>
        <li>
          <strong>Your photograph and your artwork.</strong> Kept so you can put
          the same creature on something else later without sending the photo
          again. Ask us to delete them and we will.
        </li>
        <li>
          <strong>The newsletter list.</strong> Until you unsubscribe, which is
          one click at the foot of any newsletter.
        </li>
        <li>
          <strong>Sign-in links.</strong> Minutes. Each one works once, and only
          a fingerprint of it is stored, never the link itself.
        </li>
      </ul>

      <OwnerTodo>
        <p>
          How many years must order records be kept, and does anything have to
          be deleted at the end of it? The line above is deliberately vague
          because the number is not ours to invent.
        </p>
      </OwnerTodo>

      <h2>What you can ask us for</h2>
      <p>Under POPIA you may ask us at any time:</p>
      <ul>
        <li>for a copy of what we hold about you</li>
        <li>to correct anything that is wrong</li>
        <li>to delete what we are not obliged to keep</li>
        <li>to stop sending you things</li>
      </ul>
      <p>
        Email <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> and a person
        will do it. We will ask enough to be sure it is you, which is normally
        the email address the order was placed with. There is no charge.
      </p>

      <h2>Cookies, and what this site remembers</h2>
      <ul>
        <li>
          A small signed cookie once you sign in, so the site knows it is still
          you. It holds no personal detail beyond your account.
        </li>
        <li>
          Your cart, which lives in your own browser. It reaches us only when
          you check out.
        </li>
        <li>
          Where measurement is switched on, the analytics provider sets its own
          cookies. Nothing on this site advertises to you or follows you
          elsewhere.
        </li>
      </ul>

      <h2>If you are unhappy</h2>
      <p>
        Tell us first, at <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>.
        We would far rather fix it ourselves. If we do not, POPIA gives you the
        right to complain to the Information Regulator of South Africa.
      </p>

      <OwnerTodo>
        <p>
          The Regulator&apos;s current postal address, complaints email and
          complaint form reference should be printed here in full. Confirm them
          against inforegulator.org.za on the day this page goes live rather
          than copying them from another store&apos;s policy.
        </p>
      </OwnerTodo>
    </LegalPage>
  );
}
