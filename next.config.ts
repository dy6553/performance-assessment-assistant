import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "wanhee-wonhee3.vercel.app" }],
        destination: "https://wanhee-two.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
