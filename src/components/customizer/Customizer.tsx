"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatZar, type Product, type Variant } from "@/lib/products";
import type { ArtStyle } from "@/lib/images/provider";
import { setPendingCartItem } from "@/lib/pending-cart";
import { downscaleImage } from "./downscale";
import { UploadDropzone } from "./UploadDropzone";
import { StylePicker } from "./StylePicker";
import { PreviewStage } from "./PreviewStage";

export type CustomizerProps = {
  product: Product;
  /** Colour carried from the product page, if present and valid. */
  initialColor?: string;
  /** Size carried from the product page, if present and valid. */
  initialSize?: string;
};

type Phase =
  | "idle" // no photo yet
  | "uploading" // upload + moderation in flight
  | "uploaded" // photo accepted, awaiting a style
  | "generating" // preview being drawn
  | "ready" // preview ready
  | "failed"; // generation failed

function resolveInitialColor(product: Product, name?: string): Variant {
  return (
    product.variants.find((v) => v.color === name) ?? product.variants[0]
  );
}

function resolveInitialSize(color: Variant, size?: string): string | null {
  if (color.sizes.length === 1) return color.sizes[0];
  return size && color.sizes.includes(size) ? size : null;
}

/**
 * Client island owning the whole customizer flow: photo upload and moderation,
 * style selection and preview generation (capped at three tries), and the
 * hand-off to the cart. Runs entirely against the mock provider with no keys.
 */
export function Customizer({
  product,
  initialColor,
  initialSize,
}: CustomizerProps) {
  const router = useRouter();

  const [color, setColor] = useState<Variant>(() =>
    resolveInitialColor(product, initialColor),
  );
  const [size, setSize] = useState<string | null>(() =>
    resolveInitialSize(resolveInitialColor(product, initialColor), initialSize),
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [artworkId, setArtworkId] = useState<string | null>(null);
  const [style, setStyle] = useState<ArtStyle | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const objectUrlRef = useRef<string | null>(null);

  const changeColor = (name: string) => {
    const next =
      product.variants.find((v) => v.color === name) ?? product.variants[0];
    setColor(next);
    if (next.sizes.length === 1) setSize(next.sizes[0]);
    else if (size && !next.sizes.includes(size)) setSize(null);
  };

  const generate = useCallback(
    async (id: string, chosen: ArtStyle) => {
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
      } catch {
        setPhase("failed");
      }
    },
    [],
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
    void generate(artworkId, next);
  };

  const handleRegenerate = () => {
    if (!artworkId || !style || phase === "generating" || atCap) return;
    void generate(artworkId, style);
  };

  const canAddToCart =
    phase === "ready" && !!previewUrl && !!artworkId && size !== null;

  const handleAddToCart = () => {
    if (!canAddToCart || !artworkId || !size) return;
    setPendingCartItem({
      productSlug: product.slug,
      color: color.color,
      size,
      artworkId,
    });
    router.push("/cart");
  };

  const styleDisabled =
    !artworkId || phase === "uploading" || phase === "generating" || atCap;

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
          <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
            {product.name}
          </h1>
          <p className="text-lg font-medium text-ink">
            {formatZar(color.priceZar)}
          </p>
        </div>

        {/* Garment / colour / size context (editable inline). */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-ink">
              Colour: <span className="text-muted">{color.color}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {product.variants.map((variant) => {
                const selected = variant.color === color.color;
                return (
                  <button
                    key={variant.color}
                    type="button"
                    onClick={() => changeColor(variant.color)}
                    aria-pressed={selected}
                    aria-label={variant.color}
                    title={variant.color}
                    className={cn(
                      "h-9 w-9 rounded-md border border-line transition-[box-shadow,transform] active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                      selected &&
                        "ring-2 ring-accent ring-offset-2 ring-offset-base",
                    )}
                    style={{ backgroundColor: variant.colorHex }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-ink">Size</p>
            <div className="flex flex-wrap gap-2">
              {color.sizes.map((option) => {
                const selected = option === size;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSize(option)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                      selected
                        ? "border-ink bg-ink text-base"
                        : "border-line text-ink hover:bg-surface",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step 1: upload */}
        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <p className="eyebrow text-xs text-muted">Step 1 · Your photo</p>
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
