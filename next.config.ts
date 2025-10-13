import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Configure webpack to ignore LICENSE files
  webpack: (config) => {
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /LICENSE$/,
      use: 'ignore-loader',
    });
    
    return config;
  },
  
  // Disable ESLint for production build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
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
