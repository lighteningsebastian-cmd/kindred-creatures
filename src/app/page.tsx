import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <Container className="flex flex-col items-start gap-6 py-24 md:py-32">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink md:text-6xl">
        Kindred Creature Co.
      </h1>
      <p className="max-w-xl text-lg text-muted">
        Turn a photo of your pet into portrait artwork, printed on apparel you
        will actually want to wear.
      </p>
      <Button href="/products/hoodie" size="md">
        Create theirs
      </Button>
    </Container>
  );
}
