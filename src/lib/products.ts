export type ProductSlug = "hoodie" | "tee" | "crewneck" | "tote";

export interface Variant {
  color: string;
  colorHex: string;
  sizes: string[];
  priceZar: number;
}

export interface Product {
  slug: ProductSlug;
  name: string;
  blurb: string;
  variants: Variant[];
  printArea: { widthMm: number; heightMm: number };
}

// NOTE: all priceZar values below are PLACEHOLDERS pending final print-shop
// costing. Do not treat as commercial pricing until confirmed with the Cape
// Town print partner.
const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export const PRODUCTS: Product[] = [
  {
    slug: "hoodie",
    name: "The Kindred Hoodie",
    blurb:
      "A heavyweight brushed-cotton hoodie carrying your pet's portrait, soft enough to live in and warm enough to earn a spot by the fire.",
    variants: [
      { color: "Stone", colorHex: "#D6D3CB", sizes: APPAREL_SIZES, priceZar: 899 },
      { color: "Charcoal", colorHex: "#3A3E44", sizes: APPAREL_SIZES, priceZar: 899 },
      { color: "Olive", colorHex: "#6B6F55", sizes: APPAREL_SIZES, priceZar: 899 },
    ],
    printArea: { widthMm: 280, heightMm: 350 },
  },
  {
    slug: "tee",
    name: "The Kindred Tee",
    blurb:
      "A midweight organic-cotton tee with a portrait that holds its detail wash after wash, cut for everyday wear that feels like a favourite already.",
    variants: [
      { color: "Stone", colorHex: "#D6D3CB", sizes: APPAREL_SIZES, priceZar: 449 },
      { color: "Charcoal", colorHex: "#3A3E44", sizes: APPAREL_SIZES, priceZar: 449 },
      { color: "Olive", colorHex: "#6B6F55", sizes: APPAREL_SIZES, priceZar: 449 },
      { color: "Ecru", colorHex: "#EDE8DD", sizes: APPAREL_SIZES, priceZar: 449 },
    ],
    printArea: { widthMm: 250, heightMm: 300 },
  },
  {
    slug: "crewneck",
    name: "The Kindred Crewneck",
    blurb:
      "A structured loop-back crewneck that frames your pet's portrait with room to breathe, the kind of sweater you reach for without thinking.",
    variants: [
      { color: "Stone", colorHex: "#D6D3CB", sizes: APPAREL_SIZES, priceZar: 749 },
      { color: "Charcoal", colorHex: "#3A3E44", sizes: APPAREL_SIZES, priceZar: 749 },
    ],
    printArea: { widthMm: 280, heightMm: 350 },
  },
  {
    slug: "tote",
    name: "The Kindred Tote",
    blurb:
      "A sturdy canvas tote that takes your pet's portrait to the market, the studio and everywhere in between, with handles built for a full load.",
    variants: [
      { color: "Natural", colorHex: "#E5DFD2", sizes: ["One size"], priceZar: 349 },
    ],
    printArea: { widthMm: 260, heightMm: 300 },
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
 * Converts a product's print area from millimetres to pixels at 300 DPI,
 * rounded to whole pixels. Formula per axis: mm / 25.4 * 300.
 */
export function printPixels(product: Product): {
  widthPx: number;
  heightPx: number;
} {
  const toPx = (mm: number) => Math.round((mm / 25.4) * 300);
  return {
    widthPx: toPx(product.printArea.widthMm),
    heightPx: toPx(product.printArea.heightMm),
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
