import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WebAssembly Postgres and `pg` is a native driver: bundling
  // either one breaks them at runtime (PGlite throws `instantiateWasm is not a
  // function`). Keep them as real node_modules requires on the server.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // The print compositor reads font binaries from assets/fonts at runtime to
  // outline glyphs to paths. Next's tracer cannot see a path assembled at
  // runtime, so without this the fonts are absent from the serverless bundle
  // and every plate render fails in production while passing locally. Both
  // globs are listed because the key is matched against the route path and the
  // compositor is reached from nested routes (/api/generate, and fulfilment via
  // /api/payfast/notify). See src/lib/print/fonts.ts.
  outputFileTracingIncludes: {
    "/*": ["./assets/fonts/**"],
    "/**": ["./assets/fonts/**"],
  },
  // No image `remotePatterns`: the storefront renders no remote images. Every
  // photo slot is a local hatched PhotoFrame placeholder pending real
  // photography, so next/image has no external host to allow.
};

export default nextConfig;
