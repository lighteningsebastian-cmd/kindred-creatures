# Men's and Women's Sections, Piece One: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the catalogue carry the men's and women's split that the photography has had since July, so every swatch shows the garment that will actually be sent.

**Architecture:** Fit moves from the product onto the variant, and each variant names its own photo directory, which is what lets one product carry two sets of photographs. The work lands in dependency order so that the dangerous commit is the dull one: first the photo indirection, then the files on disk, then fit through the cart and the order, then per-fit cards and tiles that still render exactly what they render today, and only last the catalogue data itself, which by then is a data-only edit to `PRODUCTS`.

**Tech Stack:** Next 16.2.10 app router, React 19, TypeScript, Tailwind 4, Drizzle on Postgres, Vitest, sharp.

**Spec:** `docs/superpowers/specs/2026-11-17-mens-and-womens-sections-design.md`

**Scope:** Piece one only. Piece two (shop tabs, the fit selector, size charts, `/size-guide`) gets its own plan once its gating question is answered.

## Global Constraints

- No em dashes or en dashes anywhere in `src`. `grep -rn "—\|–" src --include=*.tsx --include=*.ts` must come back empty.
- `ProductSlug` stays the existing four values: `hoodie`, `tee`, `crewneck`, `tote`. The slug is written into `order_items.product_slug` on every historical order.
- Prices are re-derived server side on every checkout. Client prices stay untrusted.
- Every variant that reaches the shop has its own photograph. `unphotographedColours` returns empty for every product, and a test proves it against the filesystem.
- Photo paths are `public/garments/<product>/<fit>/<colour>/<view>.webp`, unisex included, so there is one rule rather than two.
- `printArea` stays on the product. Owner decision, 17 November 2026: both fits of a garment take the same print area, so nothing downstream of `printPixels` changes.
- Size runs: women's is XS to XL, men's and unisex are XS to XXL.
- Before every commit: `npm run build`, `npx vitest run`, `npm run lint`.

## Blocked on the owner

Two values are not decided. **Task 6 cannot run until both are answered.** Every other task is unaffected, so the branch can go eight tasks deep without them.

- **Crewneck pricing.** Men's R899 against women's R799 as the spec has it, or R849 on both. Lands in `PRODUCTS` in Task 6.
- **Women's tee colourway display names.** Winter White, Peach and Blue as the shoot names them, or retail names of their own. Lands in the `color` field in Task 6. It does **not** gate the import: the directory keeps the shoot's word, as the tote's `Natural` to `beige` mapping already does.

## Review Focus

Five things the spec implies, that a person will meet, and that no task's main line of work would otherwise test. Each is pinned by a test in the task named.

- A cart persisted before this change is dropped cleanly rather than rehydrated into a line with no fit. **Task 3.**
- An order placed before this change fulfils and renders with no fit, and nothing invents one for it. **Task 3**, and again on each surface in **Task 7**.
- A checkout body pairing a colour with a fit that does not offer it is rejected by name, not priced from the other fit. **Task 3.**
- A `?fit=` value that is not a fit falls back to the default rather than erroring or rendering an empty grid. **Task 5.**
- A variant whose `photoDir` has no files behind it fails the suite rather than rendering an empty frame on a R999 product. **Task 1.**

---

### Task 1: The variant names its own photograph

**Files:**
- Modify: `src/lib/products.ts` (the `Variant` interface and all 11 existing variants)
- Modify: `src/lib/garments.ts` (delete `PHOTOS` and `garmentPhoto`; key every lookup on a photo directory)
- Modify: `src/components/products/GarmentPreview.tsx`, `src/components/products/GarmentShots.tsx`, `src/components/products/PrintLightbox.tsx`, `src/components/cart/LineThumbnail.tsx`, `src/lib/garment-shots.ts`, `src/app/dev/mockups/page.tsx`
- Test: `src/lib/garments.test.ts`, `src/lib/products.test.ts`

**Interfaces:**
- Produces: `Variant.photoDir: string`. Every one of `garmentImageUrl`, `garmentViewUrl`, `photoAspect`, `photoSourceWidth` and `placementFor` keeps its arity and its first and last parameters, and its middle parameter changes from `color: string` to `photoDir: string`. `unphotographedColours(slug: ProductSlug, variants: Variant[]): string[]` returns the colour names whose `photoDir` has no photograph. `PHOTO_SIZE` and `PLACEMENT_OVERRIDES` keys stay the string `` `${slug}/${photoDir}/${view}` ``.

At this task `photoDir` is the colour's existing lowercase directory (`white`, `heritage-blue`, `beige`), so nothing moves on disk and nothing renders differently.

- [ ] **Step 1: Write the failing tests**

In `src/lib/products.test.ts`, the test that makes the whole change safe. It reads the filesystem, in the style of the measuring tests already in `garments.test.ts`:

```ts
it("every variant's photoDir has photographs behind it", () => {
  for (const product of PRODUCTS) {
    for (const variant of product.variants) {
      const dir = join(PUBLIC, "garments", product.slug, variant.photoDir);
      expect(existsSync(dir), `${product.slug} ${variant.color}`).toBe(true);
      expect(existsSync(join(dir, "front.webp"))).toBe(true);
      expect(existsSync(join(dir, "back.webp"))).toBe(true);
    }
  }
});
```

In `src/lib/garments.test.ts`, that the second argument is now a directory and not a colour name:

```ts
it("resolves a photograph by directory, not by colour name", () => {
  expect(garmentImageUrl("tote", "beige", "front")).toBe(
    "/garments/tote/beige/front.webp",
  );
  expect(garmentImageUrl("tote", "Natural", "front")).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/products.test.ts src/lib/garments.test.ts`
Expected: FAIL, `photoDir` does not exist on `Variant`.

- [ ] **Step 3: Add `photoDir` to `Variant` in `src/lib/products.ts`**

Give all 11 existing variants their current directory. The tote's is `beige` while its colour is `Natural`, and that divergence is the point of the field: the directory keeps the shoot's word.

- [ ] **Step 4: Rewrite the lookups in `src/lib/garments.ts`**

Delete `PHOTOS` and `garmentPhoto`. Each of `garmentImageUrl`, `garmentViewUrl`, `photoAspect`, `photoSourceWidth` and `placementFor` takes `photoDir` where it took `color`, and builds its key directly. The comment block above `PHOTOS` explaining the colour-to-directory indirection moves to `photoDir` in `products.ts`, which is where that indirection now lives.

- [ ] **Step 5: Update the six callers**

`GarmentPreview`, `GarmentShots` and `PrintLightbox` hold a `Variant` already and pass `variant.photoDir`. `garment-shots.ts` carries the `photoDir` on `Shot` alongside `colour`. `LineThumbnail` holds a `CartItem` and resolves the variant by colour for now: `getProduct(item.productSlug)?.variants.find((v) => v.color === item.color)?.photoDir`. Task 3 makes that lookup take the fit as well.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS. Nothing renders differently; this is an indirection change.

- [ ] **Step 7: Commit**

```bash
git add src/lib/products.ts src/lib/garments.ts src/lib/garment-shots.ts src/components src/app/dev/mockups/page.tsx src/lib/products.test.ts src/lib/garments.test.ts
git commit -m "refactor: a variant names its own photograph"
```

---

### Task 2: The importer learns about fit

**Files:**
- Create: `src/lib/garment-import.ts`
- Create: `src/lib/garment-import.test.ts`
- Modify: `scripts/import-garments.mjs`
- Modify: `src/lib/products.ts` (`photoDir` values gain their fit segment), `src/lib/garments.ts` (`PHOTO_SIZE` and `PLACEMENT_OVERRIDES` keys)
- Rename, by hand: the three files in `Stock Images /Tees Women/Womens - Tee - Blue/`

**Interfaces:**
- Produces: `parseGarmentFile(filePath: string): { product: string; fit: Fit; colour: string; views: GarmentView[] } | null`. The script imports it; the whole of the naming logic lives here and nothing else parses a filename.

The parser moves into `src/` because `vitest.config.ts` includes only `src/**/*.test.{ts,tsx}`, and because a filename rule that decides which garment a photograph is of has earned a test. The script keeps its name and gains the alias loader that `scripts/build-catalogue-plate.ts` already uses: `node --import ./scripts/alias-loader.mjs scripts/import-garments.mjs`. Update the USAGE block in its header.

- [ ] **Step 1: Write the failing tests**

```ts
it("takes the fit from the filename", () => {
  expect(parseGarmentFile("Crewneck - Men - Grey-front.jpeg")).toEqual({
    product: "crewneck", fit: "mens", colour: "grey", views: ["front"],
  });
  expect(parseGarmentFile("Womens - Tee - Peach- back.jpeg")).toEqual({
    product: "tee", fit: "womens", colour: "peach", views: ["back"],
  });
});

it("falls back to the source folder when the filename carries no fit", () => {
  expect(parseGarmentFile("Tees Men/Tee - White/Tee - White - front.jpeg"))
    .toEqual({ product: "tee", fit: "mens", colour: "white", views: ["front"] });
  expect(parseGarmentFile("Crewneck - Woman/Crewneck - peach - back.png"))
    .toEqual({ product: "crewneck", fit: "womens", colour: "peach", views: ["back"] });
});

it("defaults to unisex, and keeps the tote's one file for two views", () => {
  expect(parseGarmentFile("Hoodies - Unisex/Hoodie-Blue-back.png"))
    .toEqual({ product: "hoodie", fit: "unisex", colour: "blue", views: ["back"] });
  expect(parseGarmentFile("Tote/tote-beige.png"))
    .toEqual({ product: "tote", fit: "unisex", colour: "beige", views: ["front", "back"] });
});
```

The men's tee case is the one that matters: those filenames carry no fit at all, so without the folder fallback the men's and women's tees collide exactly as the crewnecks already did.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/garment-import.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `parseGarmentFile` in `src/lib/garment-import.ts`**

Lift `parseName` out of the script. `men`, `mens`, `woman`, `women`, `womens` and `unisex` come out of `NOISE` and become fit tokens recognised anywhere in the name, normalised to `mens`, `womens` and `unisex`. With no token in the filename, read the same vocabulary from the path's directories. With neither, `unisex`. The tote rule and the `hoodies` to `hoodie` mapping are unchanged.

- [ ] **Step 4: Point the script at it and write into the fit segment**

The script imports `parseGarmentFile`, writes to `public/garments/<product>/<fit>/<colour>/<view>.webp`, and logs the fit in its per-file line.

- [ ] **Step 5: Rename the three unparseable source files**

`Stock Images /Tees Women/Womens - Tee - Blue/WhatsApp Image 2026-07-30 at 13.45.32*.jpeg` and `...33.jpeg` become `Womens - Tee - Blue - front.jpeg`, `- back.jpeg` and `- profile.jpeg`. **Open each one and look at it first.** Getting back and front the wrong way round puts the large plate on the chest. The back is the view with no neckline visible at the top.

- [ ] **Step 6: Re-import everything**

Run: `node --import ./scripts/alias-loader.mjs scripts/import-garments.mjs --force`
Expected: every existing colourway rewritten one level deeper, plus three new women's tee colourways and the women's crewneck Pea Green front. Delete the old flat directories. `find public/garments -name '*.webp' | wc -l` should report 45: the 35 that were there plus 9 women's tee files plus 1 Pea Green.

- [ ] **Step 7: Move the keys**

`photoDir` values in `products.ts` gain their fit (`white` becomes `unisex/white` on the hoodie, `mens/white` on the tee, and the crewneck's four take the fit of the photograph each one actually is: `mens/grey`, `mens/olive`, `womens/white`, `womens/peach`). `PHOTO_SIZE` and `PLACEMENT_OVERRIDES` keys follow. **Re-measure rather than transcribe**, with the same sharp call the tests use.

The crewneck's `photoDir` values are the first place in the codebase that tells the truth about which sweater each colourway is. The product's `fit` field is still `womens` and still wrong until Task 6.

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run`
Expected: PASS, Task 1's filesystem test included.

- [ ] **Step 9: Commit**

```bash
git add src/lib/garment-import.ts src/lib/garment-import.test.ts scripts/import-garments.mjs src/lib/products.ts src/lib/garments.ts public/garments "Stock Images "
git commit -m "feat: a photograph knows which fit it is of"
```

---

### Task 3: Fit travels with the order

**Files:**
- Modify: `src/lib/products.ts` (`Fit`, `FIT_LABELS`, `Variant.fit`, the helpers)
- Move: `priceLine` out of `src/app/api/checkout/route.ts` and into `src/lib/checkout.ts`
- Modify: `src/lib/cart-store.ts`, `src/lib/db/schema.ts`, `src/app/api/checkout/route.ts`, `src/lib/fulfillment.ts`, `src/components/cart/LineThumbnail.tsx`, `src/components/shop/CatalogueCard.tsx`
- Test: `src/lib/products.test.ts`, `src/lib/cart-store.test.ts`, `src/lib/checkout.test.ts`, `src/lib/db/schema.test.ts`, `src/lib/fulfillment.test.ts`

**Interfaces:**
- Produces: `type Fit = "womens" | "mens" | "unisex"` on `Variant`, not on `Product`. `fitsFor(product: Product): Fit[]` in variant order, deduplicated. `hasFitChoice(product: Product): boolean`. `variantsForFit(product: Product, fit: Fit): Variant[]`. `CartItem.fit: Fit`. `orderItems.fit` is nullable text.

Every product still carries exactly one fit at the end of this task, so nothing renders differently. The hoodie, tee and tote are `unisex` and the crewneck is `womens`, matching today's labels.

`priceLine` moves to `src/lib/checkout.ts` and the route imports it. It is private to a route file today, which leaves the server-side price check untestable, and Next type-checks `route.ts` exports so it cannot simply be exported where it stands.

- [ ] **Step 1: Write the failing tests**

```ts
// products.test.ts
it("reports the fits a product offers", () => {
  expect(fitsFor(getProduct("hoodie")!)).toEqual(["unisex"]);
  expect(hasFitChoice(getProduct("hoodie")!)).toBe(false);
});

// cart-store.test.ts  (Review Focus: a cart from before this change)
it("drops a cart persisted at the previous version", async () => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
    state: { items: [{ productSlug: "tee", color: "White", size: "M", qty: 1,
      artworkId: "a1", unitPriceZar: 599 }] },
    version: 1,
  }));
  await useCartStore.persist.rehydrate();
  expect(useCartStore.getState().items).toEqual([]);
});

// checkout.test.ts  (Review Focus: a colour that exists in the other fit)
it("refuses a colour the requested fit does not offer", () => {
  const result = priceLine({ productSlug: "crewneck", color: "Grey",
    fit: "womens", size: "M", qty: 1, artworkId: "a1" });
  expect(result.ok).toBe(false);
});

// fulfillment.test.ts  (Review Focus: an order from before this change)
it("builds a job sheet for an order item with no fit", async () => {
  // a row whose fit column is null must not throw, and must print no fit
  // line at all rather than the word "null"
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/products.test.ts src/lib/cart-store.test.ts src/lib/checkout.test.ts src/lib/fulfillment.test.ts`
Expected: FAIL.

- [ ] **Step 3: Move `fit` onto the variant in `src/lib/products.ts`**

`Fit` gains `"mens"`. `fit` comes off `Product` and goes onto `Variant`, with every existing variant taking its product's current value. `FIT_LABELS` gains `mens: "Men's fit"`. Add `fitsFor`, `hasFitChoice` and `variantsForFit`.

- [ ] **Step 4: Carry it through the cart and the order**

`CartItem` gains `fit: Fit` and the persisted store's `version` goes from 1 to 2, which empties held carts by design. `orderItems` gains `fit: text("fit")`, nullable, with `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fit text;` added to `CREATE_TABLES_SQL` beside the existing additive statements. The checkout route's variant lookup keys on colour **and** fit, with an error naming the fit. `LineThumbnail` resolves its variant on colour and fit. The job sheet in `fulfillment.ts` prints the fit, and prints nothing where it is null rather than guessing.

- [ ] **Step 5: Keep `CatalogueCard` compiling**

It reads `FIT_LABELS[product.fit]` today. Until Task 5 it reads `FIT_LABELS[fitsFor(product)[0]]`. One line, and the rendered output is unchanged.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib src/components src/app/api/checkout/route.ts
git commit -m "feat: a fit travels with the garment it was bought in"
```

---

### Task 4: Cards and tiles are drawn per fit

**Files:**
- Modify: `src/components/shop/CatalogueCard.tsx`, `src/app/shop/page.tsx`, `src/lib/garment-shots.ts` (`colourwayShots`, `HERO`), `src/components/sections/ProductRange.tsx`, `src/lib/seo/jsonld.ts` (`buildItemList`)
- Test: `src/components/sections/ProductRange.test.tsx`, `src/lib/garment-shots.test.ts`, a new `src/app/shop/page.test.tsx`

**Interfaces:**
- Produces: `CatalogueCard({ product, fit }: { product: Product; fit: Fit })`, rendering only that fit's variants for price, colours and size range, and linking to `/products/<slug>?fit=<fit>` where the product has a fit choice and to `/products/<slug>` where it does not. `colourwayShots(slug: ProductSlug, fit: Fit): Shot[]`. `heroColour(slug: ProductSlug, fit: Fit): string | null`. `buildItemList` takes one entry per product and fit.

Every product still has one fit, so this task renders exactly four cards and four tiles, as today. That is what its tests assert, and it is what makes Task 6 a data change rather than a redesign.

- [ ] **Step 1: Write the failing tests**

```ts
// shop/page.test.tsx
it("renders one card per product and fit", () => {
  // four cards today, because every product has one fit
  expect(screen.getAllByRole("article")).toHaveLength(
    PRODUCTS.flatMap((p) => fitsFor(p)).length,
  );
});

// garment-shots.test.ts
it("cycles only the requested fit's colourways", () => {
  const shots = colourwayShots("crewneck", "womens");
  expect(shots.every((s) => s.photoDir.startsWith("womens/"))).toBe(true);
});
```

Count the cards from `fitsFor` rather than hardcoding four, so the same test still means something after Task 6 makes it six.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/app/shop src/lib/garment-shots.test.ts`
Expected: FAIL.

- [ ] **Step 3: Give the card a fit**

`CatalogueCard` takes `{ product, fit }` and derives everything it shows from `variantsForFit(product, fit)`. The shop grid maps `PRODUCTS.flatMap((product) => fitsFor(product).map((fit) => ({ product, fit })))`, keeping the alternating vertical offset on the flattened index. `buildItemList` walks the same list so the markup and the grid cannot disagree.

- [ ] **Step 4: Give the home tiles a fit**

`colourwayShots` and `heroColour` take a fit. `HERO` is keyed by slug and fit. `ProductRange` renders one tile per product, asking for the fit of `product.variants[0]`, which is the lever `products.ts` already documents for the default colourway. The home page looks identical the day this lands and the day Task 6 lands.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components src/app/shop src/lib/garment-shots.ts src/lib/seo/jsonld.ts
git commit -m "feat: a catalogue card is a garment in a fit"
```

---

### Task 5: The product page reads a fit from the URL

**Files:**
- Modify: `src/app/products/[slug]/page.tsx`
- Test: `src/app/products/[slug]/page.test.tsx`

**Interfaces:**
- Produces: `searchParams` gains `fit?: string`, validated against the product's own fits and passed down as `initialFit`. An unknown or absent value resolves to `fitsFor(product)[0]`.

The selector itself is piece two. This task is only the URL contract, so that Task 4's card links already land somewhere sensible.

- [ ] **Step 1: Write the failing test**

```ts
// Review Focus: a ?fit= value that is not a fit
it("falls back to the first fit for an unknown ?fit=", async () => {
  const page = await ProductPage({
    params: Promise.resolve({ slug: "crewneck" }),
    searchParams: Promise.resolve({ fit: "robot" }),
  });
  // renders, and resolves to the product's first fit
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/products`
Expected: FAIL.

- [ ] **Step 3: Read and validate `?fit=` in `src/app/products/[slug]/page.tsx`**

Alongside the existing `?color=` and `?size=`, awaited from the same `searchParams` promise. The canonical stays `/products/<slug>`, carrying no params, exactly as the comment at the top of that file already requires.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/products
git commit -m "feat: a product page can be opened at a fit"
```

---

### Task 6: The catalogue splits into six

**BLOCKED.** Needs the crewneck pricing and the women's tee display names. See Blocked on the owner.

**Files:**
- Modify: `src/lib/products.ts` (`PRODUCTS`, `WOMENS_SIZES`), `src/lib/garments.ts` (`PHOTO_SIZE` and `PLACEMENT_OVERRIDES` for the four new colourways)
- Test: `src/lib/products.test.ts`, `src/lib/garments.test.ts`

**Interfaces:**
- Consumes: everything built in Tasks 1 to 5. This task adds no function and changes no signature. It is data.

The range this produces:

| Product | Fit | Colourways | Sizes | Price |
|---|---|---|---|---|
| Hoodie | unisex | Blue, Lilac, White | XS to XXL | R999 |
| Tee | mens | White, Olive, Heritage Blue | XS to XXL | R599 |
| Tee | womens | Winter White, Peach, Blue | XS to XL | R599 |
| Crewneck | mens | White, Grey, Olive | XS to XXL | blocked |
| Crewneck | womens | White, Peach | XS to XL | blocked |
| Tote | unisex | Natural | One size | R349 |

Pea Green is not in it. The women's crewneck was shot front only and the back is where the plate goes.

- [ ] **Step 1: Write the failing tests**

```ts
it("sells each garment in the fits it was photographed in", () => {
  expect(fitsFor(getProduct("tee")!)).toEqual(["mens", "womens"]);
  expect(hasFitChoice(getProduct("crewneck")!)).toBe(true);
  expect(hasFitChoice(getProduct("hoodie")!)).toBe(false);
});

it("stops women's sizes at XL", () => {
  for (const product of PRODUCTS) {
    for (const variant of product.variants) {
      if (variant.fit === "womens") expect(variant.sizes).not.toContain("XXL");
    }
  }
});

it("gives the crewneck two Whites that are different photographs", () => {
  const crewneck = getProduct("crewneck")!;
  const mens = variantsForFit(crewneck, "mens").find((v) => v.color === "White")!;
  const womens = variantsForFit(crewneck, "womens").find((v) => v.color === "White")!;
  expect(mens.photoDir).not.toBe(womens.photoDir);
  expect(photoAspect("crewneck", mens.photoDir, "front")).not.toBeCloseTo(
    photoAspect("crewneck", womens.photoDir, "front"), 2,
  );
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/products.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the range into `PRODUCTS`**

Add `WOMENS_SIZES = ["XS", "S", "M", "L", "XL"]` rather than reusing the shared run. Order each product's variants so the first carries the fit the home page should lead with: the tee men's, the crewneck women's, which is what each shows today.

- [ ] **Step 4: Sample the four new hexes**

Men's crewneck White, and the three women's tee colourways. Middle of the chest, neither highlight nor shadow, from that variant's own photograph, as the comment in `products.ts` requires. The existing crewneck `#F3F0EC` was sampled from the women's photograph and stays with the women's variant.

- [ ] **Step 5: Measure and place the new photographs**

Their `PHOTO_SIZE` entries are already in place and measured: Task 2 wrote all 48 photographs into the manifest, including the ones no variant points at yet. **Do not retype them.** The women's tee shots are 932 x 1400 on disk, a ratio of 0.666 against the men's tee White at 0.832 (the source files are 1023 x 1537, which the importer resizes), so they will need their own `PLACEMENT_OVERRIDES`; the men's crewneck White is 943 x 1400, framed like Grey and Olive, and should take the same override they do. Check every one on `/dev/mockups` before committing: a plate that sits beside the garment rather than on it is the failure this catches.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS, including Task 1's filesystem test, which now proves all six fits are photographed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/products.ts src/lib/garments.ts src/lib/products.test.ts src/lib/garments.test.ts
git commit -m "feat: the shop sells the men's and women's ranges it photographed"
```

---

### Task 7: The fit is on every line a customer reads

**Files:**
- Modify: `src/components/cart/CartView.tsx`, `src/lib/email/templates/order-confirmation.ts`, `src/app/order/[token]/page.tsx`, `src/app/admin/(dashboard)/orders/[id]/page.tsx`
- Test: the existing tests beside each

**Interfaces:**
- Consumes: `CartItem.fit` and `orderItems.fit` from Task 3.

Lines read "Colour · Size" today. With crewneck White now two garments at two prices, that does not say what was bought.

- [ ] **Step 1: Write the failing tests**

One per surface, each asserting the fit label appears on a line, and that a line with a null fit renders without it rather than rendering the word "null".

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/cart src/lib/email src/app/order src/app/admin`
Expected: FAIL.

- [ ] **Step 3: Render the fit beside the colour and size**

`FIT_LABELS` for the wording. Omit the segment entirely where the fit is null, which is every pre-change order.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/cart src/lib/email src/app/order src/app/admin
git commit -m "feat: a receipt says which fit was bought"
```

---

### Task 8: The product page quotes a range, and analytics carries the fit

**Files:**
- Modify: `src/lib/seo/jsonld.ts` (`buildProduct`), `src/lib/analytics.ts`, the call sites in `src/components/analytics/` and the flows that track
- Test: `src/lib/seo/jsonld.test.ts`, `src/lib/analytics.test.ts`

**Interfaces:**
- Produces: `buildProduct` emits an `AggregateOffer` with `lowPrice` and `highPrice` across the product's variants. `trackViewItem` and `trackAddToCart` take `fit: Fit` and emit it as `item_variant`; `item_id` stays the slug.

A single `Offer` quoting the cheapest variant would advertise R799 on a page that also sells the R899 sweater. `item_id` stays the slug so the new dimension arrives without breaking continuity with the GA data already collected.

- [ ] **Step 1: Write the failing tests**

```ts
it("quotes a range where a product has two prices", () => {
  const ld = buildProduct({ baseUrl: "https://x", product: getProduct("crewneck")! });
  expect(ld.offers["@type"]).toBe("AggregateOffer");
  expect(ld.offers.lowPrice).not.toBe(ld.offers.highPrice);
});

it("sends the fit as item_variant and keeps item_id the slug", () => {
  const gtag = installFakeGtag();   // the helper already in this file
  trackViewItem({ slug: "tee", fit: "womens", priceZar: 599 });
  expect(gtag).toHaveBeenCalledWith("event", "view_item",
    expect.objectContaining({ item_id: "tee", item_variant: "womens" }));
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/seo src/lib/analytics.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement both**

- [ ] **Step 4: Run the full suite and the constraint checks**

Run: `npx vitest run && npm run build && npm run lint && grep -rn "—\|–" src --include=*.tsx --include=*.ts`
Expected: PASS, PASS, PASS, and no grep output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo src/lib/analytics.ts src/components/analytics
git commit -m "feat: the markup quotes a range and analytics knows the fit"
```

---

## Manual checks before this branch is done

Tests do not cover the thing this change is for, which is whether the right photograph is under the right swatch.

- Open the crewneck in White twice, once per fit, and confirm they are different photographs.
- `/dev/mockups`: every plate sits on the garment, not beside it, for all six fits.
- The shop grid shows six cards. The home page shows four tiles and looks exactly as it did.
- Add a women's tee to the cart, check out to the PayFast sandbox, and confirm the job sheet names the fit.
- Place an order before deploying, then reorder it after, and confirm nothing throws.
