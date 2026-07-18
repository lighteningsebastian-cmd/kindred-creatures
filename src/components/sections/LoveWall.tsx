import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";

const quotes = [
  {
    quote:
      "“The portrait caught the exact tilt of Biscuit’s head when he wants a walk. I teared up.”",
    person: "Thandi M.",
    pet: "and Biscuit",
    span: "md:col-span-4",
    offset: "",
  },
  {
    quote:
      "“I wear the hoodie every weekend. Strangers stop me to ask about Luna, and I love that.”",
    person: "Pieter v.d.M.",
    pet: "and Luna",
    span: "md:col-span-5",
    offset: "md:mt-12",
  },
  {
    quote:
      "“It does not look printed. It looks like someone sat and drew Mango properly.”",
    person: "Ayesha K.",
    pet: "and Mango",
    span: "md:col-span-3",
    offset: "md:mt-6",
  },
];

/**
 * Testimonials laid out as an offset masonry row: three cards of different
 * widths dropped to different heights, so it never reads as an even card row.
 */
export function LoveWall() {
  return (
    <section className="bg-base py-20 md:py-28">
      <Container>
        <Reveal>
          <p className="eyebrow text-[11px] text-accent">In their words</p>
          <h2 className="mt-4 max-w-xl font-display text-3xl leading-[1.16] text-ink md:text-4xl">
            People and the pets they love
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-12">
          {quotes.map((item, index) => (
            <Reveal
              key={item.person}
              delay={index * 0.1}
              className={`${item.span} ${item.offset}`}
            >
              <figure className="flex h-full flex-col justify-between gap-6 rounded-lg border border-line bg-surface p-7">
                <blockquote className="font-display text-xl leading-snug text-ink">
                  {item.quote}
                </blockquote>
                <figcaption className="text-sm text-muted">
                  <span className="font-medium text-ink">{item.person}</span>{" "}
                  {item.pet}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
