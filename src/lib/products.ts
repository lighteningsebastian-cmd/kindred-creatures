export type ProductSlug = "hoodie" | "tee" | "crewneck" | "tote";

/** How a garment is cut. The tote has no fit, so it carries none. */
export type Fit = "unisex" | "womens";

export const FIT_LABELS: Record<Fit, string> = {
  unisex: "Unisex fit",
  womens: "Women's fit",
};

export interface Variant {
  color: string;
  colorHex: string;
  sizes: string[];
  priceZar: number;
}

export interface PrintArea {
  widthMm: number;
  heightMm: number;
}

export interface Product {
  slug: ProductSlug;
  name: string;
  blurb: string;
  /** Absent on the tote, which is not worn. */
  fit?: Fit;
  variants: Variant[];
  /**
   * The two print areas, which are genuinely different shapes.
   *
   * The back is the large archival plate. The front is the left-chest patch,
   * and it needs its OWN entry rather than a fraction of the back: the owner's
   * measurements make it 110 by 150mm, which is not the back's proportion
   * (docs/spec-print-layout.md section 1). A single printArea was the back's,
   * and the front was being derived as a third of the print width, which is a
   * different number and a different shape.
   */
  printArea: { front: PrintArea; back: PrintArea };
}

/**
 * Every colourway here has a photograph in public/garments/<slug>/<dir>/, and
 * that is not a coincidence: a swatch with no photograph behind it shows an
 * empty frame on a R999 product, which reads as a broken page.
 *
 * The hex values are SAMPLED FROM THE PHOTOGRAPHS, from the middle of the chest
 * where the fabric is neither in highlight nor in shadow, so the swatch a
 * customer taps is the colour of the garment they will be sent rather than a
 * designer's guess at it.
 *
 * Washed Black and Bush Green are deliberately absent. Neither has photography,
 * and Washed Black cannot launch at all until the printer says how dark
 * garments are handled: graphite ink on near-black fabric is close to invisible.
 * That question is still open with Red Hot Prints.
 */

/** The apparel size runs. The crewneck is cut smaller and stops at XL. */
const SIZES_TO_XXL = ["XS", "S", "M", "L", "XL", "XXL"];
const SIZES_TO_XL = ["XS", "S", "M", "L", "XL"];

/**
 * The front print, identical across the three garments: 110mm wide by 150mm
 * tall, centred on the left chest with its top 80 to 90mm below the shoulder
 * seam (docs/spec-print-layout.md section 1).
 */
export const FRONT_PRINT: PrintArea = { widthMm: 110, heightMm: 150 };

export const PRODUCTS: Product[] = [
  {
    slug: "hoodie",
    name: "The Kindred Hoodie",
    fit: "unisex",
    blurb:
      "A heavyweight brushed-cotton hoodie carrying your pet's portrait, soft enough to live in and warm enough to earn a spot by the fire.",
    variants: [
      { color: "Blue", colorHex: "#657188", sizes: SIZES_TO_XXL, priceZar: 999 },
      { color: "Lilac", colorHex: "#A898A6", sizes: SIZES_TO_XXL, priceZar: 999 },
      { color: "White", colorHex: "#F3EFE9", sizes: SIZES_TO_XXL, priceZar: 999 },
    ],
    printArea: { front: FRONT_PRINT, back: { widthMm: 280, heightMm: 350 } },
  },
  {
    slug: "tee",
    name: "The Kindred Tee",
    fit: "unisex",
    blurb:
      "A midweight organic-cotton tee with a portrait that holds its detail wash after wash, cut for everyday wear that feels like a favourite already.",
    variants: [
      { color: "White", colorHex: "#F5F5F9", sizes: SIZES_TO_XXL, priceZar: 599 },
      { color: "Olive", colorHex: "#605D2D", sizes: SIZES_TO_XXL, priceZar: 599 },
      {
        color: "Heritage Blue",
        colorHex: "#94BDD5",
        sizes: SIZES_TO_XXL,
        priceZar: 599,
      },
    ],
    printArea: { front: FRONT_PRINT, back: { widthMm: 250, heightMm: 300 } },
  },
  {
    slug: "crewneck",
    name: "The Kindred Crewneck",
    fit: "womens",
    blurb:
      "A structured loop-back crewneck that frames your pet's portrait with room to breathe, the kind of sweater you reach for without thinking.",
    variants: [
      { color: "White", colorHex: "#F3F0EC", sizes: SIZES_TO_XL, priceZar: 799 },
      { color: "Peach", colorHex: "#FBC1A3", sizes: SIZES_TO_XL, priceZar: 799 },
      { color: "Grey", colorHex: "#B9B9B9", sizes: SIZES_TO_XL, priceZar: 799 },
      { color: "Olive", colorHex: "#656B52", sizes: SIZES_TO_XL, priceZar: 799 },
    ],
    printArea: { front: FRONT_PRINT, back: { widthMm: 280, heightMm: 350 } },
  },
  {
    // Deferred, and knowingly incomplete: no photography, no plate placement and
    // no print layout of its own (docs/spec-print-layout.md). It stays in the
    // range because the shop is still being built and pulling it would be
    // undoing work that a shot list will finish. Nothing here is a promise to a
    // customer yet; the site is not live.
    slug: "tote",
    name: "The Kindred Tote",
    blurb:
      "A sturdy canvas tote that takes your pet's portrait to the market, the studio and everywhere in between, with handles built for a full load.",
    variants: [
      {
        color: "Natural",
        colorHex: "#E5DFD2",
        sizes: ["One size"],
        priceZar: 349,
      },
    ],
    printArea: { front: FRONT_PRINT, back: { widthMm: 260, heightMm: 300 } },
  },
];

/**
 * Formats an integer rand amount for display, thousands separated by a thin
 * space: 899 => "R 899", 1299 => "R 1 299". Input is whole rands, not cents.
 */
export function formatZar(amount: number): string {
  const whole = Math.round(amount);
  const sign = whole < 0 ? "-" : "";
  const digits = Math.abs(whole).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}R ${grouped}`;
}

/**
 * Converts one of a product's print areas from millimetres to pixels at 300
 * DPI, rounded to whole pixels. Formula per axis: mm / 25.4 * 300.
 *
 * The side is required rather than defaulted: the front and the back are
 * different shapes, and a caller that forgets which one it wanted is a caller
 * that prints a chest patch at plate size.
 */
export function printPixels(
  product: Product,
  side: "front" | "back",
): {
  widthPx: number;
  heightPx: number;
} {
  const area = product.printArea[side];
  const toPx = (mm: number) => Math.round((mm / 25.4) * 300);
  return {
    widthPx: toPx(area.widthMm),
    heightPx: toPx(area.heightMm),
  };
}

/** Looks up a product by slug, or returns undefined for an unknown slug. */
export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

/** Lowest variant price for a product, used for "from R x" labels. */
export function fromPriceZar(product: Product): number {
  return Math.min(...product.variants.map((variant) => variant.priceZar));
}
