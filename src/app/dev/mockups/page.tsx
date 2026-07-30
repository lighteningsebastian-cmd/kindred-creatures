import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PRODUCTS } from "@/lib/products";
import {
  PLACEMENT,
  garmentImageUrl,
  standInColours,
  type GarmentSide,
} from "@/lib/garments";
import { backPlate, frontPlate } from "@/lib/print/plate";
import { emptyProfile, type CompanionProfile } from "@/lib/companion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIDES: GarmentSide[] = ["front", "back"];

/**
 * The placement calibration tool. Not a deliverable.
 *
 * Every product, colour and side on one screen with a real plate on it, because
 * placement is a percentage judged by eye and doing that one order at a time is
 * how it stays wrong. The front plate has to sit above the pocket seam and clear
 * of the hood drawstrings; the back has to be centred between the shoulder seams
 * and stop short of the hem. Adjust PLACEMENT in src/lib/garments.ts and reload.
 *
 * The plate carries a worst case on purpose: a long name and every table row, so
 * a plate that fits here fits anything a customer can enter.
 */
export default function MockupsPage() {
  // Never shipped to customers: a dev tool behind a route nobody links to is
  // still a route, so it refuses to exist in production.
  if (process.env.NODE_ENV === "production") notFound();

  const worstCase: CompanionProfile = {
    ...emptyProfile("dog"),
    name: "Bartholomew",
    breedId: "staffordshire-bull-terrier",
    temperament: ["confident", "affectionate", "spirited"],
    togetherSince: 2021,
  };

  return (
    <Container className="py-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl text-ink">Plate placement</h1>
        <p className="max-w-2xl text-sm text-muted">
          Every product, colour and side, with a worst-case plate on it. Adjust{" "}
          <code>PLACEMENT</code> in <code>src/lib/garments.ts</code> and reload.
          The front plate should clear the drawstrings and sit above the pocket
          seam; the back should be centred between the shoulder seams and stop
          short of the hem.
        </p>
      </div>

      {PRODUCTS.map((product) => {
        const standIns = standInColours(product.slug);
        return (
          <section key={product.slug} className="mt-12 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-2xl text-ink">{product.name}</h2>
              <p className="text-xs text-muted">
                front {JSON.stringify(PLACEMENT[product.slug].front)} · back{" "}
                {JSON.stringify(PLACEMENT[product.slug].back)}
              </p>
              {standIns.length > 0 ? (
                <p className="text-xs text-btn">
                  No photography of its own:{" "}
                  {standIns
                    .map((s) => `${s.color} (showing ${s.showing})`)
                    .join(", ")}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {product.variants.flatMap((variant) =>
                SIDES.map((side) => {
                  const garment = garmentImageUrl(
                    product.slug,
                    variant.color,
                    side,
                  );
                  const placement = PLACEMENT[product.slug][side];
                  const plate =
                    side === "back"
                      ? backPlate(worstCase, "KC-01248", 900, 1125)
                      : frontPlate(worstCase, 600, 600);
                  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(plate.svg)}`;

                  return (
                    <figure
                      key={`${variant.color}-${side}`}
                      className="flex flex-col gap-1"
                    >
                      <div
                        className="relative overflow-hidden rounded-md border border-line bg-surface"
                        style={{ aspectRatio: "4 / 5" }}
                      >
                        {garment ? (
                          <Image
                            src={garment}
                            alt=""
                            fill
                            sizes="25vw"
                            className="object-cover"
                          />
                        ) : (
                          <div
                            className="absolute inset-0"
                            style={{ backgroundColor: variant.colorHex }}
                          />
                        )}
                        <div
                          className="absolute"
                          style={{
                            top: `${placement.top}%`,
                            left: `${placement.left}%`,
                            width: `${placement.width}%`,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full" />
                        </div>
                      </div>
                      <figcaption className="text-xs text-muted">
                        {variant.color} · {side}
                        {garment ? "" : " · no photo"}
                      </figcaption>
                    </figure>
                  );
                }),
              )}
            </div>
          </section>
        );
      })}
    </Container>
  );
}
