import type { NextConfig } from "next";

/**
 * Client components only receive `NEXT_PUBLIC_*` at build time unless we map them.
 * Expo/React Native repos often use `EXPO_PUBLIC_*`; mirror the **non-secret** Cloudinary
 * fields so Library uploads can use browser → Cloudinary when a preset is set.
 * (Never expose API secret to the client — keep using EXPO_/CLOUDINARY_ secret on the server only.)
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
  /** Sparticuz `bin/*.br` must ship with the serverless function (see Sparticuz bundler docs). */
  outputFileTracingIncludes: {
    "/api/reports/daily/pdf": ["./node_modules/@sparticuz/chromium/**"],
    "/reports/daily/pdf": ["./node_modules/@sparticuz/chromium/**"],
    "/api/reports/jsa/pdf": ["./node_modules/@sparticuz/chromium/**"],
    "/reports/jsa/pdf": ["./node_modules/@sparticuz/chromium/**"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    // Supabase (public client env)
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",

    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET:
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "",
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_FOLDER:
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_FOLDER ?? process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_FOLDER ?? "",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      // Supabase Storage and project-specific Cloudinary hostnames (Artifact / field uploads)
      { protocol: "https", hostname: "*.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "*.cloudinary.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
