import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy.
 *
 * Next injects inline bootstrap/hydration scripts, so `'unsafe-inline'` on
 * script-src cannot be dropped without a nonce-based setup; we use strict-dynamic
 * with a nonce in middleware instead, and keep 'unsafe-inline' only as the
 * ignored-by-modern-browsers fallback for CSP2 clients.
 *
 * `img-src` allows blob:/data: for client-side upload previews, and the storage
 * origin for signed photo URLs.
 */
function contentSecurityPolicy(): string {
  const storageOrigin = safeOrigin(process.env.S3_ENDPOINT);
  const cdnOrigin = safeOrigin(process.env.CDN_BASE_URL);
  const imgSources = ["'self'", "blob:", "data:", storageOrigin, cdnOrigin].filter(
    Boolean,
  );

  return [
    `default-src 'self'`,
    // 'unsafe-eval' is required by React Refresh in development only.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${imgSources.join(" ")}`,
    `font-src 'self' data:`,
    // Photos are uploaded straight to storage; nothing else may be contacted.
    `connect-src 'self'${storageOrigin ? ` ${storageOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    // Server actions post to our own origin only — this is the CSRF backstop.
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ].join("; ");
}

/** Returns the bare origin of a URL, or "" if unset/unparseable. */
function safeOrigin(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Isolate the app from cross-origin popups/embeds.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  // A stray package-lock.json in the user's home directory makes Next infer the
  // wrong workspace root, which breaks file tracing. Pin it to this project.
  turbopack: { root: import.meta.dirname },

  // sharp is a native module; it must not be bundled into the server build.
  serverExternalPackages: ["sharp", "pg-boss", "@node-rs/argon2"],

  // Photos are served exclusively through our authorized signed-URL route, so
  // the built-in image optimizer must never be pointed at a remote host.
  images: { remotePatterns: [] },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Photos must never be indexed (§60), and never cached by shared caches.
        source: "/api/img/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noimageindex" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/portal/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
