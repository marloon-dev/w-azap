import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV !== "production";
const isHttps = (process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://");
const uploadLimitMb = Number(process.env.MAX_UPLOAD_SIZE_MB) || 50;

// Next.js injects inline scripts and styles, so 'unsafe-inline' is needed without a nonce setup;
// dev mode (React Refresh) also needs 'unsafe-eval'. Everything else is locked to this origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",          // WhatsApp avatars, custom logo URLs
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",                // Socket.IO
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "bcryptjs"],
  poweredByHeader: false,
  // Dev only: the app is opened via 127.0.0.1 (separate cookies from other local apps on localhost)
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Dev only: keep the Next.js badge away from the sidebar account menu (bottom-left)
  devIndicators: { position: "bottom-right" },
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: `${uploadLimitMb}mb`,
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
