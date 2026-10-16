import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // PGlite (embedded Postgres used for zero-config local dev) ships WASM and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // …and keep that WASM out of Vercel's serverless bundles: production always uses DATABASE_URL.
  outputFileTracingExcludes: { "*": ["node_modules/@electric-sql/pglite/**"] },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
