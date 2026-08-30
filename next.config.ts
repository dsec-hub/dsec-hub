import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Vercel rejects request bodies over 4.5MB at the platform edge, before
      // this setting is consulted — so declaring 16MB here was misleading. Keep
      // this in step with MAX_UPLOAD_BYTES in src/lib/uploads.ts. The API's
      // 25MB ATTACHMENT_MAX_UPLOAD_BYTES is unreachable through this path.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
