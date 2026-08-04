// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { getStorage } from "@/lib/storage";
import { OpenAIImageProvider } from "./openai";

/**
 * The real provider, exercised offline by replacing the OpenAI SDK at its one
 * seam.
 *
 * The `openai` package is deliberately never loaded in dev/test (see the note
 * at the top of openai.ts), so the private sdk() method is the only place this
 * file can be cut. Everything below the cut is the production code path: the
 * storage reads, the fallbacks, and the shape of the images.edit call are all
 * real. What cannot be checked here is whether gpt-image-1 actually draws a
 * better profile with the reference attached, which needs a live key and a
 * spend cap.
 */

/** The private seam, named so the spy does not need `any`. */
type SdkSeam = { sdk(): Promise<unknown> };

/** What the fake toFile records, so a test can assert on the bytes themselves. */
type SentFile = { name: string; bytes: Uint8Array };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditSpy = ReturnType<typeof vi.fn<(body: any) => Promise<unknown>>>;

function stubSdk(provider: OpenAIImageProvider): EditSpy {
  const edit: EditSpy = vi.fn(async () => ({
    data: [{ b64_json: Buffer.from("drawn").toString("base64") }],
  }));
  class FakeOpenAI {
    images = { edit };
  }
  vi.spyOn(provider as unknown as SdkSeam, "sdk").mockResolvedValue({
    default: FakeOpenAI,
    toFile: async (bytes: Uint8Array, name: string): Promise<SentFile> => ({
      name,
      bytes,
    }),
  });
  return edit;
}

/** The `image` field exactly as it was handed to the API. */
function imageField(edit: EditSpy): SentFile | SentFile[] {
  return edit.mock.calls[0]![0].image;
}

function text(file: SentFile): string {
  return Buffer.from(file.bytes).toString();
}

let seq = 0;

/**
 * Local storage writes into .data/ and PERSISTS between runs, so every key has
 * to be unique or a test passes once and then reads a stale neighbour's bytes.
 */
async function store(prefix: string, contents: string): Promise<string> {
  seq += 1;
  const key = `${prefix}/openai-test-${Date.now()}-${seq}.png`;
  await getStorage().put(
    key,
    new Uint8Array(Buffer.from(contents)),
    "image/png",
  );
  return key;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the breed reference as a second image", () => {
  it("sends the reference alongside the photograph for the back portrait", async () => {
    const uploadKey = await store("uploads", "the customer photograph");
    const referenceKey = await store("references", "the breed side profile");
    const provider = new OpenAIImageProvider();
    const edit = stubSdk(provider);

    await provider.generatePortrait({ uploadKey, side: "back", referenceKey });

    const sent = imageField(edit);
    expect(Array.isArray(sent)).toBe(true);
    const files = sent as SentFile[];
    expect(files).toHaveLength(2);
    // The photograph comes first: it is the animal, and the likeness is the
    // product. The reference is the second input and only informs the pose.
    expect(text(files[0]!)).toBe("the customer photograph");
    expect(text(files[1]!)).toBe("the breed side profile");
  });

  it("draws from the photograph alone when there is no reference", async () => {
    // One of One entries have no reference by design, so this is the ordinary
    // case, not a degraded one. The call must look exactly as it did before.
    const uploadKey = await store("uploads", "the customer photograph");
    const provider = new OpenAIImageProvider();
    const edit = stubSdk(provider);

    await provider.generatePortrait({ uploadKey, side: "back", referenceKey: null });

    const sent = imageField(edit);
    expect(Array.isArray(sent)).toBe(false);
    expect(text(sent as SentFile)).toBe("the customer photograph");
  });

  it("draws from the photograph alone when the reference bytes are missing", async () => {
    // resolveReference in artwork-drawing.ts already filters this case, so
    // getting here means storage disagreed with itself. Still not a failure: a
    // paid order must never fail because an illustration is not drawn yet.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const uploadKey = await store("uploads", "the customer photograph");
    const provider = new OpenAIImageProvider();
    const edit = stubSdk(provider);

    await provider.generatePortrait({
      uploadKey,
      side: "back",
      referenceKey: `references/never-stored-${Date.now()}.png`,
    });

    expect(Array.isArray(imageField(edit))).toBe(false);
    // Loud, because a silent fallback here is a back plate quietly getting worse.
    expect(warn).toHaveBeenCalled();
  });

  it("never sends a reference for the front, which is face on", async () => {
    const uploadKey = await store("uploads", "the customer photograph");
    const provider = new OpenAIImageProvider();
    const edit = stubSdk(provider);

    await provider.generatePortrait({ uploadKey, side: "front" });

    expect(Array.isArray(imageField(edit))).toBe(false);
  });
});
