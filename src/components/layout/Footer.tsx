import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { AccentRule } from "@/components/ui/AccentRule";
import { NewsletterSignup } from "@/components/newsletter/NewsletterSignup";
import { GoogleReviewsLink } from "@/components/newsletter/GoogleReviewsLink";

// Shop and How it works resolve to the full pages, matching the header nav;
// Our story and FAQ are their own pages.
const shopLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "Our story" },
  { href: "/faq", label: "FAQ" },
];

// Real routes, every one of them. These sat on href="#" while the pages did not
// exist, which is the first thing a payment provider's reviewer clicks and the
// last thing a customer wants to find when they are looking for a returns
// policy. Footer.test.tsx fails the build if a "#" comes back.
const policyLinks = [
  { href: "/order-lookup", label: "Find my order" },
  { href: "/contact", label: "Contact" },
  { href: "/shipping-and-returns", label: "Shipping & returns" },
  { href: "/terms", label: "Terms of sale" },
  { href: "/privacy", label: "Privacy" },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <Container className="pt-12">
        <AccentRule />
      </Container>
      <Container className="grid grid-cols-1 gap-10 pb-12 pt-10 md:grid-cols-4">
        <div className="max-w-xs">
          <p className="font-display text-lg text-ink">Kindred Creatures</p>
          <p className="mt-3 text-sm text-muted">
            Custom apparel starring your favourite creature. Printed in South
            Africa.
          </p>
        </div>

        <nav aria-label="Site" className="flex flex-col gap-3">
          {shopLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-3">
          {policyLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="mailto:hello@kindredcreatures.co.za"
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            hello@kindredcreatures.co.za
          </a>
          <GoogleReviewsLink className="mt-1" />
        </div>

        <NewsletterSignup />
      </Container>
    </footer>
  );
}
