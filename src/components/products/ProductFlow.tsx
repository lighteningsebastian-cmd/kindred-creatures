"use client";

import { useEffect, useRef, useState } from "react";
import { ProductConfigurator } from "./ProductConfigurator";
import { ProfileQuestions } from "./ProfileQuestions";
import { CompanionForm } from "./CompanionForm";
import { LivePreview } from "./LivePreview";
import { Customizer } from "@/components/customizer/Customizer";
import { Button } from "@/components/ui/Button";
import {
  checkCreatureName,
  logBreedRequest,
  previewPlates,
  saveArtworkDetails,
} from "@/app/products/[slug]/actions";
import { emptyProfile } from "@/lib/companion";
import type { ResumedArtwork } from "@/lib/artwork-resume";
import type { Product, Variant } from "@/lib/products";

export type ProductFlowProps = {
  product: Product;
  /** Colour from the `?color=` deep link, if present and valid. */
  initialColor?: string;
  /** Size from the `?size=` deep link, if present and valid. */
  initialSize?: string;
  /**
   * A cart line come back to be changed: the artwork, the answers they gave
   * and the photograph they sent. Null for a piece being started fresh.
   */
  resumed?: ResumedArtwork | null;
};

/**
 * The colourway shown while they are still answering questions.
 *
 * The product's own first colourway, chosen once and never changed under them
 * mid-flow: the plate should not appear to shift because we swapped the garment
 * beneath it while they were reading. This used to name "Stone", which stopped
 * existing when the catalogue took the photographed colours.
 */
function defaultColor(product: Product): Variant {
  return product.variants[0];
}

function resolveColor(product: Product, name?: string): Variant {
  return product.variants.find((v) => v.color === name) ?? defaultColor(product);
}

function resolveSize(color: Variant, size?: string): string | null {
  // A one-size product has nothing to choose, so it is settled from the start.
  if (color.sizes.length === 1) return color.sizes[0];
  return size && color.sizes.includes(size) ? size : null;
}

/** Where in the commission they are. Colour and size come AFTER the profile. */
type Stage = "profile" | "edit" | "reveal" | "colour" | "size" | "photo";

/**
 * The commission, in order, with the piece on screen the whole way.
 *
 * THE ORDER IS THE PRODUCT (docs/flow-review-2.md). Colour and size are
 * shopping; the profile is the commission. Asking for a size before they have
 * seen anything makes this a clothing purchase with a customisation step bolted
 * on. Asking about their animal first, and only then what they would like it on,
 * makes it a commission that happens to arrive as a hoodie. Same fields,
 * different product. It also puts the colour switcher where it does the most
 * work: choosing between five versions of their own finished plate rather than
 * five empty garments.
 *
 * THE LAYOUT IS WHAT MAKES THAT POSSIBLE. The preview is pinned for the whole
 * flow: sticky beside the form on desktop, and on a phone a fixed share of the
 * viewport at the top with the form scrolling in the space below it. It never
 * sits behind the preview and the preview never scrolls away, which is the bug
 * that made the page unusable on a phone. Heights are in dvh, so when a keyboard
 * opens the preview shrinks with the viewport instead of covering the field
 * being typed into.
 */
export function ProductFlow({
  product,
  initialColor,
  initialSize,
  resumed = null,
}: ProductFlowProps) {
  const startColor = resolveColor(product, initialColor);
  const [color, setColor] = useState<Variant>(startColor);
  const [size, setSize] = useState<string | null>(() =>
    resolveSize(startColor, initialSize),
  );
  const [profile, setProfile] = useState(
    () => resumed?.profile ?? emptyProfile(),
  );
  /**
   * AN EDIT OPENS AT THE PIECE, not at question one.
   *
   * Somebody who came back from the cart to change a size has already told us
   * about their dog, and walking them through it again to reach the size is the
   * behaviour that made the cart feel like a one-way door in the first place.
   * The reveal is the hub: their plate is on screen, "Change something" opens
   * every answer at once, and the colour, size and photograph are the steps
   * after it.
   */
  const [stage, setStage] = useState<Stage>(resumed ? "reveal" : "profile");

  // The flow fills whatever is left of the viewport BELOW the site header, so
  // the question and its Next button are reachable without scrolling. Measured
  // rather than assumed: hard-coding a header height is how the last row ends up
  // just off the bottom of a phone, which is the bug this replaces. dvh keeps it
  // honest when a keyboard opens, and once it fits exactly the page no longer
  // scrolls, so the measured offset stays put.
  const frame = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<string | undefined>();

  useEffect(() => {
    const measure = () => {
      const top = frame.current?.getBoundingClientRect().top ?? 0;
      setAvailable(`calc(100dvh - ${Math.max(0, Math.round(top))}px)`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const handleColorChange = (colorName: string) => {
    const next = resolveColor(product, colorName);
    setColor(next);
    if (next.sizes.length === 1) setSize(next.sizes[0]);
    else if (size !== null && !next.sizes.includes(size)) setSize(null);
  };

  return (
    <div
      ref={frame}
      style={{ ["--flow-h" as string]: available }}
      className={
        // Mobile: a bounded column so the form scrolls INSIDE its own space and
        // never behind the preview. Desktop: ordinary flow with a sticky aside.
        "flex h-[var(--flow-h,82dvh)] flex-col gap-4 overflow-hidden " +
        "lg:h-auto lg:flex-row-reverse lg:items-start lg:gap-12 lg:overflow-visible"
      }
    >
      <aside
        className={
          // A fixed share of what the flow was given, and it stays for the whole
          // flow. Shrinks with the viewport when a keyboard opens rather than
          // covering the field being typed into.
          "h-[46%] shrink-0 " +
          "lg:sticky lg:top-24 lg:h-[70vh] lg:w-[38%]"
        }
      >
        <LivePreview
          profile={profile}
          product={product}
          color={color}
          render={previewPlates}
        />
      </aside>

      <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-visible [&>section]:h-full">
        {stage === "profile" ? (
          <ProfileQuestions
            profile={profile}
            onChange={setProfile}
            checkName={checkCreatureName}
            onBreedMiss={(query) => logBreedRequest(query, profile.species)}
            onComplete={() => setStage("reveal")}
          />
        ) : null}

        {stage === "edit" ? (
          <CompanionForm
            profile={profile}
            onChange={setProfile}
            checkName={checkCreatureName}
            onBreedMiss={(query) => logBreedRequest(query, profile.species)}
            onDone={() => setStage("reveal")}
          />
        ) : null}

        {stage === "reveal" ? (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="eyebrow text-xs text-accent">Their piece</p>
              <h2 className="font-display text-2xl leading-[1.15] text-ink md:text-3xl">
                {profile.name?.trim()
                  ? `Here is ${profile.name.trim()}'s piece.`
                  : "Here is their piece."}
              </h2>
              <p className="max-w-md leading-relaxed text-muted">
                {resumed
                  ? "Change anything you like: what we know about them, the colour, the size, or the photo you sent."
                  : "Front and back. Have a look at both, then choose the colour you would like it on."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={() => setStage("colour")}>
                Choose a colour
              </Button>
              {/*
                EDITING IS NOT THE QUESTION RUN AGAIN. This used to send them
                back to "profile", which restarts the one-at-a-time questions at
                question one, so somebody who wanted to fix a year had to walk
                past every other answer to reach it. A first run is a
                conversation; a correction wants everything on screen at once.
              */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStage("edit")}
              >
                Change something
              </Button>
            </div>
          </section>
        ) : null}

        {stage === "colour" ? (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="eyebrow text-xs text-accent">The garment</p>
              <h2 className="font-display text-2xl leading-[1.15] text-ink md:text-3xl">
                Which one suits them?
              </h2>
            </div>
            {/* The switcher earns its place here: five versions of THEIR plate. */}
            <ProductConfigurator
              product={product}
              color={color}
              size={size}
              onColorChange={handleColorChange}
              onSizeChange={setSize}
              only="colour"
            />
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={() => setStage("size")}>
                Next
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStage("reveal")}
              >
                Back
              </Button>
            </div>
          </section>
        ) : null}

        {stage === "size" ? (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="eyebrow text-xs text-accent">The garment</p>
              <h2 className="font-display text-2xl leading-[1.15] text-ink md:text-3xl">
                What size?
              </h2>
            </div>
            <ProductConfigurator
              product={product}
              color={color}
              size={size}
              onColorChange={handleColorChange}
              onSizeChange={setSize}
              only="size"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                disabled={size === null}
                onClick={() => setStage("photo")}
              >
                Next
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStage("colour")}
              >
                Back
              </Button>
            </div>
          </section>
        ) : null}

        {stage === "photo" ? (
          <Customizer
            product={product}
            color={color}
            size={size}
            profile={profile}
            save={saveArtworkDetails}
            resumed={resumed}
          />
        ) : null}
      </div>
    </div>
  );
}
