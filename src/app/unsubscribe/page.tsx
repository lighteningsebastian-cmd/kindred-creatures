import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Newsletter",
  robots: { index: false, follow: false },
};

/**
 * Where the unsubscribe route sends someone after it has acted (or after a bad
 * link). The route does the work; this page only confirms it, so a refresh or a
 * shared link never re-triggers anything. Two states: it worked, or the link
 * was not one we could read.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const invalid = status === "invalid";

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <div className="flex max-w-xl flex-col items-start gap-5">
          <p className="eyebrow text-xs text-muted">Newsletter</p>
          {invalid ? (
            <>
              <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
                That unsubscribe link did not check out.
              </h1>
              <p className="leading-relaxed text-muted">
                The link may have been broken in transit or copied only in part.
                If you would like to stop hearing from us, reply to any of our
                emails and we will take you off the list by hand.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
                You are off the list. No more newsletters.
              </h1>
              <p className="leading-relaxed text-muted">
                We have stopped sending you the newsletter. This does not touch
                any order updates: if you buy from us, you will still get the
                notes about your portrait and your parcel.
              </p>
            </>
          )}

          <div className="mt-2">
            <Button href="/" size="md" variant="secondary">
              Back to Kindred Creatures
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
