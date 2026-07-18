import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { FAQS } from "@/lib/content";

export function FaqTeaser() {
  return (
    <section className="bg-surface py-20 md:py-28">
      <Container>
        <Reveal>
          <p className="eyebrow text-accent">Questions, answered</p>
          <h2 className="mt-4 font-display text-3xl leading-[1.16] text-ink md:text-4xl">
            Frequently asked questions
          </h2>
        </Reveal>
        <dl className="mt-10 max-w-2xl">
          {FAQS.map((item, index) => (
            <Reveal key={item.question} delay={index * 0.08}>
              <div className="flex flex-col gap-1 border-t border-line py-5 sm:flex-row sm:gap-8">
                <dt className="font-medium text-ink sm:w-2/5">
                  {item.question}
                </dt>
                <dd className="text-muted sm:flex-1">{item.answer}</dd>
              </div>
            </Reveal>
          ))}
        </dl>
        <div className="mt-8">
          <Button href="/faq" variant="ghost">
            Read the FAQ
          </Button>
        </div>
      </Container>
    </section>
  );
}
