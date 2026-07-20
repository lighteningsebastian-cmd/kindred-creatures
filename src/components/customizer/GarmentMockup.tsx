import { Skeleton } from "@/components/ui/Skeleton";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { type Product } from "@/lib/products";

export type GarmentMockupProps = {
  product: Product;
  color: string;
  /** Signed preview URL to composite into the print area, if ready. */
  previewUrl?: string | null;
  /** Render a skeleton in the print area (generation in flight). */
  loading?: boolean;
};

/**
 * The garment photo with the portrait composited into its print area. Placement
 * is approximate (CSS-positioned over the shot), sized from the product's print
 * aspect ratio; the owner fine-tunes per garment later.
 */
export function GarmentMockup({
  product,
  color,
  previewUrl,
  loading = false,
}: GarmentMockupProps) {
  const printAspect =
    product.printArea.widthMm / product.printArea.heightMm;

  // Approximate print-area box over the garment shot: centred, upper-middle.
  const boxWidthPct = 40;
  const boxStyle: React.CSSProperties = {
    width: `${boxWidthPct}%`,
    aspectRatio: `${printAspect}`,
    top: "26%",
    left: "50%",
    transform: "translateX(-50%)",
  };

  return (
    <div className="relative aspect-[4/5] w-full">
      {/* Garment base: the hatched frame stands in for the real garment shot;
          the portrait preview composites on top exactly as before. */}
      <PhotoFrame
        aspect="4 / 5"
        description={`flatlay: the ${product.name.replace(/^The /, "").toLowerCase()} in ${color}, plain blank, ready for the portrait to be placed`}
        className="absolute inset-0 h-full"
      />

      <div className="pointer-events-none absolute" style={boxStyle}>
        {loading ? (
          <Skeleton className="h-full w-full rounded-md" />
        ) : previewUrl ? (
          // Signed, short-lived URL from our asset route; plain img avoids the
          // next/image loader for a transient token-bearing source.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`Your portrait on the ${product.name}`}
            className="h-full w-full rounded-sm object-contain shadow-[var(--shadow-card)]"
          />
        ) : null}
      </div>
    </div>
  );
}
