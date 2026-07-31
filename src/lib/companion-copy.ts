import { getBreed, temperamentLabel, type Temperament } from "@/lib/breeds";

/**
 * What the flow says back between questions.
 *
 * THESE LINES ARE WRITTEN BY US AND CHOSEN BY RULE. Nothing here is generated
 * and none of it is sent anywhere: the chips are a closed set precisely so they
 * can drive copy and a prompt adjustment without a customer's own words ever
 * reaching a model (docs/spec-pipeline.md section 6).
 *
 * The point is that the flow reads as a conversation rather than a form. It has
 * to obviously reflect what they actually said, so generic praise is worse than
 * silence: "They sound lovely" after somebody picks fearless and mischievous
 * reads as nobody listening.
 *
 * Every line has to survive the reader having lost the animal. Present tense
 * about the words they chose, never a promise about a future together.
 */

/** After the name. Warm, and uses it, because that is the whole point. */
export function afterName(name: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return `Getting to know ${trimmed} a little better.`;
}

/**
 * After the breed. Shows we know the breed rather than merely storing it.
 *
 * Draws on the row the plate is about to fill, so the sentence and the plate
 * agree: they see ORIGIN appear and read the same fact in words.
 */
export function afterBreed(breedId: string | null): string | null {
  if (!breedId) return null;
  const breed = getBreed(breedId);
  if (!breed) return null;

  if (breed.oneOfOne) {
    // The catch-all is the commonest case in South Africa and must never read
    // as a shrug. It is the one entry whose line is about them, not a lookup.
    return "One of a kind, then. That goes on the plate exactly as it should.";
  }

  const group = breed.group ? `, ${breed.group.toLowerCase()}` : "";
  return `${breed.name}${group}. From ${breed.origin}, and now on their plate.`;
}

/**
 * After the three words.
 *
 * Reads the combination, not the count. Sleepy and gentle earns a different
 * sentence to fearless and mischievous, because a line that would fit any three
 * words tells the customer we were not listening.
 */
export function afterTemperament(words: Temperament[]): string | null {
  if (words.length < 3) return null;

  const chosen = new Set(words);
  const has = (...any: Temperament[]) => any.some((w) => chosen.has(w));

  // Sentence case, not Title Case: "Confident, affectionate and spirited" reads
  // as somebody talking. Capitalising every word reads as a form field played
  // back at you, which is the opposite of the point.
  const listed = words.map((w, index) =>
    index === 0 ? temperamentLabel(w) : w.toLowerCase(),
  );
  const phrase = `${listed.slice(0, -1).join(", ")} and ${listed.at(-1)}`;

  // Ordered most specific first: a mischievous, fearless animal gets its own
  // line before the gentler catch-alls get a chance at it.
  if (has("fearless", "mischievous") && has("spirited", "playful", "confident")) {
    return `${phrase}. That is a lot of animal, and it belongs on a garment.`;
  }
  if (has("sleepy") && has("gentle", "wise", "devoted")) {
    return `${phrase}. The best sort of company, and no trouble to anyone.`;
  }
  if (has("watchful", "loyal", "devoted")) {
    return `${phrase}. The kind that keeps an eye on their people.`;
  }
  if (has("gentle", "affectionate")) {
    return `${phrase}. Soft-hearted, then. That reads beautifully on the plate.`;
  }
  if (has("wise")) {
    return `${phrase}. An old soul. Those are the good ones.`;
  }
  return `${phrase}. They sound like a good one.`;
}

/** After the year. Deliberately quiet: this is the line that can land on grief. */
export function afterYear(year: number | null): string | null {
  if (!year) return null;
  // No arithmetic on the number and no "X years together": the reader may have
  // had far fewer than they expected. The year is stated and left alone.
  return `${year}. Noted, and it goes under their name.`;
}
