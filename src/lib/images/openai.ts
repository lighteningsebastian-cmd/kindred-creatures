import { getStorage } from "@/lib/storage";
import {
  COMPOSITION,
  CONSTRAINTS,
  PROMPT_VERSION,
  REFERENCE,
  STYLE_CLAUSE,
  SUBJECT,
  type PortraitSide,
} from "./prompts";
import { adjustmentsFor, type RevisionReason } from "@/lib/revision";
import { standoutClause } from "@/lib/standout";
import type { ImageProvider } from "./provider";

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
 * The order is the point: who to draw, which picture is which, how to draw it,
 * where it sits, and what must not appear. SUBJECT and CONSTRAINTS are the same
 * on every portrait we make, which is what stops the range drifting into a set
 * of unrelated pictures.
 *
 * REFERENCE is the one clause that is not always sent. It describes a SECOND
 * attached image, so it may only appear on calls that actually attach one.
 */
export function buildPortraitPrompt(
  side: PortraitSide,
  /**
   * Chip ids from a revision, if this is a second attempt. Typed as the closed
   * set and filtered again by adjustmentsFor, so there is no route from a
   * request body to these words. What a customer WRITES never arrives here at
   * all: it goes to a person. docs/spec-pipeline.md section 6.
   */
  reasons: RevisionReason[] = [],
  /**
   * Whether a second image is actually being attached to this call. Must be
   * derived from the bytes that were really sent, never from the presence of a
   * reference KEY: a key whose bytes are missing falls back to the photograph
   * alone, and the prompt has to fall back with it.
   */
  hasReference = false,
  /**
   * The owner's answer to "what is one thing about them that really stands
   * out?", raw and untrusted, exactly as they typed it. Sanitised here rather
   * than by the caller so there is no route to these words that skips the
   * filter. Null, blank and unusable all mean the same thing: no clause.
   */
  standoutDetail: string | null = null,
): string {
  const standout = standoutClause(standoutDetail);
  return [
    SUBJECT,
    // Only when there really is a second image. Said unconditionally this
    // describes a picture the model was not given, which is a worse instruction
    // than silence. It sits here, directly after SUBJECT, because SUBJECT says
    // "from the photograph" and with two images attached that is ambiguous
    // until this resolves it.
    ...(hasReference ? [REFERENCE] : []),
    STYLE_CLAUSE[side],
    ...adjustmentsFor(reasons),
    // The seam that section 5 of docs/spec-portrait-prompting.md left open, now
    // occupied by the owner's one detail. The nature fragment, if it is ever
    // built, joins it here.
    //
    // THE POSITION IS THE SAFETY. These are the only customer-written words in
    // the prompt, and everything that costs us a garment when it goes wrong
    // comes AFTER them: COMPOSITION holds the back's strict side profile, which
    // is the most fragile instruction we give, and CONSTRAINTS holds the
    // transparent background and the ban on lettering. Nothing a customer types
    // can unseat a clause that is stated after it. Never move this below them.
    ...(standout ? [standout] : []),
    COMPOSITION[side],
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
    uploadKey: string | null,
    side: PortraitSide,
    reasons: RevisionReason[],
    referenceKey: string | null,
    standoutDetail: string | null,
  ): Promise<Uint8Array> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (await this.client()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { toFile } = (await this.sdk()) as any;

    // A null uploadKey is the customer who ordered without a photograph and
    // took the stock illustration of their breed instead (owner, 5 August).
    // A key that is SET but whose bytes are gone is a different thing entirely
    // and still an error: storage has lost the photograph of somebody's animal.
    let photograph: unknown = null;
    if (uploadKey) {
      const source = await getStorage().getBytes(uploadKey);
      if (!source) throw new Error(`Upload ${uploadKey} not found`);
      photograph = await toFile(source, "upload.png", { type: "image/png" });
    }

    // The breed's hand-reviewed side profile, when we have one. Missing bytes
    // are NOT a failure: artwork-drawing.ts already treats an undrawn
    // illustration as ordinary, and a paid order must never fail because the
    // library has not reached that breed yet. Getting here with a key whose
    // bytes are gone means storage disagreed with itself, so say so and carry
    // on with the photograph alone.
    const referenceBytes = referenceKey
      ? await getStorage().getBytes(referenceKey)
      : null;
    if (referenceKey && !referenceBytes) {
      console.warn(
        `[openai] reference ${referenceKey} is not in storage. Drawing from the photograph alone.`,
      );
    }
    const reference = referenceBytes
      ? await toFile(referenceBytes, "reference.png", { type: "image/png" })
      : null;

    // Nothing to draw from at all. Refused by name rather than sent to the
    // model, which would happily return a handsome generic example of the
    // breed: precisely what SUBJECT exists to prevent, and not what anybody
    // paid R999 for.
    if (!photograph && !reference) {
      throw new Error(
        "Nothing to draw from: this artwork has neither a photograph nor a " +
          "breed reference illustration.",
      );
    }

    // gpt-image-1 takes up to 16 images. THE PHOTOGRAPH IS ALWAYS FIRST when
    // there is one: it is the animal, and the likeness is the product. The
    // reference is otherwise the second input, and only the back asks for one,
    // because a side profile has to be inferred from a face-on photograph and
    // the reference is what keeps that inference breed-accurate.
    //
    // With no photograph the reference is the only image, so it is first, and
    // REFERENCE must NOT be sent: that clause names a FIRST and a SECOND image
    // and there is only one. See the note below about the wording this case
    // still needs.
    const images = photograph
      ? reference
        ? [photograph, reference]
        : photograph
      : reference;

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: images,
      // The prompt only names a SECOND image on the calls that actually attach
      // two, so neither fallback above can leave the model hunting for a
      // picture it was never given.
      //
      // OWNER: a reference-only generation (no photograph) is currently sent
      // the ordinary SUBJECT clause, which talks about "the photograph". It is
      // not wrong enough to break anything and no order can reach this path yet
      // (the option is not in the interface), but it wants a SUBJECT that does
      // not refer to a photograph before half two ships. prompts.ts is yours;
      // this pass deliberately did not touch it.
      //
      // THE STANDOUT DETAIL GOES ONLY WHERE THERE IS A PHOTOGRAPH. The clause
      // says "that detail is in the photograph: find it there", which is the
      // whole reason it is safe to send customer-written words at all. On a
      // reference-only generation there is no photograph to find it in, and the
      // sentence would become a description of an animal we are inventing —
      // exactly the failure the pointer framing exists to prevent. Same
      // conditional logic as REFERENCE, for the same kind of reason.
      prompt: buildPortraitPrompt(
        side,
        reasons,
        photograph !== null && reference !== null,
        photograph !== null ? standoutDetail : null,
      ),
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
    side,
    reasons = [],
    referenceKey = null,
    standoutDetail = null,
  }: {
    uploadKey: string | null;
    side: PortraitSide;
    reasons?: RevisionReason[];
    referenceKey?: string | null;
    standoutDetail?: string | null;
  }): Promise<{ portraitBytes: Uint8Array; promptVersion: string }> {
    return {
      portraitBytes: await this.render(
        uploadKey,
        side,
        reasons,
        referenceKey,
        standoutDetail,
      ),
      promptVersion: PROMPT_VERSION,
    };
  }
}
