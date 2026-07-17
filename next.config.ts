import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WebAssembly Postgres and `pg` is a native driver: bundling
  // either one breaks them at runtime (PGlite throws `instantiateWasm is not a
  // function`). Keep them as real node_modules requires on the server.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      // picsum.photos serves the optimized image via a redirect to fastly.
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
