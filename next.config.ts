import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hsp-ec.xyz',
        port: '',
        pathname: '/**',
      },
      // Allow external HTTPS images from any hostname. This is permissive —
      // prefer listing trusted hosts in production if possible.
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  turbopack: {},
  
  async rewrites() {
    const posthogUiHost = process.env.POSTHOG_UI_HOST || "https://eu.posthog.com"

    const posthogAssetsHost =
      process.env.POSTHOG_UI_HOST ||
      (posthogUiHost.includes("eu.posthog") ? "https://eu-assets.i.posthog.com" : "https://us-assets.i.posthog.com")

    const posthogApiHost =
      process.env.POSTHOG_UI_HOST ||
      (posthogUiHost.includes("eu.posthog") ? "https://eu.i.posthog.com" : "https://us.i.posthog.com")

    return [
      {
        source: "/blob/static/:path*",
        destination: `${posthogAssetsHost}/static/:path*`,
      },
      {
        source: "/blob/:path*",
        destination: `${posthogApiHost}/:path*`,
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
