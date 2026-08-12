"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { type Product, type Variant } from "@/lib/products";
import { useCartStore } from "@/lib/cart-store";
import type { ResumedArtwork } from "@/lib/artwork-resume";
import { trackAddToCart, trackPhotoUploaded } from "@/lib/analytics";
import { isProfileComplete, type CompanionProfile } from "@/lib/companion";
import { downscaleImage } from "./downscale";
import { UploadDropzone } from "./UploadDropzone";

export type CustomizerProps = {
  product: Product;
  /** The colourway chosen at the top of the flow. */
  color: Variant;
  /** The size chosen in the flow, or null until one is picked. */
  size: string | null;
  /** Everything they told us about their animal, owned by the parent flow. */
  profile: CompanionProfile;
  /** Persists the profile onto the artwork. Nothing is drawn. */
  save: (
    artworkId: string,
    profile: CompanionProfile,
  ) => Promise<{ ok: boolean }>;
  /**
   * A cart line come back to be changed. The artwork and its photograph are
   * already there, so this step opens finished rather than empty, and saving
   * lands on the line they came from instead of opening a second one.
   */
  resumed?: ResumedArtwork | null;
};

type Phase =
  | "idle" // no photo yet
  | "uploading" // upload + moderation in flight
  | "uploaded"; // photo accepted

/**
 * The style and the photograph.
 *
 * NOT GATED on a colour and size choice any more (docs/spec-flow-fixes.md
 * section 5). The gate made the owner believe the page was broken, twice; a
 * customer would simply have left. The cart is still gated, on a size and on the
 * details having been saved, because those are real preconditions rather than a
 * curtain over the page.
 *
 * NOTHING IS DRAWN HERE ANY MORE. Generation moved after payment
 * (docs/spec-pipeline.md section 1), because front and back at print quality is
 * around R7 a go and roughly a hundred people would generate for every one who
 * bought. What used to live here (a preview, three tries, a waiting state) is
 * gone: the customer sees the real plate carrying their own data further up the
 * page, and their animal is drawn once the money has landed.
 *
 * THERE IS NO STYLE CHOICE EITHER (owner decision, 3 August). One house style,
 * so this step is the photograph and nothing else. Deleting the choice took a
 * decision out of the customer's path and a whole prompt axis out of the range;
 * the two portraits we draw are now the front and the back of the garment.
 *
 * What this step must guarantee is that the drawing can succeed the moment it
 * runs, so the profile is saved onto the artwork before the cart will take it.
 * Colour and size are owned by the parent flow and arrive as props, so switching
 * them never disturbs anything and the cart line is always built from the
 * CURRENT selection.
 */
export function Customizer({
  product,
  color,
  size,
  profile,
  save,
  resumed = null,
}: CustomizerProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const replaceLine = useCartStore((state) => state.replaceLine);

  const [phase, setPhase] = useState<Phase>(resumed ? "uploaded" : "idle");
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    resumed?.photoUrl ?? null,
  );
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [artworkId, setArtworkId] = useState<string | null>(
    resumed?.artworkId ?? null,
  );
  /** The exact thing last written to the artwork, so "saved" is derived. */
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);

  const profileReady = isProfileComplete(profile);

  // What SHOULD be on the artwork right now. Deriving "saved" from a comparison
  // rather than resetting a flag in the effect means editing a name after
  // picking a style makes this stale on the spot, with no render cascade and no
  // window where a changed profile still counts as written.
  const pending =
    artworkId && profileReady ? JSON.stringify([artworkId, profile]) : null;
  const saved = pending !== null && savedKey === pending;

  useEffect(() => {
    if (!pending || !artworkId) return;
    let live = true;
    void save(artworkId, profile).then((result) => {
      if (live && result.ok) setSavedKey(pending);
    });
    return () => {
      live = false;
    };
  }, [pending, artworkId, profile, save]);

  const handleFile = useCallback(
    async (file: File) => {
      // A new photo is a new artwork, so everything downstream resets.
      setRejectReason(null);
      setUploadError(null);
      setArtworkId(null);
      setSavedKey(null);

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const localUrl = URL.createObjectURL(file);
      objectUrlRef.current = localUrl;
      setPhotoPreview(localUrl);
      setPhase("uploading");

      try {
        const blob = await downscaleImage(file, 2048);
        const form = new FormData();
        const name = blob instanceof File ? blob.name : "photo.jpg";
        form.set("file", blob, name);
        form.set("productSlug", product.slug);

        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));

        if (res.status === 422) {
          setRejectReason(
            data.error ??
              "We could not accept this photo. Please try a different one.",
          );
          setPhase("idle");
          return;
        }
        if (!res.ok) {
          setUploadError(
            data.error ?? "That upload did not go through. Please try again.",
          );
          setPhase("idle");
          return;
        }
        setArtworkId(data.artworkId);
        setPhase("uploaded");
        trackPhotoUploaded({ slug: product.slug });
      } catch {
        setUploadError("That upload did not go through. Please try again.");
        setPhase("idle");
      }
    },
    [product.slug],
  );

  // SAVED, not merely chosen. The artwork row is what the drawing reads after
  // payment, so a line reaching the cart without one is an order that could be
  // paid for and then stall.
  const canAddToCart = saved && !!artworkId && size !== null;

  const handleAddToCart = () => {
    if (!canAddToCart || !artworkId || !size) return;
    const line = {
      productSlug: product.slug,
      // Built from the CURRENT selection, not the one in force at upload time.
      color: color.color,
      size,
      qty: 1,
      artworkId,
      // Priced at add time so a later price change cannot re-price this line.
      unitPriceZar: color.priceZar,
    };

    if (resumed) {
      // Their line, edited, in the place it was already in. Keyed on the
      // artwork they ARRIVED with rather than the one they are leaving with:
      // choosing a new photograph mid-edit opens a new artwork, and the line
      // has to follow it rather than keep pointing at the picture they
      // replaced. No tracking event: this is not a new piece being bought.
      replaceLine(resumed.artworkId, line);
    } else {
      addItem(line);
      trackAddToCart({ slug: product.slug, priceZar: color.priceZar });
    }
    router.push("/cart");
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="eyebrow text-xs text-accent">Make it theirs</p>
        <h2 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
          Their photo
        </h2>
        <p className="max-w-md leading-relaxed text-muted">
          {resumed
            ? "The photo you sent is below. Keep it, or choose another one. We draw them once your order is in, and you see it before anything is printed."
            : "Good light and a clear look at their face is all we need. We draw them once your order is in, and you see it before anything is printed."}
        </p>
      </div>

      {/* One column now. The style picker used to sit alongside; with one house
          style there is nothing to put there, and a photograph is a big enough
          ask to deserve the whole width. */}
      <div className="flex flex-col gap-3">
        <UploadDropzone
          photoPreview={photoPreview}
          busy={phase === "uploading"}
          rejectReason={rejectReason}
          onFile={handleFile}
        />
        {uploadError ? (
          <p role="alert" className="text-sm font-medium text-signal-error">
            {uploadError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <Button
          block
          size="md"
          onClick={handleAddToCart}
          disabled={!canAddToCart}
          aria-disabled={!canAddToCart}
          className="w-full sm:w-auto"
        >
          {resumed ? "Save changes" : "Add to cart"}
        </Button>
        {!artworkId ? (
          <p className="text-sm text-muted">
            Upload a photo of them to carry on.
          </p>
        ) : !profileReady ? (
          <p className="text-sm text-muted">
            We still need a few details about them further up the page.
          </p>
        ) : size === null ? (
          <p className="text-sm text-muted">
            {resumed
              ? "Choose a size to save your changes."
              : "Choose a size to add to cart."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
