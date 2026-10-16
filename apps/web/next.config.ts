import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      // Stub optional @coinbase/cdp-sdk transitive deps that are
      // never invoked at runtime (x402 payment + Solana modules).
      "@x402/core/client": "./empty-module.js",
      "@x402/evm": "./empty-module.js",
      "@x402/evm/exact/client": "./empty-module.js",
      "@x402/evm/upto/client": "./empty-module.js",
      "@x402/svm/exact/client": "./empty-module.js",
      "@solana/kit": "./empty-module.js",
    },
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@x402/core/client": false,
      "@x402/evm": false,
      "@x402/evm/exact/client": false,
      "@x402/evm/upto/client": false,
      "@x402/svm/exact/client": false,
      "@solana/kit": false,
    };
    return config;
  },
};

export default nextConfig;
