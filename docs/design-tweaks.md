# Design tweaks backlog (do AFTER architecture is complete)

Owner feedback, 2026-07-17. Do not action these until the build is functionally complete;
batch them into one pass.

## 1. CatSwat: the cat is not visible
Currently you only see the FAQ heading word wobble. The swat reads as a wobble, not as a
cat. Fix: make the cat actually visible and legible as a cat. Options: bring more of the
cat in from the edge (head + shoulder + foreleg, not just a paw), enlarge it, slow the
retreat so the eye catches it, and/or have it linger before withdrawing. The swing is
nice and should stay; the cat needs to be seen doing it.

## 2. CartDog: too small to read as a dog
The head that rises above the cart basket is too small to recognise. Fix: have it emerge
further above the rim (more of the head/neck), and enlarge the head relative to the
basket, while keeping the nav button box fixed (no layout shift, overflow visible).

## 3. Palette is too dark; lighten toward the Claude Design kit
The rendered site reads darker than the handed-over kit. Re-check against
`design/DESIGN-SYSTEM.md` and the kit itself (`design/kindred-creatures-ui-kit.html`),
and lighten so it matches. Suspects: bark ink on parchment feels heavy; the maroon utility
bar and oxblood may be rendering darker than intended; dark-theme inversion may be
bleeding into perception of the light theme. Verify actual computed colors against the
kit's `:root` values rather than eyeballing.

## Also outstanding (not owner-raised, known)
- All photography is placeholder (picsum stock). Real product + lifestyle shots needed.
- Animation smoothness unverified: the preview pane throttles animation frames, so the
  dog trot, cart pop, and scroll reveals need one pass on a normal browser.
