import { SealCheck, MapPin, Truck } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

/**
 * A slim proof strip that sits directly under the hero: the three plainest
 * reasons to trust the shop, near the top where a first-time visitor looks for
 * them. Not cards, a banded full-width strip with hairline-separated columns and
 * regular-weight Phosphor icons; no decorative dots or middot chains.
 */
const beats = [
  { Icon: SealCheck, text: "You approve before we print" },
  { Icon: MapPin, text: "Printed in Jeffreys Bay" },
  { Icon: Truck, text: "Delivered in 7 to 10 working days" },
];

export function TrustBand() {
  return (
    <section className="border-y border-line bg-surface">
      <Container className="grid grid-cols-1 sm:grid-cols-3">
        {beats.map(({ Icon, text }, index) => (
          <div
            key={text}
            className={cn(
              "flex items-center justify-center gap-3 px-4 py-4 text-center",
              index > 0 && "border-t border-line sm:border-t-0 sm:border-l",
            )}
          >
            <Icon
              size={22}
              weight="regular"
              aria-hidden="true"
              className="shrink-0 text-accent"
            />
            <span className="text-sm text-ink">{text}</span>
          </div>
        ))}
      </Container>
    </section>
  );
}
