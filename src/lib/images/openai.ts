import { getStorage } from "@/lib/storage";
import type { ArtStyle, ImageProvider } from "./provider";

/**
 * Real provider backed by OpenAI: the moderation endpoint screens uploads and
 * gpt-image-1 renders the portraits. The SDK is imported lazily and the class
 * is only ever constructed when OPENAI_API_KEY is present (see index.ts), so
 * dev/test never needs the `openai` package and never calls this code.
 */

const STYLE_PROMPT: Record<ArtStyle, string> = {
  "classic-portrait":
    "a warm, painterly classic pet portrait, soft studio lighting, museum framing, dignified pose",
  "line-sketch":
    "a clean single-weight ink line-art sketch of the pet, minimal, on plain background",
  watercolor:
    "a loose, expressive watercolor portrait of the pet, gentle washes, textured paper feel",
};

function toDataUrl(bytes: Uint8Array, contentType: string): string {
  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
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
    size: string,
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
      prompt: `Turn this pet photo into ${STYLE_PROMPT[style]}.`,
      size,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from gpt-image-1");
    return new Uint8Array(Buffer.from(b64, "base64"));
  }

  async generatePreview({
    uploadKey,
    style,
  }: {
    uploadKey: string;
    style: ArtStyle;
  }): Promise<{ previewBytes: Uint8Array }> {
    return { previewBytes: await this.render(uploadKey, style, "1024x1024") };
  }

  async generatePrintFile({
    uploadKey,
    style,
  }: {
    uploadKey: string;
    style: ArtStyle;
    widthPx: number;
    heightPx: number;
  }): Promise<{ printBytes: Uint8Array }> {
    return { printBytes: await this.render(uploadKey, style, "1536x1536") };
  }
}
