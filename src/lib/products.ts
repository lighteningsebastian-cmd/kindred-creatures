export type ProductSlug = "hoodie" | "tee" | "crewneck" | "tote";

/**
 * How a garment is cut.
 *
 * "unisex" is not a third option alongside the other two: it means the garment
 * has one cut for everyone, and a product whose only fit is unisex must not
 * render a fit selector at all.
 */
export type Fit = "unisex" | "womens" | "mens";

export const FIT_LABELS: Record<Fit, string> = {
  unisex: "Unisex fit",
  womens: "Women's fit",
  mens: "Men's fit",
};

export interface Variant {
  color: string;
  /**
   * How this one is cut.
   *
   * ON THE VARIANT AND NOT THE PRODUCT, because a fit carries its own blank
   * cost, its own size run and potentially its own price: the women's crewneck
   * blank costs R290 and the men's R350. Modelled as a label on the product,
   * those facts are unrepresentable, and so is one garment sold in two cuts.
   */
  fit: Fit;
  colorHex: string;
  /**
   * This variant's photo directory, under public/garments/<slug>/.
   *
   * THE CATALOGUE'S WORD AND THE SHOOT'S WORD ARE NOT ALWAYS THE SAME, and this
   * field is the one place they are reconciled. The tote's canvas is Natural
   * here and beige on disk, and the directory keeps the shoot's word rather
   * than the import script quietly renaming the file, so someone grepping for
   * "beige" after looking at Stock Images finds it.
   *
   * It lives on the VARIANT rather than in a map beside the photographs because
   * the variant is the thing that has a photograph. A map keyed on colour name
   * cannot hold two garments that share a colour, which is exactly what a
   * men's and a women's White are.
   */
  photoDir: string;
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

/**
 * THE FIRST VARIANT IS THE DEFAULT COLOURWAY, and it is load-bearing.
 *
 * `ProductFlow` and `ReorderFlow` both start at `variants[0]`, so the order of
 * this array is the answer to "which colourway does the customer see while
 * they are answering the profile questions" (docs/flow-review-2.md). Owner,
 * 5 August: **White, on every garment.** Reordering a variants array is
 * therefore a product decision, not tidying.
 *
 * It reaches further than the swatch. `photoAspect()` is per COLOURWAY AND
 * PER VIEW rather than per product, because the shoot was not consistent (see
 * the note in lib/garments.ts), so the default colourway also decides the
 * SHAPE of the preview box the whole flow renders into.
 */

/** The apparel size runs. The crewneck is cut smaller and stops at XL. */
const SIZES_TO_XXL = ["XS", "S", "M", "L", "XL", "XXL"];
/**
 * THE WOMEN'S RUN STOPS AT XL, and this is its own constant rather than a
 * shared one so it cannot quietly gain a 2XL when the men's does. The
 * supplier's women's range has none, and offering a size that cannot be
 * supplied, on a personalised garment that cannot be returned, is a refund
 * waiting to happen.
 */
const WOMENS_SIZES = ["XS", "S", "M", "L", "XL"];

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
    blurb:
      "A heavyweight brushed-cotton hoodie carrying your pet's portrait, soft enough to live in and warm enough to earn a spot by the fire.",
    // White first: it is the default colourway. See THE FIRST VARIANT IS THE
    // DEFAULT above.
    variants: [
      {
        color: "White",
        fit: "unisex",
        colorHex: "#F3EFE9",
        photoDir: "unisex/white",
        sizes: SIZES_TO_XXL,
        priceZar: 999,
      },
      {
        color: "Blue",
        fit: "unisex",
        colorHex: "#657188",
        photoDir: "unisex/blue",
        sizes: SIZES_TO_XXL,
        priceZar: 999,
      },
      {
        color: "Lilac",
        fit: "unisex",
        colorHex: "#A898A6",
        photoDir: "unisex/lilac",
        sizes: SIZES_TO_XXL,
        priceZar: 999,
      },
    ],
    printArea: { front: FRONT_PRINT, back: { widthMm: 280, heightMm: 350 } },
  },
  {
    // Men's first, because the first variant is the leading fit and the men's
    // block is what the home tile has always shown.
    slug: "tee",
    name: "The Kindred Tee",
    blurb:
      "A midweight organic-cotton tee with a portrait that holds its detail wash after wash, cut for everyday wear that feels like a favourite already.",
    variants: [
      {
        color: "White",
        fit: "mens",
        colorHex: "#F5F5F9",
        photoDir: "mens/white",
        sizes: SIZES_TO_XXL,
        priceZar: 599,
      },
      {
        color: "Olive",
        fit: "mens",
        colorHex: "#605D2D",
        photoDir: "mens/olive",
        sizes: SIZES_TO_XXL,
        priceZar: 599,
      },
      {
        color: "Heritage Blue",
        fit: "mens",
        colorHex: "#94BDD5",
        photoDir: "mens/heritage-blue",
        sizes: SIZES_TO_XXL,
        priceZar: 599,
      },
      /*
       * The women's tee, on the supplier's TANNER block. Its colourway names
       * are the shoot's, and they are the one thing here the owner has not
       * confirmed: the folder says "Winter White" while the files say "white",
       * and these sit beside a men's tee in plain White. Changing a retail
       * name is one line each and touches nothing else, because photoDir
       * carries the directory.
       *
       * The hexes are sampled from the middle of the chest of each of these
       * photographs, as the convention above requires.
       */
      {
        color: "Winter White",
        fit: "womens",
        colorHex: "#F6F0EB",
        photoDir: "womens/white",
        sizes: WOMENS_SIZES,
        priceZar: 599,
      },
      {
        color: "Peach",
        fit: "womens",
        colorHex: "#FDC5A8",
        photoDir: "womens/peach",
        sizes: WOMENS_SIZES,
        priceZar: 599,
      },
      {
        color: "Blue",
        fit: "womens",
        colorHex: "#5DBEF4",
        photoDir: "womens/blue",
        sizes: WOMENS_SIZES,
        priceZar: 599,
      },
    ],
    printArea: { front: FRONT_PRINT, back: { widthMm: 250, heightMm: 300 } },
  },
  {
    /*
     * THE GARMENT THIS WHOLE BRANCH EXISTS FOR. Grey and Olive were sold as a
     * "Women's fit" crewneck over photographs of the men's sweater, because
     * the importer had stripped the fit out of their filenames. They are the
     * men's crewneck, and they always were.
     *
     * Women's first: the first variant is the leading fit, and the home tile
     * has always shown the women's sweater.
     *
     * TWO WHITES, a hundred rand apart, on different blocks and at different
     * shapes. That is the pair no colour-keyed lookup could ever have held.
     */
    slug: "crewneck",
    name: "The Kindred Crewneck",
    blurb:
      "A structured loop-back crewneck that frames your pet's portrait with room to breathe, the kind of sweater you reach for without thinking.",
    variants: [
      {
        color: "White",
        fit: "womens",
        colorHex: "#F3F0EC",
        photoDir: "womens/white",
        sizes: WOMENS_SIZES,
        priceZar: 799,
      },
      {
        color: "Peach",
        fit: "womens",
        colorHex: "#FBC1A3",
        photoDir: "womens/peach",
        sizes: WOMENS_SIZES,
        priceZar: 799,
      },
      // Pea Green belongs here and is absent on purpose: the shoot covered its
      // front only, and the back is where the plate goes.
      {
        // New to the catalogue. It had nowhere to go while crewneck/white held
        // the women's photograph, so it has never been on the site.
        color: "White",
        fit: "mens",
        colorHex: "#F1EBE6",
        photoDir: "mens/white",
        sizes: SIZES_TO_XXL,
        priceZar: 899,
      },
      {
        color: "Grey",
        fit: "mens",
        colorHex: "#B9B9B9",
        photoDir: "mens/grey",
        sizes: SIZES_TO_XXL,
        priceZar: 899,
      },
      {
        color: "Olive",
        fit: "mens",
        colorHex: "#656B52",
        photoDir: "mens/olive",
        sizes: SIZES_TO_XXL,
        priceZar: 899,
      },
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
        fit: "unisex",
        colorHex: "#E5DFD2",
        photoDir: "unisex/beige",
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

/**
 * The distinct fits a product actually offers, in variant order.
 *
 * Variant order, not alphabetical: the first variant is the default colourway
 * and therefore its fit is the one a product leads with, on the home tile and
 * on the product page. Reordering the variants array moves it.
 */
export function fitsFor(product: Product): Fit[] {
  return [...new Set(product.variants.map((variant) => variant.fit))];
}

/**
 * Whether this product needs a fit selector at all.
 *
 * False where a garment has one cut for everyone, and then the right interface
 * is nothing: no pill, no disabled control. Silence is the correct interface
 * for a choice that does not exist.
 */
export function hasFitChoice(product: Product): boolean {
  return fitsFor(product).length > 1;
}

/** The variants of a product cut this way. */
export function variantsForFit(product: Product, fit: Fit): Variant[] {
  return product.variants.filter((variant) => variant.fit === fit);
}

/**
 * The fit a page opens on, from a URL that may name one.
 *
 * A catalogue card links to /products/tee?fit=womens, so the flow has to be
 * able to start on a fit. Anything we cannot honour falls back to the
 * product's first rather than failing: the parameter sits in a link anyone can
 * edit, and the canonical URL carries no parameters at all, so this is a
 * preselection and never a promise.
 *
 * IT LIVES HERE, beside the rest of the catalogue, and not in ProductFlow.
 * It did, and ProductFlow is a client component: the product page called it
 * from the server and every request to /products/[slug] answered 500. Nothing
 * caught that. The build compiles the page, the unit tests import the function
 * directly, and only loading the page in a browser fails. A pure function over
 * the catalogue belongs with the catalogue.
 */
export function resolveFit(product: Product, name?: string): Fit {
  const offered = fitsFor(product);
  return offered.find((fit) => fit === name) ?? offered[0]!;
}

/**
 * Which garment a line is, for a customer reading it back: "White" on its own,
 * or "White · Women's fit" where we know the cut.
 *
 * ONE PLACE FOR IT, because four surfaces say this sentence: the cart, the
 * confirmation email, the order status page and the admin order. Crewneck
 * White is two garments at two prices, so a line that cannot identify the one
 * that was bought is the refund conversation this work exists to prevent, and
 * four copies of the sentence is how two of them end up disagreeing.
 *
 * NO FIT MEANS NO SEGMENT. Orders placed before the men's and women's ranges
 * were separated carry none, and nobody recorded which cut they were.
 * Inventing one on somebody's receipt is worse than saying less.
 */
export function colourAndFit(color: string, fit?: Fit | null): string {
  return fit ? `${color} · ${FIT_LABELS[fit]}` : color;
}

/**
 * Lowest variant price, used for "from R x" labels.
 *
 * Narrowed to one fit where a fit is given, because a card stands for a
 * garment in a cut: quoting the whole product's cheapest would advertise the
 * women's crewneck's price on the men's card.
 */
export function fromPriceZar(product: Product, fit?: Fit): number {
  const variants = fit ? variantsForFit(product, fit) : product.variants;
  return Math.min(...variants.map((variant) => variant.priceZar));
}
