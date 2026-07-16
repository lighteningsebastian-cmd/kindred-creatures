import { Container } from "@/components/ui/Container";
import { DeliveryDog } from "@/components/creatures/DeliveryDog";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Split delivery section: reassuring copy on one side, the trotting delivery dog
 * given a full-width lane to enter from off-screen on the other.
 */
export function DeliveryPromise() {
  return (
    <section className="bg-surface py-20 md:py-28">
      <Container className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
        <Reveal className="flex flex-col gap-4">
          <h2 className="max-w-md font-display text-3xl leading-[1.16] text-ink md:text-4xl">
            Printed and delivered in 5 working days
          </h2>
          <p className="max-w-md text-lg leading-relaxed text-muted">
            Every order is printed in Cape Town and couriered to your door, with
            tracking from the press to your gate so you always know where it is.
          </p>
        </Reveal>
        <DeliveryDog className="mx-auto w-full max-w-md" />
      </Container>
    </section>
  );
}
