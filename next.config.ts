import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  headers() {
    return ["/admin/:path*", "/ui-kit/:path*", "/api/:path*"].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
};

export default nextConfig;
