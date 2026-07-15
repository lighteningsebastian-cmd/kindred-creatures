import Link from "next/link";
import { Container } from "@/components/ui/Container";

const shopLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

const policyLinks = [
  { href: "#", label: "Shipping & returns" },
  { href: "#", label: "Privacy" },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <Container className="grid grid-cols-1 gap-10 py-12 md:grid-cols-3">
        <div className="max-w-xs">
          <p className="font-display text-lg font-semibold text-ink">
            Kindred Creature Co.
          </p>
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
            href="mailto:hello@kindredcreature.co.za"
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            hello@kindredcreature.co.za
          </a>
        </div>
      </Container>
    </footer>
  );
}
