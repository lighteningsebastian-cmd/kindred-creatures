import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ApprovalActions } from "@/components/order/ApprovalActions";
import {
  artworkForApproval,
  profileFromArtwork,
} from "@/lib/artwork-approval";
import { backPlate, frontPlate } from "@/lib/print/plate";
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

const BACK_W = 900;
const FRONT_PX = 600;

function dataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * "Here they are."
 *
 * The page the whole promise rests on: nothing is printed until the person who
 * ordered it has looked at it and said yes. Holding this link authorises one
 * approval and nothing else, and it never signs anyone in.
 */
export default async function ApprovePage({ params }: ApprovePageProps) {
  const { token } = await params;
  const artwork = await artworkForApproval(token);
  // A bad token, an expired guess and an unknown artwork all end up here, which
  // is the point: the page must not tell anyone which of those they hit.
  if (!artwork) notFound();

  const profile = profileFromArtwork(artwork);
  const product = getProduct(artwork.productSlug);
  const backArea = product?.printArea.back ?? { widthMm: 280, heightMm: 350 };
  const backH = Math.round((BACK_W * backArea.heightMm) / backArea.widthMm);

  // The front is its own shape now, 110 by 150mm, not the square it was drawn
  // as before the owner's measurements arrived.
  const frontArea = product?.printArea.front ?? { widthMm: 110, heightMm: 150 };
  const frontH = Math.round((FRONT_PX * frontArea.heightMm) / frontArea.widthMm);

  const back = backPlate(profile, null, BACK_W, backH);
  const front = frontPlate(profile, FRONT_PX, frontH);

  // The portrait itself. frontKey and backKey are written once generation moves
  // after payment; until then the canonical portrait stands in for both sides.
  const portraitKey = artwork.frontKey ?? artwork.canonicalKey;
  const portraitUrl = portraitKey
    ? await getStorage().getSignedUrl(portraitKey, 3600)
    : null;

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
            { plate: back, label: "Back", aspect: `${backArea.widthMm} / ${backArea.heightMm}` },
            {
              plate: front,
              label: "Left chest",
              aspect: `${frontArea.widthMm} / ${frontArea.heightMm}`,
            },
          ].map(({ plate, label, aspect }) => (
            <figure key={label} className="flex flex-col gap-2">
              <div
                className="relative w-full overflow-hidden rounded-md border border-line bg-surface"
                style={{ aspectRatio: aspect }}
              >
                {portraitUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={portraitUrl}
                    alt=""
                    className="absolute object-contain"
                    style={{
                      left: `${(plate.portrait.x / (label === "Back" ? BACK_W : FRONT_PX)) * 100}%`,
                      top: `${(plate.portrait.y / (label === "Back" ? backH : FRONT_PX)) * 100}%`,
                      width: `${(plate.portrait.width / (label === "Back" ? BACK_W : FRONT_PX)) * 100}%`,
                      height: `${(plate.portrait.height / (label === "Back" ? backH : FRONT_PX)) * 100}%`,
                    }}
                  />
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dataUrl(plate.svg)}
                  alt={`${label} of your piece`}
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <figcaption className="text-center text-sm text-muted">
                {label}
              </figcaption>
            </figure>
          ))}
        </div>

        <ApprovalActions
          token={token}
          approvedAt={artwork.approvedAt ? artwork.approvedAt.toISOString() : null}
          onApprove={approveAction}
          onRevise={reviseAction}
        />
      </div>
    </Container>
  );
}
