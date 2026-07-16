import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Node-environment test files (e.g. route handlers) have no window; the DOM
// shims below only apply to jsdom tests.
const hasWindow = typeof window !== "undefined";

// jsdom lacks matchMedia (used by motion's useReducedMotion). Default to
// "no reduced motion" so animation-bearing components render their motion path.
if (hasWindow && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// jsdom lacks IntersectionObserver (used by motion's useInView).
if (hasWindow && !("IntersectionObserver" in window)) {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error - assigning a minimal mock to the global.
  window.IntersectionObserver = MockIntersectionObserver;
  // @ts-expect-error - keep global reference in sync for libraries reading it.
  global.IntersectionObserver = MockIntersectionObserver;
}

afterEach(() => {
  if (hasWindow) cleanup();
});
