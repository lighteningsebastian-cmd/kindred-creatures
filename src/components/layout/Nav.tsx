import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CartButton } from "@/components/layout/CartButton";
import { MobileMenu, type NavLink } from "@/components/layout/MobileMenu";

const links: NavLink[] = [
  { href: "/shop", label: "Shop" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/faq", label: "FAQ" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-base">
      <Container className="flex h-[68px] items-center justify-between gap-4">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-ink"
        >
          Kindred Creature Co.
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <CartButton />
          <MobileMenu links={links} />
        </div>
      </Container>
    </header>
  );
}
