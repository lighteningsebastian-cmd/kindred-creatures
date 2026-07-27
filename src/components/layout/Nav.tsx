import Link from "next/link";
import { User } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { CartButton } from "@/components/layout/CartButton";
import { MobileMenu, type NavLink } from "@/components/layout/MobileMenu";

// Shop and How it works are now real, distinct pages: /shop is the merchandised
// catalogue, /how-it-works the process/trust page. The home page still carries
// teaser sections under #range and #how-it-works, but the nav sends people to
// the full pages. Our story and FAQ are their own pages.
const links: NavLink[] = [
  { href: "/shop", label: "Shop" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "Our story" },
  { href: "/faq", label: "FAQ" },
];

export function Nav() {
  return (
    <>
      {/* Utility bar: maroon inverse band, varsity block, centered. */}
      <div className="bg-inverse text-on-inverse">
        <Container className="flex min-h-9 items-center justify-center py-2">
          <p className="eyebrow text-center text-[11px] leading-tight">
            DESIGNED AND MADE IN SOUTH AFRICA · FREE SHIPPING OVER R1000
          </p>
        </Container>
      </div>

      <header className="sticky top-0 z-50 border-b border-line bg-base">
        <Container className="flex h-[68px] items-center justify-between gap-4">
          <Link
            href="/"
            className="font-display text-xl tracking-tight text-ink"
          >
            Kindred Creatures
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

          <div className="flex items-center gap-1 sm:gap-2">
            {/* "Track order" is intentionally absent: order status lives behind
                the token link we email, and there is no self-service lookup page
                to point at yet. A dead /track link is worse than none. Add it
                back the day an order-lookup page exists. */}
            {/* Account. A single link to /account is enough at every width: the
                page itself bounces a signed-out visitor to /account/login, so
                the nav never has to read the session (which would force it
                client-side and complicate the split). */}
            <Link
              href="/account"
              aria-label="Your account"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-[transform,background-color] hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              <User weight="regular" size={22} />
            </Link>
            <CartButton />
            <MobileMenu links={links} />
          </div>
        </Container>
      </header>
    </>
  );
}
