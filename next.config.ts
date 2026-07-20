import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WebAssembly Postgres and `pg` is a native driver: bundling
  // either one breaks them at runtime (PGlite throws `instantiateWasm is not a
  // function`). Keep them as real node_modules requires on the server.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // No image `remotePatterns`: the storefront renders no remote images. Every
  // photo slot is a local hatched PhotoFrame placeholder pending real
  // photography, so next/image has no external host to allow.
};

export default nextConfig;
