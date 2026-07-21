import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ReorderFlow } from "@/components/products/ReorderFlow";
import { requireCustomer } from "@/lib/account/auth";
import { getReorderableCreature } from "@/lib/account/creatures";

export const runtime = "nodejs";
// Reads a session cookie and signs a preview URL for one person's portrait.
// Never cached, never prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wear this again",
  robots: { index: false, follow: false },
};

type ReorderPageProps = {
  params: Promise<{ artworkId: string }>;
};

/**
 * One-click re-order of a saved creature. The guard runs first, then the
 * authorization: getReorderableCreature only returns a portrait reachable from
 * one of THIS customer's paid orders, so a stranger's artwork, an unpaid
 * artwork, or an unknown id all fall through to a graceful bounce back to the
 * account, never a crash and never a hint. The flow below adds the EXISTING
 * artworkId to the cart with no upload and no generation step.
 */
export default async function ReorderPage({ params }: ReorderPageProps) {
  const customer = await requireCustomer();
  const { artworkId } = await params;

  const creature = await getReorderableCreature(customer.id, artworkId);
  // Not this customer's paid artwork (or a stale/tampered link): send them home
  // rather than reveal anything about the id.
  if (!creature) redirect("/account");

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <ReorderFlow
          artworkId={creature.artworkId}
          styleLabel={creature.styleLabel}
          previewUrl={creature.previewUrl}
        />
      </Container>
    </div>
  );
}
