import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─── Headers ────────────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Service worker: no caching + correcto Content-Type
        source: "/sw.js",
        headers: [
          { key: "Cache-Control",           value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type",            value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed",  value: "/" },
        ],
      },
      {
        // Manifest
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "Content-Type",  value: "application/manifest+json" },
        ],
      },
      {
        // Iconos: cache larga (hash en nombre)
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Seguridad básica en todas las páginas
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
