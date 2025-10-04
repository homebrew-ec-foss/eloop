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
    // Only run ESLint in development
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
