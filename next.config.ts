import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NEXT_PUBLIC_DISABLE_PWA === "true",
  register: false, // Registered explicitly via PwaRegister component in layout.tsx
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
  },
});

const nextConfig: NextConfig = {};

export default withPWA(nextConfig);
