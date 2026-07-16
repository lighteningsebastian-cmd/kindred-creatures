# Kindred Creatures — Design System (source of truth)

Extracted verbatim from the Claude Design UI kit (`design/kindred-creatures-ui-kit.html`;
human-readable, base64 images stripped, in `design/ui-kit-readable.html`). These tokens
OVERRIDE the earlier Taste-derived system (Bricolage/terracotta/pills) everywhere.

Brand name is **Kindred Creatures** (not "Kindred Creature Co.").

Per-screen markup lives in `ui-kit-readable.html` (one line each): home=524, product=525,
customizer=526, checkout=527, about=528. Read the relevant line when building that screen.

## Aesthetic in one line
Editorial craft catalogue, not soft SaaS: warm stone-greige paper, warm brown-black ink,
oxblood accent, **near-square corners (2 to 6px)**, border-based elevation (barely any
shadow), Young Serif headlines, Archivo body, and Archivo-900 uppercase "varsity block"
for eyebrows/badges/numerals.

## Color tokens (OKLCH, use verbatim; browsers + Tailwind v4 support oklch() natively)

```css
/* base neutrals: stone greige to dark bark ink */
--parchment-0:   oklch(94.5% 0.005 80);  /* page background */
--parchment-50:  oklch(92%   0.006 78);  /* card / surface background */
--parchment-100: oklch(88.5% 0.008 76);  /* subtle fill, tags */
--dune-200:      oklch(82%   0.010 75);  /* borders, dividers */
--dune-300:      oklch(73%   0.012 72);  /* stronger borders, disabled */
--taupe-500:     oklch(46%   0.015 65);  /* secondary text, muted icons */
--bark-700:      oklch(35%   0.024 65);  /* headings on light, body emphasis */
--bark-900:      oklch(23%   0.020 60);  /* primary text, warm brown-black ink */

/* accents: oxblood (primary) + camel (secondary) */
--oxblood-400: oklch(49% 0.115 25);
--oxblood-500: oklch(42% 0.115 25);   /* PRIMARY accent (CTAs) */
--oxblood-600: oklch(36% 0.110 25);   /* accent hover/active */
--oxblood-100: oklch(90% 0.030 25);   /* accent tint background */
--camel-500:   oklch(63% 0.085 78);   /* secondary accent: numerals, trim */
--camel-100:   oklch(91% 0.035 80);   /* secondary tint background */

/* deep maroon: inverse bands (utility strip, footer, closing CTAs) */
--maroon-900: oklch(24% 0.055 25);
--maroon-800: oklch(29% 0.058 25);

/* semantic status (earthy, not saturated) */
--signal-success: oklch(48% 0.090 145);
--signal-error:   oklch(48% 0.130 30);
--signal-hold:    oklch(60% 0.100 80);

/* semantic aliases */
--bg-page: var(--parchment-0);  --bg-surface: var(--parchment-50);
--bg-surface-alt: var(--parchment-100);  --bg-inverse: var(--maroon-900);
--text-primary: var(--bark-900);  --text-secondary: var(--taupe-500);
--text-on-inverse: var(--parchment-0);  --text-on-accent: var(--parchment-0);
--border-subtle: var(--dune-200);  --border-strong: var(--dune-300);
--border-inverse: oklch(36% 0.06 25);
--accent-primary: var(--oxblood-500);  --accent-primary-hover: var(--oxblood-600);
--accent-tint: var(--oxblood-100);
--accent-secondary: var(--camel-500);  --accent-secondary-tint: var(--camel-100);
```

### Dark mode
The kit ships light only (editorial paper brand). Provide a dark theme by inverting to a
warm dark-bark base (page ~oklch(23% 0.02 60), surface ~oklch(27% 0.02 60), text
parchment-0, keep oxblood accent, lift accent to oxblood-400 for contrast). Keep it ONE
theme per page; respect `prefers-color-scheme`. Maintain WCAG AA in both.

## Typography

```css
--font-display: 'Young Serif', 'Iowan Old Style', Georgia, serif;  /* headlines, product names, quotes. weight 400 ONLY, no italic */
--font-block:   'Archivo', 'Helvetica Neue', Arial, sans-serif;    /* 900 uppercase, letter-spacing .08em: eyebrows, badges, numerals */
--font-body:    'Archivo', 'Helvetica Neue', Arial, sans-serif;    /* body, UI, forms */
```
Both are on Google Fonts: load via `next/font/google` (Young_Serif weight 400; Archivo
weights 400/600/900). Expose CSS vars `--font-display`, `--font-block`, `--font-body`.

Scale (font shorthand `weight size/line family`):
- display-xl `400 58px/1.06`, display-lg `400 44px/1.1`, display-md `400 32px/1.16`, display-sm `400 24px/1.25`
- block-lg `900 15px/1.2`, block-md `900 13px/1.2`, block-sm `900 11px/1.2` (always uppercase + `letter-spacing:.08em` in use)
- body-lg `400 19px/1.55`, body-md `400 16px/1.6`, body-sm `400 14px/1.55`
- label `600 13px/1.3`, caption `400 12.5px/1.4`

## Spacing / radii / elevation
```css
--space-1..10: 4,8,12,16,24,32,48,64,96,128 px
--radius-sm: 2px; --radius-md: 4px; --radius-lg: 6px; --radius-pill: 999px;  /* near-square is the default; pill is rare */
--shadow-card:   0 1px 2px  oklch(23% 0.018 45 / 0.06);
--shadow-raised: 0 4px 16px oklch(23% 0.018 45 / 0.10);
--border-hairline: 1px solid var(--border-subtle);
--border-hairline-strong: 1px solid var(--border-strong);
--max-content-width: 1200px;
```
Buttons use `--radius-md` (4px), NOT pills. Cards/images use `--radius-md`/`--radius-lg`.
Elevation is border-first; shadows are subtle and warm-tinted.

## Chrome (from the home screen)
- **Utility bar** (top, maroon-900 inverse band, block-sm uppercase, centered):
  `DESIGNED AND PRINTED IN SOUTH AFRICA · FREE SHIPPING OVER R750`
- **Header:** wordmark "Kindred Creatures" in Young Serif; nav (body): Shop, How it works,
  Our story, FAQ; right: Track order + cart icon.
- **Hero:** eyebrow (block) `MADE FROM YOUR PHOTO, PRINTED IN SOUTH AFRICA`; headline
  (display-xl) "Your best friend, worn like art."; body-lg subcopy; primary CTA
  `START YOUR PORTRAIT` (oxblood) + secondary `SHOP THE RANGE` (outline). CTA labels are
  uppercase block font. Right: lifestyle photo, near-square radius.

## Hard rules (unchanged)
Zero em/en-dashes in visible text. The middle dot `·` IS used in this brand (utility bar,
meta) — that is intentional here and overrides the Taste "ration the middot" guidance.
Animate transform/opacity only; reduced-motion safe. Creatures keep their line-art style
but recolor accents from terracotta to **oxblood-500** (collar, parcel string, paw pads,
cart badge). Ink stroke = bark-900 (light) / parchment-0 (dark).
