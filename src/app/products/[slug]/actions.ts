"use server";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { artworks, breedRequests } from "@/lib/db/schema";
import {
  SPECIES,
  getBreed,
  isTemperament,
  stockKey,
  type Species,
} from "@/lib/breeds";
import { isArtStyle } from "@/lib/images/provider";
import { loadPrintFont } from "@/lib/print/fonts";
import {
  NAME_MAX,
  isProfileComplete,
  type CompanionProfile,
} from "@/lib/companion";
import { backPlate, frontPlate } from "@/lib/print/plate";
import { getStorage } from "@/lib/storage";

/** The front plate is a small square patch, so one dimension describes it. */
const FRONT_PX = 600;

/** Longer than any real breed name; anything past this is not a search. */
const MAX_QUERY = 60;

/**
 * Records a breed somebody looked for and did not find.
 *
 * This is the only reason the list grows in the right order: every miss is a
 * vote, so the next breeds added are the ones customers actually asked for
 * rather than the ones we guessed at.
 *
 * Never throws. A failed log must not interrupt somebody buying a hoodie, and
 * there is nothing the customer could do about it anyway.
 *
 * ponytail: no rate limit, this is a public unauthenticated write. Capped
 * length and dropped blanks are the whole of the defence. Add one if the table
 * ever fills with junk; it is a list the owner reads by hand, so noise is
 * visible immediately.
 */
export async function logBreedRequest(
  query: string,
  species: Species,
): Promise<void> {
  const trimmed = query.trim().slice(0, MAX_QUERY);
  if (!trimmed) return;
  // Reject anything that is not a species we actually offer, rather than
  // trusting a string that arrived from a browser.
  if (species !== "other" && !(species in SPECIES)) return;

  try {
    const db = await getDb();
    await db.insert(breedRequests).values({ query: trimmed, species });
  } catch {
    // Best effort by design.
  }
}

/**
 * Words we will not print on a garment. Deliberately short.
 *
 * ponytail: an English starter list only. South Africa has eleven official
 * languages and this covers one of them, so the owner should extend it from
 * what actually turns up. The real backstop is that every order is seen by a
 * human before it goes to the printer, and this only has to catch the obvious
 * case at the moment of typing.
 */
const UNPRINTABLE_WORDS = [
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "bastard",
  "dick",
  "piss",
  "wank",
  "kaffir",
  "poes",
  "doos",
  "naai",
];

export type NameCheck = { ok: true } | { ok: false; reason: string };

/**
 * Can this name actually be printed, and should it be?
 *
 * The point is timing. The name is set in a real font on a real garment, so a
 * character the font has no glyph for is not a rendering bug, it is a blank
 * space on something already paid for and not returnable. Answering while the
 * customer is still typing costs a round trip and saves a refund.
 *
 * Coverage is asked of the font file itself rather than approximated with a
 * regex, so there is one source of truth and it is the same file the plate is
 * set from. The name is PRINTED, never prompted: it goes nowhere near the image
 * model (docs/spec-pipeline.md section 6).
 */
export async function checkCreatureName(name: string): Promise<NameCheck> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: true };
  if (trimmed.length > NAME_MAX) {
    return { ok: false, reason: `Names can be up to ${NAME_MAX} characters.` };
  }

  const lowered = trimmed.toLowerCase();
  if (UNPRINTABLE_WORDS.some((word) => lowered.includes(word))) {
    return { ok: false, reason: "We would rather not print that one." };
  }

  // Young Serif sets the name on both sides, so its coverage is the answer.
  const font = loadPrintFont("frontName");
  const missing = [...trimmed].filter(
    (char) => font.charToGlyph(char).index === 0,
  );
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `We cannot print ${missing.join(" ")} yet. Letters, spaces, hyphens and accents all work.`,
    };
  }

  return { ok: true };
}

export interface PlatePreview {
  /** The type layer, as an SVG document of outlines. Renders anywhere. */
  svg: string;
  /** Where the illustration sits, as fractions of the plate, for CSS. */
  portrait: { x: number; y: number; width: number; height: number };
}

export interface PreviewResult {
  front: PlatePreview;
  back: PlatePreview;
  /**
   * The breed's stock illustration, or null while the library is still being
   * made. Null is an ordinary state, not an error: the preview degrades to a
   * placeholder and the flow carries on.
   */
  stockUrl: string | null;
}

/** Fractions rather than pixels, so the caller can size the plate freely. */
function asFractions(
  rect: { x: number; y: number; width: number; height: number },
  w: number,
  h: number,
) {
  return {
    x: rect.x / w,
    y: rect.y / h,
    width: rect.width / w,
    height: rect.height / h,
  };
}

/**
 * Renders both plates for the pre-payment preview.
 *
 * Returns the SVG rather than a raster: the type is already outlines, so the
 * browser draws it crisply at any size with no font to load and no round trip
 * through sharp. It is the SAME layout code the print file is composed from,
 * so what they are looking at is the plate, not a mock-up of one.
 *
 * No reference code is passed: no order exists yet, and inventing a number to
 * fill the space would be the one dishonest thing on an honest plate.
 */
export async function previewPlates(
  profile: CompanionProfile,
  aspect: { width: number; height: number },
): Promise<PreviewResult> {
  const back = backPlate(profile, null, aspect.width, aspect.height);
  const front = frontPlate(profile, FRONT_PX, FRONT_PX);

  const breed = profile.breedId ? getBreed(profile.breedId) : undefined;
  let stockUrl: string | null = null;
  if (breed) {
    const key = stockKey(breed);
    // Ask storage rather than assuming: the library is being drawn breed by
    // breed, so "not there yet" is the normal case for most of them.
    const bytes = await getStorage().getBytes(key);
    if (bytes) stockUrl = await getStorage().getSignedUrl(key, 600);
  }

  return {
    back: { svg: back.svg, portrait: asFractions(back.portrait, aspect.width, aspect.height) },
    front: { svg: front.svg, portrait: asFractions(front.portrait, FRONT_PX, FRONT_PX) },
    stockUrl,
  };
}

/**
 * Saves the style and the companion profile onto the artwork.
 *
 * This is what makes the pre-payment half durable. Nothing is drawn here: the
 * drawing happens after the money lands, and what it needs is exactly this row
 * plus the photograph (docs/spec-pipeline.md section 4).
 *
 * Validated again on the way in even though the form validates as you type,
 * because a browser is not a trust boundary and these are the words that get
 * printed on a garment.
 */
export async function saveArtworkDetails(
  artworkId: string,
  style: unknown,
  profile: CompanionProfile,
): Promise<{ ok: boolean }> {
  if (!isArtStyle(style)) return { ok: false };
  if (!isProfileComplete(profile)) return { ok: false };

  const temperament = profile.temperament.filter(isTemperament);
  const db = await getDb();
  const updated = await db
    .update(artworks)
    .set({
      style,
      creatureName: profile.name?.trim() || null,
      species: profile.species,
      breedId: profile.breedId,
      temperament: JSON.stringify(temperament),
      togetherSince: profile.togetherSince,
      customFields: JSON.stringify(profile.customFields),
    })
    .where(eq(artworks.id, artworkId))
    .returning();

  return { ok: updated.length > 0 };
}
