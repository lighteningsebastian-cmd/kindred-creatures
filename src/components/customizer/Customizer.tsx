"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { type Product, type Variant } from "@/lib/products";
import type { ArtStyle } from "@/lib/images/provider";
import { useCartStore } from "@/lib/cart-store";
import {
  trackAddToCart,
  trackArtGenerated,
  trackArtRegenerated,
  trackPhotoUploaded,
} from "@/lib/analytics";
import { downscaleImage } from "./downscale";
import { UploadDropzone } from "./UploadDropzone";
import { StylePicker } from "./StylePicker";
import { PreviewStage } from "./PreviewStage";

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
};

type Phase =
  | "idle" // no photo yet
  | "uploading" // upload + moderation in flight
  | "uploaded" // photo accepted, awaiting a style
  | "generating" // preview being drawn
  | "ready" // preview ready
  | "failed"; // generation failed

/**
 * The portrait half of the product flow: photo upload and moderation, style
 * selection and preview generation (capped at three tries), and the hand-off to
 * the cart. Colour and size are owned by the parent {@link ProductFlow} and
 * arrive as props, so switching them never disturbs an artwork already made
 * (the art is garment-agnostic) and the cart line is always built from the
 * CURRENT selection. Runs entirely against the mock provider with no keys.
 */
export function Customizer({ product, color, size, active }: CustomizerProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const [phase, setPhase] = useState<Phase>("idle");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [artworkId, setArtworkId] = useState<string | null>(null);
  const [style, setStyle] = useState<ArtStyle | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const objectUrlRef = useRef<string | null>(null);

  const generate = useCallback(
    async (id: string, chosen: ArtStyle, kind: "generate" | "regenerate") => {
      setPhase("generating");
      setUploadError(null);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artworkId: id, style: chosen }),
        });
        const data = await res.json();
        if (res.status === 429) {
          // Out of tries: keep the last preview, surface the cap state.
          setRemaining(0);
          setPhase("ready");
          return;
        }
        if (!res.ok) {
          setPhase("failed");
          return;
        }
        setPreviewUrl(data.previewUrl);
        setRemaining(data.remaining);
        setPhase("ready");
        // Fired only on a portrait that actually drew: the first draw from a
        // chosen style is a generate, the Regenerate button is a regenerate.
        if (kind === "generate") {
          trackArtGenerated({ slug: product.slug, style: chosen });
        } else {
          trackArtRegenerated({ slug: product.slug, style: chosen });
        }
      } catch {
        setPhase("failed");
      }
    },
    [product.slug],
  );

  const handleFile = useCallback(
    async (file: File) => {
      // A new photo resets the portrait state entirely.
      setRejectReason(null);
      setUploadError(null);
      setArtworkId(null);
      setStyle(null);
      setPreviewUrl(null);
      setRemaining(null);

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

  // Every generation, including the first pick of a style, spends one of the
  // three tries the server allows per photo. At zero, both entry points lock.
  const atCap = remaining !== null && remaining <= 0;

  const handleSelectStyle = (next: ArtStyle) => {
    if (!artworkId || phase === "generating" || atCap) return;
    setStyle(next);
    void generate(artworkId, next, "generate");
  };

  const handleRegenerate = () => {
    if (!artworkId || !style || phase === "generating" || atCap) return;
    void generate(artworkId, style, "regenerate");
  };

  const canAddToCart =
    phase === "ready" && !!previewUrl && !!artworkId && size !== null;

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

  const styleDisabled =
    !active ||
    !artworkId ||
    phase === "uploading" ||
    phase === "generating" ||
    atCap;

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      {/* Preview: garment with the portrait composited in. */}
      <div className="order-2 flex flex-col gap-4 md:order-1">
        <PreviewStage
          product={product}
          color={color.color}
          previewUrl={previewUrl}
          loading={phase === "generating"}
          failed={phase === "failed"}
          remaining={remaining}
          onRegenerate={handleRegenerate}
        />
      </div>

      {/* Controls */}
      <div className="order-1 flex flex-col gap-8 md:order-2">
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-xs text-accent">Make it theirs</p>
          <h2 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
            Their portrait
          </h2>
          <p className="max-w-md leading-relaxed text-muted">
            {active
              ? "Upload a favourite photo, pick a style, and see it on the piece before you order."
              : "Choose a colour and size above to start their portrait."}
          </p>
        </div>

        {/* Step 1: upload */}
        <div className="flex flex-col gap-3 border-t border-line pt-6">
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

        {/* Step 2: style */}
        <div
          className={cn(
            "flex flex-col gap-3 border-t border-line pt-6 transition-opacity",
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
            onSelect={handleSelectStyle}
            disabled={styleDisabled}
          />
        </div>

        {/* Step 3: add to cart */}
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
          {phase === "ready" && previewUrl && size === null ? (
            <p className="text-sm text-muted">Choose a size to add to cart.</p>
          ) : !previewUrl ? (
            <p className="text-sm text-muted">
              Your portrait preview shows here once it is ready.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
