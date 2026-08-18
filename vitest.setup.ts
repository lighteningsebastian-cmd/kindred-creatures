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

// jsdom lacks ResizeObserver (used by PrintLightbox to measure its own box, so
// the zoom can be a fraction of it). The mock never fires, which is correct for
// a test environment with no layout: the component's first measurement reads 0
// and zoomScale answers 1, so the DOM assertions are about behaviour rather
// than about numbers. The numbers are tested in lib/print-zoom.test.ts, where
// they can be tested properly.
if (hasWindow && !("ResizeObserver" in window)) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error - assigning a minimal mock to the global.
  window.ResizeObserver = MockResizeObserver;
  // No ts-expect-error on this one: unlike the IntersectionObserver mock above,
  // this shape satisfies the global's type, and an unused directive is itself a
  // type error.
  global.ResizeObserver = MockResizeObserver;
}

afterEach(() => {
  if (hasWindow) cleanup();
});
