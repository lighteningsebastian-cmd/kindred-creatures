import Link from "next/link";
import { Container } from "@/components/ui/Container";

// Shop and How it works resolve to the landing sections that hold that content,
// matching the header nav; Our story and FAQ are their own pages.
const shopLinks = [
  { href: "/#range", label: "Shop" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/about", label: "Our story" },
  { href: "/faq", label: "FAQ" },
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
        </div>
      </Container>
    </footer>
  );
}
