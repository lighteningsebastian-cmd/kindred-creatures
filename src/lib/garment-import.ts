import type { GarmentView } from "@/lib/garments";
import type { Fit } from "@/lib/products";

/**
 * Reading a product, a fit, a colour and a view out of a photographer's
 * filename.
 *
 * WHY THIS IS NOT IN THE SCRIPT. It used to be, and it was where the men's and
 * women's ranges were quietly merged: the script kept a list of words that
 * carry no meaning, "men" and "women" were on it, and so the fit was stripped
 * out of every filename before the file was given a home. Both crewnecks
 * landed in one directory and the shop sold a Grey "Women's fit" sweater over
 * a photograph of the men's one.
 *
 * A rule that decides which garment a photograph is of is not a scripting
 * detail. It lives here because `vitest.config.ts` only collects tests under
 * src/, and it is tested because the failure it produces is silent.
 */

/** Source names for each fit, in every spelling the shoot actually uses. */
const FIT_TOKENS: Record<string, Fit> = {
  man: "mens",
  men: "mens",
  mens: "mens",
  woman: "womens",
  women: "womens",
  womens: "womens",
  unisex: "unisex",
};

/** Words that appear in file names and carry no meaning. */
const NOISE = new Set(["premium"]);

/** The views a photograph can be of. A superset is not wanted here. */
const VIEWS = new Set<string>(["front", "back", "profile", "fleece"]);

export interface ParsedGarmentFile {
  /** Product slug, as a directory name. */
  product: string;
  fit: Fit;
  /** Colour as a directory name: lowercased, hyphenated, the shoot's word. */
  colour: string;
  /** The views this one file stands for. More than one only for the tote. */
  views: GarmentView[];
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[-_\s]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/**
 * Parses one source path, or returns null when it cannot be read.
 *
 * Takes a path RELATIVE TO THE SOURCE ROOT, not a bare filename: the fit is
 * often only in the folder. The men's tees are the case that proves it, since
 * "Tee - White - front.jpeg" says nothing about fit at all and sits in a
 * directory called "Tees Men". Passing an absolute path would let any
 * directory above the shoot fold into the answer.
 *
 * Null is a real answer and the script treats it as one: it warns and skips.
 * Guessing a view from a name that does not carry one is how a back plate ends
 * up on a chest.
 */
export function parseGarmentFile(filePath: string): ParsedGarmentFile | null {
  const segments = filePath.split("/").filter((part) => part !== "");
  const base = segments.pop();
  if (!base) return null;

  let fit: Fit | null = null;
  const parts: string[] = [];
  for (const token of tokens(base.replace(/\.[^.]+$/, ""))) {
    const named = FIT_TOKENS[token];
    if (named) {
      fit ??= named;
      continue;
    }
    if (NOISE.has(token)) continue;
    parts.push(token);
  }

  // The fit from the folder where the filename does not carry one.
  if (!fit) {
    for (const segment of segments) {
      for (const token of tokens(segment)) {
        fit ??= FIT_TOKENS[token] ?? null;
      }
    }
  }
  const resolved: Fit = fit ?? "unisex";

  /*
   * THE TOTE IS ONE PHOTOGRAPH SERVING TWO VIEWS, which is why `views` is a
   * list. A tote's two faces are the same blank canvas panel, so the shoot
   * produced a single frame where every garment produced three, and writing it
   * to both names is what lets the rest of the codebase stay uniform.
   *
   * The rule is "a tote file whose last token is not a view names a COLOUR",
   * so "tote-black.png" would land at tote/unisex/black/ with no change here,
   * and a later shoot that photographs the two faces separately falls through
   * to the ordinary parser below.
   */
  if (parts[0] === "tote" && !VIEWS.has(parts[parts.length - 1] ?? "")) {
    return {
      product: "tote",
      fit: resolved,
      colour: parts.slice(1).join("-") || "natural",
      views: ["front", "back"],
    };
  }

  if (parts.length < 3) return null;

  const product = parts[0] === "hoodies" ? "hoodie" : parts[0]!;
  const view = parts[parts.length - 1]!;
  const colour = parts.slice(1, -1).join("-");
  if (!VIEWS.has(view) || colour === "") return null;

  return { product, fit: resolved, colour, views: [view as GarmentView] };
}
