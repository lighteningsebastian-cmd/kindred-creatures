import { getStorage } from "@/lib/storage";
import {
  COMPOSITION,
  CONSTRAINTS,
  PROMPT_VERSION,
  STYLE_CLAUSE,
  SUBJECT,
} from "./prompts";
import { adjustmentsFor, type RevisionReason } from "@/lib/revision";
import type { ArtStyle, ImageProvider } from "./provider";

/**
 * Real provider backed by OpenAI: the moderation endpoint screens uploads and
 * gpt-image-1 renders the portraits. The SDK is imported lazily and the class
 * is only ever constructed when OPENAI_API_KEY is present (see index.ts), so
 * dev/test never needs the `openai` package and never calls this code.
 *
 * NO PROMPT TEXT LIVES HERE. Every word we say to the model is in prompts.ts,
 * which is written to be edited by someone who does not read TypeScript. This
 * file only decides the ORDER the clauses go in.
 */

/**
 * The largest size gpt-image-1 accepts, in the orientation the product needs.
 *
 * The model takes exactly three sizes: 1024x1024, 1536x1024 and 1024x1536.
 * (1536x1536 is NOT one of them; the old print path asked for it and would have
 * been refused by the API on the first real order.) Every print area in
 * products.ts is taller than it is wide, so the portrait one is both the
 * largest and the right shape.
 */
const CANONICAL_SIZE = "1024x1536";

function toDataUrl(bytes: Uint8Array, contentType: string): string {
  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}

/**
 * Glues the clauses in prompts.ts into the one instruction the model is given.
 *
 * The order is the point: who to draw, how to draw it, where it sits, and what
 * must not appear. Three of the four clauses are identical for every portrait
 * we make, which is what stops the range drifting into three unrelated
 * pictures.
 */
export function buildPortraitPrompt(
  style: ArtStyle,
  /**
   * Chip ids from a revision, if this is a second attempt. Typed as the closed
   * set and filtered again by adjustmentsFor, so there is no route from a
   * request body to these words. What a customer WRITES never arrives here at
   * all: it goes to a person. docs/spec-pipeline.md section 6.
   */
  reasons: RevisionReason[] = [],
): string {
  return [
    SUBJECT,
    STYLE_CLAUSE[style],
    ...adjustmentsFor(reasons),
    // SEAM, deliberately empty (docs/spec-portrait-prompting.md section 5).
    // The nature fragment chosen in the customer journey slots in HERE, between
    // the style clause and the composition clause, and may modify light,
    // expression and mood only. It is not built: the journey that collects it
    // has not shipped, and a fragment with nothing to populate it is a guess.
    COMPOSITION,
    CONSTRAINTS,
  ].join(" ");
}

export class OpenAIImageProvider implements ImageProvider {
  private clientPromise: Promise<unknown> | null = null;

  // Non-literal so bundlers/tsc do not resolve `openai` in dev/test where it is
  // intentionally absent; only evaluated on the real (keyed) path.
  private sdk() {
    const specifier = "openai";
    return import(/* @vite-ignore */ specifier);
  }

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = this.sdk().then((mod) => {
        const OpenAI = mod.default ?? mod.OpenAI;
        return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      });
    }
    return this.clientPromise;
  }

  async moderate({
    bytes,
  }: {
    bytes: Uint8Array;
  }): Promise<{ ok: boolean; reason?: string }> {
    if (!bytes || bytes.length === 0) {
      return { ok: false, reason: "That file came through empty." };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (await this.client()) as any;
    const res = await client.moderations.create({
      model: "omni-moderation-latest",
      input: [
        { type: "image_url", image_url: { url: toDataUrl(bytes, "image/jpeg") } },
      ],
    });
    const flagged = res.results?.[0]?.flagged === true;
    if (flagged) {
      return {
        ok: false,
        reason:
          "We could not accept this image. Please choose a clear photo of your pet.",
      };
    }
    return { ok: true };
  }

  private async render(
    uploadKey: string,
    style: ArtStyle,
    reasons: RevisionReason[],
  ): Promise<Uint8Array> {
    const source = await getStorage().getBytes(uploadKey);
    if (!source) throw new Error(`Upload ${uploadKey} not found`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (await this.client()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { toFile } = (await this.sdk()) as any;
    const image = await toFile(source, "upload.png", { type: "image/png" });
    const result = await client.images.edit({
      model: "gpt-image-1",
      image,
      prompt: buildPortraitPrompt(style, reasons),
      size: CANONICAL_SIZE,
      // A portrait printed on a Stone hoodie must be an animal, not a white
      // rectangle with an animal in it. Transparency requires a PNG or WebP
      // output format, so the two options below travel together: change one and
      // you must change the other.
      background: "transparent",
      output_format: "png",
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from gpt-image-1");
    return new Uint8Array(Buffer.from(b64, "base64"));
  }

  async generatePortrait({
    uploadKey,
    style,
    reasons = [],
  }: {
    uploadKey: string;
    style: ArtStyle;
    reasons?: RevisionReason[];
  }): Promise<{ portraitBytes: Uint8Array; promptVersion: string }> {
    return {
      portraitBytes: await this.render(uploadKey, style, reasons),
      promptVersion: PROMPT_VERSION,
    };
  }
}
