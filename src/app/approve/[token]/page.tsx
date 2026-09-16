import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ApprovalActions } from "@/components/order/ApprovalActions";
import { artworkForApproval } from "@/lib/artwork-approval";
import { getProduct } from "@/lib/products";
import { getStorage } from "@/lib/storage";
import { approveAction, reviseAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your portrait",
  // One person's artwork, reachable by anyone holding the link. Search engines
  // are exactly the sort of thing that follows a link nobody gave them.
  robots: { index: false, follow: false },
};

type ApprovePageProps = { params: Promise<{ token: string }> };

/** Same lease the account and admin screens give an artwork link. */
const PLATE_LINK_TTL_SEC = 60 * 60;

/**
 * "Here they are."
 *
 * The page the whole promise rests on: nothing is printed until the person who
 * ordered it has looked at it and said yes. Holding this link authorises one
 * approval and nothing else, and it never signs anyone in.
 *
 * NOTHING IS COMPOSITED HERE. `frontKey` and `backKey` are the finished plates:
 * `drawArtworkPlates` set the type and the portrait together, once, and stored
 * those bytes, and the print file is a resize of the back one. This page used
 * to typeset a fresh plate and drop the stored FRONT plate into its portrait
 * window on both sides, so the customer approved two names, two arcs and a
 * colour face where the graphite profile belongs, and never saw the back that
 * prints (docs/spec-first-real-order-16-sep.md section 0). Showing the stored
 * bytes is the only way what they approve can be what we print.
 *
 * A missing plate is "not ready yet". It is never a reason to draw or compose
 * something else in its place, and there is nothing to approve until both are
 * here.
 */
export default async function ApprovePage({ params }: ApprovePageProps) {
  const { token } = await params;
  const artwork = await artworkForApproval(token);
  // A bad token, an expired guess and an unknown artwork all end up here, which
  // is the point: the page must not tell anyone which of those they hit.
  if (!artwork) notFound();

  // The boxes are the print areas' own shapes, which are the shapes the plates
  // were composed at, so the plate fills its box with nothing cropped.
  const product = getProduct(artwork.productSlug);
  const backArea = product?.printArea.back ?? { widthMm: 280, heightMm: 350 };
  const frontArea = product?.printArea.front ?? { widthMm: 110, heightMm: 150 };

  const storage = getStorage();
  const [backUrl, frontUrl] = await Promise.all(
    [artwork.backKey, artwork.frontKey].map((key) =>
      key ? storage.getSignedUrl(key, PLATE_LINK_TTL_SEC) : null,
    ),
  );
  const ready = Boolean(backUrl && frontUrl);

  const name = artwork.creatureName?.trim();

  return (
    <Container className="py-14 md:py-20">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <div className="flex flex-col gap-3">
          <p className="font-block text-xs font-black uppercase tracking-[0.08em] text-accent">
            Your portrait
          </p>
          <h1 className="font-display text-4xl leading-[1.1] text-ink md:text-5xl">
            Here they are
          </h1>
          <p className="max-w-xl leading-relaxed text-muted">
            {name
              ? `This is ${name}, drawn from your photo and set on your piece. Nothing goes to the press until you say so.`
              : "This is your portrait, drawn from your photo and set on your piece. Nothing goes to the press until you say so."}
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-[2fr_1fr] sm:items-start">
          {[
            { url: backUrl, label: "Back", area: backArea },
            { url: frontUrl, label: "Left chest", area: frontArea },
          ].map(({ url, label, area }) => (
            <figure key={label} className="flex flex-col gap-2">
              <div
                className="relative w-full overflow-hidden rounded-md border border-line bg-surface"
                style={{ aspectRatio: `${area.widthMm} / ${area.heightMm}` }}
              >
                {url ? (
                  // Plain img: a short-lived signed URL, same call the account
                  // cards make. contain, because the box is the plate's shape
                  // and nothing of it may be cropped away.
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={url}
                    alt={`${label} of your piece`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted">
                    Still being drawn
                  </p>
                )}
              </div>
              <figcaption className="text-center text-sm text-muted">
                {label}
              </figcaption>
            </figure>
          ))}
        </div>

        {ready || artwork.approvedAt ? (
          <ApprovalActions
            token={token}
            approvedAt={artwork.approvedAt ? artwork.approvedAt.toISOString() : null}
            standoutDetail={artwork.standoutDetail}
            onApprove={approveAction}
            onRevise={reviseAction}
          />
        ) : (
          // Nothing to say yes to until both sides exist. An approval here would
          // be an approval of a picture nobody has seen.
          <p role="status" className="leading-relaxed text-muted">
            We are still finishing this one. We will email you the moment both
            sides are ready to look at.
          </p>
        )}
      </div>
    </Container>
  );
}
