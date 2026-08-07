import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";

/**
 * The furniture the four policy pages share: privacy, terms, shipping and
 * returns, contact.
 *
 * One narrow measure, one type scale, and element styling applied from here so
 * each page is nothing but its own words in plain semantic HTML. A policy page
 * that has to be re-typeset every time it is amended is a policy page that
 * quietly stops being amended.
 */
export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  /** Rendered verbatim, e.g. "7 August 2026". */
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-base py-16 md:py-24">
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col">
          <Reveal>
            <p className="eyebrow text-[11px] text-accent">{eyebrow}</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-5 font-display text-3xl leading-[1.1] text-ink md:text-[44px] md:leading-[1.08]">
              {title}
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg leading-relaxed text-muted">{intro}</p>
          </Reveal>
          <p className="mt-4 text-sm text-muted">Last updated {updated}</p>

          <div
            className={[
              "mt-4",
              "[&>h2]:mt-12 [&>h2]:font-display [&>h2]:text-2xl [&>h2]:leading-[1.2] [&>h2]:text-ink",
              "[&>h3]:mt-8 [&>h3]:font-display [&>h3]:text-lg [&>h3]:leading-snug [&>h3]:text-ink",
              "[&>p]:mt-4 [&>p]:leading-relaxed [&>p]:text-muted",
              "[&>ul]:mt-4 [&>ul]:flex [&>ul]:list-disc [&>ul]:flex-col [&>ul]:gap-3 [&>ul]:pl-5",
              "[&_li]:leading-relaxed [&_li]:text-muted [&_li]:marker:text-line-strong",
              "[&_strong]:font-medium [&_strong]:text-ink",
              "[&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-accent",
            ].join(" ")}
          >
            {children}
          </div>
        </div>
      </Container>
    </div>
  );
}

/**
 * A gap in a policy page, left open on purpose and shown rather than hidden.
 *
 * Every one of these is a question only the owner or his attorney can answer:
 * a registration number, a VAT status, a legal position on cancellation. The
 * alternative is a plausible-looking placeholder, and a placeholder that reads
 * like a fact is worse than an obvious gap: nobody ever comes back to correct
 * a sentence that already looks finished.
 *
 * BEFORE LAUNCH: `grep -rn OwnerTodo src/app` must be empty. Each one that goes
 * has an answer behind it.
 */
export function OwnerTodo({ children }: { children: ReactNode }) {
  return (
    <aside className="mt-6 rounded-md border border-dashed border-accent bg-accent-tint p-5">
      <p className="eyebrow text-[11px] text-accent">TODO(owner)</p>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-ink [&_a]:underline [&_a]:underline-offset-4 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
        {children}
      </div>
    </aside>
  );
}
