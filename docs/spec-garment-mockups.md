# Spec: garment mockups · showing the plate on the real garment

**For Claude Code. How the owner's product photography becomes a live preview showing a
customer their plate on the colour they picked, front and back.**

30 July 2026.

---

## 1. How it works

No image processing at request time. The garment photograph is a background, the plate is a
transparent PNG positioned on top with CSS. The garment colour shows through the plate's
transparency exactly as ink on fabric will.

```
<div class="relative">
  <Image src="/garments/hoodie/blue-shadow/front.webp" />       ← garment
  <img  src={plateFrontUrl} class="absolute" style={placement} /> ← plate, transparent
</div>
```

Front and back are two separate garment photographs and two separate plates.

---

## 2. Get the files into the repo

The owner's uploads live in `Stock Images/`, which is **outside** `public/` and therefore
not servable, and the folder names contain spaces and trailing spaces that will break URLs.

Copy them into `public/garments/` with this structure, all lowercase, hyphenated, no spaces:

```
public/garments/
  hoodie/
    blue-shadow/    front.webp  back.webp  profile.webp  fleece.webp
    dusty-lilac/    front.webp  back.webp  profile.webp  fleece.webp
    winter-white/   front.webp  back.webp  profile.webp  fleece.webp
  crewneck/
    winter-white/   front.webp  back.webp  profile.webp
    peach/          front.webp  back.webp
```

Map from the owner's names: `Hoodie-Blue-*` → `blue-shadow`, `Hoodie-Lilac-*` →
`dusty-lilac`, `Hoodie-White-*` → `winter-white`, `Crewneck-white-*` → `winter-white`,
`Crewneck - peach - *` → `peach`.

`front` and `back` are the overlay targets. `profile` and `fleece` are gallery extras: the
fleece shot is the inside texture and is a good detail image for a premium product page,
but nothing is ever composited onto either.

### Convert them, do not commit them as they are

The source PNGs are **1.1 to 2.9 MB each**, 17 files, about 29 MB. Shipping those would
ruin mobile performance on the exact page that has to convert.

Resize the long edge to 1400px and convert to WebP at quality 82. Expect roughly 100 to
200 KB each. Serve through `next/image` so it handles responsive sizes and lazy loading.

---

## 3. Placement data

Placement is a percentage of the garment image, not pixels, so it survives responsive
resizing. Store it as data next to the products, never inline in a component.

```ts
/** Where a plate sits on a garment photo, as percentages of the image box. */
export interface PlatePlacement {
  top: number;    // % from top
  left: number;   // % from left
  width: number;  // % of image width
}

export const PLACEMENT: Record<ProductSlug, { front: PlatePlacement; back: PlatePlacement }> = {
  hoodie: {
    // Left chest, from the wearer's point of view, so right of centre on screen.
    front: { top: 27, left: 55, width: 15 },
    back:  { top: 22, left: 25, width: 50 },
  },
  // crewneck and tee follow, calibrated per garment
};
```

**These numbers are a starting estimate from the hoodie photograph and must be calibrated
by eye.** Build a dev route at `/dev/mockups` that renders every product, colour and side
with a placeholder plate, so placement can be checked in one screen rather than one order
at a time. That page is the tool, not a deliverable.

Calibration notes for whoever does it: the front plate should sit above the pocket seam
and clear of the hood drawstrings. The back plate should be centred between the shoulder
seams, starting below the hood, and must not run past the bottom hem when the plate is
tall.

---

## 4. On the product page

- Front and back shown side by side on desktop, a toggle on mobile.
- Changing colour swaps the garment photo. **The plate does not regenerate**, it is the
  same PNG over a different background.
- Changing product does swap placement, since a tee sits differently to a hoodie.
- Preload the selected colour's two images; lazy-load the rest.

---

## 5. Colours · reconcile before building

The photography does not match the colourway list currently agreed.

| Agreed colourway | Hoodie photo | Crewneck photo |
|---|---|---|
| Washed Black | **missing** | **missing** |
| Blue Shadow | yes | **missing** |
| Dusty Lilac | yes | **missing** |
| Winter White | yes | yes |
| Bush Green | **missing** | **missing** |
| Peach | not on the list | yes |

**Owner decision needed.** Either the missing photography is produced, or the range launches
on the colours that actually have images. Do not ship a colour swatch with no photograph
behind it: an empty swatch on a R999 product looks broken.

Note also that **Washed Black cannot launch** until the printer confirms how dark garments
are handled, since graphite ink on near-black fabric is nearly invisible. That question is
outstanding with Red Hot Prints.

Recommendation: launch hoodie in Blue Shadow, Dusty Lilac and Winter White, and crewneck in
Winter White and Peach. Add the rest as photography and printing allow.

---

## 6. Verify

- `/dev/mockups` renders every product, colour and side without a missing image
- A plate with a long name and five table rows does not overflow the garment on the back
- Changing colour does not re-request the plate
- Lighthouse on the product page: images are not the largest contentful paint blocker
- Total page weight on mobile is sane, which it will not be if the source PNGs ship
