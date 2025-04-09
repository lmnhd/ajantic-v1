console.log("NEXT_SERVER_ACTIONS_ENCRYPTION_KEY loaded:", !!process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY);

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['pdf-parse'],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  // Ensure server actions encryption uses the environment variable
  experimental: {
    serverActions: {
      // This will use the NEXT_SERVER_ACTIONS_ENCRYPTION_KEY environment variable
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        // Add your production domain if needed
      ],
    },
  },
};

export default nextConfig;
