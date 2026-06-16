import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Image uploads flow through a Server Action; the default body cap is 1MB.
      // Allow up to 16MB so the dsec-api MEDIA_MAX_UPLOAD_BYTES (15MB) is the
      // binding limit (clean 413 from the API) rather than a Next.js error.
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
