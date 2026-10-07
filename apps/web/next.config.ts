import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@zepply/api-client", "@zepply/core", "@zepply/i18n", "@zepply/reels", "@zepply/tokens", "@zepply/types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
