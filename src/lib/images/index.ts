import type { ImageProvider } from "./provider";
import { MockImageProvider } from "./mock";

export * from "./provider";

/** True when we should use the offline mock rather than a real image service. */
export function usingMockProvider(): boolean {
  return process.env.MOCK_SERVICES === "true" || !process.env.OPENAI_API_KEY;
}

let cached: ImageProvider | null = null;

/**
 * Returns the active image provider: the mock when MOCK_SERVICES is truthy or
 * no OPENAI_API_KEY is set, otherwise the real OpenAI provider. The OpenAI
 * class is only imported when actually selected, so the mock path stays free of
 * the `openai` dependency.
 */
export async function getImageProvider(): Promise<ImageProvider> {
  if (cached) return cached;
  if (usingMockProvider()) {
    cached = new MockImageProvider();
  } else {
    const { OpenAIImageProvider } = await import("./openai");
    cached = new OpenAIImageProvider();
  }
  return cached;
}
