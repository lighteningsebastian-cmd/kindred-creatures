"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { type Product, type Variant } from "@/lib/products";
import type { ArtStyle } from "@/lib/images/provider";
import { useCartStore } from "@/lib/cart-store";
import { trackAddToCart, trackPhotoUploaded } from "@/lib/analytics";
import { isProfileComplete, type CompanionProfile } from "@/lib/companion";
import { downscaleImage } from "./downscale";
import { UploadDropzone } from "./UploadDropzone";
import { StylePicker } from "./StylePicker";

export type CustomizerProps = {
  product: Product;
  /** The colourway chosen at the top of the flow. */
  color: Variant;
  /** The size chosen at the top of the flow, or null until one is picked. */
  size: string | null;
  /**
   * True once a colour and size are both chosen. Until then the portrait step
   * is shown but disabled, so the page does not jump when it activates.
   */
  active: boolean;
  /** Everything they told us about their animal, owned by the parent flow. */
  profile: CompanionProfile;
  /** Persists the style and profile onto the artwork. Nothing is drawn. */
  save: (
    artworkId: string,
    style: ArtStyle,
    profile: CompanionProfile,
  ) => Promise<{ ok: boolean }>;
};

type Phase =
  | "idle" // no photo yet
  | "uploading" // upload + moderation in flight
  | "uploaded"; // photo accepted

/**
 * The last step before paying: the photograph and the style.
 *
 * NOTHING IS DRAWN HERE ANY MORE. Generation moved after payment
 * (docs/spec-pipeline.md section 1), because front and back at print quality is
 * around R7 a go and roughly a hundred people would generate for every one who
 * bought. What used to live here (a preview, three tries, a waiting state) is
 * gone: the customer sees the real plate carrying their own data further up the
 * page, and their animal is drawn once the money has landed.
 *
 * What this step must guarantee is that the drawing can succeed the moment it
 * runs, so the style and the profile are saved onto the artwork before the cart
 * will take it. Colour and size are owned by the parent flow and arrive as
 * props, so switching them never disturbs anything and the cart line is always
 * built from the CURRENT selection.
 */
export function Customizer({
  product,
  color,
  size,
  active,
  profile,
  save,
}: CustomizerProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const [phase, setPhase] = useState<Phase>("idle");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [artworkId, setArtworkId] = useState<string | null>(null);
  const [style, setStyle] = useState<ArtStyle | null>(null);
  /** The exact thing last written to the artwork, so "saved" is derived. */
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);

  const profileReady = isProfileComplete(profile);

  // What SHOULD be on the artwork right now. Deriving "saved" from a comparison
  // rather than resetting a flag in the effect means editing a name after
  // picking a style makes this stale on the spot, with no render cascade and no
  // window where a changed profile still counts as written.
  const pending =
    artworkId && style && profileReady
      ? JSON.stringify([artworkId, style, profile])
      : null;
  const saved = pending !== null && savedKey === pending;

  useEffect(() => {
    if (!pending || !artworkId || !style) return;
    let live = true;
    void save(artworkId, style, profile).then((result) => {
      if (live && result.ok) setSavedKey(pending);
    });
    return () => {
      live = false;
    };
  }, [pending, artworkId, style, profile, save]);

  const handleFile = useCallback(
    async (file: File) => {
      // A new photo is a new artwork, so everything downstream resets.
      setRejectReason(null);
      setUploadError(null);
      setArtworkId(null);
      setStyle(null);
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
  const canAddToCart = active && saved && !!artworkId && size !== null;

  const handleAddToCart = () => {
    if (!canAddToCart || !artworkId || !size) return;
    addItem({
      productSlug: product.slug,
      // Built from the CURRENT selection, not the one in force at upload time.
      color: color.color,
      size,
      qty: 1,
      artworkId,
      // Priced at add time so a later price change cannot re-price this line.
      unitPriceZar: color.priceZar,
    });
    trackAddToCart({ slug: product.slug, priceZar: color.priceZar });
    router.push("/cart");
  };

  const styleDisabled = !active || !artworkId || phase === "uploading";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="eyebrow text-xs text-accent">Make it theirs</p>
        <h2 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
          Their photo
        </h2>
        <p className="max-w-md leading-relaxed text-muted">
          {active
            ? "Good light and a clear look at their face is all we need. We draw them once your order is in, and you see it before anything is printed."
            : "Choose a colour and size above to start their portrait."}
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="flex flex-col gap-3">
          <p className="eyebrow text-xs text-muted">Step 1 · Your photo</p>
          <UploadDropzone
            photoPreview={photoPreview}
            busy={phase === "uploading"}
            rejectReason={rejectReason}
            disabled={!active}
            onFile={handleFile}
          />
          {uploadError ? (
            <p role="alert" className="text-sm font-medium text-signal-error">
              {uploadError}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "flex flex-col gap-3 transition-opacity",
            styleDisabled && !artworkId && "opacity-60",
          )}
        >
          <p className="eyebrow text-xs text-muted">Step 2 · Your style</p>
          {!artworkId ? (
            <p className="text-sm text-muted">
              Upload a photo first, then pick a style.
            </p>
          ) : null}
          <StylePicker
            value={style}
            onSelect={setStyle}
            disabled={styleDisabled}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="eyebrow text-xs text-muted">Step 3 · Add to cart</p>
        <Button
          block
          size="md"
          onClick={handleAddToCart}
          disabled={!canAddToCart}
          aria-disabled={!canAddToCart}
          className="w-full sm:w-auto"
        >
          Add to cart
        </Button>
        {!artworkId ? (
          <p className="text-sm text-muted">
            Upload a photo of them to carry on.
          </p>
        ) : !style ? (
          <p className="text-sm text-muted">Pick a style to carry on.</p>
        ) : !profileReady ? (
          <p className="text-sm text-muted">
            We still need a few details about them further up the page.
          </p>
        ) : size === null ? (
          <p className="text-sm text-muted">Choose a size to add to cart.</p>
        ) : null}
      </div>
    </div>
  );
}
