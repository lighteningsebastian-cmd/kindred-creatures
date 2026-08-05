import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    /**
     * Vitest's default is 5 seconds, and a handful of tests in this suite
     * genuinely need longer: the drawing and fulfilment paths rasterise real
     * 3307 x 4134 plates through sharp, against a PGlite database, and there
     * are enough of them that under full-suite parallelism they queue behind
     * each other and time out. They pass every time in isolation.
     *
     * That produced a suite that failed six or seven files on one run and a
     * different six on the next, which is worse than a slow suite: it teaches
     * everybody to re-run until it is green, and a real failure then hides in
     * the noise. `npx vitest run` is a step in the review checklist and it has
     * to mean something.
     */
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
